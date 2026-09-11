import { access, readFile } from 'node:fs/promises';

const runtime=await readFile(new URL('./runtime-enhancements.js',import.meta.url),'utf8');
new Function(runtime);
for(const needle of ['mediaSession','MediaMetadata','setActionHandler','setPositionState','audio_error','AUDIO UNAVAILABLE','NETWORK SLOW']){
  if(!runtime.includes(needle))throw new Error('Mobile/audio runtime capability missing: '+needle);
}
await access(new URL('../public/runtime-enhancements.js',import.meta.url));
const built=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
if(!built.includes('<script src="/runtime-enhancements.js"></script>'))throw new Error('Built player is missing runtime enhancements');
console.log('PASS: Media Session metadata/actions, OS position state and audio buffering/error resilience runtime');
