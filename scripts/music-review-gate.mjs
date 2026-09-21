import { readFile } from 'node:fs/promises';
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

const root=process.cwd();
const policy=JSON.parse(await readFile(path.join(root,'music','catalog-policy.json'),'utf8'));
const rules=policy[stage];
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const reviews=[];
for(const reviewPath of reviewPaths){
  const review=JSON.parse(await readFile(reviewPath,'utf8'));
  if(review.room!==manifest.room)throw new Error('Review room does not match manifest: '+reviewPath);
  reviews.push({path:reviewPath,...review});
}
if(reviews.length<rules.minimumReviewers)throw new Error(stage+' review requires at least '+rules.minimumReviewers+' reviewer files');

const byId=new Map(manifest.candidates.map(candidate=>[candidate.id,[]]));
for(const review of reviews){
  const seen=new Set();
  for(const item of review.reviews||[]){
    if(!byId.has(item.candidateId)||seen.has(item.candidateId))continue;
    seen.add(item.candidateId);
    byId.get(item.candidateId).push(item);
  }
}

const results=[];
for(const candidate of manifest.candidates){
  const candidateReviews=byId.get(candidate.id)||[];
  const reasons=[];
  if(!candidate.metrics?.technicalPass)reasons.push('technical QC failed');
  if(!String(candidate.rights||'').startsWith('first-party'))reasons.push('rights/provenance is not first-party');
  if(candidateReviews.length<rules.minimumReviewers)reasons.push('insufficient reviewer coverage');

  const valid=candidateReviews.filter(review=>Number(review.listenedSeconds)>=rules.minimumListenedSeconds);
  if(valid.length<rules.minimumReviewers)reasons.push('insufficient listening time');
  if(candidateReviews.some(review=>review.decision==='reject'))reasons.push('received reject decision');
  const shortlistVotes=candidateReviews.filter(review=>review.decision==='shortlist').length;
  if(shortlistVotes<rules.minimumShortlistVotes)reasons.push('not enough shortlist votes');

  const averages={};
  for(const [key,minimum] of Object.entries(rules.minimumScores)){
    const scores=valid.map(review=>Number(review.scores?.[key])).filter(Number.isFinite);
    averages[key]=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null;
    if(scores.length<rules.minimumReviewers||averages[key]<minimum)reasons.push(key+' below '+minimum);
  }

  results.push({
    candidateId:candidate.id,
    approved:reasons.length===0,
    reviewers:candidateReviews.length,
    shortlistVotes,
    averages,
    reasons
  });
}
const approved=results.filter(result=>result.approved);
console.log(JSON.stringify({stage,room:manifest.room,approved:approved.map(x=>x.candidateId),results},null,2));
if(!approved.length)process.exitCode=1;
