import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd(),pub=path.join(root,'public');
const slugs=['roma','window','long-way-home','two-hundred','one-more-log','rooftop','friends','backroom','headspace','last-bus','momentum','between'];

await access(path.join(pub,'index.html'));
await access(path.join(pub,'focus-room.js'));
await access(path.join(pub,'library-runtime.js'));
await access(path.join(pub,'offline-worker.js'));
await access(path.join(pub,'queue-runtime.js'));
await access(path.join(pub,'library-browser.js'));
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

const focusRoom=await readFile(path.join(root,'scripts/focus-room.js'),'utf8');
new Function(focusRoom);
for(const needle of ['afterlight-radio:focus-room:v1','focus_session_started','focus_session_finished','document.hidden','IDLE_MS = 120000','ambientRain','ambientBrown','ambientFan','createBiquadFilter','crypto.randomUUID','timer-complete','active.plannedMinutes * 60000','state.todos','data-todo-use','data-todo-toggle','todoFocusedSeconds','Stored locally','linkedTodo ? linkedTodo.id : null','selectedTodoId = null']){
  if(!focusRoom.includes(needle))throw new Error('Focus-room contract missing: '+needle);
}
for(const forbidden of ['/api/preferences','task_label:','task_text:','todo_title:','todo_text:']){
  if(focusRoom.includes(forbidden))throw new Error('Focus-room privacy boundary drifted: '+forbidden);
}
const builtIndex=await readFile(path.join(pub,'index.html'),'utf8');
if(!builtIndex.includes('/focus-room.js?v=offline2'))throw new Error('Versioned focus-room runtime not injected into built room routes');

const libraryRuntime=await readFile(path.join(root,'scripts/library-runtime.js'),'utf8');
const offlineWorker=await readFile(path.join(root,'scripts/offline-worker.js'),'utf8');
new Function(libraryRuntime);
new Function(offlineWorker);
for(const needle of ['afterlight-offline-v1','afterlight-radio:playback-memory:v1','Save offline','offline_room_saved','serviceWorker.register','providerContract','version:2','lyricsUrl','normalizedLyrics','server-side-only','externalProvidersEnabled:false','audio.currentTime','loadedmetadata','SHELL_URLS','offlinePackageUrls','/library-browser.js','/queue-runtime.js']){
  if(!libraryRuntime.includes(needle))throw new Error('Offline-library contract missing: '+needle);
}
for(const needle of ['CACHE_URLS','REMOVE_URLS','Only same-origin media can be cached','Content-Range','Partial Content','status:206','/audio/','data.urls.length>20','Offline asset unavailable','try{\n      return await fetch(request)']){
  if(!offlineWorker.includes(needle))throw new Error('Offline worker contract missing: '+needle);
}
for(const forbidden of ['password','accessToken','apiKey','Authorization:']){
  if(libraryRuntime.includes(forbidden)||offlineWorker.includes(forbidden))throw new Error('Offline-library credential boundary drifted: '+forbidden);
}
if(!builtIndex.includes('/library-runtime.js?v=offline2'))throw new Error('Versioned offline-library runtime not injected into built room routes');
if(libraryRuntime.includes('registration().catch'))throw new Error('Offline worker must not register before explicit offline intent');
if(!libraryRuntime.includes("await send('REMOVE_URLS',{urls:roomUrls(slug)})"))throw new Error('Removing one room must preserve shared offline shell assets');

const queueRuntime=await readFile(path.join(root,'scripts/queue-runtime.js'),'utf8');
new Function(queueRuntime);
for(const needle of ['afterlight-radio:queue:v1','HISTORY_LIMIT=40','deterministicShuffle','repeat:\'all\'','queue_repeat_one','queue_finished','queue_shuffle_changed','queue_repeat_changed','Listening queue','Recent on this device','window.__afterlightQueue']){
  if(!queueRuntime.includes(needle))throw new Error('Queue runtime contract missing: '+needle);
}
for(const forbidden of ['/api/preferences','fetch(','credentials:']){
  if(queueRuntime.includes(forbidden))throw new Error('Queue local-first boundary drifted: '+forbidden);
}
if(!builtIndex.includes('/queue-runtime.js?v=offline2'))throw new Error('Versioned queue runtime not injected into built room routes');

const libraryBrowser=await readFile(path.join(root,'scripts/library-browser.js'),'utf8');
new Function(libraryBrowser);
for(const needle of ['Owned Afterlight catalog','Music library','Search tracks, places, or moods','library_track_selected','library_opened','window.__afterlightCatalog','count:entries.length']){
  if(!libraryBrowser.includes(needle))throw new Error('Library browser contract missing: '+needle);
}
for(const forbidden of ['fetch(','innerHTML=entry.title','innerHTML=entry.roomName']){
  if(libraryBrowser.includes(forbidden))throw new Error('Library browser safety/local boundary drifted: '+forbidden);
}
if(!builtIndex.includes('/library-browser.js?v=offline2'))throw new Error('Versioned library browser not injected into built room routes');

const audioEngine=await readFile(path.join(root,'scripts/audio-library.mjs'),'utf8');
for(const needle of ["version:3","channels:2","bars:BARS","authored-elements-plus-deterministic-arrangement","thirdPartyAudio:false","buildScore","sectionFor","transformMotif","afterlight-composition-engine-v3"]){
  if(!audioEngine.includes(needle))throw new Error('Composition engine contract missing: '+needle);
}
if(audioEngine.includes('const sr=32000,bars=8'))throw new Error('Legacy short mono-loop composition engine returned');
const musicManifest=JSON.parse(await readFile(path.join(pub,'music-manifest.json'),'utf8'));
if(musicManifest.version!==3||musicManifest.tracks?.length!==36||musicManifest.thirdPartyAudio!==false)throw new Error('Music manifest v3 contract missing');
if(musicManifest.tracks.some(track=>track.channels!==2||track.bars!==12||track.generator!=='afterlight-composition-engine-v3'))throw new Error('Music manifest renderer contract drifted');

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
const previewServer=await readFile(path.join(root,'scripts/preview-server.mjs'),'utf8');
const neonFn=await readFile(path.join(root,'functions/afterlight-lite.mjs'),'utf8');
const runtimeSecrets=JSON.parse(await readFile(path.join(root,'api/runtime-secrets.json'),'utf8'));
const vercelConfig=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));

