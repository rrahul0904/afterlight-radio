import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderMusicCandidate } from './audio-library.mjs';
import { decodePcm16StereoWav, audioMetrics, processQualityV4 } from './music-quality-v4.mjs';

const SCHEMA='afterlight-music-quality-agent/v1';
const FLAGSHIP_ROOMS=Object.freeze(['rooftop','window','headspace','last-bus']);
const ROOM_POLICY=Object.freeze({
  rooftop:{repetitionWarn:.82,fatigueWarn:.34,minDynamicDb:8},
  window:{repetitionWarn:.88,fatigueWarn:.30,minDynamicDb:7},
  headspace:{repetitionWarn:.91,fatigueWarn:.27,minDynamicDb:6},
  'last-bus':{repetitionWarn:.92,fatigueWarn:.29,minDynamicDb:6}
});

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const db=v=>20*Math.log10(Math.max(v,1e-9));
const round=(v,n=5)=>Number(v.toFixed(n));

function quantile(values,q){
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b),pos=(sorted.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos);
  if(lo===hi)return sorted[lo];
  return sorted[lo]+(sorted[hi]-sorted[lo])*(pos-lo);
}

function correlation(a,b){
  const n=Math.min(a.length,b.length);
  if(!n)return 0;
  let ma=0,mb=0;for(let i=0;i<n;i++){ma+=a[i];mb+=b[i]}ma/=n;mb/=n;
  let num=0,da=0,dbb=0;
  for(let i=0;i<n;i++){const x=a[i]-ma,y=b[i]-mb;num+=x*y;da+=x*x;dbb+=y*y}
  return da&&dbb?num/Math.sqrt(da*dbb):0;
}

function blockEnvelope(left,right,sampleRate,seconds=.5){
  const size=Math.max(1,Math.round(sampleRate*seconds)),out=[];
  for(let start=0;start<left.length;start+=size){
    const end=Math.min(left.length,start+size);let sum=0,peak=0,diff=0,prev=((left[start]||0)+(right[start]||0))*.5;
    for(let i=start;i<end;i++){
      const mono=(left[i]+right[i])*.5;sum+=mono*mono;peak=Math.max(peak,Math.abs(mono));
      if(i>start){const d=mono-prev;diff+=d*d}prev=mono;
    }
    const n=Math.max(1,end-start),rms=Math.sqrt(sum/n),rough=Math.sqrt(diff/Math.max(1,n-1));
    out.push({rms,peak,rough});
  }
  return out;
}

function repetitionProxy(envelope,secondsPerBlock=.5){
  const series=envelope.map(x=>Math.log10(Math.max(x.rms,1e-7)));
  const lags=[4,8,16,24,32].map(sec=>Math.round(sec/secondsPerBlock)).filter(l=>l>1&&l<series.length*.75);
  let best={seconds:0,correlation:0};
  for(const lag of lags){
    const c=correlation(series.slice(lag),series.slice(0,-lag));
    if(c>best.correlation)best={seconds:lag*secondsPerBlock,correlation:c};
  }
  return best;
}

function waveformFeatures(bytes){
  const decoded=decodePcm16StereoWav(bytes),{left,right,sampleRate}=decoded,base=audioMetrics(left,right);
  const envelope=blockEnvelope(left,right,sampleRate,.5),rmsBlocks=envelope.map(x=>x.rms),roughBlocks=envelope.map(x=>x.rough);
  const p10=quantile(rmsBlocks,.10),p95=quantile(rmsBlocks,.95),dynamicDb=db(p95)-db(Math.max(p10,1e-6));
  let lrNum=0,lPow=0,rPow=0,clip=0,silent=0,zcr=0,prev=(left[0]+right[0])*.5;
  for(let i=0;i<left.length;i++){
    const l=left[i],r=right[i],mono=(l+r)*.5;lrNum+=l*r;lPow+=l*l;rPow+=r*r;
    if(Math.abs(l)>=.985||Math.abs(r)>=.985)clip++;
    if(Math.abs(l)<1e-4&&Math.abs(r)<1e-4)silent++;
    if(i&&((mono>=0)!=(prev>=0)))zcr++;prev=mono;
  }
  const stereoCorrelation=lrNum/Math.sqrt(Math.max(1e-12,lPow*rPow));
  const roughness=quantile(roughBlocks,.75)/(Math.max(base.rms,1e-7));
  const repetition=repetitionProxy(envelope,.5);
  return {
    sampleRate,durationSeconds:decoded.durationSeconds,
    rms:base.rms,peak:base.peak,crest:base.crest,dc:base.dc,sideToMid:base.sideToMid,
    stereoCorrelation,dynamicDb,roughness,repetition,
    clippingRatio:clip/left.length,silenceRatio:silent/left.length,zeroCrossingRate:zcr/Math.max(1,left.length-1)
  };
}

function finding(agent,status,code,message,evidence){return {agent,status,code,message,evidence}}

