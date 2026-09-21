const STRIPE_VERSION='2026-07-29.dahlia';
const ACTIVE=new Set(['active','trialing','past_due']);
const AUTH_FALLBACK='https://ep-bitter-cake-axu59msq.neonauth.c-4.us-east-2.aws.neon.tech/afterlight/auth';
const PAYMENT_LINKS={monthly:'https://buy.stripe.com/14AbJ3dy88kJaiSdqkdZ600',annual:'https://buy.stripe.com/eVqdRb2TucAZ62C1HCdZ601'};

function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}})}
function appOrigin(req){return req.headers.get('X-Afterlight-Origin')||req.headers.get('Origin')||'https://afterlight-radio.vercel.app'}
function authBase(){return (process.env.NEON_AUTH_BASE_URL||AUTH_FALLBACK).replace(/\/$/,'')}
function configured(){return {auth:!!authBase(),data:!!process.env.DATABASE_URL,checkout:true,webhook:!!process.env.STRIPE_WEBHOOK_SECRET,portal:!!process.env.STRIPE_RESTRICTED_KEY,externalLibrary:providerConfigured()}}
async function body(req){try{return await req.json()}catch{return {}}}

function providerConfigured(){return !!(process.env.NAVIDROME_BASE_URL&&process.env.NAVIDROME_USERNAME&&process.env.NAVIDROME_TOKEN&&process.env.NAVIDROME_SALT)}
function safeProviderBase(){
  if(!providerConfigured())throw new Error('External music library is not configured');
  const url=new URL(process.env.NAVIDROME_BASE_URL);
  if(url.protocol!=='https:')throw new Error('External music library must use HTTPS');
  const host=url.hostname.toLowerCase();
  if(host==='localhost'||host.endsWith('.localhost')||host==='127.0.0.1'||host==='::1'||host.startsWith('10.')||host.startsWith('192.168.')||/^172\.(1[6-9]|2\d|3[01])\./.test(host)||host.endsWith('.local'))throw new Error('External music library host is not allowed');
  url.pathname=url.pathname.replace(/\/$/,'');
  return url;
}
function providerUrl(endpoint,params={}){
  const base=safeProviderBase(),url=new URL(base.toString());
  url.pathname=base.pathname+'/rest/'+endpoint+'.view';
  const all={u:String(process.env.NAVIDROME_USERNAME),t:String(process.env.NAVIDROME_TOKEN),s:String(process.env.NAVIDROME_SALT),v:'1.16.1',c:String(process.env.NAVIDROME_CLIENT_NAME||'afterlight-radio').slice(0,64),f:'json',...params};
  for(const [key,value] of Object.entries(all))if(value!==undefined&&value!==null)url.searchParams.set(key,String(value));
  return url;
}
async function providerJson(endpoint,params={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
  try{
    const response=await fetch(providerUrl(endpoint,params),{headers:{Accept:'application/json'},redirect:'error',signal:controller.signal});
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw new Error('External library request failed');
    const root=data?.['subsonic-response'];if(!root||root.status!=='ok')throw new Error(root?.error?.message||'External library returned an error');
    return root;
  }finally{clearTimeout(timer)}
}
function normalizedProviderTrack(song){
  if(!song?.id)return null;
  return {id:'navidrome:'+String(song.id),title:String(song.title||'Untitled').slice(0,300),artist:String(song.artist||'').slice(0,300),album:String(song.album||'').slice(0,300),duration:Number.isFinite(Number(song.duration))?Number(song.duration):0,artwork:song.coverArt?'/api/library/provider/artwork?id='+encodeURIComponent(String(song.coverArt)):'',streamUrl:'/api/library/provider/stream?id='+encodeURIComponent(String(song.id)),provider:'navidrome',providerTrackId:String(song.id)};
}
async function providerStatus(req){
  const a=await session(req);if(!a?.user)return json({error:'Sign in required'},401);
  if(!providerConfigured())return json({enabled:false,provider:'navidrome'},200);
  try{const ping=await providerJson('ping');return json({enabled:true,provider:'navidrome',reachable:ping.status==='ok'})}catch{return json({enabled:true,provider:'navidrome',reachable:false},200)}
}
async function providerSearch(req,url){
  const a=await session(req);if(!a?.user)return json({error:'Sign in required'},401);
  if(!providerConfigured())return json({error:'External music library is not configured'},503);
  const q=String(url.searchParams.get('q')||'').trim().slice(0,120);if(q.length<2)return json({error:'Search query must be at least 2 characters'},400);
  try{const root=await providerJson('search3',{query:q,songCount:50,albumCount:0,artistCount:0}),songs=Array.isArray(root.searchResult3?.song)?root.searchResult3.song:[],tracks=songs.map(normalizedProviderTrack).filter(Boolean);return json({provider:'navidrome',query:q,tracks})}
  catch(error){return json({error:error?.name==='AbortError'?'External music library timed out':'External music library request failed'},502)}
}
async function providerBinary(req,url,kind){
  const a=await session(req);if(!a?.user)return json({error:'Sign in required'},401);
  if(!providerConfigured())return json({error:'External music library is not configured'},503);
  const id=String(url.searchParams.get('id')||'').trim();if(!id||id.length>200||!/^[A-Za-z0-9._:-]+$/.test(id))return json({error:'Invalid media id'},400);
  const headers=new Headers();if(kind==='stream'){const range=req.headers.get('Range');if(range)headers.set('Range',range)}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const upstream=await fetch(providerUrl(kind==='artwork'?'getCoverArt':'stream',{id}),{headers,redirect:'error',signal:controller.signal});
    if(!upstream.ok&&upstream.status!==206)return json({error:'External media request failed'},502);
    const out=new Headers({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
    for(const key of ['content-type','content-range','accept-ranges','content-length','etag','last-modified']){const value=upstream.headers.get(key);if(value)out.set(key,value)}
    return new Response(req.method==='HEAD'?null:upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:out});
  }catch(error){return json({error:error?.name==='AbortError'?'External media request timed out':'External media request failed'},502)}
  finally{clearTimeout(timer)}
}

function parseArray(s){if(!s||s==='{}')return [];const x=s.slice(1,-1);if(!x)return [];return x.split(',').map(v=>v.replace(/^"|"$/g,'').replace(/\\"/g,'"').replace(/\\\\/g,'\\'))}
function decode(v,oid){if(v===null)return null;if(oid===16)return v===true||v==='t'||v==='true';if([20,21,23,26,700,701,1700].includes(oid))return Number(v);if(oid===114||oid===3802){try{return typeof v==='string'?JSON.parse(v):v}catch{return v}}if(oid===1009)return Array.isArray(v)?v:parseArray(v);return v}
function prepare(v){if(v===undefined||v===null)return null;if(v instanceof Date)return v.toISOString();if(typeof v==='object')return JSON.stringify(v);return v}
async function query(text,params=[]){
  const cs=process.env.DATABASE_URL;if(!cs)throw new Error('Database is not configured');
  const u=new URL(cs),endpoint='https://'+u.hostname.replace(/^[^.]+\./,'api.')+'/sql';
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Neon-Connection-String':cs,'Neon-Raw-Text-Output':'true','Neon-Array-Mode':'true'},body:JSON.stringify({query:text,params:params.map(prepare)})});
  const data=await r.json().catch(()=>null);if(!r.ok)throw new Error(data?.message||`Database request failed (${r.status})`);
  const fields=data?.fields||[],rows=data?.rows||[];return rows.map(row=>Object.fromEntries(fields.map((f,i)=>[f.name,decode(row[i],f.dataTypeID)])));
}
function sql(strings,...values){let text='';for(let i=0;i<strings.length;i++){text+=strings[i];if(i<values.length)text+='$'+(i+1)}return query(text,values)}

function authHeaders(req,withBody=false){const h=new Headers({Accept:req.headers.get('Accept')||'application/json',Origin:appOrigin(req)});const c=req.headers.get('Cookie');if(c)h.set('Cookie',c);const ua=req.headers.get('User-Agent');if(ua)h.set('User-Agent',ua);if(withBody){const t=req.headers.get('Content-Type');if(t)h.set('Content-Type',t)}return h}
async function authProxy(req,url){const suffix=url.pathname.slice('/api/auth'.length)||'/get-session',target=new URL(authBase()+suffix+url.search),init={method:req.method,headers:authHeaders(req,true),redirect:'manual'};if(!['GET','HEAD'].includes(req.method)){init.body=req.body;init.duplex='half'}const upstream=await fetch(target,init),headers=new Headers(upstream.headers);headers.set('Cache-Control','no-store');const loc=headers.get('location');if(loc&&loc.startsWith(authBase()))headers.set('location',appOrigin(req)+'/api/auth'+loc.slice(authBase().length));return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers})}
async function session(req){const r=await fetch(authBase()+'/get-session',{headers:authHeaders(req),redirect:'manual'});if(!r.ok)return null;const d=await r.json().catch(()=>null);return d?.user?d:null}
async function profile(user){await sql`insert into profiles (user_id,email,updated_at) values (${user.id}::uuid,${user.email||null},now()) on conflict (user_id) do update set email=excluded.email,updated_at=now()`;return (await sql`select user_id,email,stripe_customer_id,created_at,updated_at from profiles where user_id=${user.id}::uuid`)[0]}
async function subscription(userId){return (await sql`select * from subscriptions where user_id=${userId}::uuid`)[0]||null}
async function preference(userId){return (await sql`select * from user_preferences where user_id=${userId}::uuid`)[0]||null}

function adminEmails(){return new Set(String(process.env.AFTERLIGHT_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean))}
function roleHasAdmin(role){return String(role||'').split(/[\s,]+/).some(x=>x.toLowerCase()==='admin')}
function adminIdentity(user){return !!user&&(roleHasAdmin(user.role)||adminEmails().has(String(user.email||'').toLowerCase()))}
async function adminForUser(user){if(adminIdentity(user))return true;if(!user?.id||!process.env.DATABASE_URL)return false;const rows=await sql`select email,role,banned from neon_auth."user" where id=${user.id}::uuid limit 1`;return !!rows[0]&&!rows[0].banned&&adminIdentity(rows[0])}
async function requireAdmin(req){
  const a=await session(req);if(!a?.user)return {response:json({error:'Sign in required'},401)};
  if(!process.env.DATABASE_URL)return {response:json({error:'Admin data is not configured'},503)};
  const rows=await sql`select id,name,email,"emailVerified" as email_verified,role,banned,"createdAt" as created_at from neon_auth."user" where id=${a.user.id}::uuid limit 1`;
  const user=rows[0]||{id:a.user.id,name:a.user.name,email:a.user.email,role:a.user.role,banned:false};
  if(user.banned)return {response:json({error:'Admin access denied'},403)};
  if(!adminIdentity(user))return {response:json({error:'Admin access required'},403)};
  return {auth:a,user};
}
async function adminSummary(req){
  const gate=await requireAdmin(req);if(gate.response)return gate.response;
  const rows=await sql`select
    (select count(*) from neon_auth."user")::int as total_users,
    (select count(*) from neon_auth."user" where "emailVerified" is true)::int as verified_users,
    (select count(*) from neon_auth."user" where "createdAt">=now()-interval '7 days')::int as new_users_7d,
    (select count(*) from subscriptions where status in ('active','trialing','past_due'))::int as active_subscriptions,
    (select count(*) from analytics_events where created_at>=now()-interval '24 hours')::int as events_24h,
    (select count(*) from support_requests where status='open')::int as open_support`;
  return json({...rows[0],admin:{id:gate.user.id,email:gate.user.email,role:gate.user.role||'admin'}});
}
async function adminUsers(req,url){
  const gate=await requireAdmin(req);if(gate.response)return gate.response;
  const q=String(url.searchParams.get('q')||'').trim().slice(0,120).toLowerCase(),pattern='%'+q+'%';
  const limit=Math.max(1,Math.min(100,Number(url.searchParams.get('limit'))||50));
  const offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0));
  const subscriptionAllowed=new Set(['all','free','active','trialing','past_due','canceled']);
  const verifiedAllowed=new Set(['all','verified','unverified']);
  const accountAllowed=new Set(['all','active','banned']);
  const subscriptionFilter=subscriptionAllowed.has(url.searchParams.get('subscription'))?url.searchParams.get('subscription'):'all';
  const verified=verifiedAllowed.has(url.searchParams.get('verified'))?url.searchParams.get('verified'):'all';
  const accountState=accountAllowed.has(url.searchParams.get('account_state'))?url.searchParams.get('account_state'):'all';
  const countRows=await sql`select count(*)::int as total from neon_auth."user" u left join subscriptions s on s.user_id=u.id
    where (${q}='' or lower(u.email) like ${pattern} or lower(u.name) like ${pattern} or u.id::text like ${pattern})
      and (${subscriptionFilter}='all' or coalesce(s.status,'free')=${subscriptionFilter})
      and (${verified}='all' or (${verified}='verified' and u."emailVerified" is true) or (${verified}='unverified' and u."emailVerified" is false))
      and (${accountState}='all' or (${accountState}='banned' and coalesce(u.banned,false) is true) or (${accountState}='active' and coalesce(u.banned,false) is false))`;
  const users=await sql`with activity as (
      select user_id,count(*)::int as event_count,max(created_at) as last_activity from analytics_events where user_id is not null group by user_id
    ), support as (
      select user_id,count(*)::int as support_count,count(*) filter(where status='open')::int as open_support from support_requests where user_id is not null group by user_id
    )
    select u.id,u.name,u.email,u."emailVerified" as email_verified,u.role,coalesce(u.banned,false) as banned,u."createdAt" as created_at,u."updatedAt" as updated_at,
      coalesce(s.status,'free') as subscription_status,s.plan,s.current_period_end,s.cancel_at_period_end,(p.stripe_customer_id is not null) as has_billing_profile,
      coalesce(cardinality(pref.favorites),0)::int as favorites_count,pref.last_room,pref.last_track,pref.updated_at as preference_updated_at,
      coalesce(a.event_count,0)::int as event_count,a.last_activity,coalesce(sp.support_count,0)::int as support_count,coalesce(sp.open_support,0)::int as open_support
    from neon_auth."user" u
    left join profiles p on p.user_id=u.id left join subscriptions s on s.user_id=u.id left join user_preferences pref on pref.user_id=u.id
    left join activity a on a.user_id=u.id left join support sp on sp.user_id=u.id
    where (${q}='' or lower(u.email) like ${pattern} or lower(u.name) like ${pattern} or u.id::text like ${pattern})
      and (${subscriptionFilter}='all' or coalesce(s.status,'free')=${subscriptionFilter})
      and (${verified}='all' or (${verified}='verified' and u."emailVerified" is true) or (${verified}='unverified' and u."emailVerified" is false))
      and (${accountState}='all' or (${accountState}='banned' and coalesce(u.banned,false) is true) or (${accountState}='active' and coalesce(u.banned,false) is false))
    order by u."createdAt" desc,u.id limit ${limit} offset ${offset}`;
  return json({total:countRows[0]?.total||0,offset,limit,users});
}

