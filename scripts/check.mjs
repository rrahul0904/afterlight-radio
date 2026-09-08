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
for(const p of ['privacy','terms','support'])await access(path.join(pub,p,'index.html'));

const html=await readFile(path.join(root,'index.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)],runtime=scripts.at(-1)?.[1];
if(!runtime)throw new Error('Inline runtime missing');
new Function(runtime);

const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const wrangler=JSON.parse(await readFile(path.join(root,'wrangler.jsonc'),'utf8'));
if(pkg.scripts.build!=='node scripts/build.mjs')throw new Error('Unexpected build command');
if(wrangler.main!=='src/worker.js'||wrangler.assets?.directory!=='./public'||wrangler.assets?.binding!=='ASSETS')throw new Error('Wrangler backend/static config mismatch');

for(const slug of slugs)if(!html.includes(`slug:'${slug}'`))throw new Error('Room missing: '+slug);
if((html.match(/slug:'/g)||[]).length!==12)throw new Error('Need exactly 12 rooms');

for(const needle of ['new Audio()',"setAttribute('playsinline','')","if(i<0)i=5","new Set(['rooftop','window','roma'])",'id="favorite"','id="timerBtn"','id="shareBtn"','id="upgrade"','id="account"','data-plan="monthly"','data-plan="annual"','/api/checkout','/api/preferences','/audio/']){
  if(!html.includes(needle))throw new Error('MVP surface missing: '+needle);
}

const worker=await readFile(path.join(root,'src/worker.js'),'utf8');
for(const needle of ['/api/health','/api/config','/api/me','/api/preferences','/api/checkout','/api/portal','/api/events','/api/stripe/webhook','Stripe-Signature','2026-07-29.dahlia']){
  if(!worker.includes(needle))throw new Error('Worker capability missing: '+needle);
}
const migration=await readFile(path.join(root,'supabase/migrations/20260908_afterlight_mvp.sql'),'utf8');
for(const needle of ['enable row level security','profiles_select_own','preferences_update_own','subscriptions_select_own','analytics_events']){
  if(!migration.includes(needle))throw new Error('Supabase security/schema missing: '+needle);
}
console.log('PASS: 12 routes, 36 audio files, auth/account UI, premium gating, timers/favorites/share, Cloudflare API, Stripe webhook/checkout contract, Supabase RLS, legal pages');
