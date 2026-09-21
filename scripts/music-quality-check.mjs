import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root=process.cwd(),pub=path.join(root,'public');
const slugs=['roma','window','long-way-home','two-hundred','one-more-log','rooftop','friends','backroom','headspace','last-bus','momentum','between'];
const hashes=new Set();
const summaries=[];

function wavInfo(buffer,file){
  if(buffer.subarray(0,4).toString()!=='RIFF'||buffer.subarray(8,12).toString()!=='WAVE')throw new Error('Invalid WAV '+file);
  const channels=buffer.readUInt16LE(22),sampleRate=buffer.readUInt32LE(24),bits=buffer.readUInt16LE(34),dataBytes=buffer.readUInt32LE(40);
  if(channels!==2)throw new Error('Music must remain stereo: '+file);
  if(sampleRate!==32000)throw new Error('Unexpected music sample rate '+sampleRate+': '+file);
  if(bits!==16)throw new Error('Unexpected PCM bit depth '+bits+': '+file);
  const frames=dataBytes/(channels*(bits/8)),duration=frames/sampleRate;
  if(duration<30)throw new Error('Arrangement too short ('+duration.toFixed(1)+'s): '+file);
  if(dataBytes<4_000_000)throw new Error('Arrangement payload too small: '+file);

  let sumL=0,sumR=0,sumDiff=0,sumMono=0,peak=0,meanL=0,meanR=0,count=0;
  const stride=29,frameBytes=4;
  for(let frame=0;frame<frames;frame+=stride){
    const offset=44+frame*frameBytes;
    if(offset+3>=buffer.length)break;
    const l=buffer.readInt16LE(offset)/32768,r=buffer.readInt16LE(offset+2)/32768;
    sumL+=l*l;sumR+=r*r;sumDiff+=(l-r)*(l-r);sumMono+=((l+r)*.5)**2;
    meanL+=l;meanR+=r;peak=Math.max(peak,Math.abs(l),Math.abs(r));count++;
  }
  const rmsL=Math.sqrt(sumL/count),rmsR=Math.sqrt(sumR/count),rms=Math.sqrt((sumL+sumR)/(count*2));
  const diffRms=Math.sqrt(sumDiff/count),monoRms=Math.sqrt(sumMono/count),dc=Math.max(Math.abs(meanL/count),Math.abs(meanR/count));
  if(rms<.012||rms>.42)throw new Error('Implausible music RMS '+rms.toFixed(4)+': '+file);
  if(peak<.12||peak>.9999)throw new Error('Implausible music peak '+peak.toFixed(4)+': '+file);
  if(peak/rms<1.35)throw new Error('Music is over-compressed/flat: '+file);
  if(diffRms<.006||diffRms/(monoRms+.0001)<.04)throw new Error('Stereo field collapsed: '+file);
  if(dc>.06)throw new Error('Excessive DC offset '+dc.toFixed(4)+': '+file);
  if(Math.min(rmsL,rmsR)/Math.max(rmsL,rmsR)<.45)throw new Error('Stereo balance is implausible: '+file);
  return {duration,rms,peak,diffRms};
}

for(const slug of slugs){
  const roomHashes=new Set();
  for(let track=1;track<=3;track++){
    const file=path.join(pub,'audio',slug,track+'.wav'),buffer=await readFile(file),info=wavInfo(buffer,file);
    const digest=createHash('sha256').update(buffer).digest('hex');
    if(hashes.has(digest))throw new Error('Duplicate generated music found: '+file);
    hashes.add(digest);roomHashes.add(digest);
    summaries.push({slug,track,...info});
  }
  if(roomHashes.size!==3)throw new Error('Room does not have three distinct compositions: '+slug);
}

const manifest=JSON.parse(await readFile(path.join(pub,'music-manifest.json'),'utf8'));
if(manifest.version!==3||manifest.generated!==true||manifest.thirdPartyAudio!==false)throw new Error('Music manifest v3 boundary missing');
if(!Array.isArray(manifest.tracks)||manifest.tracks.length!==36)throw new Error('Music manifest must describe 36 tracks');
for(const track of manifest.tracks){
  if(track.channels!==2||track.sampleRate!==32000||track.bars!==12)throw new Error('Manifest audio contract drifted: '+JSON.stringify(track));
  if(track.generator!=='afterlight-composition-engine-v3')throw new Error('Unexpected generator: '+track.generator);
  if(track.model!=='authored-elements-plus-deterministic-arrangement')throw new Error('Unexpected composition model: '+track.model);
  if(!track.title||!track.roomName||!track.style||!track.key)throw new Error('Manifest metadata incomplete: '+JSON.stringify(track));
}

if(hashes.size!==36)throw new Error('Expected 36 unique generated compositions, got '+hashes.size);
const minDuration=Math.min(...summaries.map(x=>x.duration)),maxDuration=Math.max(...summaries.map(x=>x.duration));
console.log('PASS music-quality: 36 unique stereo arrangements; duration '+minDuration.toFixed(1)+'–'+maxDuration.toFixed(1)+'s; manifest v3; first-party deterministic composition engine');