async function stripe(path,params){if(!process.env.STRIPE_RESTRICTED_KEY)throw new Error('Stripe portal is not configured');const form=new URLSearchParams();for(const [k,v] of Object.entries(params||{}))if(v!==undefined&&v!==null)form.set(k,String(v));const r=await fetch('https://api.stripe.com/v1/'+path,{method:'POST',headers:{Authorization:'Bearer '+process.env.STRIPE_RESTRICTED_KEY,'Stripe-Version':STRIPE_VERSION,'Content-Type':'application/x-www-form-urlencoded'},body:form});const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||'Stripe request failed');return d}
async function me(req){const a=await session(req);if(!a?.user)return json({error:'Sign in required'},401);const p=await profile(a.user),sub=await subscription(a.user.id),pref=await preference(a.user.id),admin=await adminForUser(a.user),premium=!!sub&&ACTIVE.has(sub.status)&&(!sub.current_period_end||new Date(sub.current_period_end).getTime()>Date.now());return json({user:{id:a.user.id,email:a.user.email,name:a.user.name},profile:p,subscription:sub,premium,preferences:pref,admin})}
async function preferences(req){const a=await session(req);if(!a?.user)return json({error:'Sign in required'},401);if(req.method==='GET')return json({preferences:await preference(a.user.id)});const x=await body(req),favorites=Array.isArray(x.favorites)?x.favorites.slice(0,30).map(String):[],csv=favorites.join(',');const rows=await sql`insert into user_preferences (user_id,favorites,last_room,last_track,volume,muted,timer_end,updated_at) values (${a.user.id}::uuid,coalesce(string_to_array(${csv},','),array[]::text[]),${String(x.last_room||'rooftop').slice(0,64)},${Math.max(0,Math.min(2,Number(x.last_track)||0))},${Math.max(0,Math.min(100,Number(x.volume)||0))},${!!x.muted},${x.timer_end||null}::timestamptz,now()) on conflict (user_id) do update set favorites=excluded.favorites,last_room=excluded.last_room,last_track=excluded.last_track,volume=excluded.volume,muted=excluded.muted,timer_end=excluded.timer_end,updated_at=now() returning *`;return json({preferences:rows[0]})}
async function checkout(req){const a=await session(req);if(!a?.user)return json({error:'Sign in required'},401);const x=await body(req),plan=x.plan==='annual'?'annual':'monthly',u=new URL(PAYMENT_LINKS[plan]);u.searchParams.set('client_reference_id',a.user.id);if(a.user.email)u.searchParams.set('locked_prefilled_email',a.user.email);return json({url:u.toString(),mode:'payment_link'})}
async function portal(req){const a=await session(req);if(!a?.user)return json({error:'Sign in required'},401);const p=await profile(a.user);if(!p.stripe_customer_id)return json({error:'No billing account found'},404);if(!process.env.STRIPE_RESTRICTED_KEY)return json({error:'Billing portal is awaiting Stripe account activation'},503);const d=await stripe('billing_portal/sessions',{customer:p.stripe_customer_id,return_url:appOrigin(req)+'/account/'});return json({url:d.url})}
async function events(req){if(!process.env.DATABASE_URL)return json({accepted:true},202);const a=await session(req),x=await body(req),allowed=new Set(['page_view','play','pause','favorite','timer_set','upgrade_view','checkout_started','checkout_return','sign_in','sign_up','client_error','offline_room_saved','offline_room_removed','queue_repeat_one','queue_finished','queue_shuffle_changed','queue_repeat_changed','library_opened','library_track_selected']),event=allowed.has(x.event)?x.event:'unknown';await sql`insert into analytics_events (user_id,session_id,event_name,room_slug,properties,created_at) values (${a?.user?.id||null}::uuid,${String(x.session_id||'').slice(0,128)||null},${event},${x.room_slug?String(x.room_slug).slice(0,64):null},${JSON.stringify(typeof x.properties==='object'&&x.properties?x.properties:{})}::jsonb,now())`;return json({accepted:true},202)}
async function support(req){const x=await body(req),email=String(x.email||'').trim().slice(0,320),message=String(x.message||'').trim().slice(0,5000),subject=String(x.subject||'General').trim().slice(0,120);if(!email.includes('@')||message.length<10)return json({error:'Please provide a valid email and a little more detail.'},400);const a=await session(req);await sql`insert into support_requests (user_id,email,subject,message,status,created_at) values (${a?.user?.id||null}::uuid,${email},${subject},${message},'open',now())`;return json({ok:true},201)}

