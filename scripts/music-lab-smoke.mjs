import { createHash } from 'node:crypto';
import { renderMusicCandidate } from './audio-library.mjs';

const candidate=renderMusicCandidate({roomSlug:'rooftop',seed:'ci-smoke-a',trackRole:2,bars:24});
const bytes=Buffer.from(candidate.bytes),m=candidate.metadata;
if(bytes.subarray(0,4).toString()!=='RIFF'||bytes.subarray(8,12).toString()!=='WAVE')throw new Error('Music Lab smoke candidate is not WAV');
if(m.room!=='rooftop'||m.bars!==24||m.channels!==2||m.sampleRate!==32000)throw new Error('Music Lab candidate metadata drifted: '+JSON.stringify(m));
if(m.durationSeconds<70||m.durationSeconds>90)throw new Error('Unexpected long-form smoke duration: '+m.durationSeconds);
if(bytes.length<8_000_000)throw new Error('Long-form smoke candidate is unexpectedly small: '+bytes.length);
const digest=createHash('sha256').update(bytes).digest('hex');
if(!/^[0-9a-f]{64}$/.test(digest))throw new Error('Music Lab smoke hash missing');
console.log('PASS Music Lab render',m.durationSeconds+'s',bytes.length+' bytes',digest.slice(0,12));
