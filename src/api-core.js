import { neon } from '@neondatabase/serverless';

const STRIPE_VERSION='2026-07-29.dahlia';
const ACTIVE=new Set(['active','trialing','past_due']);
const PAYMENT_LINKS={
  monthly:'https://buy.stripe.com/14AbJ3dy88kJaiSdqkdZ600',
  annual:'https://buy.stripe.com/eVqdRb2TucAZ62C1HCdZ601'
};

function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}})}
function configured(env){return {auth:!!env.NEON_AUTH_BASE_URL,data:!!env.DATABASE_URL,checkout:!!(PAYMENT_LINKS.monthly&&PAYMENT_LINKS.annual),webhook:!!env.STRIPE_WEBHOOK_SECRET,portal:!!env.STRIPE_RESTRICTED_KEY,externalLibrary:providerConfigured(env)}}
function appOrigin(req){return req.headers.get('X-Afterlight-Origin')||req.headers.get('Origin')||new URL(req.url).origin}
function originOf(req){return appOrigin(req)}
async function body(req){try{return await req.json()}catch{return {}}}
function db(env){if(!env.DATABASE_URL)throw new Error('Database is not configured');return neon(env.DATABASE_URL)}

function providerConfigured(env){
  return !!(env.NAVIDROME_BASE_URL&&env.NAVIDROME_USERNAME&&env.NAVIDROME_TOKEN&&env.NAVIDROME_SALT);
}
function safeProviderBase(env){
  if(!providerConfigured(env))throw new Error('External music library is not configured');
  const url=new URL(env.NAVIDROME_BASE_URL);
  if(url.protocol!=='https:')throw new Error('External music library must use HTTPS');
  const host=url.hostname.toLowerCase();
  if(host==='localhost'||host.endsWith('.localhost')||host==='127.0.0.1'||host==='::1'||host.startsWith('10.')||host.startsWith('192.168.')||/^172\.(1[6-9]|2\d|3[01])\./.test(host)||host.endsWith('.local')){
    throw new Error('External music library host is not allowed');
  }
  url.pathname=url.pathname.replace(/\/$/,'');
  return url;
}
function providerParams(env){
  return {
    u:String(env.NAVIDROME_USERNAME),
    t:String(env.NAVIDROME_TOKEN),
    s:String(env.NAVIDROME_SALT),
    v:'1.16.1',
    c:String(env.NAVIDROME_CLIENT_NAME||'afterlight-radio').slice(0,64),
    f:'json'
  };
}
function providerUrl(env,endpoint,params={}){
  const base=safeProviderBase(env);
  const url=new URL(base.toString());
  url.pathname=base.pathname+'/rest/'+endpoint+'.view';
  const all={...providerParams(env),...params};
  for(const [key,value] of Object.entries(all))if(value!==undefined&&value!==null)url.searchParams.set(key,String(value));
  return url;
}
async function providerJson(env,endpoint,params={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),7000);
  try{
    const response=await fetch(providerUrl(env,endpoint,params),{headers:{Accept:'application/json'},redirect:'error',signal:controller.signal});
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw new Error('External library request failed');
    const root=data?.['subsonic-response'];
    if(!root||root.status!=='ok')throw new Error(root?.error?.message||'External library returned an error');
    return root;
  }finally{clearTimeout(timer)}
}
function validProviderId(value){
  const id=String(value||'').trim();
  return id&&id.length<=200&&/^[A-Za-z0-9._:-]+$/.test(id)?id:'';
}
function normalizedProviderTrack(song){
  if(!song?.id)return null;
  const providerTrackId=String(song.id);
  return {
    id:'navidrome:'+providerTrackId,
    title:String(song.title||'Untitled').slice(0,300),
    artist:String(song.artist||'').slice(0,300),
    album:String(song.album||'').slice(0,300),
    duration:Number.isFinite(Number(song.duration))?Number(song.duration):0,
    artwork:song.coverArt?'/api/library/provider/artwork?id='+encodeURIComponent(String(song.coverArt)):'',
    streamUrl:'/api/library/provider/stream?id='+encodeURIComponent(providerTrackId),
    lyricsUrl:'/api/library/provider/lyrics?id='+encodeURIComponent(providerTrackId),
    provider:'navidrome',
    providerTrackId
  };
}
function normalizedProviderLyrics(root,providerTrackId){
  const source=Array.isArray(root?.lyricsList?.structuredLyrics)?root.lyricsList.structuredLyrics:[];
  const tracks=[];
  let remainingLines=4000;
  for(const entry of source.slice(0,8)){
    if(remainingLines<=0)break;
    const rawLines=Array.isArray(entry?.line)?entry.line:[];
    const lines=[];
    for(const line of rawLines.slice(0,remainingLines)){
      const text=String(line?.value??'').slice(0,2000);
      const start=Number(line?.start);
      if(!text&&!Number.isFinite(start))continue;
      lines.push({startMs:Number.isFinite(start)&&start>=0?Math.round(start):null,text});
    }
    remainingLines-=lines.length;
    const offset=Number(entry?.offset);
    const rawLang=String(entry?.lang||'und').trim().slice(0,32);
    tracks.push({
      lang:rawLang==='xxx'?'und':rawLang||'und',
      synced:!!entry?.synced,
      offsetMs:Number.isFinite(offset)?Math.max(-600000,Math.min(600000,Math.round(offset))):0,
      displayArtist:String(entry?.displayArtist||'').slice(0,300),
      displayTitle:String(entry?.displayTitle||'').slice(0,300),
      lines
    });
  }
  return {provider:'navidrome',providerTrackId,tracks,available:tracks.some(track=>track.lines.length>0)};
}
async function providerStatus(req,env){
  const auth=await authSession(req,env);if(!auth?.user)return json({error:'Sign in required'},401);
  if(!providerConfigured(env))return json({enabled:false,provider:'navidrome'},200);
  try{
    const ping=await providerJson(env,'ping');
    return json({enabled:true,provider:'navidrome',reachable:ping.status==='ok'});
  }catch{return json({enabled:true,provider:'navidrome',reachable:false},200)}
}
async function providerSearch(req,env,url){
  const auth=await authSession(req,env);if(!auth?.user)return json({error:'Sign in required'},401);
  if(!providerConfigured(env))return json({error:'External music library is not configured'},503);
  const q=String(url.searchParams.get('q')||'').trim().slice(0,120);
  if(q.length<2)return json({error:'Search query must be at least 2 characters'},400);
  try{
    const root=await providerJson(env,'search3',{query:q,songCount:50,albumCount:0,artistCount:0});
    const songs=Array.isArray(root.searchResult3?.song)?root.searchResult3.song:[];
    const tracks=songs.map(normalizedProviderTrack).filter(Boolean);
    return json({provider:'navidrome',query:q,tracks});
  }catch(error){return json({error:error?.name==='AbortError'?'External music library timed out':'External music library request failed'},502)}
}
async function providerLyrics(req,env,url){
  const auth=await authSession(req,env);if(!auth?.user)return json({error:'Sign in required'},401);
  if(!providerConfigured(env))return json({error:'External music library is not configured'},503);
  const id=validProviderId(url.searchParams.get('id'));
  if(!id)return json({error:'Invalid media id'},400);
  try{
    const root=await providerJson(env,'getLyricsBySongId',{id});
    return json(normalizedProviderLyrics(root,id));
  }catch(error){
    return json({error:error?.name==='AbortError'?'External lyrics request timed out':'External lyrics request failed'},502);
  }
}
async function providerBinary(req,env,url,kind){
  const auth=await authSession(req,env);if(!auth?.user)return json({error:'Sign in required'},401);
  if(!providerConfigured(env))return json({error:'External music library is not configured'},503);
  const id=validProviderId(url.searchParams.get('id'));
  if(!id)return json({error:'Invalid media id'},400);
  const endpoint=kind==='artwork'?'getCoverArt':'stream';
  const headers=new Headers();
  if(kind==='stream'){
    const range=req.headers.get('Range');if(range)headers.set('Range',range);
  }
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const upstream=await fetch(providerUrl(env,endpoint,{id}),{headers,redirect:'error',signal:controller.signal});
    if(!upstream.ok&&upstream.status!==206)return json({error:'External media request failed'},502);
    const out=new Headers({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
    for(const key of ['content-type','content-range','accept-ranges','content-length','etag','last-modified']){
      const value=upstream.headers.get(key);if(value)out.set(key,value);
    }
    return new Response(req.method==='HEAD'?null:upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:out});
  }catch(error){
    return json({error:error?.name==='AbortError'?'External media request timed out':'External media request failed'},502);
  }finally{clearTimeout(timer)}
}

