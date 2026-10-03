import { readFile } from 'node:fs/promises';
import path from 'node:path';

const allowedRooms=new Set(['rooftop','window','headspace','last-bus']);
const youtubeId=/^[A-Za-z0-9_-]{11}$/;

export function validateCuratedSourceManifest(manifest,{allowFixture=false}={}){
  const errors=[];
  if(!manifest||manifest.version!==1)errors.push('manifest.version must be 1');
  if(!Array.isArray(manifest?.entries)||manifest.entries.length===0)errors.push('manifest.entries must contain at least one candidate');

  const seen=new Set();
  for(const [index,entry] of (manifest?.entries||[]).entries()){
    const prefix=`entries[${index}]`;
    if(!allowedRooms.has(entry.room))errors.push(`${prefix}.room must be a flagship room`);
    if(entry.provider!=='youtube'&&entry.provider!=='owned')errors.push(`${prefix}.provider must be youtube or owned`);
    if(!entry.title?.trim())errors.push(`${prefix}.title is required`);
    if(!entry.sourceUrl?.startsWith('https://'))errors.push(`${prefix}.sourceUrl must be https`);
    if(!entry.provenance?.trim())errors.push(`${prefix}.provenance is required`);
    if(!entry.checkedAt||Number.isNaN(Date.parse(entry.checkedAt)))errors.push(`${prefix}.checkedAt must be an ISO timestamp`);
    if(entry.hiddenPlayer===true)errors.push(`${prefix}.hiddenPlayer is forbidden`);
    if(entry.audioOnly===true)errors.push(`${prefix}.audioOnly is forbidden`);
    if(entry.backgroundPlayback===true)errors.push(`${prefix}.backgroundPlayback is forbidden`);

    if(entry.provider==='youtube'){
      if(!youtubeId.test(entry.videoId||''))errors.push(`${prefix}.videoId must be an 11-character YouTube id`);
      if(!entry.channel?.trim())errors.push(`${prefix}.channel is required for YouTube sources`);
      if(entry.embedAllowed!==true)errors.push(`${prefix}.embedAllowed must be explicitly true after an embed check`);
      if(entry.playerVisible!==true)errors.push(`${prefix}.playerVisible must be true`);
      if(Number(entry.minViewportWidth)<200||Number(entry.minViewportHeight)<200)errors.push(`${prefix} must preserve a >=200x200 player viewport`);
      if(entry.fixture===true&&!allowFixture)errors.push(`${prefix} is a test fixture and cannot be promoted`);
    }

    const id=entry.provider==='youtube'?`${entry.provider}:${entry.videoId}`:`${entry.provider}:${entry.sourceUrl}`;
    if(seen.has(id))errors.push(`${prefix} duplicates ${id}`);
    seen.add(id);
  }
  return errors;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const file=process.argv[2];
  if(!file){console.error('usage: node scripts/curated-source-intake.mjs <manifest.json> [--allow-fixture]');process.exit(2)}
  const manifest=JSON.parse(await readFile(path.resolve(file),'utf8'));
  const errors=validateCuratedSourceManifest(manifest,{allowFixture:process.argv.includes('--allow-fixture')});
  if(errors.length){for(const error of errors)console.error(`- ${error}`);process.exit(1)}
  console.log(`curated source intake: PASS (${manifest.entries.length} candidate${manifest.entries.length===1?'':'s'})`);
}
