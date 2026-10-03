import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const supportedExtensions=new Set(['.mp3','.wav','.m4a','.ogg','.flac']);

export async function buildPromotionReceipt({candidate,assetPath,publicSource,acquisitionSource,separateLicenseReceipt,reviewer}){
  const errors=[];
  if(!candidate?.room||!candidate?.title||!candidate?.artist)errors.push('candidate room/title/artist are required');
  if(!['CC-BY-4.0','CC0-1.0'].includes(candidate?.licenseId))errors.push('candidate license must be CC-BY-4.0 or CC0-1.0');
  if(!candidate?.licensePage?.startsWith('https://freemusicarchive.org/'))errors.push('candidate requires an individual FMA license page');
  if(!assetPath)errors.push('assetPath is required');
  if(!publicSource?.startsWith('/audio/curated/'))errors.push('publicSource must live under /audio/curated/');
  if(!acquisitionSource?.startsWith('https://'))errors.push('acquisitionSource must be an https URL for the exact acquired copy');
  if(!reviewer?.trim())errors.push('reviewer is required');
  if(candidate?.licensePage?.includes('freemusicarchive.org')&&acquisitionSource?.startsWith('https://')&&!acquisitionSource.includes('freemusicarchive.org')&&!separateLicenseReceipt?.trim()){
    errors.push('FMA-licensed candidate must be acquired from an FMA-traceable source or carry a separateLicenseReceipt');
  }
  if(errors.length)return {ok:false,errors};

  const extension=path.extname(assetPath).toLowerCase();
  if(!supportedExtensions.has(extension))return {ok:false,errors:[`unsupported audio extension ${extension||'(none)'}`]};
  const info=await stat(assetPath).catch(()=>null);
  if(!info?.isFile()||info.size<=0)return {ok:false,errors:['asset must be a non-empty local file']};
  const bytes=await readFile(assetPath);
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const attribution=candidate.licenseId==='CC-BY-4.0'
    ? `${candidate.title} — ${candidate.artist} · CC BY 4.0 · ${candidate.licensePage}`
    : `${candidate.title} — ${candidate.artist} · source/provenance: ${candidate.licensePage}`;

  return {ok:true,receipt:{
    schema:'afterlight-stage-a-asset/v1',
    room:candidate.room,
    title:candidate.title,
    artist:candidate.artist,
    durationSeconds:candidate.durationSeconds,
    licenseId:candidate.licenseId,
    licensePage:candidate.licensePage,
    acquisitionSource,
    separateLicenseReceipt:separateLicenseReceipt?.trim()||null,
    attribution,
    assetFile:path.basename(assetPath),
    publicSource,
    bytes:info.size,
    sha256,
    verifiedAt:new Date().toISOString(),
    verifiedBy:reviewer,
    rightsState:'license-page-and-acquisition-source-verified-asset-bound',
    productionState:'candidate-not-human-approved'
  }};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [candidateFile,assetPath,publicSource,acquisitionSource,outputFile]=process.argv.slice(2);
  if(!candidateFile||!assetPath||!publicSource||!acquisitionSource||!outputFile){
    console.error('usage: node scripts/stage-a-asset-promotion.mjs <candidate.json> <asset> </audio/curated/...> <acquisition-url> <receipt.json>');
    process.exit(2);
  }
  const candidate=JSON.parse(await readFile(path.resolve(candidateFile),'utf8'));
  const result=await buildPromotionReceipt({candidate,assetPath:path.resolve(assetPath),publicSource,acquisitionSource,separateLicenseReceipt:process.env.AFTERLIGHT_SEPARATE_LICENSE_RECEIPT||'',reviewer:process.env.AFTERLIGHT_REVIEWER||''});
  if(!result.ok){for(const error of result.errors)console.error(`- ${error}`);process.exit(1)}
  await writeFile(path.resolve(outputFile),`${JSON.stringify(result.receipt,null,2)}\n`);
  console.log(`asset promotion receipt: ${result.receipt.sha256} -> ${result.receipt.publicSource}`);
}
