# Afterlight Music Engine

## Purpose

Afterlight is the listening product. Its music system must create original, low-distraction listening experiences that can evolve over a session without copying third-party recordings or proprietary implementations.

The current production source contains **Composition Engine v2**, which renders 36 original deterministic room tracks at build time. This document records the public product patterns that inform the next clean-room adaptive layer.

## Public donor patterns

### Endel-style generative soundscape pattern

Public Endel product material describes a system with three important layers:

1. **Context inputs** — time of day, weather, motion, heart rate and other permitted device/environment signals.
2. **Core logic** — maps current context onto soundscape rules.
3. **Pre-designed sound logic and elements** — musical/sound-design material is created ahead of time, then the runtime adapts the active soundscape when inputs change.

The useful product lesson for Afterlight is not “AI makes a finished song from scratch.” It is **designed musical material + deterministic/adaptive runtime logic**.

### Brain.fm-style functional composition pattern

Public Brain.fm material describes a different but complementary pipeline:

1. Humans compose the musical foundation: melody, harmony, chord progressions, sound design and instrumentation.
2. Algorithmic systems arrange motifs over longer time spans.
3. Acoustic processing/modulation and salience reduction are layered onto that musical material.
4. Finished material is tested and edited rather than accepted blindly.

The useful product lesson for Afterlight is **composition first, adaptation/process second**. A focus-oriented product should also avoid abrupt gaps, sharp changes and excessive attention-grabbing events.

## What Afterlight already implements

### Composition Engine v2

`scripts/audio-library.mjs` currently provides:

- 12 room-specific musical identities.
- 3 arrangements per room / 36 total tracks.
- room-specific BPM, tonal center, mode and style.
- intro / A / B / outro arrangement phases.
- deterministic motif banks.
- chord inversions and simple voice-leading.
- electric-piano motifs with rests and dynamics.
- plucked/guitar-like syncopation.
- bass movement and approach tones.
- restrained drum patterns and fills.
- brown/tape-style room texture and sparse crackle.
- intro/outro fades.
- multi-tap reverb and subtle chorus-like thickening.
- objective WAV quality checks.
- `music-manifest.json` describing every rendered track.

This is original procedural composition. It is not copied from Endel, Brain.fm, JellyBox or another music service.

## Why JellyBox did not solve music generation

JellyBox is primarily a **music client/player** for Jellyfin, Emby and Navidrome/Subsonic libraries. Its donor value is playback, offline storage, queues, media controls and external-library interoperability. It does not provide the missing composition engine.

For music-generation architecture, products such as Endel and Brain.fm are the more relevant public references.

## Composition Engine v3 — adaptive layer

The next layer should preserve v2's authored musical identity and add runtime adaptation instead of replacing it with undirected generation.

### Inputs

Use only inputs that are available and appropriate for the web product:

- selected intent: Focus / Unwind / Read / Sleep.
- room identity.
- local time bucket: morning / daytime / evening / late night.
- current session duration.
- recent track history.
- explicit user intensity preference.
- optional motion/biometric inputs only on future platforms where the user grants permission.

Location, health or biometric data must **not** be required.

### Score planner

The score planner should produce a small deterministic state such as:

```js
{
  intent: 'focus',
  energy: 0.58,
  density: 0.44,
  percussion: 0.30,
  motifActivity: 0.38,
  brightness: 0.52,
  ambience: 0.24,
  variationWindowBars: 16
}
```

It should evolve gradually. No single input change should cause an abrupt musical cut.

### Musical constraints

For Focus:
- lower melodic salience.
- narrow density changes.
- steady pulse.
- fewer fills.
- longer motif-repetition windows.

For Unwind:
- lower percussion.
- warmer harmonic spectrum.
- longer releases.
- higher ambience.

For Read:
- moderate pulse.
- sparse lead activity.
- stable harmony.
- restrained low-frequency movement.

For Sleep:
- percussion near zero.
- slow energy decay.
- extended pads/noise textures.
- no sharp high-frequency transients.

### Runtime architecture

Phase 1 should remain lightweight:

1. Continue serving v2 rendered recordings as the reliable base layer.
2. Add a first-party **adaptive controller** that changes track/section selection only at musical boundaries.
3. Add an optional low-level Web Audio ambience layer.
4. Persist only non-sensitive session preferences locally.
5. Keep offline packages deterministic.

A later native/mobile version can use pre-rendered stems and crossfades for finer-grained adaptation.

## Functional modulation

Do not market or implement medical/neuroscience claims without appropriate evidence.

A future experimental Focus mode may support subtle amplitude/spectral modulation as an **optional audio-processing experiment**, but it must be bounded to safe playback levels, configurable/removable, tested against an unprocessed control, and described factually rather than as a medical treatment.

## Rights and provenance

- All Afterlight generated audio must be original or properly licensed.
- Never scrape or copy third-party music.
- Never recreate a recognizable copyrighted recording.
- Public product descriptions may inform requirements and architecture; proprietary code and assets may not be copied.
- Each build continues to publish provenance metadata in `music-manifest.json`.

## Launch gate

Music is not considered launched merely because the repository renders audio.

A release is launch-certified only when the exact Git revision is:

1. green in CI,
2. green in the browser matrix,
3. deployed to an anonymous/public production URL,
4. verified to serve `music-manifest.json`,
5. verified to return valid audio and byte-range responses,
6. verified to match `release.txt` to the expected commit SHA.

As of this design, deployment credentials remain an infrastructure requirement independent of the composition engine.
