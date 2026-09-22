import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { planFirstPartyTracks,transitionBroadcastItem,BROADCAST_ITEM_STATES } from '../src/broadcast-domain.js';

const root=process.cwd();
const manifest=JSON.parse(await readFile(path.join(root,'public','music-manifest.json'),'utf8'));
if(manifest.version!==3||manifest.thirdPartyAudio!==false||manifest.tracks?.length!==36)throw new Error('Broadcast planner requires the 36-track first-party manifest v3');

const a=planFirstPartyTracks(manifest.tracks,{seed:'ci-seed',count:12,repetitionWindow:6});
const b=planFirstPartyTracks(manifest.tracks,{seed:'ci-seed',count:12,repetitionWindow:6});
if(JSON.stringify(a.map(x=>x.sourceId))!==JSON.stringify(b.map(x=>x.sourceId)))throw new Error('Broadcast planner is not deterministic');
if(new Set(a.map(x=>x.sourceId)).size!==12)throw new Error('Broadcast planner repeated a track inside the global first-party window');
if(a.some(x=>x.kind!=='track'||x.state!=='planned'||!x.selectionReason?.policy))throw new Error('Broadcast planner output contract is incomplete');

const roomPlan=planFirstPartyTracks(manifest.tracks,{seed:'rooftop-ci',room:'rooftop',count:6,repetitionWindow:2});
for(let i=0;i<roomPlan.length;i++){
  const recent=roomPlan.slice(Math.max(0,i-2),i).map(x=>x.sourceId);
  if(recent.includes(roomPlan[i].sourceId))throw new Error('Room planner violated repetition window');
}
if(!roomPlan.every(x=>x.room==='rooftop'))throw new Error('Room planner escaped the requested room');

const planned={id:'item-1',state:'planned'};
const ready=transitionBroadcastItem(planned,'ready',{writer:'director',now:'2026-09-21T00:00:00.000Z'});
const handed=transitionBroadcastItem(ready,'handed',{writer:'director',now:'2026-09-21T00:01:00.000Z'});
const airing=transitionBroadcastItem(handed,'airing',{writer:'director',now:'2026-09-21T00:02:00.000Z'});
const played=transitionBroadcastItem(airing,'played',{writer:'director',now:'2026-09-21T00:03:00.000Z'});
if(played.state!=='played'||played.startedAt!=='2026-09-21T00:02:00.000Z'||played.endedAt!=='2026-09-21T00:03:00.000Z')throw new Error('Director lifecycle timestamps drifted');
for(const [item,next,writer] of [[planned,'played','director'],[planned,'ready','operator'],[played,'ready','director']]){
  let failed=false;try{transitionBroadcastItem(item,next,{writer})}catch{failed=true}
  if(!failed)throw new Error('Director state machine accepted an invalid mutation');
}
if(BROADCAST_ITEM_STATES.length!==7)throw new Error('Broadcast state contract drifted');

const migration=await readFile(path.join(root,'neon','migrations','20260921_broadcast_phase1.sql'),'utf8');
for(const needle of ['create table if not exists public.broadcasts','create table if not exists public.broadcast_items','create table if not exists public.broadcast_events',"unique (broadcast_id, ordinal)","actor text not null default 'director'","command_id text unique","broadcasts_one_live_idx","sort_key numeric(20,6)","broadcast_items_broadcast_sort_idx"]){
  if(!migration.includes(needle))throw new Error('Broadcast migration contract missing: '+needle);
}

const core=await readFile(path.join(root,'src','api-core.js'),'utf8');
const neonFn=await readFile(path.join(root,'functions','afterlight-lite.mjs'),'utf8');
for(const source of [core,neonFn]){
  for(const needle of ['/api/admin/broadcast/status','/api/admin/broadcast/lineup','/api/admin/broadcast/events','/api/admin/broadcast/start','/api/admin/broadcast/stop','/api/admin/broadcast/reorder','broadcast/items/','ordered_item_ids','Idempotency-Key','broadcast.item.','Admin access required','broadcast_items','broadcasts']){
    if(!source.includes(needle))throw new Error('Broadcast API parity missing: '+needle);
  }
}
const admin=await readFile(path.join(root,'admin.html'),'utf8');
const adminRuntime=await readFile(path.join(root,'scripts','admin-runtime.js'),'utf8');
new Function(adminRuntime);
for(const needle of ['Broadcast / AI-DJ mode','broadcastStart','broadcastStop','broadcastRows','broadcastEvents']){
  if(!admin.includes(needle))throw new Error('Broadcast admin surface missing: '+needle);
}
for(const needle of ['/api/admin/broadcast/status','/api/admin/broadcast/lineup','/api/admin/broadcast/events','/api/admin/broadcast/start','/api/admin/broadcast/stop','/api/admin/broadcast/reorder','Idempotency-Key','crypto.randomUUID','runItemCommand','runReorder']){
  if(!adminRuntime.includes(needle))throw new Error('Broadcast admin runtime missing: '+needle);
}
for(const forbidden of ["localStorage.setItem('admin","sessionStorage.setItem('admin","?admin=true"]){
  if((admin+adminRuntime).includes(forbidden))throw new Error('Broadcast admin authorization bypass detected: '+forbidden);
}

console.log('PASS broadcast-phase2-repo: deterministic 36-track planner, director-only lifecycle, durable idempotent operator commands, audit reads, Neon parity, and protected admin controls');
