import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildPromotionReceipt } from './stage-a-asset-promotion.mjs';

const dir=await mkdtemp(path.join(os.tmpdir(),'afterlight-stage-a-'));
const asset=path.join(dir,'fixture.wav');
await writeFile(asset,Buffer.from('RIFFfixture-audio-bytes'));
const candidate={room:'rooftop',title:'Fixture',artist:'Fixture Artist',durationSeconds:180,licenseId:'CC-BY-4.0',licensePage:'https://freemusicarchive.org/music/example/fixture/'};
const fmaAsset='https://freemusicarchive.org/music/example/fixture/download/';

const good=await buildPromotionReceipt({candidate,assetPath:asset,publicSource:'/audio/curated/rooftop/fixture.wav',acquisitionSource:fmaAsset,reviewer:'ci-smoke'});
if(!good.ok)throw new Error(`valid promotion failed: ${good.errors.join('; ')}`);
if(good.receipt.schema!=='afterlight-stage-a-asset/v1')throw new Error('receipt schema mismatch');
if(!/^[a-f0-9]{64}$/.test(good.receipt.sha256))throw new Error('sha256 missing');
if(!good.receipt.attribution.includes('CC BY 4.0'))throw new Error('CC BY attribution missing');
if(good.receipt.acquisitionSource!==fmaAsset)throw new Error('acquisition source missing from receipt');
if(good.receipt.productionState!=='candidate-not-human-approved')throw new Error('promotion overstated human approval');

const badSource=await buildPromotionReceipt({candidate,assetPath:asset,publicSource:'https://example.test/audio.wav',acquisitionSource:fmaAsset,reviewer:'ci-smoke'});
if(badSource.ok||!badSource.errors.some(error=>error.includes('/audio/curated/')))throw new Error('external public source was not rejected');

const noReviewer=await buildPromotionReceipt({candidate,assetPath:asset,publicSource:'/audio/curated/rooftop/fixture.wav',acquisitionSource:fmaAsset,reviewer:''});
if(noReviewer.ok||!noReviewer.errors.some(error=>error.includes('reviewer')))throw new Error('reviewer-less promotion was not rejected');

const wrongChannel=await buildPromotionReceipt({candidate,assetPath:asset,publicSource:'/audio/curated/rooftop/fixture.wav',acquisitionSource:'https://other.example.test/fixture.wav',reviewer:'ci-smoke'});
if(wrongChannel.ok||!wrongChannel.errors.some(error=>error.includes('FMA-traceable')))throw new Error('cross-channel asset/license mismatch was not rejected');

const separatelyLicensed=await buildPromotionReceipt({candidate,assetPath:asset,publicSource:'/audio/curated/rooftop/fixture.wav',acquisitionSource:'https://artist.example.test/fixture.wav',separateLicenseReceipt:'direct-license-2026-10-03',reviewer:'ci-smoke'});
if(!separatelyLicensed.ok)throw new Error(`separate license receipt should allow alternate acquisition: ${separatelyLicensed.errors.join('; ')}`);

const nonAudio=path.join(dir,'fixture.txt');await writeFile(nonAudio,'hello');
const badType=await buildPromotionReceipt({candidate,assetPath:nonAudio,publicSource:'/audio/curated/rooftop/fixture.txt',acquisitionSource:fmaAsset,reviewer:'ci-smoke'});
if(badType.ok||!badType.errors.some(error=>error.includes('unsupported audio extension')))throw new Error('non-audio asset was not rejected');

console.log('Stage-A asset promotion receipt: PASS');
