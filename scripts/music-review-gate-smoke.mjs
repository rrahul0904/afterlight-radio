import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd();
const gate=path.join(root,'scripts','music-review-gate.mjs');
const temp=await mkdtemp(path.join(tmpdir(),'afterlight-review-gate-'));
const candidateDir=path.join(temp,'candidates');
await mkdir(candidateDir,{recursive:true});
const candidatePath=path.join(candidateDir,'a.wav');
const original=Buffer.from('afterlight-review-gate-fixture-v1');
await writeFile(candidatePath,original);
const sha256=createHash('sha256').update(original).digest('hex');

const packageId='fixture-package-'+sha256.slice(0,16);
const manifest={
  schemaVersion:1,
  status:'audition-only',
  packageId,
  room:'rooftop',
  candidates:[{
    id:'rooftop-A',
    file:'a.wav',
    sha256,
    rights:'first-party procedural candidate; not production-approved',
    generator:'afterlight-composition-engine-v3-lab',
    metrics:{technicalPass:true}
  }]
};
const manifestPath=path.join(temp,'manifest.json');
await writeFile(manifestPath,JSON.stringify(manifest));

const baseScores={roomFit:4,musicality:4,fatigueResistance:4,variation:4,productionPolish:4};
async function review(name,reviewer,{seconds=60,decision='shortlist',scores=baseScores}={}){
  const file=path.join(temp,name+'.json');
  await writeFile(file,JSON.stringify({
    schemaVersion:1,packageId,room:'rooftop',reviewer,
    reviews:[{candidateId:'rooftop-A',candidateSha256:sha256,listenedSeconds:seconds,scores,decision,notes:''}]
  }));
  return file;
}
function run(stage,files){
  return spawnSync(process.execPath,[gate,'--stage',stage,'--manifest',manifestPath,'--reviews',files.join(',')],{
    cwd:root,encoding:'utf8'
  });
}
function expect(label,condition,result){
  if(condition)return;
  throw new Error(label+' failed\\nstdout:\\n'+(result?.stdout||'')+'\\nstderr:\\n'+(result?.stderr||''));
}

try{
  const alice=await review('alice','Alice',{seconds:90});
  let result=run('beta',[alice]);
  expect('valid beta review should pass',result.status===0,result);

  const bobNoListen=await review('bob-no-listen','Bob',{seconds:0});
  const aliceRework=await review('alice-rework','Alice',{seconds:60,decision:'rework'});
  result=run('beta',[aliceRework,bobNoListen]);
  expect('unqualified shortlist vote must not pass',result.status!==0,result);

  const badScores=await review('bad-scores','Carol',{seconds:60,scores:{...baseScores,musicality:7}});
  result=run('beta',[badScores]);
  expect('out-of-range score must fail',result.status!==0,result);

  const sameAlice=await review('same-alice','Alice',{seconds:90});
  result=run('production',[alice,sameAlice]);
  expect('duplicate reviewer identity must fail',result.status!==0,result);

  const bob=await review('bob','Bob',{seconds:90});
  result=run('production',[alice,bob]);
  expect('two distinct production reviewers should pass',result.status===0,result);

  await writeFile(candidatePath,Buffer.from('tampered-audio'));
  result=run('beta',[alice]);
  expect('candidate hash mismatch must fail',result.status!==0,result);
  await writeFile(candidatePath,original);

  result=run('production',[alice,alice]);
  expect('duplicate review paths must fail',result.status!==0,result);

  const stale=path.join(temp,'stale.json');
  await writeFile(stale,JSON.stringify({
    schemaVersion:1,packageId:'older-package',room:'rooftop',reviewer:'Dora',
    reviews:[{candidateId:'rooftop-A',candidateSha256:sha256,listenedSeconds:90,scores:baseScores,decision:'shortlist',notes:''}]
  }));
  result=run('beta',[stale]);
  expect('review from older audition package must fail',result.status!==0,result);

  const wrongHash=path.join(temp,'wrong-hash.json');
  await writeFile(wrongHash,JSON.stringify({
    schemaVersion:1,packageId,room:'rooftop',reviewer:'Evan',
    reviews:[{candidateId:'rooftop-A',candidateSha256:'0'.repeat(64),listenedSeconds:90,scores:baseScores,decision:'shortlist',notes:''}]
  }));
  result=run('beta',[wrongHash]);
  expect('review bound to a different candidate hash must fail',result.status!==0,result);

  const output=JSON.parse(run('beta',[alice]).stdout);
  expect('passing result should approve the expected candidate',output.approved?.[0]==='rooftop-A');

  console.log('PASS Music Lab review gate: qualified shortlist, score bounds, unique reviewers, package binding, and SHA binding');
}finally{
  await rm(temp,{recursive:true,force:true});
}
