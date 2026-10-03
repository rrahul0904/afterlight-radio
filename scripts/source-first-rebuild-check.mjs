import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const html=await readFile(path.join(root,'rebuild','index.html'),'utf8');
const runtime=await readFile(path.join(root,'rebuild','app.js'),'utf8');
const catalog=await readFile(path.join(root,'rebuild','catalog.js'),'utf8');
const built=await readFile(path.join(root,'public','rebuild','index.html'),'utf8');
const builtCatalog=await readFile(path.join(root,'public','rebuild','catalog.js'),'utf8');
const stageAManifest=JSON.parse(await readFile(path.join(root,'music','stage-a-catalog.json'),'utf8'));

for(const room of ['rooftop','window','headspace','last-bus']){
  if(!html.includes(`data-room-choice="${room}"`))throw new Error(`missing flagship room ${room}`);
  if(!catalog.includes(`${room}:`)&&!catalog.includes(`'${room}':`))throw new Error(`missing flagship room catalog ${room}`);
}
for(const required of ['Another view','Play this place','Share this moment','Ambience off']){
  if(!html.includes(required))throw new Error(`missing rebuild interaction: ${required}`);
}
for(const forbidden of ['Sign in','Upgrade','Admin','Todo','Dashboard']){
  if(html.includes(forbidden))throw new Error(`core rebuild leaks non-listening UI: ${forbidden}`);
}
if(!runtime.includes('render({preserveAudio:true})'))throw new Error('visual cycling is not explicitly playback-preserving');
if(!runtime.includes("url.searchParams.set('room',room)"))throw new Error('share/deep-link room identity missing');
if(!runtime.includes("url.searchParams.set('track',String(track+1))"))throw new Error('share/deep-link track identity missing');
if(!runtime.includes("url.searchParams.set('view',String(view))"))throw new Error('share/deep-link view identity missing');
if(!runtime.includes("provider==='owned'||provider==='cleared'"))throw new Error('runtime does not enable cleared HTML-audio masters');
if(!runtime.includes("selected.mixWithAmbienceAllowed===true"))throw new Error('runtime does not enforce per-track ambience rights');

for(const boundary of [
  "kind:'official-iframe-visible'",
  'width:200',
  'height:200',
  'requireVisiblePlayback:true',
  'allowObscuringOverlay:false',
  'allowAudioExtraction:false',
  'allowBackgroundPlay:false',
  'preserveYouTubeMetadataAndStandardExperience:true',
  "status:'adapter-contract-only-no-catalog-ids-committed'"
]){
  if(!catalog.includes(boundary))throw new Error(`YouTube provider compliance boundary missing: ${boundary}`);
}

if(built!==html)throw new Error('built rebuild HTML does not match source rebuild HTML');
if((stageAManifest.entries||[]).length===0&&!builtCatalog.includes("mode:'demo'"))throw new Error('empty real Stage-A manifest must build an explicitly labeled demo catalog');
for(const file of ['styles.css','catalog.js','app.js'])await stat(path.join(root,'public','rebuild',file));
console.log('source-first Afterlight rebuild contract: PASS');
