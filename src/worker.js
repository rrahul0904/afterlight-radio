const STRIPE_VERSION='2026-07-29.dahlia';
const ACTIVE=new Set(['active','trialing','past_due']);
function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}})}
function configured(env){return {auth:!!(env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY),data:!!(env.SUPABASE_URL&&env.SUPABASE_SECRET_KEY),billing:!!(env.STRIPE_RESTRICTED_KEY&&env.STRIPE_WEBHOOK_SECRET&&env.STRIPE_PRICE_MONTHLY&&env.STRIPE_PRICE_ANNUAL)}}
function originOf(req){return new URL(req.url).origin}
async function body(req){try{return await req.json()}catch{return {}}}
function bearer(req){const h=req.headers.get('Authorization')||'';return h.startsWith('Bearer ')?h.slice(7):null}
async function supa(env,path,{method='GET',body:payload,prefer}={}){
  if(!env.SUPABASE_URL||!env.SUPABASE_SECRET_KEY)throw new Error('Data backend is not configured');
  const headers={apikey:env.SUPABASE_SECRET_KEY,Accept:'application/json'};
  if(payload!==undefined)headers['Content-Type']='application/json';
  if(prefer)headers.Prefer=prefer;
  const r=await fetch(env.SUPABASE_URL+'/rest/v1/'+path,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload)});
  const raw=await r.text();let data=null;try{data=raw?JSON.parse(raw):null}catch{data=raw}
  if(!r.ok)throw new Error('Supabase '+r.status+': '+(data?.message||data?.error||raw||'request failed'));
  return data;
}
async function authUser(req,env){
  const token=bearer(req);if(!token||!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)return null;
  const r=await fetch(env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token,Accept:'application/json'}});
  return r.ok?await r.json():null;
}
async function ensureProfile(user,env){
  const payload={user_id:user.id,email:user.email||null,updated_at:new Date().toISOString()};
  await supa(env,'profiles?on_conflict=user_id',{method:'POST',body:[payload],prefer:'resolution=merge-duplicates,return=minimal'});
  const rows=await supa(env,'profiles?user_id=eq.'+encodeURIComponent(user.id)+'&select=*');return rows?.[0]||payload;
}
async function subscriptionFor(userId,env){const rows=await supa(env,'subscriptions?user_id=eq.'+encodeURIComponent(userId)+'&select=*');return rows?.[0]||null}
async function preferenceFor(userId,env){const rows=await supa(env,'user_preferences?user_id=eq.'+encodeURIComponent(userId)+'&select=*');return rows?.[0]||null}
async function stripe(env,path,params){
  if(!env.STRIPE_RESTRICTED_KEY)throw new Error('Stripe is not configured');
  const form=new URLSearchParams();for(const [k,v] of Object.entries(params||{}))if(v!==undefined&&v!==null)form.set(k,String(v));
  const r=await fetch('https://api.stripe.com/v1/'+path,{method:'POST',headers:{Authorization:'Bearer '+env.STRIPE_RESTRICTED_KEY,'Stripe-Version':STRIPE_VERSION,'Content-Type':'application/x-www-form-urlencoded'},body:form});
  const data=await r.json();if(!r.ok)throw new Error(data?.error?.message||'Stripe request failed');return data;
}
async function stripeGet(env,path){const r=await fetch('https://api.stripe.com/v1/'+path,{headers:{Authorization:'Bearer '+env.STRIPE_RESTRICTED_KEY,'Stripe-Version':STRIPE_VERSION}});const data=await r.json();if(!r.ok)throw new Error(data?.error?.message||'Stripe request failed');return data}
async function checkout(req,env){
  const user=await authUser(req,env);if(!user)return json({error:'Sign in required'},401);
  const x=await body(req),plan=x.plan==='annual'?'annual':'monthly',price=plan==='annual'?env.STRIPE_PRICE_ANNUAL:env.STRIPE_PRICE_MONTHLY;if(!price)return json({error:'Billing plan is not configured'},503);
  const profile=await ensureProfile(user,env),origin=originOf(req),params={mode:'subscription','line_items[0][price]':price,'line_items[0][quantity]':1,success_url:origin+'/?checkout=success&session_id={CHECKOUT_SESSION_ID}',cancel_url:origin+'/?checkout=cancelled',client_reference_id:user.id,'metadata[user_id]':user.id,'metadata[plan]':plan,'subscription_data[metadata][user_id]':user.id,'subscription_data[metadata][plan]':plan,allow_promotion_codes:'true',integration_identifier:'afterlight_web_qmztuvwx'};
  if(profile.stripe_customer_id)params.customer=profile.stripe_customer_id;else params.customer_email=user.email;
  const session=await stripe(env,'checkout/sessions',params);return json({url:session.url,id:session.id});
}
async function portal(req,env){
  const user=await authUser(req,env);if(!user)return json({error:'Sign in required'},401);
  const profile=await ensureProfile(user,env);if(!profile.stripe_customer_id)return json({error:'No billing account found'},404);
  const p=await stripe(env,'billing_portal/sessions',{customer:profile.stripe_customer_id,return_url:originOf(req)+'/'});return json({url:p.url});
}
async function me(req,env){
  const user=await authUser(req,env);if(!user)return json({error:'Sign in required'},401);
  const profile=await ensureProfile(user,env),subscription=await subscriptionFor(user.id,env),preferences=await preferenceFor(user.id,env);
  const premium=!!subscription&&ACTIVE.has(subscription.status)&&(!subscription.current_period_end||Date.parse(subscription.current_period_end)>Date.now());
  return json({user:{id:user.id,email:user.email},profile,subscription,premium,preferences});
}
async function preferences(req,env){
  const user=await authUser(req,env);if(!user)return json({error:'Sign in required'},401);
  if(req.method==='GET')return json({preferences:await preferenceFor(user.id,env)});
  const x=await body(req),payload={user_id:user.id,favorites:Array.isArray(x.favorites)?x.favorites.slice(0,30):[],last_room:String(x.last_room||'rooftop').slice(0,64),last_track:Math.max(0,Math.min(2,Number(x.last_track)||0)),volume:Math.max(0,Math.min(100,Number(x.volume)||0)),muted:!!x.muted,timer_end:x.timer_end||null,updated_at:new Date().toISOString()};
  const rows=await supa(env,'user_preferences?on_conflict=user_id',{method:'POST',body:[payload],prefer:'resolution=merge-duplicates,return=representation'});return json({preferences:rows?.[0]||payload});
}
async function events(req,env){
  if(!env.SUPABASE_URL||!env.SUPABASE_SECRET_KEY)return json({accepted:true},202);
  const user=await authUser(req,env),x=await body(req),allowed=new Set(['page_view','play','pause','favorite','timer_set','upgrade_view','checkout_started','checkout_return','sign_in_link_sent','client_error']),event=allowed.has(x.event)?x.event:'unknown';
  await supa(env,'analytics_events',{method:'POST',body:[{user_id:user?.id||null,session_id:String(x.session_id||'').slice(0,128)||null,event_name:event,room_slug:x.room_slug?String(x.room_slug).slice(0,64):null,properties:typeof x.properties==='object'&&x.properties?x.properties:{},created_at:new Date().toISOString()}],prefer:'return=minimal'});return json({accepted:true},202);
}
function hex(bytes){return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function safeEq(a,b){if(!a||!b||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
async function verifyStripe(raw,signature,secret){
  const pairs=(signature||'').split(',').map(p=>p.split('=',2)),t=pairs.find(p=>p[0]==='t')?.[1],v1=pairs.find(p=>p[0]==='v1')?.[1];if(!t||!v1||Math.abs(Date.now()/1000-Number(t))>300)return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(t+'.'+raw));return safeEq(hex(sig),v1);
}
async function resolveUserByCustomer(customer,env){if(!customer)return null;const rows=await supa(env,'profiles?stripe_customer_id=eq.'+encodeURIComponent(customer)+'&select=user_id');return rows?.[0]?.user_id||null}
async function syncSubscription(obj,env){
  let userId=obj.metadata?.user_id||null;if(!userId)userId=await resolveUserByCustomer(obj.customer,env);if(!userId)return;
  const payload={user_id:userId,stripe_customer_id:typeof obj.customer==='string'?obj.customer:obj.customer?.id||null,stripe_subscription_id:obj.id,plan:obj.metadata?.plan||'unknown',status:obj.status,current_period_end:obj.current_period_end?new Date(obj.current_period_end*1000).toISOString():null,cancel_at_period_end:!!obj.cancel_at_period_end,updated_at:new Date().toISOString()};
  await supa(env,'subscriptions?on_conflict=user_id',{method:'POST',body:[payload],prefer:'resolution=merge-duplicates,return=minimal'});
  if(payload.stripe_customer_id)await supa(env,'profiles?on_conflict=user_id',{method:'POST',body:[{user_id:userId,stripe_customer_id:payload.stripe_customer_id,updated_at:new Date().toISOString()}],prefer:'resolution=merge-duplicates,return=minimal'});
}
async function webhook(req,env){
  const raw=await req.text(),signature=req.headers.get('Stripe-Signature');if(!env.STRIPE_WEBHOOK_SECRET||!await verifyStripe(raw,signature,env.STRIPE_WEBHOOK_SECRET))return json({error:'Invalid signature'},400);
  const event=JSON.parse(raw),obj=event.data?.object||{};
  if(event.type==='checkout.session.completed'){const userId=obj.client_reference_id||obj.metadata?.user_id;if(userId&&obj.customer)await supa(env,'profiles?on_conflict=user_id',{method:'POST',body:[{user_id:userId,stripe_customer_id:typeof obj.customer==='string'?obj.customer:obj.customer.id,updated_at:new Date().toISOString()}],prefer:'resolution=merge-duplicates,return=minimal'});if(obj.subscription)try{await syncSubscription(await stripeGet(env,'subscriptions/'+obj.subscription),env)}catch(e){console.error('subscription sync',e)}}
  if(event.type==='customer.subscription.created'||event.type==='customer.subscription.updated'||event.type==='customer.subscription.deleted')await syncSubscription(obj,env);
  return json({received:true});
}
async function api(req,env,url){
  if(url.pathname==='/api/health')return json({ok:true,configured:configured(env)});
  if(url.pathname==='/api/config')return json({authEnabled:configured(env).auth,billingEnabled:configured(env).billing,supabaseUrl:env.SUPABASE_URL||'',supabasePublishableKey:env.SUPABASE_PUBLISHABLE_KEY||'',supportEmail:env.SUPPORT_EMAIL||''});
  if(url.pathname==='/api/me'&&req.method==='GET')return me(req,env);
  if(url.pathname==='/api/preferences'&&(req.method==='GET'||req.method==='PUT'))return preferences(req,env);
  if(url.pathname==='/api/checkout'&&req.method==='POST')return checkout(req,env);
  if(url.pathname==='/api/portal'&&req.method==='POST')return portal(req,env);
  if(url.pathname==='/api/events'&&req.method==='POST')return events(req,env);
  if(url.pathname==='/api/stripe/webhook'&&req.method==='POST')return webhook(req,env);
  return json({error:'Not found'},404);
}
export default{async fetch(req,env){try{const url=new URL(req.url);if(url.pathname.startsWith('/api/'))return await api(req,env,url);return env.ASSETS.fetch(req)}catch(e){console.error(e);return json({error:'Internal server error'},500)}}};