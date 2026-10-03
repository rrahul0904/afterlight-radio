import { auditStageACatalog, STAGE_A_ROOMS } from './stage-a-catalog-readiness.mjs';

const makeEntry=(room,index)=>({
  room,
  provider:'cleared',
  title:`${room} fixture ${index+1}`,
  artist:`Fixture artist ${room} ${index+1}`,
  sourceUrl:`https://media.example.test/${room}/${index+1}.wav`,
  provenance:'test fixture only',
  rightsEvidence:`license-receipt:${room}-${index+1}`,
  licenseScope:'commercial web streaming for Afterlight',
  commercialUseAllowed:true,
  streamingUseAllowed:true,
  territories:['US'],
  mixWithAmbienceAllowed:true,
  mixWithPresenterAllowed:false,
  checkedAt:'2026-10-03T12:00:00Z',
  durationSeconds:150,
  fixture:true
});

const readyManifest={version:1,entries:STAGE_A_ROOMS.flatMap(room=>Array.from({length:8},(_,index)=>makeEntry(room,index)))};
const ready=auditStageACatalog(readyManifest,{allowFixture:true});
if(!ready.ready)throw new Error(`expected Stage-A fixture to pass: ${ready.errors.join('; ')}`);
for(const room of STAGE_A_ROOMS){
  if(ready.summary[room].tracks!==8)throw new Error(`${room}: wrong track count`);
  if(ready.summary[room].durationSeconds!==1200)throw new Error(`${room}: wrong duration`);
}

const tooSmall={version:1,entries:readyManifest.entries.filter(entry=>!(entry.room==='rooftop'&&entry.title.endsWith('8')))};
const smallResult=auditStageACatalog(tooSmall,{allowFixture:true});
if(smallResult.ready||!smallResult.errors.some(error=>error.includes('rooftop: needs at least 8')))throw new Error('undersized room pool was not rejected');

const shortDuration={version:1,entries:readyManifest.entries.map(entry=>entry.room==='window'?{...entry,durationSeconds:100}:entry)};
const shortResult=auditStageACatalog(shortDuration,{allowFixture:true});
if(shortResult.ready||!shortResult.errors.some(error=>error.includes('window: needs at least 900 seconds')))throw new Error('short room duration was not rejected');

const duplicateAcrossRooms={version:1,entries:readyManifest.entries.map((entry,index)=>index===8?{...entry,sourceUrl:readyManifest.entries[0].sourceUrl}:entry)};
const duplicateResult=auditStageACatalog(duplicateAcrossRooms,{allowFixture:true});
if(duplicateResult.ready||!duplicateResult.errors.some(error=>error.includes('duplicates cleared:')))throw new Error('cross-room duplicate was not rejected');

console.log('Stage-A catalog readiness audit: PASS');
