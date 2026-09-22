import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd(),temp=await mkdtemp(path.join(tmpdir(),'afterlight-master-intake-'));
const audioPath=path.join(temp,'master.wav'),metadataPath=path.join(temp,'master.json'),out=path.join(temp,'package');
const sampleRate=32000,duration=92,frames=sampleRate*duration,channels=2,bits=16,dataBytes=frames*4;
const wav=Buffer.allocUnsafe(44+dataBytes);
wav.write('RIFF',0);wav.writeUInt32LE(36+dataBytes,4);wav.write('WAVE',8);wav.write('fmt ',12);
wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(channels,22);wav.writeUInt32LE(sampleRate,24);
wav.writeUInt32LE(sampleRate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(bits,34);wav.write('data',36);wav.writeUInt32LE(dataBytes,40);
for(let i=0;i<frames;i++){
  const t=i/sampleRate,env=Math.min(1,t/1.2,(duration-t)/1.5);
  const l=.20*Math.sin(Math.PI*2*220*t)*env+.022*Math.sin(Math.PI*2*440*t)*env;
  const r=.19*Math.sin(Math.PI*2*223*t+.18)*env+.024*Math.sin(Math.PI*2*447*t+.35)*env;
  wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,l))*32767),44+i*4);
  wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,r))*32767),46+i*4);
}
await writeFile(audioPath,wav);
await writeFile(metadataPath,JSON.stringify({schemaVersion:1,id:'rooftop-studio-smoke',room:'rooftop',title:'Studio intake smoke',sourceType:'open-music-studio',rightsStatus:'first-party',creator:'Afterlight CI',sourceRevision:'ci-fixture-v2-mastering',commercialUseCleared:true,containsThirdPartySamples:false,aiAssisted:true,modelDisclosure:'synthetic CI fixture; no external model'},null,2));

function run(command,args){return spawnSync(command,args,{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024})}
function expect(label,condition,result){if(condition)return;throw new Error(label+' failed\nstdout:\n'+(result?.stdout||'')+'\nstderr:\n'+(result?.stderr||''))}

try{
  let result=run(process.execPath,[path.join(root,'scripts','music-master-intake.mjs'),'--audio',audioPath,'--metadata',metadataPath,'--out',out]);
  expect('master intake',result.status===0,result);
  const manifestPath=path.join(out,'manifest.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  expect('audition-only package',manifest.status==='audition-only'&&manifest.source==='studio-master-intake');
  expect('exact master candidate',manifest.candidates?.length===1&&manifest.candidates[0].metrics?.technicalPass===true);
  expect('review package binding',Boolean(manifest.packageId)&&/^[0-9a-f]{64}$/.test(manifest.candidates[0].sha256));

  const candidate=manifest.candidates[0];
  const makeReview=async(name,reviewer)=>{
    const file=path.join(temp,name+'.json');
    await writeFile(file,JSON.stringify({schemaVersion:1,packageId:manifest.packageId,room:manifest.room,reviewer,reviews:[{candidateId:candidate.id,candidateSha256:candidate.sha256,listenedSeconds:90,scores:{roomFit:4,musicality:4,fatigueResistance:4,variation:4,productionPolish:4},decision:'shortlist',notes:'CI acceptance fixture'}]}));
    return file;
  };
  const alice=await makeReview('alice','Alice'),bob=await makeReview('bob','Bob'),reviewArgs=alice+','+bob;

  result=run(process.execPath,[path.join(root,'scripts','music-review-gate.mjs'),'--stage','production','--manifest',manifestPath,'--reviews',reviewArgs]);
  expect('production gate must reject studio master before mastering certification',result.status!==0,result);
  expect('missing mastering report reason',/mastering report missing or unreadable/.test(result.stdout),result);

  result=run(process.execPath,[path.join(root,'scripts','music-mastering-certify.mjs'),'--manifest',manifestPath]);
  expect('mastering certification',result.status===0,result);
  const mastering=JSON.parse(await readFile(path.join(out,'mastering-report.json'),'utf8'));
  expect('mastering report passes',mastering.pass===true&&mastering.candidates?.[0]?.pass===true);
  expect('mastering metrics are finite',Number.isFinite(mastering.candidates[0].metrics?.integratedLufs)&&Number.isFinite(mastering.candidates[0].metrics?.truePeakDbtp)&&Number.isFinite(mastering.candidates[0].metrics?.loudnessRangeLu));
  expect('mastering report binds candidate',mastering.candidates[0].candidateSha256===candidate.sha256);

  result=run(process.execPath,[path.join(root,'scripts','music-review-gate.mjs'),'--stage','production','--manifest',manifestPath,'--reviews',reviewArgs]);
  expect('studio master production review compatibility after mastering',result.status===0,result);
  const gated=JSON.parse(result.stdout);
  expect('review gate approves mastered imported master',gated.approved?.[0]===candidate.id,result);

  const certificateArgs=[path.join(root,'scripts','music-release-certificate.mjs'),'--manifest',manifestPath,'--reviews',reviewArgs,'--operator','CI Release Operator','--slot','rooftop:1','--candidate',candidate.id];
  result=run(process.execPath,certificateArgs);
  expect('release certificate creation',result.status===0,result);
  const releaseCertificate=JSON.parse(await readFile(path.join(out,'release-certificate.json'),'utf8'));
  expect('release certificate remains non-publishing',releaseCertificate.status==='approved-for-release-packaging'&&/does not deploy, publish, upload, or replace production audio/i.test(releaseCertificate.boundary));
  expect('release certificate target binding',releaseCertificate.target?.slot==='rooftop:1'&&releaseCertificate.candidate?.sha256===candidate.sha256);
  expect('release certificate evidence binding',Boolean(releaseCertificate.evidence?.manifestSha256)&&Boolean(releaseCertificate.evidence?.masteringReportSha256)&&releaseCertificate.evidence?.reviews?.length===2);
  expect('release certificate id',/^[0-9a-f]{64}$/.test(releaseCertificate.certificateId||''));
  result=run(process.execPath,certificateArgs);
  expect('release certificate cannot be silently overwritten',result.status!==0&&/already exists/.test(result.stderr),result);

  await writeFile(path.join(out,'candidates','master.wav'),Buffer.from('tampered'));
  result=run(process.execPath,[path.join(root,'scripts','music-review-gate.mjs'),'--stage','production','--manifest',manifestPath,'--reviews',reviewArgs]);
  expect('tampered imported master fails gate',result.status!==0,result);
  const tamperedOut=path.join(out,'tampered-release-certificate.json');
  result=run(process.execPath,[...certificateArgs,'--out',tamperedOut]);
  expect('tampered imported master cannot receive release certificate',result.status!==0,result);

  console.log('PASS studio master intake: WAV validation, provenance, mastering certification, human production review, create-only non-publishing release certificate, and SHA tamper binding');
}finally{
  await rm(temp,{recursive:true,force:true});
}
