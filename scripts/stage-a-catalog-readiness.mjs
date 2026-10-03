import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateCuratedSourceManifest } from './curated-source-intake.mjs';

export const STAGE_A_ROOMS=['rooftop','window','headspace','last-bus'];
export const STAGE_A_MIN_TRACKS=8;
export const STAGE_A_MAX_TRACKS=12;
export const STAGE_A_MIN_SECONDS=15*60;

export function auditStageACatalog(manifest,{allowFixture=false}={}){
  const errors=[...validateCuratedSourceManifest(manifest,{allowFixture})];
  const entries=Array.isArray(manifest?.entries)?manifest.entries:[];
  const sourceOwners=new Map();

  for(const room of STAGE_A_ROOMS){
    const roomEntries=entries.filter(entry=>entry.room===room);
    if(roomEntries.length<STAGE_A_MIN_TRACKS)errors.push(`${room}: needs at least ${STAGE_A_MIN_TRACKS} cleared/owned tracks; found ${roomEntries.length}`);
    if(roomEntries.length>STAGE_A_MAX_TRACKS)errors.push(`${room}: Stage-A pool must stay at or below ${STAGE_A_MAX_TRACKS} tracks; found ${roomEntries.length}`);
    const seconds=roomEntries.reduce((sum,entry)=>sum+(Number.isFinite(Number(entry.durationSeconds))?Number(entry.durationSeconds):0),0);
    if(roomEntries.some(entry=>!Number.isFinite(Number(entry.durationSeconds))||Number(entry.durationSeconds)<=0))errors.push(`${room}: every Stage-A track needs a positive durationSeconds value`);
    if(seconds<STAGE_A_MIN_SECONDS)errors.push(`${room}: needs at least ${STAGE_A_MIN_SECONDS} seconds of unique listening time; found ${Math.round(seconds)}`);
  }

  for(const [index,entry] of entries.entries()){
    const identity=entry.provider==='youtube'?`youtube:${entry.videoId}`:`${entry.provider}:${entry.sourceUrl}`;
    const owner=sourceOwners.get(identity);
    if(owner&&owner!==entry.room)errors.push(`entries[${index}] duplicates ${identity} across rooms (${owner} and ${entry.room})`);
    sourceOwners.set(identity,entry.room);
  }

  const unique=[...new Set(errors)];
  return {
    ready:unique.length===0,
    errors:unique,
    summary:Object.fromEntries(STAGE_A_ROOMS.map(room=>{
      const roomEntries=entries.filter(entry=>entry.room===room);
      return [room,{tracks:roomEntries.length,durationSeconds:roomEntries.reduce((sum,entry)=>sum+(Number(entry.durationSeconds)||0),0)}];
    }))
  };
}

if(import.meta.url===`file://${process.argv[1]}`){
  const file=process.argv[2]||'music/stage-a-catalog.json';
  let manifest;
  try{manifest=JSON.parse(await readFile(path.resolve(file),'utf8'))}
  catch(error){console.error(`Stage-A catalog unavailable: ${file}`);console.error(error instanceof Error?error.message:String(error));process.exit(1)}
  const result=auditStageACatalog(manifest,{allowFixture:process.argv.includes('--allow-fixture')});
  console.log(JSON.stringify(result.summary,null,2));
  if(!result.ready){
    console.error('Stage-A catalog: NOT READY');
    for(const error of result.errors)console.error(`- ${error}`);
    process.exit(1);
  }
  console.log('Stage-A catalog: READY for human listening UAT');
}
