import assert from 'node:assert/strict';
import { evaluateMusicCandidate, runMusicQualityAgent, SCHEMA } from './music-quality-agent.mjs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const first=evaluateMusicCandidate({room:'headspace',seed:'agent-smoke',role:1,bars:24});
const second=evaluateMusicCandidate({room:'headspace',seed:'agent-smoke',role:1,bars:24});

assert.equal(first.schema,SCHEMA);
assert.equal(first.hashes.source,second.hashes.source,'source candidate must be deterministic');
assert.equal(first.hashes.finished,second.hashes.finished,'finished candidate must be deterministic');
assert.notEqual(first.hashes.source,first.hashes.finished,'agent must compare distinct source/finished audio');
assert.equal(first.consensus.humanListeningRequired,true,'machine agent must require human listening');
assert.equal(first.consensus.canAutoApproveProduction,false,'machine agent must never auto-approve production');
assert.ok(['reject','eligible-for-human-review'].includes(first.consensus.machineGate));
assert.ok(first.specialists['signal-integrity'].length>=3,'signal specialist missing');
assert.ok(first.specialists['repetition-proxy'].length===1,'repetition specialist missing');
assert.ok(first.specialists['room-fit'].every(x=>x.status==='human'),'room fit must remain human-governed');
assert.match(first.releaseBoundary,/cannot truthfully certify musical taste/i);

const tmp=await mkdtemp(path.join(os.tmpdir(),'afterlight-music-agent-'));
try{
  const run=await runMusicQualityAgent({rooms:['rooftop','window'],seeds:['agent-smoke'],role:1,bars:24,out:tmp});
  assert.equal(run.summary.candidateCount,2);
  assert.equal(run.summary.humanListeningRequired,true);
  const summary=JSON.parse(await readFile(path.join(tmp,'summary.json'),'utf8'));
  assert.equal(summary.candidateCount,2);
  for(const item of summary.reports){
    assert.equal(typeof item.finishedSha256,'string');
    assert.equal(item.finishedSha256.length,64);
    assert.ok(['reject','eligible-for-human-review'].includes(item.machineGate));
  }
} finally {
  await rm(tmp,{recursive:true,force:true});
}

console.log('PASS music-quality-agent: deterministic specialist evidence, bounded machine gate, mandatory human listening');
