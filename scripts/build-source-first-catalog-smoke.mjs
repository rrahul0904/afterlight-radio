import { buildSourceFirstCatalog } from './build-source-first-catalog.mjs';

const baseline="window.AFTERLIGHT_REBUILD_CATALOG={\n  version:2,\n  rooms:{rooftop:{},window:{},headspace:{},'last-bus':{}},\n  providerContract:{}\n};\n";
const empty=buildSourceFirstCatalog({manifest:{version:1,entries:[]},baselineSource:baseline});
if(empty.mode!=='demo'||!empty.source.includes("mode:'demo'"))throw new Error('empty Stage-A manifest did not preserve explicit demo mode');

const rooms=['rooftop','window','headspace','last-bus'];
const entries=rooms.flatMap(room=>Array.from({length:8},(_,index)=>({
  room,provider:'cleared',title:`${room} ${index+1}`,artist:`Artist ${room}`,
  sourceUrl:`/audio/curated/${room}/${index+1}.wav`,durationSeconds:150,
  provenance:`fixture ${room} ${index+1}`,checkedAt:'2026-10-03T20:00:00Z',rightsEvidence:'fixture-rights',
  licenseScope:'fixture cleared web streaming',commercialUseAllowed:true,streamingUseAllowed:true,territories:['US'],
  mixWithAmbienceAllowed:index%2===0,mixWithPresenterAllowed:false,attribution:`Credit ${room} ${index+1}`,
  assetSha256:String(index+1).repeat(64).slice(0,64),humanListeningApproved:false
})));
const built=buildSourceFirstCatalog({manifest:{version:1,entries},baselineSource:baseline});
if(built.mode!=='stage-a')throw new Error(`ready fixture did not switch to stage-a: ${built.audit.errors.join('; ')}`);
if(!built.source.includes('"mode": "stage-a"'))throw new Error('generated runtime catalog does not declare stage-a mode');
if(!built.source.includes('/audio/curated/window/8.wav'))throw new Error('generated runtime catalog lost curated source');
if(!built.source.includes('"provider": "cleared"'))throw new Error('generated runtime catalog lost cleared provider');
if(!built.source.includes('"mixWithAmbienceAllowed": false'))throw new Error('generated runtime catalog lost ambience-rights decision');
if(!built.source.includes('"humanListeningApproved": false'))throw new Error('generated runtime catalog overstated human approval');
console.log('source-first runtime catalog switch: PASS');
