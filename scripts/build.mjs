import { mkdir, readFile, rm, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { generateAudio, audioRoomSlugs, musicRooms } from './audio-library.mjs';
import { masterGeneratedCatalog, V3_MASTER_GAIN_DB } from './audio-mastering-trim.mjs';
import { createBlindPair } from './music-quality-v4-pack.mjs';

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
/audio-lab/audio/*
  Cache-Control: public, max-age=3600
`);

const count=await generateAudio(out);
const mastered=await masterGeneratedCatalog(out,slugs);

if(process.env.AFTERLIGHT_AUDIO_LAB==='1'){
  const flagship=['rooftop','window','headspace','last-bus'];
  const labRoot=path.join(out,'audio-lab');
  await mkdir(labRoot,{recursive:true});
  const labHtml=await readFile(path.join(root,'audio-lab.html'),'utf8');
  await writeFile(path.join(labRoot,'index.html'),labHtml);
  const rooms=[];
  for(const room of flagship){
    const pair=createBlindPair({room,seed:'flagship-a',role:1,bars:24});
    const roomDir=path.join(labRoot,'audio',room);
    await mkdir(roomDir,{recursive:true});
    await writeFile(path.join(roomDir,'A.wav'),pair.A);
    await writeFile(path.join(roomDir,'B.wav'),pair.B);
    const profile=musicRooms.find(entry=>entry.slug===room);
    const seconds=profile?24*4*60/profile.bpm:0;
    rooms.push({
      pairId:pair.pairId,
      room,
      roomName:profile?.name||room,
      files:{A:`/audio-lab/audio/${room}/A.wav`,B:`/audio-lab/audio/${room}/B.wav`},
      hashes:pair.publicManifest.hashes,
      durationLabel:`about ${Math.max(1,Math.round(seconds/60))} min each`,
      blinded:true
    });
  }
  await writeFile(path.join(labRoot,'manifest.json'),JSON.stringify({
    schema:'afterlight-audio-lab/v1',
    releaseSha:release,
    status:'audition-only',
    blinded:true,
    rooms,
    privacy:'Review state stays in browser localStorage unless the reviewer explicitly exports JSON.',
    releaseBoundary:'Audio Lab evidence does not publish or replace production audio.'
  },null,2)+'\n');
}

const sample=await stat(path.join(out,'audio','rooftop','1.wav'));
const masteredPeak=Math.max(...mastered.map(track=>track.masteredSamplePeak));
const labSuffix=process.env.AFTERLIGHT_AUDIO_LAB==='1'?' + blind flagship Audio Lab':'';
console.log(`Built ${slugs.length} room routes, mobile/audio/focus/offline-library/queue/catalog runtime, three-track continuity, billing-support fallback, account + admin portals, 3 legal pages and ${count} composition-engine-v3 stereo audio files + music manifest with +${V3_MASTER_GAIN_DB} dB linear master trim${labSuffix} (max sample peak ${masteredPeak.toFixed(3)}, sample ${sample.size} bytes)`);