function hex(bytes){return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function safeEq(a,b){if(!a||!b||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
async function verifyStripe(raw,sig,secret){const pairs=(sig||'').split(',').map(p=>p.split('=',2)),t=pairs.find(p=>p[0]==='t')?.[1],v1=pairs.find(p=>p[0]==='v1')?.[1];if(!t||!v1||Math.abs(Date.now()/1000-Number(t))>300)return false;const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),mac=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(t+'.'+raw));return safeEq(hex(mac),v1)}
async function userByCustomer(customer){if(!customer)return null;return (await sql`select user_id from profiles where stripe_customer_id=${customer} limit 1`)[0]?.user_id||null}
async function syncSubscription(obj){let userId=obj.metadata?.user_id||await userByCustomer(typeof obj.customer==='string'?obj.customer:obj.customer?.id);if(!userId)return;const customer=typeof obj.customer==='string'?obj.customer:obj.customer?.id||null,period=obj.current_period_end?new Date(obj.current_period_end*1000).toISOString():null;await sql`insert into subscriptions (user_id,stripe_customer_id,stripe_subscription_id,plan,status,current_period_end,cancel_at_period_end,updated_at) values (${userId}::uuid,${customer},${obj.id},${obj.metadata?.plan||'unknown'},${obj.status},${period}::timestamptz,${!!obj.cancel_at_period_end},now()) on conflict (user_id) do update set stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,plan=excluded.plan,status=excluded.status,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=now()`;if(customer)await sql`insert into profiles (user_id,stripe_customer_id,updated_at) values (${userId}::uuid,${customer},now()) on conflict (user_id) do update set stripe_customer_id=excluded.stripe_customer_id,updated_at=now()`}
async function webhook(req){const raw=await req.text(),secret=process.env.STRIPE_WEBHOOK_SECRET;if(!secret||!await verifyStripe(raw,req.headers.get('Stripe-Signature'),secret))return json({error:'Invalid signature'},400);const event=JSON.parse(raw),obj=event.data?.object||{};if(event.type==='checkout.session.completed'){const userId=obj.client_reference_id||obj.metadata?.user_id,customer=typeof obj.customer==='string'?obj.customer:obj.customer?.id,subId=typeof obj.subscription==='string'?obj.subscription:obj.subscription?.id,plan=obj.metadata?.plan||'unknown';if(userId&&customer){await sql`insert into profiles (user_id,stripe_customer_id,updated_at) values (${userId}::uuid,${customer},now()) on conflict (user_id) do update set stripe_customer_id=excluded.stripe_customer_id,updated_at=now()`;if(subId)await sql`insert into subscriptions (user_id,stripe_customer_id,stripe_subscription_id,plan,status,updated_at) values (${userId}::uuid,${customer},${subId},${plan},'active',now()) on conflict (user_id) do update set stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,plan=excluded.plan,status='active',updated_at=now()`}}if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type))await syncSubscription(obj);return json({received:true})}

