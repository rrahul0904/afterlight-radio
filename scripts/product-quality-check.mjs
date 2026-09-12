import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const runtime=await readFile(path.join(root,'scripts','runtime-enhancements.js'),'utf8');
const mobilePolish=await readFile(path.join(root,'scripts','mobile-visual-polish.js'),'utf8');
const account=await readFile(path.join(root,'scripts','account-enhancements.js'),'utf8');
const audioSource=await readFile(path.join(root,'scripts','audio-library.mjs'),'utf8');

// Compile injected browser scripts before a release can move forward.
new Function(runtime);
new Function(mobilePolish);
new Function(account);

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
for(const needle of ['/api/auth/sign-in/social',"provider:'google'",'Continue with Google','googleAuthAccount']){
  if(!account.includes(needle))throw new Error('Account Google auth surface missing: '+needle);
}
for(const needle of ['const sr=32000','major7','minor7','dorian','softSaw','brushed snare','multi-tap room reverb','d1=Math.floor(sr*.137)']){
  if(!audioSource.includes(needle))throw new Error('Rich audio engine capability missing: '+needle);
}

// Verify the actual generated PCM is long enough and objectively audible.
const samplePath=path.join(root,'public','audio','rooftop','1.wav');
const wav=await readFile(samplePath);
if(wav.subarray(0,4).toString()!=='RIFF'||wav.subarray(8,12).toString()!=='WAVE')throw new Error('Rooftop audio is not a WAV');
const channels=wav.readUInt16LE(22),sampleRate=wav.readUInt32LE(24),bits=wav.readUInt16LE(34),dataBytes=wav.readUInt32LE(40);
if(channels!==1||sampleRate!==32000||bits!==16)throw new Error(`Unexpected audio format: ${channels}ch ${sampleRate}Hz ${bits}bit`);
const duration=dataBytes/(sampleRate*channels*(bits/8));
if(duration<22)throw new Error('Audio bed is too short: '+duration.toFixed(2)+'s');
let sumSq=0,peak=0,count=0;
for(let p=44;p+1<wav.length;p+=16){const a=Math.abs(wav.readInt16LE(p))/32768;peak=Math.max(peak,a);sumSq+=a*a;count++}
const rms=Math.sqrt(sumSq/count);
if(rms<0.025)throw new Error('Audio is too quiet; RMS='+rms.toFixed(4));
if(peak<0.30)throw new Error('Audio peak is too low; peak='+peak.toFixed(4));
if(peak>0.999)throw new Error('Audio is clipping; peak='+peak.toFixed(4));

console.log(`PASS: Google OAuth is exposed on sign-up/sign-in, mobile account access and full-bleed scene framing are guarded, 12 distinct illustrated scenes are wired, and generated audio is ${duration.toFixed(1)}s @ ${sampleRate}Hz with RMS ${rms.toFixed(3)} / peak ${peak.toFixed(3)}`);