function signalAgent(f){
  const findings=[];
  findings.push(finding('signal-integrity',f.peak>.90?'fail':f.peak>.84?'warn':'pass','peak-ceiling',`sample peak ${round(f.peak,4)}`,{peak:round(f.peak)}));
  findings.push(finding('signal-integrity',f.clippingRatio>0?'fail':'pass','clipping',`clipping ratio ${round(f.clippingRatio,8)}`,{clippingRatio:round(f.clippingRatio,8)}));
  findings.push(finding('signal-integrity',f.dc>.01?'fail':f.dc>.004?'warn':'pass','dc-offset',`DC ${round(f.dc,6)}`,{dc:round(f.dc,6)}));
  findings.push(finding('signal-integrity',f.silenceRatio>.12?'warn':'pass','silence',`silence ratio ${round(f.silenceRatio,4)}`,{silenceRatio:round(f.silenceRatio)}));
  return findings;
}

function dynamicsAgent(f,policy){
  return [
    finding('dynamics',f.crest<2?'fail':f.crest<2.6?'warn':'pass','crest-factor',`crest factor ${round(f.crest,3)}`,{crest:round(f.crest)}),
    finding('dynamics',f.dynamicDb<policy.minDynamicDb?'warn':'pass','macro-dynamics',`0.5s block dynamic span ${round(f.dynamicDb,2)} dB`,{dynamicDb:round(f.dynamicDb,2),minimumDb:policy.minDynamicDb})
  ];
}

function stereoAgent(f){
  return [
    finding('stereo',f.sideToMid<.035?'fail':f.sideToMid<.055?'warn':'pass','stereo-width',`side/mid ${round(f.sideToMid,4)}`,{sideToMid:round(f.sideToMid)}),
    finding('stereo',f.stereoCorrelation>.995?'warn':f.stereoCorrelation<-.25?'warn':'pass','stereo-correlation',`L/R correlation ${round(f.stereoCorrelation,4)}`,{correlation:round(f.stereoCorrelation)})
  ];
}

function fatigueAgent(f,policy){
  const rough=f.roughness>policy.fatigueWarn?'warn':'pass';
  const zcr=f.zeroCrossingRate>.18?'warn':'pass';
  return [
    finding('fatigue-proxy',rough,'roughness-proxy',`normalized upper-quartile derivative RMS ${round(f.roughness,4)}`,{roughness:round(f.roughness),warningAbove:policy.fatigueWarn}),
    finding('fatigue-proxy',zcr,'zero-crossing-proxy',`zero-crossing rate ${round(f.zeroCrossingRate,4)}`,{zeroCrossingRate:round(f.zeroCrossingRate)})
  ];
}

function repetitionAgent(f,policy){
  const c=f.repetition.correlation;
  return [finding('repetition-proxy',c>policy.repetitionWarn?'warn':'pass','envelope-periodicity',`strongest long-lag loudness correlation ${round(c,4)} at ${f.repetition.seconds}s`,{correlation:round(c),lagSeconds:f.repetition.seconds,warningAbove:policy.repetitionWarn})];
}

function comparisonAgent(before,after){
  const findings=[];
  findings.push(finding('candidate-comparison',after.sideToMid<before.sideToMid*.65?'warn':'pass','width-regression',`side/mid ${round(before.sideToMid,4)} -> ${round(after.sideToMid,4)}`,{before:round(before.sideToMid),after:round(after.sideToMid)}));
  findings.push(finding('candidate-comparison',after.dynamicDb<before.dynamicDb-6?'warn':'pass','dynamics-regression',`dynamic span ${round(before.dynamicDb,2)} -> ${round(after.dynamicDb,2)} dB`,{beforeDb:round(before.dynamicDb,2),afterDb:round(after.dynamicDb,2)}));
  findings.push(finding('candidate-comparison',after.repetition.correlation>before.repetition.correlation+.12?'warn':'pass','repetition-regression',`periodicity ${round(before.repetition.correlation,3)} -> ${round(after.repetition.correlation,3)}`,{before:round(before.repetition.correlation),after:round(after.repetition.correlation)}));
  findings.push(finding('candidate-comparison',after.roughness>before.roughness*1.35?'warn':'pass','roughness-regression',`roughness ${round(before.roughness,4)} -> ${round(after.roughness,4)}`,{before:round(before.roughness),after:round(after.roughness)}));
  return findings;
}

function roomFitAgent(metadata){
  return [finding('room-fit','human','subjective-room-fit',`${metadata.roomName}: ${metadata.style}, ${metadata.bpm} BPM, ${metadata.key}. Waveform analysis cannot establish emotional/genre fit.`,{room:metadata.room,roomName:metadata.roomName,style:metadata.style,bpm:metadata.bpm,key:metadata.key})];
}

