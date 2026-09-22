import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root=process.cwd();
const args=process.argv.slice(2);
const arg=(name,fallback)=>{
  const i=args.indexOf('--'+name);
  return i>=0&&args[i+1]!==undefined?args[i+1]:fallback;
};
const manifestPath=path.resolve(arg('manifest','.music-lab/imported-master/manifest.json'));
const reviewArg=String(arg('reviews','')).trim();
const operator=String(arg('operator','')).trim();
const slot=String(arg('slot','')).trim();
const requestedCandidate=String(arg('candidate','')).trim();
if(!reviewArg)throw new Error('--reviews is required');
if(!operator)throw new Error('--operator is required');
if(!slot)throw new Error('--slot is required, for example rooftop:1');

const slotMatch=/^([a-z0-9-]+):([1-3])$/.exec(slot);
if(!slotMatch)throw new Error('--slot must use <room>:<1|2|3>');
const [,slotRoom,slotTrackRaw]=slotMatch,slotTrack=Number(slotTrackRaw);
const reviewPaths=reviewArg.split(',').map(value=>value.trim()).filter(Boolean).map(value=>path.resolve(value));
if(!reviewPaths.length)throw new Error('At least one review file is required');

const manifestRaw=await readFile(manifestPath,'utf8');
const manifest=JSON.parse(manifestRaw);
if(manifest.status!=='audition-only')throw new Error('Release certification requires an audition-only package');
if(manifest.room!==slotRoom)throw new Error(`Release slot room ${slotRoom} does not match audition room ${manifest.room}`);
if(!manifest.packageId)throw new Error('Audition manifest is missing packageId');

const gate=spawnSync(process.execPath,[
  path.join(root,'scripts','music-review-gate.mjs'),
  '--stage','production',
  '--manifest',manifestPath,
  '--reviews',reviewPaths.join(',')
],{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});
if(gate.status!==0)throw new Error('Production review gate did not approve release candidate:\n'+String(gate.stdout||gate.stderr||'').trim());
let gateResult;
try{gateResult=JSON.parse(gate.stdout)}catch{throw new Error('Production review gate did not return parseable JSON')}
const approved=Array.isArray(gateResult.approved)?gateResult.approved:[];
const candidateId=requestedCandidate||approved[0];
if(!candidateId)throw new Error('Production review gate approved no candidate');
if(!approved.includes(candidateId))throw new Error('Requested candidate is not production-approved: '+candidateId);
const candidate=manifest.candidates?.find(entry=>entry.id===candidateId);
if(!candidate)throw new Error('Approved candidate is missing from audition manifest: '+candidateId);

const packageRoot=path.dirname(manifestPath),candidateRoot=path.resolve(packageRoot,'candidates');
const candidatePath=path.resolve(candidateRoot,String(candidate.file||''));
const relative=path.relative(candidateRoot,candidatePath);
if(!candidate.file||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Candidate file path is invalid');
const candidateBytes=await readFile(candidatePath);
const actualCandidateSha=createHash('sha256').update(candidateBytes).digest('hex');
if(actualCandidateSha.toLowerCase()!==String(candidate.sha256||'').toLowerCase())throw new Error('Candidate audio changed after review approval');

let masteringReportSha256=null;
if(manifest.source==='studio-master-intake'){
  const masteringRaw=await readFile(path.join(packageRoot,'mastering-report.json'),'utf8');
  masteringReportSha256=createHash('sha256').update(masteringRaw).digest('hex');
}
const reviewEvidence=[];
for(const reviewPath of reviewPaths){
  const raw=await readFile(reviewPath,'utf8'),review=JSON.parse(raw);
  reviewEvidence.push({
    reviewer:String(review.reviewer||'').trim(),
    sha256:createHash('sha256').update(raw).digest('hex')
  });
}
const gateCandidate=gateResult.results?.find(entry=>entry.candidateId===candidateId);
const manifestSha256=createHash('sha256').update(manifestRaw).digest('hex');
const certificateCore={
  schemaVersion:1,
  status:'approved-for-release-packaging',
  boundary:'This certificate records an explicit release decision. It does not deploy, publish, upload, or replace production audio.',
  packageId:manifest.packageId,
  target:{room:slotRoom,track:slotTrack,slot},
  candidate:{
    id:candidate.id,
    sha256:actualCandidateSha,
    title:candidate.title||null,
    sourceType:candidate.sourceType||candidate.generator||manifest.source||null,
    sourceRevision:candidate.sourceRevision||candidate.generator||null,
    rights:candidate.rights||null
  },
  evidence:{
    manifestSha256,
    masteringReportSha256,
    reviews:reviewEvidence,
    productionReview:{
      reviewers:gateCandidate?.reviewers??null,
      eligibleReviewers:gateCandidate?.eligibleReviewers??null,
      shortlistVotes:gateCandidate?.shortlistVotes??null,
      averages:gateCandidate?.averages??null
    }
  },
  operator,
  approvedAt:new Date().toISOString()
};
const certificateId=createHash('sha256').update(JSON.stringify(certificateCore)).digest('hex');
const certificate={...certificateCore,certificateId};
const outPath=path.resolve(arg('out',path.join(packageRoot,'release-certificate.json')));
try{
  await writeFile(outPath,JSON.stringify(certificate,null,2)+'\n',{flag:'wx'});
}catch(error){
  if(error?.code==='EEXIST')throw new Error('Release certificate already exists; preserve it and use a new --out path for a distinct release decision');
  throw error;
}
console.log(JSON.stringify({out:outPath,certificateId,status:certificate.status,target:certificate.target,candidate:certificate.candidate},null,2));
