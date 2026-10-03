import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { renderMusicCandidate } from './audio-library.mjs';
import { audioMetrics, decodePcm16StereoWav, processQualityV4 } from './music-quality-v4.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const source=Buffer.from(renderMusicCandidate({roomSlug:'headspace',seed:'ci-v4',trackRole:1,bars:24}).bytes);
const first=processQualityV4(source),second=processQualityV4(source);

assert.notEqual(hash(source),hash(first.bytes),'v4 processing must produce a distinct audition render');
assert.equal(hash(first.bytes),hash(second.bytes),'v4 processing must remain deterministic');
assert.equal(first.sampleRate,32000,'v4 must preserve source sample rate');
assert.ok(Math.abs(first.durationSeconds-second.durationSeconds)<1e-9,'deterministic duration drifted');
assert.ok(first.after.peak<=.835,'v4 peak ceiling must remain bounded');
assert.ok(first.after.peak>.20,'v4 audition should not be near-silent');
assert.ok(first.after.rms>.035,'v4 audition RMS is implausibly low');
assert.ok(first.after.rms<.20,'v4 audition RMS is implausibly high');
assert.ok(first.after.dc<.012,'v4 DC offset must remain low');
assert.ok(first.after.sideToMid>.035,'v4 stereo field must not collapse');
assert.ok(first.after.crest>1.3,'v4 should preserve useful dynamics');

const decoded=decodePcm16StereoWav(first.bytes),roundTrip=audioMetrics(decoded.left,decoded.right);
assert.equal(decoded.left.length,decoded.right.length,'rendered WAV channels differ');
assert.ok(decoded.durationSeconds>60,'24-bar Music Lab candidate should be long enough for meaningful audition');
assert.ok(roundTrip.peak<=.84,'PCM round trip exceeded peak bound');
assert.ok(Math.abs(roundTrip.rms-first.after.rms)<.002,'PCM round trip materially changed RMS');

console.log(`PASS audio-quality-v4-smoke duration=${decoded.durationSeconds.toFixed(1)}s beforeRms=${first.before.rms.toFixed(4)} afterRms=${roundTrip.rms.toFixed(4)} peak=${roundTrip.peak.toFixed(4)} side/mid=${roundTrip.sideToMid.toFixed(3)}`);
