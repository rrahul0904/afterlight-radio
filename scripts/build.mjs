import { mkdir, readFile, rm, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { generateAudio, audioRoomSlugs } from './audio-library.mjs';

const root=process.cwd(),out=path.join(root,'public'),slugs=audioRoomSlugs;
const improveContrast=html=>html
  .replaceAll('#756b5f','#675e53')
  .replaceAll('#766d61','#675e53');
const SHELL_REV='offline2';
const injectScript=(html,src)=>html.replace('</body>',`<script src="${src}?v=${SHELL_REV}"></script>\n</body>`);
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
const sourceHtml=await readFile(path.join(root,'index.html'),'utf8');
const html=injectScript(injectScript(injectScript(injectScript(injectScript(injectScript(injectScript(sourceHtml,'/runtime-enhancements.js'),'/mobile-visual-polish.js'),'/audio-continuity.js'),'/focus-room.js'),'/library-runtime.js'),'/queue-runtime.js'),'/library-browser.js');
const runtimeEnhancements=await readFile(path.join(root,'scripts','runtime-enhancements.js'),'utf8');
const mobileVisualPolish=await readFile(path.join(root,'scripts','mobile-visual-polish.js'),'utf8');
const audioContinuity=await readFile(path.join(root,'scripts','audio-continuity.js'),'utf8');
const accountEnhancements=await readFile(path.join(root,'scripts','account-enhancements.js'),'utf8');
const adminRuntime=await readFile(path.join(root,'scripts','admin-runtime.js'),'utf8');
const focusRoom=await readFile(path.join(root,'scripts','focus-room.js'),'utf8');
const libraryRuntime=await readFile(path.join(root,'scripts','library-runtime.js'),'utf8');
const offlineWorker=await readFile(path.join(root,'scripts','offline-worker.js'),'utf8');
const queueRuntime=await readFile(path.join(root,'scripts','queue-runtime.js'),'utf8');
const libraryBrowser=await readFile(path.join(root,'scripts','library-browser.js'),'utf8');
await writeFile(path.join(out,'runtime-enhancements.js'),runtimeEnhancements);
await writeFile(path.join(out,'mobile-visual-polish.js'),mobileVisualPolish);
await writeFile(path.join(out,'audio-continuity.js'),audioContinuity);
await writeFile(path.join(out,'account-enhancements.js'),accountEnhancements);
await writeFile(path.join(out,'admin-runtime.js'),adminRuntime);
await writeFile(path.join(out,'focus-room.js'),focusRoom);
await writeFile(path.join(out,'library-runtime.js'),libraryRuntime);
await writeFile(path.join(out,'offline-worker.js'),offlineWorker);
await writeFile(path.join(out,'queue-runtime.js'),queueRuntime);
await writeFile(path.join(out,'library-browser.js'),libraryBrowser);
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
const adminDir=path.join(out,'admin');
await mkdir(adminDir,{recursive:true});
const adminSource=await readFile(path.join(root,'admin.html'),'utf8');
await writeFile(path.join(adminDir,'index.html'),adminSource);
const release=(process.env.AFTERLIGHT_RELEASE_SHA||process.env.VERCEL_GIT_COMMIT_SHA||process.env.RAILWAY_GIT_COMMIT_SHA||'development').trim();
await writeFile(path.join(out,'release.txt'),release+'\n');
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
console.log(`Built ${slugs.length} room routes, mobile/audio/focus/offline-library/queue/catalog runtime, three-track continuity, billing-support fallback, account + admin portals, 3 legal pages and ${count} composition-engine-v3 stereo audio files + music manifest (sample ${sample.size} bytes)`);