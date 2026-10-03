import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateCuratedSourceManifest } from './curated-source-intake.mjs';

export function buildCatalogEntry({receipt,rightsDecision}){
  const errors=[];
  if(receipt?.schema!=='afterlight-stage-a-asset/v1')errors.push('receipt schema must be afterlight-stage-a-asset/v1');
  if(receipt?.productionState!=='candidate-not-human-approved')errors.push('receipt must still be candidate-not-human-approved');
  if(!receipt?.sha256||!/^[a-f0-9]{64}$/.test(receipt.sha256))errors.push('receipt sha256 is required');
  if(!receipt?.publicSource?.startsWith('/audio/curated/'))errors.push('receipt publicSource must be a curated local path');
  if(!receipt?.acquisitionSource?.startsWith('https://'))errors.push('receipt acquisitionSource is required');
  if(!rightsDecision?.reviewedBy?.trim())errors.push('rightsDecision.reviewedBy is required');
  if(!rightsDecision?.reviewedAt||Number.isNaN(Date.parse(rightsDecision.reviewedAt)))errors.push('rightsDecision.reviewedAt must be an ISO timestamp');
  if(rightsDecision?.commercialUseAllowed!==true)errors.push('commercialUseAllowed must be explicitly true');
  if(rightsDecision?.streamingUseAllowed!==true)errors.push('streamingUseAllowed must be explicitly true');
  if(!Array.isArray(rightsDecision?.territories)||rightsDecision.territories.length===0)errors.push('territories are required');
  if(typeof rightsDecision?.mixWithAmbienceAllowed!=='boolean')errors.push('mixWithAmbienceAllowed must be explicitly true or false');
  if(typeof rightsDecision?.mixWithPresenterAllowed!=='boolean')errors.push('mixWithPresenterAllowed must be explicitly true or false');
  if(!rightsDecision?.basis?.trim())errors.push('rightsDecision.basis is required');
  if(errors.length)return {ok:false,errors};

  const entry={
    room:receipt.room,
    provider:'cleared',
    title:receipt.title,
    artist:receipt.artist,
    sourceUrl:receipt.publicSource,
    durationSeconds:receipt.durationSeconds,
    provenance:`asset sha256:${receipt.sha256}; acquired:${receipt.acquisitionSource}; evidence:${receipt.licensePage}`,
    checkedAt:rightsDecision.reviewedAt,
    rightsEvidence:`${receipt.licenseId}; ${receipt.licensePage}; reviewer:${rightsDecision.reviewedBy}; basis:${rightsDecision.basis}`,
    licenseScope:rightsDecision.licenseScope?.trim()||`${receipt.licenseId} reviewed for Afterlight Stage-A web listening`,
    commercialUseAllowed:true,
    streamingUseAllowed:true,
    territories:rightsDecision.territories,
    mixWithAmbienceAllowed:rightsDecision.mixWithAmbienceAllowed,
    mixWithPresenterAllowed:rightsDecision.mixWithPresenterAllowed,
    attribution:receipt.attribution,
    assetSha256:receipt.sha256,
    acquisitionSource:receipt.acquisitionSource,
    humanListeningApproved:false
  };
  const manifestErrors=validateCuratedSourceManifest({version:1,entries:[entry]},{allowFixture:true});
  if(manifestErrors.length)return {ok:false,errors:manifestErrors};
  return {ok:true,entry};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [receiptFile,decisionFile,outputFile]=process.argv.slice(2);
  if(!receiptFile||!decisionFile||!outputFile){
    console.error('usage: node scripts/stage-a-catalog-admit.mjs <asset-receipt.json> <rights-decision.json> <catalog-entry.json>');
    process.exit(2);
  }
  const receipt=JSON.parse(await readFile(path.resolve(receiptFile),'utf8'));
  const rightsDecision=JSON.parse(await readFile(path.resolve(decisionFile),'utf8'));
  const result=buildCatalogEntry({receipt,rightsDecision});
  if(!result.ok){for(const error of result.errors)console.error(`- ${error}`);process.exit(1)}
  await writeFile(path.resolve(outputFile),`${JSON.stringify(result.entry,null,2)}\n`);
  console.log(`catalog admission candidate: ${result.entry.room} / ${result.entry.title} / ${result.entry.assetSha256}`);
}
