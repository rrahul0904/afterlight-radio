import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { analyzeMastering, loadMasteringPolicy } from './music-mastering.mjs';

const args=process.argv.slice(2);
const arg=(name,fallback)=>{
  const i=args.indexOf('--'+name);
  return i>=0&&args[i+1]!==undefined?args[i+1]:fallback;
};
const manifestPath=path.resolve(arg('manifest','.music-lab/imported-master/manifest.json'));
const packageRoot=path.dirname(manifestPath);
const outputPath=path.resolve(arg('out',path.join(packageRoot,'mastering-report.json')));
const manifestRaw=await readFile(manifestPath,'utf8');
const manifest=JSON.parse(manifestRaw);
if(manifest.status!=='audition-only')throw new Error('Mastering certification only accepts audition packages');
if(!manifest.packageId)throw new Error('Audition manifest is missing packageId');
if(!Array.isArray(manifest.candidates)||!manifest.candidates.length)throw new Error('Audition manifest has no candidates');

const {policy,sha256:policySha256}=await loadMasteringPolicy();
const candidateRoot=path.resolve(packageRoot,'candidates');
const reports=[];
for(const candidate of manifest.candidates){
  const file=String(candidate.file||'').trim();
  if(!file)throw new Error('Candidate file missing: '+candidate.id);
  const audioPath=path.resolve(candidateRoot,file);
  const relative=path.relative(candidateRoot,audioPath);
  if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Candidate file escapes audition package: '+candidate.id);
  const bytes=await readFile(audioPath);
  const actualSha256=createHash('sha256').update(bytes).digest('hex');
  if(actualSha256.toLowerCase()!==String(candidate.sha256||'').toLowerCase())throw new Error('Candidate SHA-256 mismatch before mastering analysis: '+candidate.id);
  const report=await analyzeMastering({audioPath,candidateSha256:actualSha256});
  reports.push({candidateId:candidate.id,...report});
}

const output={
  schemaVersion:1,
  packageId:manifest.packageId,
  manifestSha256:createHash('sha256').update(manifestRaw).digest('hex'),
  generatedAt:new Date().toISOString(),
  policy:{schemaVersion:policy.schemaVersion,sha256:policySha256,name:policy.name,basis:policy.basis},
  candidates:reports,
  pass:reports.every(report=>report.pass)
};
await writeFile(outputPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({output:outputPath,packageId:manifest.packageId,pass:output.pass,candidates:reports.map(report=>({candidateId:report.candidateId,pass:report.pass,metrics:report.metrics,reasons:report.reasons}))},null,2));
if(!output.pass)process.exitCode=1;
