import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderMusicCandidate } from './audio-library.mjs';
import { processQualityV4 } from './music-quality-v4.mjs';

const FLAGSHIP_ROOMS=Object.freeze(['rooftop','window','headspace','last-bus']);
const DEFAULT_SEEDS=Object.freeze(['flagship-a','flagship-b','flagship-c']);
const REVIEW_FIELDS=Object.freeze(['roomFit','musicality','lowFatigue','variation','productionPolish']);
const PACK_VERSION='afterlight-audio-quality-v4-blind-pack-1';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const stableBit=value=>parseInt(createHash('sha256').update(value).digest('hex').slice(0,2),16)%2;

function sanitize(value){
  return String(value).trim().slice(0,80).replace(/[^A-Za-z0-9._-]+/g,'-')||'candidate';
}

function makeReviewTemplate({pairId,room,seed,role,bars,publicManifest}){
  return {
    version:2,
    pairId,
    room,
    candidate:{seed,role,bars},
    exactHashes:{A:publicManifest.hashes.A,B:publicManifest.hashes.B},
    reviewerId:'',
    minimumListeningSecondsPerVersion:90,
    listenedSeconds:{A:0,B:0},
    preferred:'',
    decision:'',
    scores:{
      A:Object.fromEntries(REVIEW_FIELDS.map(field=>[field,null])),
      B:Object.fromEntries(REVIEW_FIELDS.map(field=>[field,null]))
    },
    comments:{A:'',B:'',comparison:''},
    instructions:'Listen to A and B without opening the private truth map. Score each 1-5. preferred must be A, B, or tie; decision must be shortlist, rework, or reject. Do not edit pairId or exactHashes.'
  };
}

export function createBlindPair({room,seed,role=1,bars=48}={}){
  if(!room)throw new Error('room is required');
  const safeSeed=sanitize(seed||'flagship-a');
  const safeRole=Math.max(1,Math.min(3,Math.round(Number(role)||1)));
  const safeBars=Math.max(24,Math.min(96,Math.round(Number(bars)||48)));
  const source=Buffer.from(renderMusicCandidate({roomSlug:room,seed:safeSeed,trackRole:safeRole,bars:safeBars}).bytes);
  const finished=Buffer.from(processQualityV4(source).bytes);
  const sourceSha=sha256(source),finishedSha=sha256(finished);
  if(sourceSha===finishedSha)throw new Error('Blind pair source and finished render must differ');
  const pairId=sanitize(`${room}-${safeSeed}-r${safeRole}-b${safeBars}`);
  const finishedIsA=stableBit(`${pairId}:${sourceSha}:${finishedSha}`)===0;
  const A=finishedIsA?finished:source;
  const B=finishedIsA?source:finished;
  return {
    pairId,room,seed:safeSeed,role:safeRole,bars:safeBars,
    A,B,
    publicManifest:{
      version:PACK_VERSION,pairId,room,candidate:{seed:safeSeed,role:safeRole,bars:safeBars},
      files:{A:'A.wav',B:'B.wav'},
      hashes:{A:sha256(A),B:sha256(B)},
      reviewTemplate:'review.json',
      blinded:true,
      releaseBoundary:'Audition only. No result is production-approved without Music Lab thresholds, mastering certification, release certificate and hosted device UAT.'
    },
    truth:{pairId,room,sourceSha256:sourceSha,finishedSha256:finishedSha,finishedLabel:finishedIsA?'A':'B'}
  };
}

export async function writeBlindPack({rooms=FLAGSHIP_ROOMS,seeds=DEFAULT_SEEDS,role=1,bars=48,out='.music-lab/v4-blind'}={}){
  const safeRooms=[...new Set((Array.isArray(rooms)?rooms:String(rooms).split(',')).map(sanitize).filter(Boolean))];
  const safeSeeds=[...new Set((Array.isArray(seeds)?seeds:String(seeds).split(',')).map(sanitize).filter(Boolean))];
  if(!safeRooms.length||!safeSeeds.length)throw new Error('At least one room and seed are required');
  const outDir=path.resolve(process.cwd(),out),truth=[];await mkdir(outDir,{recursive:true});
  const pairs=[];
  for(const room of safeRooms){
    for(const seed of safeSeeds){
      const pair=createBlindPair({room,seed,role,bars});
      const pairDir=path.join(outDir,'blind',pair.pairId);await mkdir(pairDir,{recursive:true});
      await writeFile(path.join(pairDir,'A.wav'),pair.A);
      await writeFile(path.join(pairDir,'B.wav'),pair.B);
      await writeFile(path.join(pairDir,'manifest.json'),JSON.stringify(pair.publicManifest,null,2)+'\n');
      await writeFile(path.join(pairDir,'review.json'),JSON.stringify(makeReviewTemplate(pair),null,2)+'\n');
      truth.push(pair.truth);pairs.push(pair.publicManifest);
    }
  }
  const packManifest={
    version:PACK_VERSION,status:'audition-only',rooms:safeRooms,seeds:safeSeeds,role:Number(role),bars:Number(bars),
    pairCount:pairs.length,pairs,
    reviewerBoundary:'Reviewers should receive only the blind/ directory. Keep private/truth-map.json hidden until reviews are frozen.',
    releaseBoundary:'Blind preference is evidence, not release approval.'
  };
  const privateDir=path.join(outDir,'private');await mkdir(privateDir,{recursive:true});
  await writeFile(path.join(outDir,'pack-manifest.json'),JSON.stringify(packManifest,null,2)+'\n');
  await writeFile(path.join(privateDir,'truth-map.json'),JSON.stringify({version:PACK_VERSION,pairs:truth},null,2)+'\n');
  return {outDir,packManifest,truth};
}

function parseArgs(argv){
  const result={rooms:FLAGSHIP_ROOMS,seeds:DEFAULT_SEEDS,role:1,bars:48,out:'.music-lab/v4-blind'};
  for(let i=0;i<argv.length;i++){
    const key=argv[i],value=argv[i+1];
    if(key==='--rooms'&&value){result.rooms=value.split(',');i++}
    else if(key==='--seeds'&&value){result.seeds=value.split(',');i++}
    else if(key==='--role'&&value){result.role=Number(value);i++}
    else if(key==='--bars'&&value){result.bars=Number(value);i++}
    else if(key==='--out'&&value){result.out=value;i++}
  }
  return result;
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(invoked){
  const result=await writeBlindPack(parseArgs(process.argv.slice(2)));
  console.log(`PASS audio-quality-v4 blind pack: ${result.packManifest.pairCount} pairs -> ${result.outDir}`);
  console.log('Reviewer package: blind/ only. Keep private/truth-map.json hidden until reviews are frozen.');
}

export { FLAGSHIP_ROOMS, DEFAULT_SEEDS, REVIEW_FIELDS };
