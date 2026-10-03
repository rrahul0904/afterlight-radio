import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const THRESHOLDS=Object.freeze({roomFit:4,musicality:4,lowFatigue:4,variation:3.5,productionPolish:4});
const SCORE_FIELDS=Object.freeze(Object.keys(THRESHOLDS));

function assertScore(value,label){
  if(typeof value!=='number'||!Number.isFinite(value)||value<1||value>5)throw new Error(`${label} must be a number from 1 to 5`);
}

function average(values){return values.reduce((sum,value)=>sum+value,0)/Math.max(1,values.length)}

export function validateBlindReview(review,{pairId}={}){
  if(!review||typeof review!=='object')throw new Error('Review must be an object');
  if(pairId&&review.pairId!==pairId)throw new Error(`Review pairId mismatch: expected ${pairId}`);
  const reviewerId=String(review.reviewerId||'').trim();
  if(!reviewerId)throw new Error('reviewerId is required');
  const listenedA=Number(review.listenedSeconds?.A||0),listenedB=Number(review.listenedSeconds?.B||0);
  if(listenedA<90||listenedB<90)throw new Error('Each reviewer must listen to at least 90 seconds of both A and B');
  if(!['A','B','tie'].includes(review.preferred))throw new Error('preferred must be A, B, or tie');
  if(!['shortlist','rework','reject'].includes(review.decision))throw new Error('decision must be shortlist, rework, or reject');
  for(const label of ['A','B']){
    if(!review.scores?.[label])throw new Error(`scores.${label} is required`);
    for(const field of SCORE_FIELDS)assertScore(review.scores[label][field],`scores.${label}.${field}`);
  }
  return {...review,reviewerId,listenedSeconds:{A:listenedA,B:listenedB}};
}

export function evaluateBlindPair({manifest,truth,reviews}){
  if(!manifest?.pairId||manifest.blinded!==true)throw new Error('A valid blinded pair manifest is required');
  if(!truth||truth.pairId!==manifest.pairId)throw new Error('Private truth map does not match pair manifest');
  if(!['A','B'].includes(truth.finishedLabel))throw new Error('truth.finishedLabel must be A or B');
  if(!Array.isArray(reviews)||reviews.length<2)throw new Error('At least two completed reviews are required');
  const validated=reviews.map(review=>validateBlindReview(review,{pairId:manifest.pairId}));
  const ids=new Set(validated.map(review=>review.reviewerId.toLowerCase()));
  if(ids.size!==validated.length)throw new Error('Reviewer identities must be unique');

  const finished=truth.finishedLabel,source=finished==='A'?'B':'A';
  const finishedVotes=validated.filter(review=>review.preferred===finished).length;
  const sourceVotes=validated.filter(review=>review.preferred===source).length;
  const ties=validated.filter(review=>review.preferred==='tie').length;
  const finishedScores=Object.fromEntries(SCORE_FIELDS.map(field=>[field,average(validated.map(review=>review.scores[finished][field]))]));
  const sourceScores=Object.fromEntries(SCORE_FIELDS.map(field=>[field,average(validated.map(review=>review.scores[source][field]))]));
  const thresholdPass=Object.fromEntries(SCORE_FIELDS.map(field=>[field,finishedScores[field]>=THRESHOLDS[field]]));
  const allThresholdsPass=Object.values(thresholdPass).every(Boolean);
  const allShortlist=validated.every(review=>review.decision==='shortlist');
  const unanimousFinishedPreference=finishedVotes===validated.length;
  const advanceToMastering=allThresholdsPass&&allShortlist&&unanimousFinishedPreference;

  return {
    version:'afterlight-audio-quality-v4-review-gate-1',
    pairId:manifest.pairId,
    room:manifest.room,
    reviewedAt:new Date().toISOString(),
    reviewerCount:validated.length,
    exactHashes:{A:manifest.hashes?.A||null,B:manifest.hashes?.B||null},
    unblindedAfterReview:{finishedLabel:finished,sourceLabel:source},
    preference:{finishedVotes,sourceVotes,ties,unanimousFinishedPreference},
    meanScores:{finished:finishedScores,source:sourceScores},
    thresholds:{required:THRESHOLDS,finishedPass:thresholdPass,allThresholdsPass},
    allShortlist,
    advanceToMastering,
    status:advanceToMastering?'eligible-for-mastering-evaluation':'do-not-advance',
    boundary:'This gate never publishes audio. A passing candidate still requires FFmpeg mastering certification, existing production review, release certificate and hosted multi-device listening UAT.'
  };
}

export async function evaluateBlindPack({pairDir,truthMapPath,reviewsDir,out}={}){
  if(!pairDir||!truthMapPath||!reviewsDir)throw new Error('pairDir, truthMapPath and reviewsDir are required');
  const manifest=JSON.parse(await readFile(path.join(pairDir,'manifest.json'),'utf8'));
  const truthMap=JSON.parse(await readFile(truthMapPath,'utf8'));
  const truth=truthMap.pairs?.find(entry=>entry.pairId===manifest.pairId);
  if(!truth)throw new Error(`No truth entry for ${manifest.pairId}`);
  const index=JSON.parse(await readFile(path.join(reviewsDir,'reviews.json'),'utf8'));
  if(!Array.isArray(index.reviews))throw new Error('reviews.json must contain a reviews array');
  const reviews=[];
  for(const filename of index.reviews){
    const safe=path.basename(String(filename));
    if(safe!==filename||!safe.endsWith('.json'))throw new Error(`Unsafe review filename: ${filename}`);
    reviews.push(JSON.parse(await readFile(path.join(reviewsDir,safe),'utf8')));
  }
  const report=evaluateBlindPair({manifest,truth,reviews});
  if(out)await writeFile(out,JSON.stringify(report,null,2)+'\n');
  return report;
}

function parseArgs(argv){
  const result={};
  for(let i=0;i<argv.length;i++){
    const key=argv[i],value=argv[i+1];
    if(key==='--pair'&&value){result.pairDir=value;i++}
    else if(key==='--truth'&&value){result.truthMapPath=value;i++}
    else if(key==='--reviews'&&value){result.reviewsDir=value;i++}
    else if(key==='--out'&&value){result.out=value;i++}
  }
  return result;
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(invoked){
  const args=parseArgs(process.argv.slice(2));
  const report=await evaluateBlindPack(args);
  console.log(`${report.advanceToMastering?'PASS':'HOLD'} audio-quality-v4 review gate ${report.pairId}: ${report.status}`);
  console.log(`finished preference ${report.preference.finishedVotes}/${report.reviewerCount}; thresholds=${report.thresholds.allThresholdsPass}; shortlist=${report.allShortlist}`);
  if(!report.advanceToMastering)process.exitCode=2;
}

export { THRESHOLDS, SCORE_FIELDS };
