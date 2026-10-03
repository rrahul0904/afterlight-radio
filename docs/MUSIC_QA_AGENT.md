# Afterlight Music QA Agent

The Music QA Agent is an evidence-producing pre-listening gate for Afterlight candidates. It does **not** claim that waveform statistics can prove a song is enjoyable.

## Specialist evaluators

The agent runs independent specialist checks for:

- signal integrity: peak ceiling, clipping, DC offset, excessive silence;
- dynamics: crest factor and macro-dynamic span;
- stereo: side/mid energy and left/right correlation;
- fatigue proxies: derivative roughness and zero-crossing density;
- repetition proxies: long-lag loudness-envelope periodicity;
- candidate comparison: width, dynamics, repetition and roughness regressions versus the untreated source;
- room fit: metadata is recorded, but emotional/genre fit is deliberately left to human listening.

## Consensus

The machine consensus has only two outcomes:

- `reject` — a hard technical failure exists;
- `eligible-for-human-review` — no hard technical failure was found.

It never emits `production-approved`. `humanListeningRequired` is always true and `canAutoApproveProduction` is always false.

## Exact-candidate binding

Flagship qualification uses one candidate identity everywhere: seed `flagship-a`, role 1 and 32 bars for Rooftop, Window, Headspace and Last Bus. Thirty-two bars keeps every room above the 90-second minimum used by the blind review gate.

CI privately binds four evidence layers before producing a deploy artifact:

1. the Music QA report source and finished SHA-256 values;
2. the private blind-pack treatment map;
3. the blinded A/B pack hashes;
4. the hashes served by the deployable Audio Lab.

A mismatch fails CI. This prevents the machine agent from grading one render while humans hear another.

## Blinding boundary

Music QA reports and the private treatment map are separate CI artifacts. They are intentionally **not** copied into `/audio-lab/` because the finished-audio hash could identify which A/B file received the v4 treatment.

The public/deployable Audio Lab contains only blinded A/B hashes and review metadata. Reviewers should not inspect the Music QA or private-truth artifacts until their A/B decisions are frozen.

## CI evidence

PR CI publishes:

- one JSON Music QA evidence report per candidate;
- a separate `summary.json` with exact finished-audio SHA-256 values and machine gates;
- an artifact named `afterlight-music-agent-<exact-head-sha>`;
- a blinded flagship listening artifact;
- a separate private treatment-map artifact;
- an exact-head deploy bundle that contains the Audio Lab but no treatment-revealing QA evidence.

CI fails if any flagship candidate is machine-rejected, if any candidate is shorter than 90 seconds, if hashes drift across layers, or if treatment-revealing evidence appears in the public Audio Lab.

## What it cannot prove

The agent cannot truthfully establish musical taste, emotional room fit, groove, authenticity of instrument timbre, or whether a listener will enjoy a 30–60 minute session. Those remain blind-human-review requirements.

A future model-backed listener may consume the audio itself and provide an additional structured critique, but it must remain advisory and must not replace the existing blind reviewer gate.
