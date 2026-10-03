# Afterlight Audio Quality v4 — audition-first recovery

## Why this exists

Afterlight's room/player product is substantially more mature than the sound of the current procedural catalog. The merged catalog audit proved a concrete mastering gap, but loudness correction alone cannot establish musical quality.

This slice therefore creates a **non-production audition path**. It is intentionally designed to improve and compare long-form candidates without silently replacing any released room audio.

## What v4 changes

The v4 audition pass starts from the existing long-form Composition Engine candidate and applies an original deterministic finishing chain:

1. DC removal / subsonic cleanup.
2. Low/high tonal split with bounded room-aware warmth and presence.
3. Mid/side width control with a strict anti-collapse bound.
4. Short cross-channel early reflections for depth without a long metallic tail.
5. Soft saturation and a slow envelope compressor to reduce brittle peaks.
6. RMS-aware gain staging with a hard peak ceiling.
7. Final PCM16 render plus before/after objective metrics and SHA-256 receipts.

The output is an audition candidate, **not a production master**.

## What v4 does not claim

- It does not claim that DSP metrics prove that a track sounds good.
- It does not auto-publish or replace the 36-track production catalog.
- It does not bypass Music Lab listening review.
- It does not add third-party audio, stems, samples, model weights, or copyrighted recordings.
- It does not claim LUFS compliance; the existing FFmpeg mastering certification remains authoritative for release candidates.

## Required release path

A v4 candidate can only progress toward production after:

1. A/B listening against the untreated long-form candidate.
2. Music Lab review for room fit, musicality, low fatigue, variation and production polish.
3. Exact candidate SHA binding.
4. FFmpeg mastering certification.
5. Existing multi-reviewer production approval.
6. Explicit release certificate.
7. Hosted listening UAT on representative phone speaker, headphones and desktop/laptop playback.

## Suggested flagship rooms

Start with four rooms before regenerating the whole catalog:

- `rooftop` — warm/social flagship.
- `window` — rain/jazz low-fatigue case.
- `headspace` — sparse focus/piano case.
- `last-bus` — dark/ambient case.

For each room, render several 48–64 bar candidates, blind A/B them, and only promote candidates that humans clearly prefer.

## CLI

```bash
npm run music:quality-v4 -- --room rooftop --seed flagship-a --role 1 --bars 48 --out .music-lab/v4/rooftop
```

The command writes:

- `before.wav` — untreated long-form engine candidate.
- `after.wav` — v4 audition-finishing candidate.
- `quality-receipt.json` — deterministic metrics, hashes and processing provenance.

## Product principle

For Afterlight, audio quality is a launch gate. New visuals, social features, DJ/broadcast features and additional integrations should not be used as a substitute for a catalog that people actually want to keep listening to.
