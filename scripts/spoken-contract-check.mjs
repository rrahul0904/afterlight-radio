import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd(),pub=path.join(root,'public');
const runtimePath=path.join(root,'scripts','spoken-library.js');
const htmlPath=path.join(root,'spoken.html');
const builtRuntime=path.join(pub,'spoken-library.js');
const builtHtml=path.join(pub,'spoken','index.html');
for(const file of [runtimePath,htmlPath,builtRuntime,builtHtml])await access(file);

const runtime=await readFile(runtimePath,'utf8');
const html=await readFile(htmlPath,'utf8');
const built=await readFile(builtHtml,'utf8');
new Function(runtime);

for(const needle of ['spoken-library/v1','afterlight:spoken:v1','needs_relink','metadataFingerprint','crypto.subtle.digest','URL.createObjectURL','URL.revokeObjectURL','parseWebVtt','parseSrt','parsePlainText','validateTimedSegments','audio.currentTime','playbackRate','sleepEndsAt','listenedSeconds','state.queue','source-timed','file.text()']){
  if(!runtime.includes(needle))throw new Error('Spoken contract missing: '+needle);
}
for(const forbidden of ['fetch(','XMLHttpRequest','sendBeacon','WebSocket','FormData','/api/','torrent','debrid']){
  if(runtime.includes(forbidden))throw new Error('Spoken local-first boundary drifted: '+forbidden);
}
for(const needle of ['Afterlight Spoken','Add local audio','Import transcript','Your audio, filenames and transcript text stay in this browser flow','/spoken-library.js?v=spoken1']){
  if(!html.includes(needle))throw new Error('Spoken surface missing: '+needle);
}
if(!built.includes('/spoken-library.js?v=spoken1'))throw new Error('Built spoken route does not load versioned runtime');
if(await readFile(builtRuntime,'utf8')!==runtime)throw new Error('Built spoken runtime differs from source runtime');
console.log('Afterlight Spoken source/build privacy contract passed');
