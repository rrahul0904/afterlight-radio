import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { analyzeMastering, loadMasteringPolicy } from './music-mastering.mjs';

const root=process.cwd(),pub=path.join(root,'public');
const args=process.argv.slice(2);
const arg=(name,fallback)=>{
  const i=args.indexOf('--'+name);
  return i>=0&&args[i+1]!==undefined?args[i+1]:fallback;
};
const enforce=args.includes('--enforce');
const outPath=path.resolve(arg('out',path.join('.music-lab','catalog-mastering-audit.json')));
const manifest=JSON.parse(await readFile(path.join(pub,'music-manifest.json'),'utf8'));
if(manifest.version!==3||!Array.isArray(manifest.tracks)||manifest.tracks.length!==36)throw new Error('Expected production music manifest v3 with 36 tracks');
const {policy,sha256:policySha256}=await loadMasteringPolicy();
const results=[];
for(const track of manifest.tracks){
  const audioPath=path.join(pub,'audio',track.room,String(track.track)+'.wav');
  const bytes=await readFile(audioPath),sha256=createHash('sha256').update(bytes).digest('hex');
  const report=await analyzeMastering({audioPath,candidateSha256:sha256});
  results.push({
    id:track.id,
    room:track.room,
    title:track.title,
    arrangement:track.arrangement,
    durationSeconds:track.durationSeconds,
    sha256,
    pass:report.pass,
    metrics:report.metrics,
    reasons:report.reasons
  });
}
const integrated=results.map(result=>result.metrics.integratedLufs).filter(Number.isFinite);
const peaks=results.map(result=>result.metrics.truePeakDbtp).filter(Number.isFinite);
const lra=results.map(result=>result.metrics.loudnessRangeLu).filter(Number.isFinite);
const passed=results.filter(result=>result.pass),failed=results.filter(result=>!result.pass);
const byRoom=Object.fromEntries([...new Set(results.map(result=>result.room))].map(room=>{
  const roomTracks=results.filter(result=>result.room===room);
  return [room,{tracks:roomTracks.length,passed:roomTracks.filter(result=>result.pass).length,integratedLufs:{min:Math.min(...roomTracks.map(result=>result.metrics.integratedLufs)),max:Math.max(...roomTracks.map(result=>result.metrics.integratedLufs))}}];
}));
const output={
  schemaVersion:1,
  scope:'composition-engine-v3-production-build',
  evidenceOnly:!enforce,
  generatedAt:new Date().toISOString(),
  policy:{schemaVersion:policy.schemaVersion,sha256:policySha256,name:policy.name},
  summary:{
    tracks:results.length,
    passed:passed.length,
    failed:failed.length,
    integratedLufs:{min:Math.min(...integrated),max:Math.max(...integrated),spread:Number((Math.max(...integrated)-Math.min(...integrated)).toFixed(2))},
    truePeakDbtp:{min:Math.min(...peaks),max:Math.max(...peaks)},
    loudnessRangeLu:{min:Math.min(...lra),max:Math.max(...lra)}
  },
  byRoom,
  tracks:results
};
await mkdir(path.dirname(outPath),{recursive:true});
await writeFile(outPath,JSON.stringify(output,null,2)+'\n');
console.log('CATALOG MASTERING AUDIT '+JSON.stringify(output.summary));
for(const result of failed)console.log('OUTLIER '+JSON.stringify({id:result.id,metrics:result.metrics,reasons:result.reasons}));
console.log('AUDIT REPORT '+outPath);
if(enforce&&failed.length)process.exitCode=1;
