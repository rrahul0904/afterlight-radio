import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const args=process.argv.slice(2);
const arg=(name,fallback)=>{
  const i=args.indexOf('--'+name);
  return i>=0&&args[i+1]!==undefined?args[i+1]:fallback;
};
const manifestPath=path.resolve(arg('manifest','.music-lab/rooftop/manifest.json'));
const reviewArg=arg('reviews','');
const stage=arg('stage','beta');
if(!['beta','production'].includes(stage))throw new Error('--stage must be beta or production');
const reviewPaths=reviewArg.split(',').map(x=>x.trim()).filter(Boolean).map(x=>path.resolve(x));
if(!reviewPaths.length)throw new Error('Provide one or more comma-separated review JSON files with --reviews');
if(new Set(reviewPaths).size!==reviewPaths.length)throw new Error('Duplicate review file paths are not allowed');

const root=process.cwd();
const policy=JSON.parse(await readFile(path.join(root,'music','catalog-policy.json'),'utf8'));
const rules=policy[stage];
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const reviews=[];
const reviewerIds=new Set();
for(const reviewPath of reviewPaths){
  const review=JSON.parse(await readFile(reviewPath,'utf8'));
  if(review.room!==manifest.room)throw new Error('Review room does not match manifest: '+reviewPath);
  if(!manifest.packageId||review.packageId!==manifest.packageId)throw new Error('Review package does not match audition manifest: '+reviewPath);
  const reviewer=String(review.reviewer||'').trim();
  if(!reviewer)throw new Error('Review is missing reviewer identity: '+reviewPath);
  const reviewerId=reviewer.toLocaleLowerCase('en-US');
  if(reviewerIds.has(reviewerId))throw new Error('Duplicate reviewer identity: '+reviewer);
  reviewerIds.add(reviewerId);
  reviews.push({path:reviewPath,...review,reviewer});
}
if(reviews.length<rules.minimumReviewers)throw new Error(stage+' review requires at least '+rules.minimumReviewers+' reviewer files');

const packageRoot=path.dirname(manifestPath);
const candidateRoot=path.resolve(packageRoot,'candidates');
const byId=new Map(manifest.candidates.map(candidate=>[candidate.id,[]]));
for(const review of reviews){
  const seen=new Set();
  for(const item of review.reviews||[]){
    if(!byId.has(item.candidateId)||seen.has(item.candidateId))continue;
    const candidate=manifest.candidates.find(entry=>entry.id===item.candidateId);
    if(!candidate||String(item.candidateSha256||'').toLowerCase()!==String(candidate.sha256||'').toLowerCase())continue;
    seen.add(item.candidateId);
    byId.get(item.candidateId).push({...item,reviewer:review.reviewer});
  }
}

const results=[];
for(const candidate of manifest.candidates){
  const candidateReviews=byId.get(candidate.id)||[];
  const reasons=[];
  if(!candidate.metrics?.technicalPass)reasons.push('technical QC failed');
  const rights=String(candidate.rights||'').trim();
  const rightsCleared=rights.startsWith('first-party')||
    (rights==='licensed-for-afterlight'&&candidate.commercialUseCleared===true&&String(candidate.licenseReference||'').trim());
  if(!rightsCleared)reasons.push('rights/provenance is not first-party or explicitly licensed');
  if(candidate.containsThirdPartySamples===true&&!String(candidate.thirdPartyClearanceReference||'').trim())reasons.push('third-party sample clearance is missing');
  if(!String(candidate.sourceRevision||candidate.generator||'').trim())reasons.push('source revision/provenance is missing');
  if(candidateReviews.length<rules.minimumReviewers)reasons.push('insufficient reviewer coverage');

  const candidateFile=String(candidate.file||'').trim();
  let hashMatches=false;
  if(!candidateFile){
    reasons.push('candidate file missing');
  }else{
    const candidatePath=path.resolve(candidateRoot,candidateFile);
    const relative=path.relative(candidateRoot,candidatePath);
    if(relative.startsWith('..')||path.isAbsolute(relative)){
      reasons.push('candidate file escapes audition package');
    }else{
      try{
        const bytes=await readFile(candidatePath);
        const actualHash=createHash('sha256').update(bytes).digest('hex');
        hashMatches=/^[0-9a-f]{64}$/i.test(String(candidate.sha256||''))&&actualHash.toLowerCase()===String(candidate.sha256).toLowerCase();
      }catch{
        reasons.push('candidate file unreadable');
      }
      if(!hashMatches&&!reasons.includes('candidate file unreadable'))reasons.push('candidate SHA-256 mismatch');
    }
  }

  const valid=candidateReviews.filter(review=>Number(review.listenedSeconds)>=rules.minimumListenedSeconds);
  if(valid.length<rules.minimumReviewers)reasons.push('insufficient listening time');
  if(candidateReviews.some(review=>review.decision==='reject'))reasons.push('received reject decision');
  const shortlistVotes=valid.filter(review=>review.decision==='shortlist').length;
  if(shortlistVotes<rules.minimumShortlistVotes)reasons.push('not enough shortlist votes');

  const averages={};
  for(const [key,minimum] of Object.entries(rules.minimumScores)){
    const scores=valid.map(review=>Number(review.scores?.[key])).filter(score=>Number.isFinite(score)&&score>=1&&score<=5);
    averages[key]=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null;
    if(scores.length<valid.length)reasons.push(key+' has invalid or missing score');
    if(scores.length<rules.minimumReviewers||averages[key]<minimum)reasons.push(key+' below '+minimum);
  }

  results.push({
    candidateId:candidate.id,
    approved:reasons.length===0,
    reviewers:candidateReviews.length,
    eligibleReviewers:valid.length,
    shortlistVotes,
    averages,
    reasons:[...new Set(reasons)]
  });
}
const approved=results.filter(result=>result.approved);
console.log(JSON.stringify({stage,room:manifest.room,approved:approved.map(x=>x.candidateId),results},null,2));
if(!approved.length)process.exitCode=1;
