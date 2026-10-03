import assert from 'node:assert/strict';
import { evaluateBlindPair, validateBlindReview } from './music-quality-v4-review-gate.mjs';

const manifest={pairId:'headspace-flagship-a-r1-b48',room:'headspace',blinded:true,hashes:{A:'a'.repeat(64),B:'b'.repeat(64)}};
const truth={pairId:manifest.pairId,finishedLabel:'B'};
const makeReview=(reviewerId,overrides={})=>({
  pairId:manifest.pairId,
  exactHashes:{...manifest.hashes},
  reviewerId,
  listenedSeconds:{A:120,B:125},
  preferred:'B',
  decision:'shortlist',
  scores:{
    A:{roomFit:3.4,musicality:3.3,lowFatigue:3.6,variation:3.2,productionPolish:3.2},
    B:{roomFit:4.4,musicality:4.3,lowFatigue:4.5,variation:4.0,productionPolish:4.2}
  },
  ...overrides
});

const reviews=[makeReview('reviewer-one'),makeReview('reviewer-two')];
const pass=evaluateBlindPair({manifest,truth,reviews});
assert.equal(pass.advanceToMastering,true,'unanimously preferred threshold-passing v4 candidate should advance only to mastering evaluation');
assert.equal(pass.status,'eligible-for-mastering-evaluation');
assert.equal(pass.preference.finishedVotes,2);
assert.equal(pass.thresholds.allThresholdsPass,true);
assert.equal(pass.allShortlist,true);
assert.deepEqual(pass.exactHashes,manifest.hashes,'gate output must preserve exact reviewed hashes');

const tie=evaluateBlindPair({manifest,truth,reviews:[makeReview('one'),makeReview('two',{preferred:'tie'})]});
assert.equal(tie.advanceToMastering,false,'a tie must hold the candidate');

const lowScore=evaluateBlindPair({manifest,truth,reviews:[makeReview('one'),makeReview('two',{scores:{
  A:{roomFit:3.4,musicality:3.3,lowFatigue:3.6,variation:3.2,productionPolish:3.2},
  B:{roomFit:4.4,musicality:3.0,lowFatigue:4.5,variation:4.0,productionPolish:4.2}
}})]});
assert.equal(lowScore.advanceToMastering,false,'below-threshold musicality must hold the candidate');

assert.throws(()=>validateBlindReview(makeReview('short-listen',{listenedSeconds:{A:89,B:120}}),{pairId:manifest.pairId,hashes:manifest.hashes}),/at least 90 seconds/);
assert.throws(()=>evaluateBlindPair({manifest,truth,reviews:[makeReview('one',{exactHashes:{A:'c'.repeat(64),B:manifest.hashes.B}}),makeReview('two')]}),/exactHashes do not match/,'a review for stale or different audio must be rejected');
assert.throws(()=>evaluateBlindPair({manifest,truth,reviews:[makeReview('same'),makeReview('SAME')]}),/Reviewer identities must be unique/);
assert.throws(()=>evaluateBlindPair({manifest,truth,reviews:[makeReview('only-one')]}),/At least two completed reviews/);

console.log('PASS audio-quality-v4 review gate: exact hashes, listening time, independent reviewers, preference, shortlist and score thresholds enforced');