function authHeaders(req,includeContent=false){
  const headers=new Headers({Accept:req.headers.get('Accept')||'application/json'});
  const cookie=req.headers.get('Cookie');if(cookie)headers.set('Cookie',cookie);
  const ua=req.headers.get('User-Agent');if(ua)headers.set('User-Agent',ua);
  headers.set('Origin',appOrigin(req));
  if(includeContent){const type=req.headers.get('Content-Type');if(type)headers.set('Content-Type',type)}
  return headers;
}
async function authProxy(req,env,url){
  if(!env.NEON_AUTH_BASE_URL)return json({error:'Authentication is not configured'},503);
  const suffix=url.pathname.slice('/api/auth'.length)||'/get-session';
  const target=new URL(env.NEON_AUTH_BASE_URL.replace(/\/$/,'')+suffix+url.search);
  const init={method:req.method,headers:authHeaders(req,true),redirect:'manual'};
  if(req.method!=='GET'&&req.method!=='HEAD')init.body=req.body;
  const upstream=await fetch(target,init);
  const outHeaders=new Headers(upstream.headers);outHeaders.set('Cache-Control','no-store');
  const location=outHeaders.get('location');
  if(location&&location.startsWith(env.NEON_AUTH_BASE_URL))outHeaders.set('location',appOrigin(req)+'/api/auth'+location.slice(env.NEON_AUTH_BASE_URL.length));
  return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:outHeaders});
}
async function authSession(req,env){
  if(!env.NEON_AUTH_BASE_URL)return null;
  const r=await fetch(env.NEON_AUTH_BASE_URL.replace(/\/$/,'')+'/get-session',{headers:authHeaders(req),redirect:'manual'});
  if(!r.ok)return null;const data=await r.json().catch(()=>null);return data?.user?data:null;
}
async function ensureProfile(user,env){
  const sql=db(env);
  await sql`insert into profiles (user_id,email,updated_at) values (${user.id}::uuid,${user.email||null},now()) on conflict (user_id) do update set email=excluded.email,updated_at=now()`;
  const rows=await sql`select user_id,email,stripe_customer_id,created_at,updated_at from profiles where user_id=${user.id}::uuid`;return rows[0];
}
async function subscriptionFor(userId,env){const sql=db(env),rows=await sql`select * from subscriptions where user_id=${userId}::uuid`;return rows[0]||null}
async function preferenceFor(userId,env){const sql=db(env),rows=await sql`select * from user_preferences where user_id=${userId}::uuid`;return rows[0]||null}

