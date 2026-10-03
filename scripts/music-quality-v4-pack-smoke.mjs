import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createBlindPair, writeBlindPack } from './music-quality-v4-pack.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const first=createBlindPair({room:'headspace',seed:'pack-smoke',role:1,bars:24});
const second=createBlindPair({room:'headspace',seed:'pack-smoke',role:1,bars:24});

assert.equal(first.pairId,second.pairId,'pair identity must be deterministic');
assert.equal(first.truth.finishedLabel,second.truth.finishedLabel,'blind label assignment must be deterministic');
assert.equal(hash(first.A),hash(second.A),'A render must be deterministic');
assert.equal(hash(first.B),hash(second.B),'B render must be deterministic');
assert.notEqual(hash(first.A),hash(first.B),'blind pair must contain two distinct renders');
assert.ok(['A','B'].includes(first.truth.finishedLabel),'truth map must identify one finished label');
assert.equal(first.publicManifest.blinded,true,'public manifest must remain explicitly blinded');
assert.equal('finishedLabel' in first.publicManifest,false,'public manifest must not reveal treatment identity');

const tmp=await mkdtemp(path.join(os.tmpdir(),'afterlight-v4-pack-'));
try{
  const result=await writeBlindPack({rooms:['headspace'],seeds:['pack-smoke'],role:1,bars:24,out:tmp});
  assert.equal(result.packManifest.pairCount,1,'smoke pack must contain one pair');
  const pairId=result.packManifest.pairs[0].pairId;
  const manifest=JSON.parse(await readFile(path.join(tmp,'blind',pairId,'manifest.json'),'utf8'));
  const review=JSON.parse(await readFile(path.join(tmp,'blind',pairId,'review.json'),'utf8'));
  const truth=JSON.parse(await readFile(path.join(tmp,'private','truth-map.json'),'utf8'));
  const a=await readFile(path.join(tmp,'blind',pairId,'A.wav'));
  const b=await readFile(path.join(tmp,'blind',pairId,'B.wav'));
  assert.equal(manifest.hashes.A,hash(a),'A hash receipt must bind exact file');
  assert.equal(manifest.hashes.B,hash(b),'B hash receipt must bind exact file');
  assert.deepEqual(review.exactHashes,manifest.hashes,'review template must bind the exact A/B files');
  assert.equal(review.preferred,'','review must start undecided');
  assert.equal(review.listenedSeconds.A,0,'review listening evidence must start empty');
  assert.equal(review.listenedSeconds.B,0,'review listening evidence must start empty');
  assert.equal(truth.pairs.length,1,'private truth map must bind the pair');
  assert.equal(truth.pairs[0].pairId,pairId,'truth map pair identity mismatch');
} finally {
  await rm(tmp,{recursive:true,force:true});
}

console.log('PASS audio-quality-v4 blind-pack: deterministic blinding, exact hashes, hash-bound review template, separated truth map, empty review evidence');
