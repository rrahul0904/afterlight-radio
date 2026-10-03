import { validateCuratedSourceManifest } from './curated-source-intake.mjs';

const base={
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

const valid=validateCuratedSourceManifest({version:1,entries:[base]},{allowFixture:true});
if(valid.length)throw new Error(`expected valid fixture: ${valid.join('; ')}`);

for(const [label,patch,needle] of [
  ['hidden player',{hiddenPlayer:true},'hiddenPlayer is forbidden'],
  ['audio extraction',{audioOnly:true},'audioOnly is forbidden'],
  ['background playback',{backgroundPlayback:true},'backgroundPlayback is forbidden'],
  ['small viewport',{minViewportWidth:199},'>=200x200'],
  ['unchecked embed',{embedAllowed:false},'embedAllowed must be explicitly true'],
  ['invisible player',{playerVisible:false},'playerVisible must be true']
]){
  const errors=validateCuratedSourceManifest({version:1,entries:[{...base,...patch}]},{allowFixture:true});
  if(!errors.some(error=>error.includes(needle)))throw new Error(`${label} was not rejected: ${errors.join('; ')}`);
}

const productionErrors=validateCuratedSourceManifest({version:1,entries:[base]});
if(!productionErrors.some(error=>error.includes('test fixture')))throw new Error('fixture promotion was not rejected');

console.log('curated source intake boundary: PASS');
