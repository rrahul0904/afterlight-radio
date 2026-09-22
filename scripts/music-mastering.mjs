import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root=process.cwd();
const defaultPolicyPath=path.join(root,'music','mastering-policy.json');

function number(value){
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:null;
}

function runFfmpeg(args){
  const result=spawnSync(process.env.FFMPEG_BIN||'ffmpeg',args,{
    cwd:root,
    encoding:'utf8',
    maxBuffer:20*1024*1024
  });
  if(result.error?.code==='ENOENT')throw new Error('FFmpeg is required for mastering certification. Install ffmpeg or set FFMPEG_BIN.');
  if(result.error)throw result.error;
  return result;
}

function extractLoudnormJson(stderr){
  const matches=[...String(stderr||'').matchAll(/\{\s*"input_i"\s*:\s*"[^"]+"[\s\S]*?\}/g)];
  if(!matches.length)throw new Error('FFmpeg loudnorm analysis did not emit a parseable measurement block');
  try{return JSON.parse(matches.at(-1)[0])}
  catch(error){throw new Error('FFmpeg loudnorm JSON could not be parsed: '+error.message)}
}

export async function loadMasteringPolicy(policyPath=defaultPolicyPath){
  const raw=await readFile(policyPath,'utf8');
  const policy=JSON.parse(raw);
  if(policy.schemaVersion!==1)throw new Error('Unsupported mastering policy schema');
  if(!Number.isFinite(policy.integratedLufs?.min)||!Number.isFinite(policy.integratedLufs?.max)||!Number.isFinite(policy.integratedLufs?.target))throw new Error('Mastering policy loudness window is invalid');
  if(!Number.isFinite(policy.truePeakDbtp?.max)||!Number.isFinite(policy.loudnessRangeLu?.max))throw new Error('Mastering policy peak/range values are invalid');
  return {policy,raw,sha256:createHash('sha256').update(raw).digest('hex')};
}

export async function analyzeMastering({audioPath,candidateSha256,policyPath=defaultPolicyPath}={}){
  if(!audioPath)throw new Error('audioPath is required for mastering analysis');
  if(!/^[0-9a-f]{64}$/i.test(String(candidateSha256||'')))throw new Error('candidateSha256 is required for mastering analysis');
  const {policy,sha256:policySha256}=await loadMasteringPolicy(policyPath);

  const version=runFfmpeg(['-version']);
  if(version.status!==0)throw new Error('Unable to read FFmpeg version: '+String(version.stderr||version.stdout||'').trim());
  const ffmpegVersion=String(version.stdout||'').split(/\r?\n/)[0].trim();

  const target=policy.integratedLufs.target;
  const peakTarget=policy.truePeakDbtp.max;
  const analysis=runFfmpeg([
    '-hide_banner','-nostats','-i',path.resolve(audioPath),
    '-map_metadata','-1',
    '-af',`loudnorm=I=${target}:TP=${peakTarget}:LRA=11:print_format=json`,
    '-f','null','-'
  ]);
  if(analysis.status!==0)throw new Error('FFmpeg loudness analysis failed: '+String(analysis.stderr||analysis.stdout||'').trim().slice(-4000));

  const measured=extractLoudnormJson(analysis.stderr);
  const integratedLufs=number(measured.input_i);
  const truePeakDbtp=number(measured.input_tp);
  const loudnessRangeLu=number(measured.input_lra);
  const thresholdLufs=number(measured.input_thresh);
  const reasons=[];
  if(integratedLufs===null)reasons.push('integrated loudness is not finite');
  else{
    if(integratedLufs<policy.integratedLufs.min)reasons.push(`integrated loudness ${integratedLufs} LUFS is below ${policy.integratedLufs.min}`);
    if(integratedLufs>policy.integratedLufs.max)reasons.push(`integrated loudness ${integratedLufs} LUFS is above ${policy.integratedLufs.max}`);
  }
  if(truePeakDbtp===null)reasons.push('true peak is not finite');
  else if(truePeakDbtp>policy.truePeakDbtp.max)reasons.push(`true peak ${truePeakDbtp} dBTP exceeds ${policy.truePeakDbtp.max}`);
  if(loudnessRangeLu===null)reasons.push('loudness range is not finite');
  else if(loudnessRangeLu>policy.loudnessRangeLu.max)reasons.push(`loudness range ${loudnessRangeLu} LU exceeds ${policy.loudnessRangeLu.max}`);

  return {
    schemaVersion:1,
    measurement:'ffmpeg-loudnorm-first-pass',
    candidateSha256:String(candidateSha256).toLowerCase(),
    policyVersion:policy.schemaVersion,
    policySha256,
    ffmpegVersion,
    metrics:{
      integratedLufs,
      truePeakDbtp,
      loudnessRangeLu,
      thresholdLufs
    },
    targets:{
      integratedLufs:policy.integratedLufs,
      truePeakDbtp:policy.truePeakDbtp,
      loudnessRangeLu:policy.loudnessRangeLu
    },
    pass:reasons.length===0,
    reasons
  };
}
