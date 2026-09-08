import { mkdir, readFile, rm, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { generateAudio, audioRoomSlugs } from './audio-library.mjs';

const root=process.cwd(),out=path.join(root,'public'),slugs=audioRoomSlugs;
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
const html=await readFile(path.join(root,'index.html'),'utf8');
await writeFile(path.join(out,'index.html'),html);

for(const slug of slugs){
  const dir=path.join(out,slug);
  await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'index.html'),html);
}
for(const page of ['privacy','terms','support']){
  const dir=path.join(out,page);
  await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'index.html'),await readFile(path.join(root,'legal',page+'.html'),'utf8'));
}

await writeFile(path.join(out,'404.html'),html);
await writeFile(path.join(out,'_headers'),`/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Cross-Origin-Opener-Policy: same-origin
/audio/*
  Cache-Control: public, max-age=31536000, immutable
`);

const count=await generateAudio(out);
const sample=await stat(path.join(out,'audio','rooftop','1.wav'));
console.log(`Built ${slugs.length} room routes, 3 legal pages and ${count} audio files (sample ${sample.size} bytes)`);
