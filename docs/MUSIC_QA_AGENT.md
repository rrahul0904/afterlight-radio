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

## CI deployment

PR CI executes the agent against Rooftop, Window, Headspace and Last Bus and publishes:

- one JSON evidence report per candidate;
- `summary.json` with exact finished-audio SHA-256 values and machine gates;
- an artifact named `afterlight-music-agent-<exact-head-sha>`;
- the summary inside the deploy bundle at `/audio-lab/music-agent-summary.json` when Audio Lab is enabled.

CI fails if any flagship candidate is machine-rejected.

## What it cannot prove

The agent cannot truthfully establish musical taste, emotional room fit, groove, authenticity of instrument timbre, or whether a listener will enjoy a 30–60 minute session. Those remain blind-human-review requirements.

A future model-backed listener may consume the audio itself and provide an additional structured critique, but it must remain advisory and must not replace the existing blind reviewer gate.