async function route(req){const url=new URL(req.url),p=url.pathname;if(p.startsWith('/api/auth/'))return authProxy(req,url);if(p==='/api/health')return json({ok:true,configured:configured(),backend:'neon-function'});if(p==='/api/ready'){const c=configured();let database=false;if(c.data)try{database=(await sql`select 1 as ok`)[0]?.ok===1}catch{}return json({ok:c.auth&&database&&c.checkout&&c.webhook,auth:c.auth,database,checkout:c.checkout,webhook:c.webhook,portal:c.portal,backend:'neon-function'})}if(p==='/api/config'){const c=configured();return json({authEnabled:c.auth,billingEnabled:c.checkout,portalEnabled:c.portal,webhookEnabled:c.webhook,supportEnabled:c.data,externalLibraryEnabled:c.externalLibrary})}if(p==='/api/me'&&req.method==='GET')return me(req);if(p==='/api/preferences'&&['GET','PUT'].includes(req.method))return preferences(req);if(p==='/api/checkout'&&req.method==='POST')return checkout(req);if(p==='/api/portal'&&req.method==='POST')return portal(req);if(p==='/api/events'&&req.method==='POST')return events(req);if(p==='/api/admin/summary'&&req.method==='GET')return adminSummary(req);if(p==='/api/admin/users'&&req.method==='GET')return adminUsers(req,url);if(p==='/api/library/provider/status'&&req.method==='GET')return providerStatus(req);if(p==='/api/library/provider/search'&&req.method==='GET')return providerSearch(req,url);if(p==='/api/library/provider/stream'&&['GET','HEAD'].includes(req.method))return providerBinary(req,url,'stream');if(p==='/api/library/provider/artwork'&&['GET','HEAD'].includes(req.method))return providerBinary(req,url,'artwork');if(p==='/api/support'&&req.method==='POST')return support(req);if(p==='/api/stripe/webhook'&&req.method==='POST')return webhook(req);return json({error:'Not found'},404)}

export default{async fetch(request){try{return await route(request)}catch(error){console.error(error);return json({error:'Internal server error'},500)}}};