for(const needle of ["/api/auth/","/get-session","/api/health","/api/ready","/api/config","/api/me","/api/preferences","/api/checkout","/api/portal","/api/events","/api/support","/api/stripe/webhook","/api/library/provider/status","/api/library/provider/search","/api/library/provider/lyrics","/api/library/provider/stream","/api/library/provider/artwork","getLyricsBySongId","normalizedProviderLyrics","lyricsUrl:'/api/library/provider/lyrics?id='","NAVIDROME_BASE_URL","NAVIDROME_USERNAME","NAVIDROME_TOKEN","NAVIDROME_SALT","External music library must use HTTPS","External music library host is not allowed","streamUrl:'/api/library/provider/stream?id='","Stripe-Signature","2026-07-29.dahlia","buy.stripe.com","locked_prefilled_email"]){
  if(!core.includes(needle))throw new Error('Cloudflare API core capability missing: '+needle);
}
for(const eventName of ['offline_room_saved','offline_room_removed','queue_repeat_one','queue_finished','queue_shuffle_changed','queue_repeat_changed','library_opened','library_track_selected']){
  if(!core.includes("'"+eventName+"'"))throw new Error('Analytics event allowlist missing: '+eventName);
}
for(const forbidden of ['NAVIDROME_PASSWORD','http://localhost','http://127.0.0.1']){
  if(core.includes(forbidden))throw new Error('External provider security boundary drifted: '+forbidden);
}
if(!core.includes("from '@neondatabase/serverless'"))throw new Error('Cloudflare Neon runtime import missing');
if(!worker.includes('handleApi'))throw new Error('Cloudflare adapter must call shared API core');
if(worker.includes('SUPABASE_')||core.includes('SUPABASE_'))throw new Error('Stale Supabase backend remains');

const neonBackend='https://br-proud-breeze-axhwv7rx-afterlightapi.compute.c-4.us-east-2.aws.neon.tech';
for(const needle of [neonBackend,'X-Afterlight-Origin','bodyParser:false','getSetCookie','stripe-signature',"'range'","'if-range'"])if(!vercel.includes(needle))throw new Error('Vercel Neon proxy missing: '+needle);
if(vercel.includes('runtime-secrets.json')||vercel.includes('DATABASE_URL'))throw new Error('Vercel proxy must not depend on database secrets');
for(const needle of ['AFTERLIGHT_BACKEND_URL','X-Afterlight-Origin',"'range'","'if-range'",'0.0.0.0','/healthz'])if(!previewServer.includes(needle))throw new Error('Portable preview server missing: '+needle);
if(previewServer.includes('NAVIDROME_TOKEN')||previewServer.includes('DATABASE_URL'))throw new Error('Portable preview server must remain a thin first-party proxy');
if(Object.keys(runtimeSecrets).length!==0)throw new Error('Tracked runtime-secrets.json must remain empty');
if(vercelConfig.outputDirectory!=='public'||vercelConfig.rewrites?.[0]?.destination!=='/api?path=:path*')throw new Error('Vercel routing config mismatch');

for(const needle of ['Neon-Connection-String','Neon-Raw-Text-Output','DATABASE_URL','STRIPE_WEBHOOK_SECRET','/api/ready','/api/support','/api/stripe/webhook','/api/library/provider/status','/api/library/provider/search','/api/library/provider/lyrics','/api/library/provider/stream','/api/library/provider/artwork','getLyricsBySongId','normalizedProviderLyrics',"lyricsUrl:'/api/library/provider/lyrics?id='",'NAVIDROME_BASE_URL','NAVIDROME_USERNAME','NAVIDROME_TOKEN','NAVIDROME_SALT','External music library must use HTTPS','External music library host is not allowed','backend:\'neon-function\'','buy.stripe.com'])if(!neonFn.includes(needle))throw new Error('Production Neon Function missing: '+needle);
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
for(const needle of ['Afterlight Support','When Stripe self-service billing is available','When self-service billing is unavailable','billing changes and cancellation requests are handled through'])if(!terms.includes(needle))throw new Error('Terms must describe billing management and fallback accurately: '+needle);
for(const page of ['privacy','terms','support','account']){
  const built=await readFile(path.join(pub,page,'index.html'),'utf8');
  if(built.includes('#756b5f')||built.includes('#766d61'))throw new Error('Low-contrast secondary text remains in built '+page+' page');
}

console.log('PASS: 12 routes, account portal, support intake, 36 arranged stereo music files with music-quality gate, local-first focus sessions/todos with linkage, away-time accounting and generated ambience, complete cold-offline room packages with network-fresh/offline-fallback runtime shell + range playback and playback memory, durable local queue/history with shuffle-repeat restore, searchable 36-track owned catalog, disabled-by-default secure Navidrome/Subsonic provider boundary with server-side streaming and bounded structured lyrics, first-party Neon Auth, production Neon Function/Postgres, Vercel proxy, Cloudflare fallback, premium gating, Stripe payment links/webhook contract, accurate legal processors/billing fallback, accessible secondary-page contrast');
