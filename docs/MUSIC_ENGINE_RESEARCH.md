# Music engine reverse-engineering notes

This work separates two donor problems:

- **JellyBox** is a playback/library/offline donor. It does not create music.
- **Afterlight's music engine** needs separate clean-room research from products that actually generate or adapt music.

## Public product evidence

### Endel

Endel publicly describes its system as personalized, real-time sound generation. Its technology page says the sound team pre-designs sound logic and musical elements for each soundscape, while a core logic/node system maps inputs onto those elements and adapts the result on the fly. Endel also distinguishes endlessly generated Soundscapes from timed Scenarios with predefined phases.

Sources:
- https://endel.io/technology
- https://endel.io/
- https://endel.io/science

Relevant patent families also describe continuous soundscape generation and automatic composition. Those patents are useful for understanding the problem space, but this implementation deliberately avoids reproducing patent claims or proprietary algorithms.

### Brain.fm

Brain.fm publicly describes functional music designed to avoid distracting foreground events. Its science material says it uses direct acoustic/rhythmic modulation in its audio rather than simply curating ordinary songs. We use only the broad product lesson — predictable, low-distraction structure — and do **not** attempt to clone its patented neural phase-locking methods or make medical/neuroscience efficacy claims.

Sources:
- https://www.brain.fm/science
- https://www.brain.fm/blog/beta-waves-brain-fm-engineering-focus

### Mubert

Mubert publicly exposes a prompt/mood/genre → track-type → duration → generation workflow and supports track, loop, mix and jingle outputs. This reinforces the product distinction between a fixed playlist and a generation engine that accepts a desired musical context.

Source:
- https://mubert.com/render/how-it-works

## Clean-room design adopted for Afterlight

The old engine generated short 8-bar mono loops. That was not sufficient.

Version 2 uses an independent **authored-elements + deterministic-arrangement** model:

1. Each room defines a musical profile: BPM, tonal center, mode, warmth, motion, brightness, melody density, swing, texture and rhythm density.
2. Each generated track receives a deterministic seeded score.
3. Chord states move through a small weighted harmonic graph rather than a fixed repeated progression.
4. Authored motif templates are transformed by rotation, inversion-like mapping, register shifts and selective variation.
5. Each 12-bar piece moves through multiple arrangement sections with different pad, keys, pluck, bass, drums, lead and ambience levels.
6. Notes include bounded microtiming, velocity and swing variation.
7. The synth renders a true stereo field with voice-specific panning and cross-fed multi-tap ambience.
8. All 36 files are generated from first-party code; no external stems, copyrighted recordings, third-party model weights, melodies or samples are included.
9. CI runs `scripts/music-quality-check.mjs` and rejects mono files, short arrangements, duplicate tracks, collapsed stereo, implausible loudness or DC offset.

## What we intentionally do not copy

- Endel implementation details, source code, trained models, node graphs, stems or patented claim language.
- Brain.fm neural phase-locking implementation, modulation parameters or efficacy claims.
- Mubert models, datasets, prompts, training recipes or generated assets.
- Music from any external streaming service.

The target is functional product parity at the level of user experience: original, room-specific, evolving background music that can play continuously without sounding like one tiny loop.
