import { mkdir, readFile, rm, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { generateAudio, audioRoomSlugs } from './audio-library.mjs';

const root=process.cwd(),out=path.join(root,'public'),slugs=audioRoomSlugs;
const improveContrast=html=>html
  .replaceAll('#756b5f','#675e53')
  .replaceAll('#766d61','#675e53');
const injectScript=(html,src)=>html.replace('</body>',`<script src="${src}"></script>\n</body>`);
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
const sourceHtml=await readFile(path.join(root,'index.html'),'utf8');
const html=injectScript(injectScript(sourceHtml,'/runtime-enhancements.js'),'/mobile-visual-polish.js');
const runtimeEnhancements=await readFile(path.join(root,'scripts','runtime-enhancements.js'),'utf8');
const mobileVisualPolish=await readFile(path.join(root,'scripts','mobile-visual-polish.js'),'utf8');
const accountEnhancements=await readFile(path.join(root,'scripts','account-enhancements.js'),'utf8');
await writeFile(path.join(out,'runtime-enhancements.js'),runtimeEnhancements);
await writeFile(path.join(out,'mobile-visual-polish.js'),mobileVisualPolish);
await writeFile(path.join(out,'account-enhancements.js'),accountEnhancements);
await writeFile(path.join(out,'index.html'),html);

for(const slug of slugs){
  const dir=path.join(out,slug);
  await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'index.html'),html);
}
for(const page of ['privacy','terms','support']){
  const dir=path.join(out,page);
  await mkdir(dir,{recursive:true});
  const pageHtml=await readFile(path.join(root,'legal',page+'.html'),'utf8');
  await writeFile(path.join(dir,'index.html'),improveContrast(pageHtml));
}

const accountDir=path.join(out,'account');
await mkdir(accountDir,{recursive:true});
const accountSource=improveContrast(await readFile(path.join(root,'account.html'),'utf8'));
await writeFile(path.join(accountDir,'index.html'),injectScript(accountSource,'/account-enhancements.js'));
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
console.log(`Built ${slugs.length} room routes, mobile/audio runtime, billing-support fallback, account portal, 3 legal pages and ${count} audio files (sample ${sample.size} bytes)`);