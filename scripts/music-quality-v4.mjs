import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderMusicCandidate } from './audio-library.mjs';

const VERSION='afterlight-audio-quality-v4-audition-1';
const DEFAULTS=Object.freeze({
  targetRms:0.105,
  peakCeiling:0.82,
  stereoWidth:1.08,
  saturationDrive:1.12,
  compressorThreshold:0.19,
  compressorRatio:2.2
});

function clamp(value,min=-1,max=1){return Math.max(min,Math.min(max,value))}
function sha256(bytes){return createHash('sha256').update(bytes).digest('hex')}

export function decodePcm16StereoWav(input){
  const buffer=Buffer.isBuffer(input)?input:Buffer.from(input);
  if(buffer.length<44||buffer.subarray(0,4).toString()!=='RIFF'||buffer.subarray(8,12).toString()!=='WAVE')throw new Error('Expected RIFF/WAVE input');
  const format=buffer.readUInt16LE(20),channels=buffer.readUInt16LE(22),sampleRate=buffer.readUInt32LE(24),bits=buffer.readUInt16LE(34);
  if(format!==1||channels!==2||bits!==16)throw new Error(`Expected stereo PCM16 WAV, got format=${format} channels=${channels} bits=${bits}`);
  const dataBytes=buffer.readUInt32LE(40);
  if(44+dataBytes>buffer.length||dataBytes%4!==0)throw new Error('Invalid PCM payload length');
  const frames=dataBytes/4,left=new Float32Array(frames),right=new Float32Array(frames);
  for(let i=0;i<frames;i++){
    const offset=44+i*4;
    left[i]=buffer.readInt16LE(offset)/32768;
    right[i]=buffer.readInt16LE(offset+2)/32768;
  }
  return {sampleRate,left,right,frames,durationSeconds:frames/sampleRate};
}

export function encodePcm16StereoWav({sampleRate,left,right}){
  if(left.length!==right.length)throw new Error('Stereo channel length mismatch');
  const frames=left.length,dataBytes=frames*4,buffer=Buffer.allocUnsafe(44+dataBytes);
  buffer.write('RIFF',0);buffer.writeUInt32LE(36+dataBytes,4);buffer.write('WAVE',8);buffer.write('fmt ',12);
  buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(2,22);
  buffer.writeUInt32LE(sampleRate,24);buffer.writeUInt32LE(sampleRate*4,28);buffer.writeUInt16LE(4,32);buffer.writeUInt16LE(16,34);
  buffer.write('data',36);buffer.writeUInt32LE(dataBytes,40);
  for(let i=0;i<frames;i++){
    buffer.writeInt16LE(Math.round(clamp(left[i]) * 32767),44+i*4);
    buffer.writeInt16LE(Math.round(clamp(right[i]) * 32767),46+i*4);
  }
  return buffer;
}

export function audioMetrics(left,right){
  if(left.length!==right.length||left.length===0)throw new Error('Cannot measure empty/mismatched stereo audio');
  let sum=0,sumMid=0,sumSide=0,peak=0,meanL=0,meanR=0;
  for(let i=0;i<left.length;i++){
    const l=left[i],r=right[i],mid=(l+r)*.5,side=(l-r)*.5;
    sum+=(l*l+r*r)*.5;sumMid+=mid*mid;sumSide+=side*side;
    peak=Math.max(peak,Math.abs(l),Math.abs(r));meanL+=l;meanR+=r;
  }
  const rms=Math.sqrt(sum/left.length),midRms=Math.sqrt(sumMid/left.length),sideRms=Math.sqrt(sumSide/left.length);
  const dc=Math.max(Math.abs(meanL/left.length),Math.abs(meanR/left.length));
  return {
    rms,peak,crest:rms?peak/rms:0,dc,midRms,sideRms,
    sideToMid:sideRms/(midRms+1e-9)
  };
}

function dcBlock(input){
  const out=new Float32Array(input.length);let x1=0,y1=0;
  for(let i=0;i<input.length;i++){
    const x=input[i],y=x-x1+.995*y1;out[i]=y;x1=x;y1=y;
  }
  return out;
}

function toneShape(input,sampleRate){
  const out=new Float32Array(input.length),cutoff=1800,alpha=1-Math.exp(-2*Math.PI*cutoff/sampleRate);let low=0;
  for(let i=0;i<input.length;i++){
    const x=input[i];low+=alpha*(x-low);const high=x-low;
    out[i]=low*1.045+high*.955;
  }
  return out;
}

function addEarlyReflections(left,right,sampleRate){
  const outL=new Float32Array(left),outR=new Float32Array(right);
  const taps=[
    {delay:Math.round(sampleRate*.031),gain:.060,cross:true},
    {delay:Math.round(sampleRate*.053),gain:.045,cross:false},
    {delay:Math.round(sampleRate*.079),gain:.032,cross:true}
  ];
  for(let i=0;i<left.length;i++){
    let l=outL[i],r=outR[i];
    for(const tap of taps){
      if(i<tap.delay)continue;
      l+=(tap.cross?right[i-tap.delay]:left[i-tap.delay])*tap.gain;
      r+=(tap.cross?left[i-tap.delay]:right[i-tap.delay])*tap.gain;
    }
    outL[i]=l;outR[i]=r;
  }
  return [outL,outR];
}

function widen(left,right,width){
  const outL=new Float32Array(left.length),outR=new Float32Array(right.length);
  for(let i=0;i<left.length;i++){
    const mid=(left[i]+right[i])*.5,side=(left[i]-right[i])*.5*width;
    outL[i]=mid+side;outR[i]=mid-side;
  }
  return [outL,outR];
}

