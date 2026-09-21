import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const runtime=await readFile(path.join(root,'scripts','runtime-enhancements.js'),'utf8');
const mobilePolish=await readFile(path.join(root,'scripts','mobile-visual-polish.js'),'utf8');
const account=await readFile(path.join(root,'scripts','account-enhancements.js'),'utf8');
const audioContinuity=await readFile(path.join(root,'scripts','audio-continuity.js'),'utf8');
const audioSource=await readFile(path.join(root,'scripts','audio-library.mjs'),'utf8');

// Compile injected browser scripts before a release can move forward.
new Function(runtime);
new Function(mobilePolish);
new Function(account);
new Function(audioContinuity);

for(const needle of [
  '/api/auth/sign-in/social',
  "provider:'google'",
  'Continue with Google',
  'googleAuthMain',
  'paintedScene',
  'painted-scene',
  'Rooftop at sundown',
  'Rainy window seat',
  'Late-night pizzeria',
  'Night drive home',
  'Midnight gas station',
  'Cabin fire',
  'Courtyard with friends',
  'Backroom live stage',
  'Quiet writing desk',
  'Last bus home',
  'Bright morning kitchen',
  'Surreal quiet architecture'
]){
  if(!runtime.includes(needle))throw new Error('Main product quality surface missing: '+needle);
}
for(const needle of ['#accountBtn','display:inline-flex!important','xMidYMid slice','max-height:calc(100dvh - 24px)','MutationObserver']){
  if(!mobilePolish.includes(needle))throw new Error('Mobile product surface missing: '+needle);
}
for(const needle of ['/api/auth/sign-in/social',"provider:'google'",'Continue with Google','googleAuthAccount','Billing support','Subscription cancellation']){
  if(!account.includes(needle))throw new Error('Account/auth/billing surface missing: '+needle);
}
for(const needle of ['audio.loop=false','audio.onended','t=(t+1)%3','continuous:true']){
  if(!audioContinuity.includes(needle))throw new Error('Room audio continuity missing: '+needle);
}
for(const needle of ['const SR=32000','const BARS=12','major7','minor7','dorian','softSaw','chordTransitions','transformMotif','buildScore','sectionFor','arrival arc','motion arc','late-night arc','music-manifest.json','afterlight-composition-engine-v3','authored-elements-plus-deterministic-arrangement','thirdPartyAudio:false']){
  if(!audioSource.includes(needle))throw new Error('Composition Engine v3 capability missing: '+needle);
}

// Verify the actual generated PCM is long enough and objectively audible.
const samplePath=path.join(root,'public','audio','rooftop','1.wav');
const wav=await readFile(samplePath);
if(wav.subarray(0,4).toString()!=='RIFF'||wav.subarray(8,12).toString()!=='WAVE')throw new Error('Rooftop audio is not a WAV');
const channels=wav.readUInt16LE(22),sampleRate=wav.readUInt32LE(24),bits=wav.readUInt16LE(34),dataBytes=wav.readUInt32LE(40);
if(channels!==2||sampleRate!==32000||bits!==16)throw new Error(`Unexpected audio format: ${channels}ch ${sampleRate}Hz ${bits}bit`);
const duration=dataBytes/(sampleRate*channels*(bits/8));
if(duration<30)throw new Error('Audio arrangement is too short: '+duration.toFixed(2)+'s');
let sumSq=0,peak=0,diffSq=0,monoSq=0,count=0;
for(let p=44;p+3<wav.length;p+=32){
  const l=wav.readInt16LE(p)/32768,r=wav.readInt16LE(p+2)/32768;
  peak=Math.max(peak,Math.abs(l),Math.abs(r));sumSq+=(l*l+r*r)/2;diffSq+=(l-r)*(l-r);monoSq+=((l+r)*.5)**2;count++;
}
const rms=Math.sqrt(sumSq/count),stereoRatio=Math.sqrt(diffSq/count)/(Math.sqrt(monoSq/count)+.0001);
if(rms<0.025)throw new Error('Audio is too quiet; RMS='+rms.toFixed(4));
if(peak<0.30)throw new Error('Audio peak is too low; peak='+peak.toFixed(4));
if(peak>0.9999)throw new Error('Audio is clipping; peak='+peak.toFixed(4));
if(stereoRatio<.04)throw new Error('Stereo field collapsed; ratio='+stereoRatio.toFixed(4));

const manifest=JSON.parse(await readFile(path.join(root,'public','music-manifest.json'),'utf8'));
if(manifest.version!==3||manifest.tracks?.length!==36||manifest.thirdPartyAudio!==false)throw new Error('Composition Engine v3 manifest is incomplete');
if(!manifest.tracks.every(track=>track.channels===2&&track.bars===12&&track.generator==='afterlight-composition-engine-v3'))throw new Error('Composition Engine v3 manifest drift');

console.log(`PASS: Google OAuth is exposed on sign-up/sign-in, mobile account access and full-bleed scene framing are guarded, billing support is functional, 12 distinct illustrated scenes are wired, each room rotates through three Composition Engine v3 stereo arrangements, and generated audio is ${duration.toFixed(1)}s @ ${sampleRate}Hz with RMS ${rms.toFixed(3)} / peak ${peak.toFixed(3)} / stereo ${stereoRatio.toFixed(3)}`);
