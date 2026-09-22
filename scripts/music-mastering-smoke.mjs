import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd(),temp=await mkdtemp(path.join(tmpdir(),'afterlight-mastering-smoke-'));
const out=path.join(temp,'package'),candidateDir=path.join(out,'candidates'),audioPath=path.join(candidateDir,'quiet.wav');
await mkdir(candidateDir,{recursive:true});
const sampleRate=32000,duration=30,frames=sampleRate*duration,dataBytes=frames*4,wav=Buffer.allocUnsafe(44+dataBytes);
wav.write('RIFF',0);wav.writeUInt32LE(36+dataBytes,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(sampleRate,24);wav.writeUInt32LE(sampleRate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(dataBytes,40);
for(let i=0;i<frames;i++){
  const t=i/sampleRate,l=.09*Math.sin(Math.PI*2*220*t),r=.085*Math.sin(Math.PI*2*224*t+.2);
  wav.writeInt16LE(Math.round(l*32767),44+i*4);wav.writeInt16LE(Math.round(r*32767),46+i*4);
}
await writeFile(audioPath,wav);
const sha256=createHash('sha256').update(wav).digest('hex');
const manifest={schemaVersion:1,status:'audition-only',packageId:'quiet-mastering-smoke',room:'rooftop',source:'studio-master-intake',candidates:[{id:'quiet-A',file:'quiet.wav',sha256}]};
await writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');

function run(args){return spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024})}
try{
  const result=run([path.join(root,'scripts','music-mastering-certify.mjs'),'--manifest',path.join(out,'manifest.json')]);
  if(result.status===0)throw new Error('Too-quiet mastering fixture unexpectedly passed');
  const report=JSON.parse(await readFile(path.join(out,'mastering-report.json'),'utf8'));
  if(report.pass!==false||report.candidates?.[0]?.pass!==false)throw new Error('Failed mastering report did not fail closed');
  const reasons=report.candidates[0].reasons||[];
  if(!reasons.some(reason=>reason.includes('integrated loudness')&&reason.includes('below')))throw new Error('Too-quiet fixture did not fail the integrated-loudness floor: '+JSON.stringify(reasons));
  console.log('PASS mastering rejection: out-of-window quiet master fails with measured loudness evidence');
}finally{
  await rm(temp,{recursive:true,force:true});
}
