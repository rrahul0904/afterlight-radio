import { buildCatalogEntry } from './stage-a-catalog-admit.mjs';

const receipt={
  schema:'afterlight-stage-a-asset/v1',room:'rooftop',title:'Fixture',artist:'Fixture Artist',durationSeconds:180,
  licenseId:'CC-BY-4.0',licensePage:'https://freemusicarchive.org/music/example/fixture/',
  acquisitionSource:'https://freemusicarchive.org/music/example/fixture/download/',
  attribution:'Fixture — Fixture Artist · CC BY 4.0 · https://freemusicarchive.org/music/example/fixture/',
  publicSource:'/audio/curated/rooftop/fixture.wav',sha256:'a'.repeat(64),productionState:'candidate-not-human-approved'
};
const decision={reviewedBy:'rights-smoke',reviewedAt:'2026-10-03T20:00:00Z',commercialUseAllowed:true,streamingUseAllowed:true,territories:['US'],mixWithAmbienceAllowed:true,mixWithPresenterAllowed:false,basis:'fixture rights review'};

const good=buildCatalogEntry({receipt,rightsDecision:decision});
if(!good.ok)throw new Error(`valid admission failed: ${good.errors.join('; ')}`);
if(good.entry.sourceUrl!=='/audio/curated/rooftop/fixture.wav')throw new Error('curated runtime path missing');
if(good.entry.humanListeningApproved!==false)throw new Error('catalog admission overstated human listening approval');
if(good.entry.mixWithPresenterAllowed!==false)throw new Error('explicit presenter-mixing decision lost');

for(const [label,patch,needle] of [
  ['no rights reviewer',{reviewedBy:''},'reviewedBy'],
  ['commercial denied',{commercialUseAllowed:false},'commercialUseAllowed'],
  ['streaming denied',{streamingUseAllowed:false},'streamingUseAllowed'],
  ['territory missing',{territories:[]},'territories'],
  ['ambience undecided',{mixWithAmbienceAllowed:null},'mixWithAmbienceAllowed'],
  ['presenter undecided',{mixWithPresenterAllowed:null},'mixWithPresenterAllowed'],
  ['basis missing',{basis:''},'basis']
]){
  const result=buildCatalogEntry({receipt,rightsDecision:{...decision,...patch}});
  if(result.ok||!result.errors.some(error=>error.includes(needle)))throw new Error(`${label} was not rejected: ${(result.errors||[]).join('; ')}`);
}

console.log('Stage-A catalog admission rights gate: PASS');
