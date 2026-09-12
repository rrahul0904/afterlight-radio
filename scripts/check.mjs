import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd(),pub=path.join(root,'public');
const slugs=['roma','window','long-way-home','two-hundred','one-more-log','rooftop','friends','backroom','headspace','last-bus','momentum','between'];

await access(path.join(pub,'index.html'));
for(const slug of slugs){
  await access(path.join(pub,slug,'index.html'));
  for(let t=1;t<=3;t++){
    const p=path.join(pub,'audio',slug,t+'.wav'),s=await stat(p);
    if(s.size<500000)throw new Error('Audio asset too small: '+p);
    const h=await readFile(p);
    if(h.subarray(0,4).toString()!=='RIFF'||h.subarray(8,12).toString()!=='WAVE')throw new Error('Invalid WAV: '+p);
  }
}
for(const p of ['privacy','terms','support','account'])await access(path.join(pub,p,'index.html'));

const html=await readFile(path.join(root,'index.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)],runtime=scripts.at(-1)?.[1];
if(!runtime)throw new Error('Inline runtime missing');
new Function(runtime);

const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const wrangler=JSON.parse(await readFile(path.join(root,'wrangler.jsonc'),'utf8'));
if(pkg.scripts.build!=='node scripts/build.mjs')throw new Error('Unexpected build command');
if(pkg.dependencies?.['@neondatabase/serverless']!=='1.1.0')throw new Error('Cloudflare Neon driver must remain pinned');
if(wrangler.main!=='src/worker.js'||wrangler.assets?.directory!=='./public'||wrangler.assets?.binding!=='ASSETS')throw new Error('Wrangler backend/static config mismatch');
if(!wrangler.vars?.NEON_AUTH_BASE_URL?.includes('.neonauth.'))throw new Error('Neon Auth base URL missing');
if(wrangler.vars?.STRIPE_PRICE_MONTHLY!=='price_1UDVEkRB8OGmEnBw7xEw07J0'||wrangler.vars?.STRIPE_PRICE_ANNUAL!=='price_1UDVEmRB8OGmEnBwO1DeztjQ')throw new Error('Stripe price IDs drifted');

for(const slug of slugs)if(!html.includes(`slug:'${slug}'`))throw new Error('Room missing: '+slug);
if((html.match(/slug:'/g)||[]).length!==12)throw new Error('Need exactly 12 rooms');
for(const needle of ['new Audio()',"setAttribute('playsinline','')","if(i<0)i=5","new Set(['rooftop','window','roma'])",'id="favorite"','id="timerBtn"','id="shareBtn"','id="upgrade"','id="account"','id="loginPassword"','data-plan="monthly"','data-plan="annual"','/api/auth/','sign-in/email','sign-up/email','/api/checkout','/api/preferences','/audio/']){
  if(!html.includes(needle))throw new Error('MVP surface missing: '+needle);
}
if(html.includes('SUPABASE_')||html.includes('/auth/v1/'))throw new Error('Stale Supabase auth code remains in browser');

const worker=await readFile(path.join(root,'src/worker.js'),'utf8');
const core=await readFile(path.join(root,'src/api-core.js'),'utf8');
const vercel=await readFile(path.join(root,'api/index.js'),'utf8');
const neonFn=await readFile(path.join(root,'functions/afterlight-lite.mjs'),'utf8');
const runtimeSecrets=JSON.parse(await readFile(path.join(root,'api/runtime-secrets.json'),'utf8'));
const vercelConfig=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));

for(const needle of ["/api/auth/","/get-session","/api/health","/api/ready","/api/config","/api/me","/api/preferences","/api/checkout","/api/portal","/api/events","/api/support","/api/stripe/webhook","Stripe-Signature","2026-07-29.dahlia","buy.stripe.com","locked_prefilled_email"]){
  if(!core.includes(needle))throw new Error('Cloudflare API core capability missing: '+needle);
}
if(!core.includes("from '@neondatabase/serverless'"))throw new Error('Cloudflare Neon runtime import missing');
if(!worker.includes('handleApi'))throw new Error('Cloudflare adapter must call shared API core');
if(worker.includes('SUPABASE_')||core.includes('SUPABASE_'))throw new Error('Stale Supabase backend remains');

const neonBackend='https://br-proud-breeze-axhwv7rx-afterlightapi.compute.c-4.us-east-2.aws.neon.tech';
for(const needle of [neonBackend,'X-Afterlight-Origin','bodyParser:false','getSetCookie','stripe-signature'])if(!vercel.includes(needle))throw new Error('Vercel Neon proxy missing: '+needle);
if(vercel.includes('runtime-secrets.json')||vercel.includes('DATABASE_URL'))throw new Error('Vercel proxy must not depend on database secrets');
if(Object.keys(runtimeSecrets).length!==0)throw new Error('Tracked runtime-secrets.json must remain empty');
if(vercelConfig.outputDirectory!=='public'||vercelConfig.rewrites?.[0]?.destination!=='/api?path=:path*')throw new Error('Vercel routing config mismatch');

for(const needle of ['Neon-Connection-String','Neon-Raw-Text-Output','DATABASE_URL','STRIPE_WEBHOOK_SECRET','/api/ready','/api/support','/api/stripe/webhook','backend:\'neon-function\'','buy.stripe.com'])if(!neonFn.includes(needle))throw new Error('Production Neon Function missing: '+needle);
new Function(neonFn.replace(/export default[\s\S]*$/,''));

const migration=await readFile(path.join(root,'neon/migrations/20260908_afterlight_mvp.sql'),'utf8');
for(const needle of ['references neon_auth."user"(id)','user_preferences','subscriptions','analytics_events','support_requests'])if(!migration.includes(needle))throw new Error('Neon schema missing: '+needle);

const account=await readFile(path.join(root,'account.html'),'utf8');
for(const needle of ['/api/me','/api/portal','/api/auth/sign-in/email','Saved places','Manage billing'])if(!account.includes(needle))throw new Error('Account portal missing: '+needle);
const support=await readFile(path.join(root,'legal/support.html'),'utf8');
for(const needle of ['/api/support','supportForm','Subscription cancellation','Received. Your support request has been saved.'])if(!support.includes(needle))throw new Error('Support surface missing: '+needle);
const privacy=await readFile(path.join(root,'legal/privacy.html'),'utf8');
for(const needle of ['Vercel','Neon','Stripe'])if(!privacy.includes(needle))throw new Error('Privacy processor disclosure missing: '+needle);
if(privacy.includes('Supabase'))throw new Error('Stale Supabase processor remains in privacy notice');
const terms=await readFile(path.join(root,'legal/terms.html'),'utf8');
for(const needle of ['Afterlight Support','When Stripe self-service billing is available','When self-service billing is unavailable','Subscription cancellation'])if(!terms.includes(needle))throw new Error('Terms must describe billing management and fallback accurately: '+needle);
for(const page of ['privacy','terms','support','account']){
  const built=await readFile(path.join(pub,page,'index.html'),'utf8');
  if(built.includes('#756b5f')||built.includes('#766d61'))throw new Error('Low-contrast secondary text remains in built '+page+' page');
}

console.log('PASS: 12 routes, account portal, support intake, 36 audio files, first-party Neon Auth, production Neon Function/Postgres, Vercel proxy, Cloudflare fallback, premium gating, Stripe payment links/webhook contract, accurate legal processors/billing fallback, accessible secondary-page contrast');
