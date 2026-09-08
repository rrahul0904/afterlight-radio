import { neon } from '@neondatabase/serverless';

const STRIPE_VERSION='2026-07-29.dahlia';
const ACTIVE=new Set(['active','trialing','past_due']);

function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}})}
function configured(env){return {auth:!!env.NEON_AUTH_BASE_URL,data:!!env.DATABASE_URL,billing:!!(env.STRIPE_RESTRICTED_KEY&&env.STRIPE_WEBHOOK_SECRET&&env.STRIPE_PRICE_MONTHLY&&env.STRIPE_PRICE_ANNUAL)}}
function originOf(req){return new URL(req.url).origin}
async function body(req){try{return await req.json()}catch{return {}}}
function db(env){if(!env.DATABASE_URL)throw new Error('Database is not configured');return neon(env.DATABASE_URL)}

async function authProxy(req,env,url){
  if(!env.NEON_AUTH_BASE_URL)return json({error:'Authentication is not configured'},503);
  const suffix=url.pathname.slice('/api/auth'.length)||'/get-session';
  const target=new URL(env.NEON_AUTH_BASE_URL.replace(/\/$/,'')+suffix+url.search);
  const headers=new Headers(req.headers);headers.delete('host');
  const init={method:req.method,headers,redirect:'manual'};
  if(req.method!=='GET'&&req.method!=='HEAD')init.body=req.body;
  const upstream=await fetch(target,init);
  const outHeaders=new Headers(upstream.headers);outHeaders.set('Cache-Control','no-store');
  const location=outHeaders.get('location');
  if(location&&location.startsWith(env.NEON_AUTH_BASE_URL))outHeaders.set('location',originOf(req)+'/api/auth'+location.slice(env.NEON_AUTH_BASE_URL.length));
  return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:outHeaders});
}
async function authSession(req,env){
  if(!env.NEON_AUTH_BASE_URL)return null;
  const headers=new Headers({Accept:'application/json'});
  const cookie=req.headers.get('Cookie');if(cookie)headers.set('Cookie',cookie);
  const origin=req.headers.get('Origin')||originOf(req);headers.set('Origin',origin);
  const r=await fetch(env.NEON_AUTH_BASE_URL.replace(/\/$/,'')+'/get-session',{headers,redirect:'manual'});
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
async function stripeGet(env,path){const r=await fetch('https://api.stripe.com/v1/'+path,{headers:{Authorization:'Bearer '+env.STRIPE_RESTRICTED_KEY,'Stripe-Version':STRIPE_VERSION}});const data=await r.json();if(!r.ok)throw new Error(data?.error?.message||'Stripe request failed');return data}

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
  const x=await body(req),plan=x.plan==='annual'?'annual':'monthly',price=plan==='annual'?env.STRIPE_PRICE_ANNUAL:env.STRIPE_PRICE_MONTHLY;if(!price)return json({error:'Billing plan is not configured'},503);
  const profile=await ensureProfile(auth.user,env),origin=originOf(req),params={mode:'subscription','line_items[0][price]':price,'line_items[0][quantity]':1,success_url:origin+'/?checkout=success&session_id={CHECKOUT_SESSION_ID}',cancel_url:origin+'/?checkout=cancelled',client_reference_id:auth.user.id,'metadata[user_id]':auth.user.id,'metadata[plan]':plan,'subscription_data[metadata][user_id]':auth.user.id,'subscription_data[metadata][plan]':plan,allow_promotion_codes:'true',integration_identifier:'afterlight_web_qmztuvwx'};
  if(profile.stripe_customer_id)params.customer=profile.stripe_customer_id;else params.customer_email=auth.user.email;
  const session=await stripe(env,'checkout/sessions',params);return json({url:session.url,id:session.id});
}
async function portal(req,env){
  const auth=await authSession(req,env);if(!auth?.user)return json({error:'Sign in required'},401);
  const profile=await ensureProfile(auth.user,env);if(!profile.stripe_customer_id)return json({error:'No billing account found'},404);
  const p=await stripe(env,'billing_portal/sessions',{customer:profile.stripe_customer_id,return_url:originOf(req)+'/'});return json({url:p.url});
}
async function events(req,env){
  if(!env.DATABASE_URL)return json({accepted:true},202);
  const auth=await authSession(req,env),x=await body(req),allowed=new Set(['page_view','play','pause','favorite','timer_set','upgrade_view','checkout_started','checkout_return','sign_in','sign_up','client_error']),event=allowed.has(x.event)?x.event:'unknown',sql=db(env);
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
    const userId=obj.client_reference_id||obj.metadata?.user_id,customer=typeof obj.customer==='string'?obj.customer:obj.customer?.id;
    if(userId&&customer){const sql=db(env);await sql`insert into profiles (user_id,stripe_customer_id,updated_at) values (${userId}::uuid,${customer},now()) on conflict (user_id) do update set stripe_customer_id=excluded.stripe_customer_id,updated_at=now()`}
    if(obj.subscription)try{await syncSubscription(await stripeGet(env,'subscriptions/'+obj.subscription),env)}catch(e){console.error('subscription sync',e)}
  }
  if(event.type==='customer.subscription.created'||event.type==='customer.subscription.updated'||event.type==='customer.subscription.deleted')await syncSubscription(obj,env);
  return json({received:true});
}
async function api(req,env,url){
  if(url.pathname.startsWith('/api/auth/'))return authProxy(req,env,url);
  if(url.pathname==='/api/health')return json({ok:true,configured:configured(env),backend:'neon'});
  if(url.pathname==='/api/config')return json({authEnabled:configured(env).auth,billingEnabled:configured(env).billing,supportEmail:env.SUPPORT_EMAIL||''});
  if(url.pathname==='/api/me'&&req.method==='GET')return me(req,env);
  if(url.pathname==='/api/preferences'&&(req.method==='GET'||req.method==='PUT'))return preferences(req,env);
  if(url.pathname==='/api/checkout'&&req.method==='POST')return checkout(req,env);
  if(url.pathname==='/api/portal'&&req.method==='POST')return portal(req,env);
  if(url.pathname==='/api/events'&&req.method==='POST')return events(req,env);
  if(url.pathname==='/api/stripe/webhook'&&req.method==='POST')return webhook(req,env);
  return json({error:'Not found'},404);
}
export default{async fetch(req,env){try{const url=new URL(req.url);if(url.pathname.startsWith('/api/'))return await api(req,env,url);return env.ASSETS.fetch(req)}catch(e){console.error(e);return json({error:'Internal server error'},500)}}};