async function stripe(env,path,params){
  if(!env.STRIPE_RESTRICTED_KEY)throw new Error('Stripe is not configured');
  const form=new URLSearchParams();for(const [k,v] of Object.entries(params||{}))if(v!==undefined&&v!==null)form.set(k,String(v));
  const r=await fetch('https://api.stripe.com/v1/'+path,{method:'POST',headers:{Authorization:'Bearer '+env.STRIPE_RESTRICTED_KEY,'Stripe-Version':STRIPE_VERSION,'Content-Type':'application/x-www-form-urlencoded'},body:form});
  const data=await r.json();if(!r.ok)throw new Error(data?.error?.message||'Stripe request failed');return data;
}

async function me(req,env){
  const auth=await authSession(req,env);if(!auth?.user)return json({error:'Sign in required'},401);
  const profile=await ensureProfile(auth.user,env),subscription=await subscriptionFor(auth.user.id,env),preferences=await preferenceFor(auth.user.id,env);
  const premium=!!subscription&&ACTIVE.has(subscription.status)&&(!subscription.current_period_end||new Date(subscription.current_period_end).getTime()>Date.now());
  return json({user:{id:auth.user.id,email:auth.user.email,name:auth.user.name},profile,subscription,premium,preferences});
}
async function preferences(req,env){
  const auth=await authSession(req,env);if(!auth?.user)return json({error:'Sign in required'},401);
  if(req.method==='GET')return json({preferences:await preferenceFor(auth.user.id,env)});
  const x=await body(req),favorites=Array.isArray(x.favorites)?x.favorites.slice(0,30).map(String):[],favCsv=favorites.join(',');
  const sql=db(env);
  const rows=await sql`insert into user_preferences (user_id,favorites,last_room,last_track,volume,muted,timer_end,updated_at)
    values (${auth.user.id}::uuid,coalesce(string_to_array(${favCsv},','),array[]::text[]),${String(x.last_room||'rooftop').slice(0,64)},${Math.max(0,Math.min(2,Number(x.last_track)||0))},${Math.max(0,Math.min(100,Number(x.volume)||0))},${!!x.muted},${x.timer_end||null}::timestamptz,now())
    on conflict (user_id) do update set favorites=excluded.favorites,last_room=excluded.last_room,last_track=excluded.last_track,volume=excluded.volume,muted=excluded.muted,timer_end=excluded.timer_end,updated_at=now()
    returning *`;
  return json({preferences:rows[0]});
}
async function checkout(req,env){
  const auth=await authSession(req,env);if(!auth?.user)return json({error:'Sign in required'},401);
  const x=await body(req),plan=x.plan==='annual'?'annual':'monthly',base=PAYMENT_LINKS[plan];if(!base)return json({error:'Checkout is not configured'},503);
  const u=new URL(base);u.searchParams.set('client_reference_id',auth.user.id);if(auth.user.email)u.searchParams.set('locked_prefilled_email',auth.user.email);
  return json({url:u.toString(),mode:'payment_link'});
}
async function portal(req,env){
  const auth=await authSession(req,env);if(!auth?.user)return json({error:'Sign in required'},401);
  const profile=await ensureProfile(auth.user,env);if(!profile.stripe_customer_id)return json({error:'No billing account found'},404);
  if(!env.STRIPE_RESTRICTED_KEY)return json({error:'Billing portal is awaiting Stripe account activation'},503);
  const p=await stripe(env,'billing_portal/sessions',{customer:profile.stripe_customer_id,return_url:originOf(req)+'/account/'});return json({url:p.url});
}
async function events(req,env){
  if(!env.DATABASE_URL)return json({accepted:true},202);
  const auth=await authSession(req,env),x=await body(req),allowed=new Set(['page_view','play','pause','favorite','timer_set','upgrade_view','checkout_started','checkout_return','sign_in','sign_up','client_error','offline_room_saved','offline_room_removed','queue_repeat_one','queue_finished','queue_shuffle_changed','queue_repeat_changed','library_opened','library_track_selected']),event=allowed.has(x.event)?x.event:'unknown',sql=db(env);
  await sql`insert into analytics_events (user_id,session_id,event_name,room_slug,properties,created_at) values (${auth?.user?.id||null}::uuid,${String(x.session_id||'').slice(0,128)||null},${event},${x.room_slug?String(x.room_slug).slice(0,64):null},${JSON.stringify(typeof x.properties==='object'&&x.properties?x.properties:{})}::jsonb,now())`;
  return json({accepted:true},202);
}
function hex(bytes){return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function safeEq(a,b){if(!a||!b||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
async function verifyStripe(raw,signature,secret){
  const pairs=(signature||'').split(',').map(p=>p.split('=',2)),t=pairs.find(p=>p[0]==='t')?.[1],v1=pairs.find(p=>p[0]==='v1')?.[1];if(!t||!v1||Math.abs(Date.now()/1000-Number(t))>300)return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(t+'.'+raw));return safeEq(hex(sig),v1);
}
async function resolveUserByCustomer(customer,env){if(!customer)return null;const sql=db(env),rows=await sql`select user_id from profiles where stripe_customer_id=${customer} limit 1`;return rows[0]?.user_id||null}
async function syncSubscription(obj,env){
  let userId=obj.metadata?.user_id||null;if(!userId)userId=await resolveUserByCustomer(typeof obj.customer==='string'?obj.customer:obj.customer?.id,env);if(!userId)return;
  const customer=typeof obj.customer==='string'?obj.customer:obj.customer?.id||null,period=obj.current_period_end?new Date(obj.current_period_end*1000).toISOString():null,sql=db(env);
  await sql`insert into subscriptions (user_id,stripe_customer_id,stripe_subscription_id,plan,status,current_period_end,cancel_at_period_end,updated_at)
    values (${userId}::uuid,${customer},${obj.id},${obj.metadata?.plan||'unknown'},${obj.status},${period}::timestamptz,${!!obj.cancel_at_period_end},now())
    on conflict (user_id) do update set stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,plan=excluded.plan,status=excluded.status,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=now()`;
  if(customer)await sql`insert into profiles (user_id,stripe_customer_id,updated_at) values (${userId}::uuid,${customer},now()) on conflict (user_id) do update set stripe_customer_id=excluded.stripe_customer_id,updated_at=now()`;
}
async function webhook(req,env){
  const raw=await req.text(),signature=req.headers.get('Stripe-Signature');if(!env.STRIPE_WEBHOOK_SECRET||!await verifyStripe(raw,signature,env.STRIPE_WEBHOOK_SECRET))return json({error:'Invalid signature'},400);
  const event=JSON.parse(raw),obj=event.data?.object||{};
  if(event.type==='checkout.session.completed'){
    const userId=obj.client_reference_id||obj.metadata?.user_id,customer=typeof obj.customer==='string'?obj.customer:obj.customer?.id,subscription=typeof obj.subscription==='string'?obj.subscription:obj.subscription?.id,plan=obj.metadata?.plan||'unknown';
    if(userId&&customer){
      const sql=db(env);
      await sql`insert into profiles (user_id,stripe_customer_id,updated_at) values (${userId}::uuid,${customer},now()) on conflict (user_id) do update set stripe_customer_id=excluded.stripe_customer_id,updated_at=now()`;
      if(subscription)await sql`insert into subscriptions (user_id,stripe_customer_id,stripe_subscription_id,plan,status,updated_at) values (${userId}::uuid,${customer},${subscription},${plan},'active',now()) on conflict (user_id) do update set stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,plan=excluded.plan,status='active',updated_at=now()`;
    }
  }
  if(event.type==='customer.subscription.created'||event.type==='customer.subscription.updated'||event.type==='customer.subscription.deleted')await syncSubscription(obj,env);
  return json({received:true});
}
async function support(req,env){
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const x=await body(req),email=String(x.email||'').trim().slice(0,320),message=String(x.message||'').trim().slice(0,5000),subject=String(x.subject||'General').trim().slice(0,120);
  if(!email.includes('@')||message.length<10)return json({error:'Please provide a valid email and a little more detail.'},400);
  const auth=await authSession(req,env),sql=db(env);
  await sql`insert into support_requests (user_id,email,subject,message,status,created_at) values (${auth?.user?.id||null}::uuid,${email},${subject},${message},'open',now())`;
  return json({ok:true},201);
}
async function api(req,env,url){
  if(url.pathname.startsWith('/api/auth/'))return authProxy(req,env,url);
  if(url.pathname==='/api/health')return json({ok:true,configured:configured(env),backend:'neon'});
  if(url.pathname==='/api/ready'){const c=configured(env);let database=false;if(c.data)try{const sql=db(env);const rows=await sql`select 1 as ok`;database=rows?.[0]?.ok===1}catch{}return json({ok:c.auth&&database&&c.checkout&&c.webhook,auth:c.auth,database,checkout:c.checkout,webhook:c.webhook,portal:c.portal,backend:'neon'})}
  if(url.pathname==='/api/config'){const c=configured(env);return json({authEnabled:c.auth,billingEnabled:c.checkout,portalEnabled:c.portal,webhookEnabled:c.webhook,supportEnabled:c.data,externalLibraryEnabled:c.externalLibrary})}
  if(url.pathname==='/api/me'&&req.method==='GET')return me(req,env);
  if(url.pathname==='/api/preferences'&&(req.method==='GET'||req.method==='PUT'))return preferences(req,env);
  if(url.pathname==='/api/checkout'&&req.method==='POST')return checkout(req,env);
  if(url.pathname==='/api/portal'&&req.method==='POST')return portal(req,env);
  if(url.pathname==='/api/events'&&req.method==='POST')return events(req,env);
  if(url.pathname==='/api/library/provider/status'&&req.method==='GET')return providerStatus(req,env);
  if(url.pathname==='/api/library/provider/search'&&req.method==='GET')return providerSearch(req,env,url);
  if(url.pathname==='/api/library/provider/lyrics'&&req.method==='GET')return providerLyrics(req,env,url);
  if(url.pathname==='/api/library/provider/stream'&&(req.method==='GET'||req.method==='HEAD'))return providerBinary(req,env,url,'stream');
  if(url.pathname==='/api/library/provider/artwork'&&(req.method==='GET'||req.method==='HEAD'))return providerBinary(req,env,url,'artwork');
  if(url.pathname==='/api/support'&&req.method==='POST')return support(req,env);
  if(url.pathname==='/api/stripe/webhook'&&req.method==='POST')return webhook(req,env);
  return json({error:'Not found'},404);
}

export async function handleApi(req,env){const url=new URL(req.url);return api(req,env,url)}
