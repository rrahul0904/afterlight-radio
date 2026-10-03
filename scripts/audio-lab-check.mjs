import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

if(process.env.AFTERLIGHT_AUDIO_LAB!=='1'){
  console.log('SKIP audio-lab-check: AFTERLIGHT_AUDIO_LAB is not enabled');
  process.exit(0);
}

const root=process.cwd(),lab=path.join(root,'public','audio-lab');
const expected=['rooftop','window','headspace','last-bus'];
const manifest=JSON.parse(await readFile(path.join(lab,'manifest.json'),'utf8'));
assert.equal(manifest.schema,'afterlight-audio-lab/v1');
assert.equal(manifest.status,'audition-only');
assert.equal(manifest.blinded,true);
assert.equal(manifest.candidateSeed,'flagship-a');
assert.equal(manifest.candidateBars,32);
assert.deepEqual(manifest.rooms.map(x=>x.room),expected);
if(process.env.AFTERLIGHT_RELEASE_SHA)assert.equal(manifest.releaseSha,process.env.AFTERLIGHT_RELEASE_SHA,'Audio Lab release marker drifted');

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const room of manifest.rooms){
  assert.equal(room.blinded,true,`${room.room} must stay blinded`);
  assert.ok(room.durationSeconds>=90,`${room.room} must provide at least 90 seconds per blind version`);
  assert.equal(room.minimumListeningSecondsPerVersion,90,`${room.room} review minimum drifted`);
  const aPath=path.join(root,'public',room.files.A.replace(/^\//,''));
  const bPath=path.join(root,'public',room.files.B.replace(/^\//,''));
  const [a,b,aStat,bStat]=await Promise.all([readFile(aPath),readFile(bPath),stat(aPath),stat(bPath)]);
  assert.ok(aStat.size>1_000_000&&bStat.size>1_000_000,`${room.room} audition WAVs are implausibly small`);
  assert.notEqual(sha(a),sha(b),`${room.room} blind versions must differ`);
  assert.equal(sha(a),room.hashes.A,`${room.room} A hash mismatch`);
  assert.equal(sha(b),room.hashes.B,`${room.room} B hash mismatch`);
}

for(const forbiddenPath of ['private/truth-map.json','music-agent-summary.json']){
  let leaked=false;
  try{await access(path.join(lab,forbiddenPath));leaked=true}catch{}
  assert.equal(leaked,false,`Blind Audio Lab must not ship treatment-revealing evidence: ${forbiddenPath}`);
}

const html=await readFile(path.join(lab,'index.html'),'utf8');
assert.match(html,/localStorage/,'Audio Lab must keep review state local');
assert.match(html,/Export review JSON/,'Audio Lab must provide explicit local export');
for(const forbidden of ['sendBeacon','XMLHttpRequest','FormData','google-analytics','segment.io','mixpanel']){
  assert.equal(html.includes(forbidden),false,`Audio Lab must not contain review-upload/analytics primitive: ${forbidden}`);
}

console.log(`PASS audio-lab: ${manifest.rooms.length} blind flagship rooms, >=90s each, exact hashes, no treatment evidence, local-only review state`);