export function evaluateMusicCandidate({room='rooftop',seed='agent-a',role=1,bars=48}={}){
  const policy=ROOM_POLICY[room]||{repetitionWarn:.88,fatigueWarn:.31,minDynamicDb:7};
  const rendered=renderMusicCandidate({roomSlug:room,seed,trackRole:role,bars});
  const source=Buffer.from(rendered.bytes),processed=processQualityV4(source),finished=Buffer.from(processed.bytes);
  const sourceFeatures=waveformFeatures(source),finishedFeatures=waveformFeatures(finished),metadata=rendered.metadata;
  const findings=[...signalAgent(finishedFeatures),...dynamicsAgent(finishedFeatures,policy),...stereoAgent(finishedFeatures),...fatigueAgent(finishedFeatures,policy),...repetitionAgent(finishedFeatures,policy),...comparisonAgent(sourceFeatures,finishedFeatures),...roomFitAgent(metadata)];
  const failures=findings.filter(x=>x.status==='fail'),warnings=findings.filter(x=>x.status==='warn');
  const machineGate=failures.length?'reject':'eligible-for-human-review';
  return {
    schema:SCHEMA,createdBy:'Afterlight Music QA Agent',candidate:{room,seed,role,bars,metadata},
    hashes:{source:sha256(source),finished:sha256(finished)},
    features:{source:Object.fromEntries(Object.entries(sourceFeatures).map(([k,v])=>[k,typeof v==='number'?round(v):v])),finished:Object.fromEntries(Object.entries(finishedFeatures).map(([k,v])=>[k,typeof v==='number'?round(v):v]))},
    specialists:{
      'signal-integrity':findings.filter(x=>x.agent==='signal-integrity'),
      dynamics:findings.filter(x=>x.agent==='dynamics'),
      stereo:findings.filter(x=>x.agent==='stereo'),
      'fatigue-proxy':findings.filter(x=>x.agent==='fatigue-proxy'),
      'repetition-proxy':findings.filter(x=>x.agent==='repetition-proxy'),
      'candidate-comparison':findings.filter(x=>x.agent==='candidate-comparison'),
      'room-fit':findings.filter(x=>x.agent==='room-fit')
    },
    consensus:{machineGate,failures:failures.length,warnings:warnings.length,humanListeningRequired:true,canAutoApproveProduction:false},
    releaseBoundary:'This agent can reject technical regressions and prioritize candidates. It cannot truthfully certify musical taste, emotional room fit, or long-session enjoyment. Blind human listening remains mandatory before mastering/release.'
  };
}

export async function runMusicQualityAgent({rooms=FLAGSHIP_ROOMS,seeds=['agent-a'],role=1,bars=24,out='.music-lab/music-agent'}={}){
  const safeRooms=Array.isArray(rooms)?rooms:String(rooms).split(','),safeSeeds=Array.isArray(seeds)?seeds:String(seeds).split(',');
  const reports=[];for(const room of safeRooms)for(const seed of safeSeeds)reports.push(evaluateMusicCandidate({room:room.trim(),seed:seed.trim(),role,bars}));
  const summary={schema:SCHEMA,generatedAt:new Date().toISOString(),candidateCount:reports.length,rejected:reports.filter(r=>r.consensus.machineGate==='reject').length,eligibleForHumanReview:reports.filter(r=>r.consensus.machineGate==='eligible-for-human-review').length,humanListeningRequired:true,reports:reports.map(r=>({room:r.candidate.room,seed:r.candidate.seed,finishedSha256:r.hashes.finished,machineGate:r.consensus.machineGate,failures:r.consensus.failures,warnings:r.consensus.warnings}))};
  const outDir=path.resolve(process.cwd(),out);await mkdir(outDir,{recursive:true});
  for(const report of reports)await writeFile(path.join(outDir,`${report.candidate.room}-${report.candidate.seed}.json`),JSON.stringify(report,null,2)+'\n');
  await writeFile(path.join(outDir,'summary.json'),JSON.stringify(summary,null,2)+'\n');
  return {outDir,summary,reports};
}

function parseArgs(argv){
  const r={rooms:FLAGSHIP_ROOMS,seeds:['agent-a'],role:1,bars:24,out:'.music-lab/music-agent'};
  for(let i=0;i<argv.length;i++){const k=argv[i],v=argv[i+1];if(k==='--rooms'&&v){r.rooms=v.split(',');i++}else if(k==='--seeds'&&v){r.seeds=v.split(',');i++}else if(k==='--role'&&v){r.role=Number(v);i++}else if(k==='--bars'&&v){r.bars=Number(v);i++}else if(k==='--out'&&v){r.out=v;i++}}
  return r;
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(invoked){
  const result=await runMusicQualityAgent(parseArgs(process.argv.slice(2)));
  console.log(`Music QA Agent: ${result.summary.eligibleForHumanReview}/${result.summary.candidateCount} eligible for blind human review; ${result.summary.rejected} machine-rejected.`);
  console.log(`Reports: ${result.outDir}`);
}

export { FLAGSHIP_ROOMS, SCHEMA };
