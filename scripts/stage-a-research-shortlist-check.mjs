import { readFile } from 'node:fs/promises';
import path from 'node:path';

const rooms=['rooftop','window','headspace','last-bus'];
const allowedLicenses=new Set(['CC-BY-4.0','CC0-1.0']);
const minimumPerRoom=8;
const minimumSeconds=15*60;

export function auditResearchShortlist(manifest){
  const errors=[];
  const entries=Array.isArray(manifest?.entries)?manifest.entries:[];
  if(manifest?.version!==1)errors.push('manifest.version must be 1');
  if(manifest?.status!=='research-shortlist-not-runtime-catalog')errors.push('shortlist status must remain research-only');
  const identities=new Set();

  for(const [index,entry] of entries.entries()){
    const prefix=`entries[${index}]`;
    if(!rooms.includes(entry.room))errors.push(`${prefix}.room is invalid`);
    if(!entry.title?.trim()||!entry.artist?.trim())errors.push(`${prefix} requires title and artist`);
    if(!allowedLicenses.has(entry.licenseId))errors.push(`${prefix}.licenseId must be CC-BY-4.0 or CC0-1.0`);
    if(!entry.licensePage?.startsWith('https://freemusicarchive.org/music/')&&!entry.licensePage?.startsWith('https://freemusicarchive.org/index.php/music/'))errors.push(`${prefix}.licensePage must be an individual Free Music Archive music URL`);
    if(Number(entry.durationSeconds)<=0)errors.push(`${prefix}.durationSeconds must be positive`);
    if(!entry.fit?.trim())errors.push(`${prefix}.fit is required`);
    if(entry.assetStatus!=='pending')errors.push(`${prefix}.assetStatus must stay pending until a playable asset/source is acquired and hashed`);
    const identity=`${entry.artist.toLowerCase()}::${entry.title.toLowerCase()}`;
    if(identities.has(identity))errors.push(`${prefix} duplicates ${entry.artist} — ${entry.title}`);
    identities.add(identity);
  }

  const summary={};
  for(const room of rooms){
    const selected=entries.filter(entry=>entry.room===room);
    const seconds=selected.reduce((sum,entry)=>sum+(Number(entry.durationSeconds)||0),0);
    summary[room]={tracks:selected.length,durationSeconds:seconds};
    if(selected.length<minimumPerRoom)errors.push(`${room}: research shortlist requires at least ${minimumPerRoom} candidates; found ${selected.length}`);
    if(seconds<minimumSeconds)errors.push(`${room}: research shortlist requires at least ${minimumSeconds} seconds; found ${seconds}`);
  }

  return {ready:errors.length===0,errors,summary,total:entries.length};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const file=process.argv[2]||'music/stage-a-research-candidates.json';
  const manifest=JSON.parse(await readFile(path.resolve(file),'utf8'));
  const result=auditResearchShortlist(manifest);
  console.log(JSON.stringify({total:result.total,rooms:result.summary},null,2));
  if(!result.ready){for(const error of result.errors)console.error(`- ${error}`);process.exit(1)}
  console.log('Stage-A research shortlist: PASS — licensing research complete enough to begin asset acquisition; runtime catalog remains unready.');
}
