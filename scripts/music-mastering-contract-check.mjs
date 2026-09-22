import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const policy=JSON.parse(await readFile(path.join(root,'music','mastering-policy.json'),'utf8'));
const analyzer=await readFile(path.join(root,'scripts','music-mastering.mjs'),'utf8');
const certify=await readFile(path.join(root,'scripts','music-mastering-certify.mjs'),'utf8');
const gate=await readFile(path.join(root,'scripts','music-review-gate.mjs'),'utf8');

if(policy.schemaVersion!==1)throw new Error('Mastering policy schema drifted');
if(policy.integratedLufs?.target!==-16||policy.integratedLufs?.min!==-20||policy.integratedLufs?.max!==-13)throw new Error('Mastering loudness window drifted');
if(policy.truePeakDbtp?.max!==-1)throw new Error('Mastering true-peak ceiling drifted');
if(policy.loudnessRangeLu?.max!==18)throw new Error('Mastering loudness-range ceiling drifted');
for(const needle of ['FFmpeg is required','loudnorm=I=','input_i','input_tp','input_lra','policySha256','candidateSha256']){
  if(!analyzer.includes(needle))throw new Error('Mastering analyzer contract missing: '+needle);
}
for(const needle of ['mastering-report.json','manifestSha256','packageId','analyzeMastering','Candidate SHA-256 mismatch before mastering analysis']){
  if(!certify.includes(needle))throw new Error('Mastering certification contract missing: '+needle);
}
for(const needle of ['mastering report missing or unreadable','mastering report policy is stale','mastering report candidate SHA mismatch','mastering certification failed']){
  if(!gate.includes(needle))throw new Error('Production mastering gate missing: '+needle);
}
console.log('PASS mastering contract: LUFS window, true-peak/LRA ceiling, exact-package evidence, and production fail-closed gate');
