import { validateCuratedSourceManifest } from './curated-source-intake.mjs';

const youtube={
  room:'rooftop',
  provider:'youtube',
  videoId:'abcDEF123_-',
  title:'Fixture source',
  channel:'Fixture channel',
  sourceUrl:'https://www.youtube.com/watch?v=abcDEF123_-',
  provenance:'test fixture only; not a production catalog entry',
  checkedAt:'2026-10-03T12:00:00Z',
  embedAllowed:true,
  playerVisible:true,
  minViewportWidth:200,
  minViewportHeight:200,
  hiddenPlayer:false,
  audioOnly:false,
  backgroundPlayback:false,
  fixture:true
};

const cleared={
  room:'window',
  provider:'cleared',
  title:'Licensed fixture source',
  artist:'Fixture artist',
  sourceUrl:'https://media.example.test/licensed-fixture.wav',
  provenance:'fixture representing a direct or commercial license receipt',
  rightsEvidence:'license-receipt:fixture-123',
  licenseScope:'commercial web streaming for Afterlight',
  commercialUseAllowed:true,
  streamingUseAllowed:true,
  territories:['US','CA'],
  mixWithAmbienceAllowed:true,
  mixWithPresenterAllowed:false,
  checkedAt:'2026-10-03T12:00:00Z',
  expiresAt:'2027-10-03T12:00:00Z',
  fixture:true
};

for(const entry of [youtube,cleared]){
  const valid=validateCuratedSourceManifest({version:1,entries:[entry]},{allowFixture:true});
  if(valid.length)throw new Error(`expected valid fixture: ${valid.join('; ')}`);
}

for(const [label,patch,needle] of [
  ['hidden player',{hiddenPlayer:true},'hiddenPlayer is forbidden'],
  ['audio extraction',{audioOnly:true},'audioOnly is forbidden'],
  ['background playback',{backgroundPlayback:true},'backgroundPlayback is forbidden'],
  ['small viewport',{minViewportWidth:199},'>=200x200'],
  ['unchecked embed',{embedAllowed:false},'embedAllowed must be explicitly true'],
  ['invisible player',{playerVisible:false},'playerVisible must be true']
]){
  const errors=validateCuratedSourceManifest({version:1,entries:[{...youtube,...patch}]},{allowFixture:true});
  if(!errors.some(error=>error.includes(needle)))throw new Error(`${label} was not rejected: ${errors.join('; ')}`);
}

for(const [label,patch,needle] of [
  ['missing rights receipt',{rightsEvidence:''},'rightsEvidence is required'],
  ['commercial rights not explicit',{commercialUseAllowed:false},'commercialUseAllowed must be explicitly true'],
  ['streaming rights not explicit',{streamingUseAllowed:false},'streamingUseAllowed must be explicitly true'],
  ['territory missing',{territories:[]},'territories must contain'],
  ['ambience mixing unspecified',{mixWithAmbienceAllowed:null},'mixWithAmbienceAllowed must be explicitly true or false'],
  ['presenter mixing unspecified',{mixWithPresenterAllowed:null},'mixWithPresenterAllowed must be explicitly true or false'],
  ['expired at intake',{expiresAt:'2025-10-03T12:00:00Z'},'expiresAt must be after checkedAt']
]){
  const errors=validateCuratedSourceManifest({version:1,entries:[{...cleared,...patch}]},{allowFixture:true});
  if(!errors.some(error=>error.includes(needle)))throw new Error(`${label} was not rejected: ${errors.join('; ')}`);
}

for(const entry of [youtube,cleared]){
  const productionErrors=validateCuratedSourceManifest({version:1,entries:[entry]});
  if(!productionErrors.some(error=>error.includes('test fixture')))throw new Error('fixture promotion was not rejected');
}

console.log('curated source intake boundary: PASS');