function compressAndSaturate(left,right,sampleRate,{compressorThreshold,compressorRatio,saturationDrive}){
  const outL=new Float32Array(left.length),outR=new Float32Array(right.length);
  const attack=Math.exp(-1/(sampleRate*.012)),release=Math.exp(-1/(sampleRate*.240)),norm=Math.tanh(saturationDrive);let env=0,gain=1;
  for(let i=0;i<left.length;i++){
    const detector=Math.max(Math.abs(left[i]),Math.abs(right[i]));
    env=detector>env?attack*env+(1-attack)*detector:release*env+(1-release)*detector;
    let wanted=1;
    if(env>compressorThreshold){
      const compressed=compressorThreshold+(env-compressorThreshold)/compressorRatio;
      wanted=compressed/(env+1e-9);
    }
    gain+=.015*(wanted-gain);
    outL[i]=Math.tanh(left[i]*gain*saturationDrive)/norm;
    outR[i]=Math.tanh(right[i]*gain*saturationDrive)/norm;
  }
  return [outL,outR];
}

function gainStage(left,right,{targetRms,peakCeiling}){
  const before=audioMetrics(left,right);
  const byRms=before.rms>0?targetRms/before.rms:1,byPeak=before.peak>0?peakCeiling/before.peak:1;
  const gain=Math.max(.35,Math.min(2.4,byRms,byPeak));
  const outL=new Float32Array(left.length),outR=new Float32Array(right.length);
  for(let i=0;i<left.length;i++){outL[i]=left[i]*gain;outR[i]=right[i]*gain}
  return [outL,outR,gain];
}

export function processQualityV4(input,options={}){
  const config={...DEFAULTS,...options},decoded=decodePcm16StereoWav(input),before=audioMetrics(decoded.left,decoded.right);
  let left=toneShape(dcBlock(decoded.left),decoded.sampleRate),right=toneShape(dcBlock(decoded.right),decoded.sampleRate);
  [left,right]=addEarlyReflections(left,right,decoded.sampleRate);
  [left,right]=widen(left,right,config.stereoWidth);
  [left,right]=compressAndSaturate(left,right,decoded.sampleRate,config);
  let finalGain;[left,right,finalGain]=gainStage(left,right,config);
  const after=audioMetrics(left,right),bytes=encodePcm16StereoWav({sampleRate:decoded.sampleRate,left,right});
  if(after.peak>config.peakCeiling+.015)throw new Error(`v4 peak ceiling exceeded: ${after.peak.toFixed(4)}`);
  if(after.dc>.012)throw new Error(`v4 DC offset too high: ${after.dc.toFixed(5)}`);
  if(after.sideToMid<.035)throw new Error(`v4 stereo field collapsed: ${after.sideToMid.toFixed(4)}`);
  return {bytes,before,after,finalGain,config,sampleRate:decoded.sampleRate,durationSeconds:decoded.durationSeconds};
}

function parseArgs(argv){
  const result={room:'rooftop',seed:'flagship-a',role:1,bars:48,out:'.music-lab/v4/rooftop'};
  for(let i=0;i<argv.length;i++){
    const key=argv[i],value=argv[i+1];
    if(key==='--room'&&value){result.room=value;i++}
    else if(key==='--seed'&&value){result.seed=value;i++}
    else if(key==='--role'&&value){result.role=Number(value);i++}
    else if(key==='--bars'&&value){result.bars=Number(value);i++}
    else if(key==='--out'&&value){result.out=value;i++}
  }
  return result;
}

export async function writeQualityV4Audition({room='rooftop',seed='flagship-a',role=1,bars=48,out='.music-lab/v4/rooftop'}={}){
  const candidate=renderMusicCandidate({roomSlug:room,seed,trackRole:role,bars}),beforeBytes=Buffer.from(candidate.bytes),processed=processQualityV4(beforeBytes);
  const outDir=path.resolve(process.cwd(),out);await mkdir(outDir,{recursive:true});
  const afterBytes=Buffer.from(processed.bytes),receipt={
    version:VERSION,
    status:'audition-only',
    room,seed,role:Number(role),bars:candidate.metadata.bars,
    source:{generator:candidate.metadata.generator,sha256:sha256(beforeBytes),metrics:processed.before},
    output:{sha256:sha256(afterBytes),metrics:processed.after,sampleRate:processed.sampleRate,durationSeconds:Number(processed.durationSeconds.toFixed(3))},
    processing:{...processed.config,finalGain:processed.finalGain,steps:['dc-block','tonal-split','early-reflections','mid-side-width','soft-compression','soft-saturation','rms-aware-gain-stage']},
    releaseBoundary:'Requires blind listening review, Music Lab approval, mastering certification, release certificate and hosted device UAT before production.'
  };
  await writeFile(path.join(outDir,'before.wav'),beforeBytes);
  await writeFile(path.join(outDir,'after.wav'),afterBytes);
  await writeFile(path.join(outDir,'quality-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  return {outDir,receipt};
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(invoked){
  const result=await writeQualityV4Audition(parseArgs(process.argv.slice(2)));
  console.log(`PASS audio-quality-v4 audition ${result.receipt.room} -> ${result.outDir}`);
  console.log(`before rms=${result.receipt.source.metrics.rms.toFixed(4)} peak=${result.receipt.source.metrics.peak.toFixed(4)} | after rms=${result.receipt.output.metrics.rms.toFixed(4)} peak=${result.receipt.output.metrics.peak.toFixed(4)}`);
}
