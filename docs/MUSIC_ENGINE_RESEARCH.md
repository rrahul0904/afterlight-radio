# Music engine reverse-engineering notes

This work separates two donor problems:

- **JellyBox** is a playback/library/offline donor. It does not create music.
- **Afterlight's music engine** needs separate clean-room research from products that actually generate or adapt music.

## Public product evidence

### Endel

Endel publicly describes personalized, real-time sound generation. Its technology material says sound logic and elements are pre-designed by its sound team, then a core logic/node system maps context onto those elements and adapts the soundscape on the fly. Endel also distinguishes endlessly generated Soundscapes from timed Scenarios with predefined phases.

Sources:
- https://endel.io/technology
- https://endel.io/
- https://endel.io/science

Relevant patent families describe continuous soundscape generation and automatic composition. They are useful for understanding the problem space, but this implementation deliberately avoids reproducing patent claims or proprietary algorithms.

### Brain.fm

Brain.fm publicly describes functional music designed to avoid distracting foreground events and says its audio uses engineered rhythmic/acoustic modulation. We use only the broad product lesson — predictable, low-distraction musical structure — and do **not** copy its patented neural phase-locking techniques, modulation parameters, or efficacy claims.

Sources:
- https://www.brain.fm/science
- https://www.brain.fm/blog/beta-waves-brain-fm-engineering-focus

### Mubert

Mubert publicly exposes a context-generation workflow: prompt or mood/genre → output type → duration → generation. It supports tracks, loops, mixes, and jingles. That reinforces the product distinction between a fixed playlist and a generation engine driven by a desired musical context.

Source:
- https://mubert.com/render/how-it-works

## Clean-room design adopted for Afterlight

Afterlight v3 uses an independent **authored-elements + deterministic-arrangement** model:

1. Each room owns a musical profile: BPM, tonal center, mode, style, warmth, motion, brightness, melody density, swing, rhythm density, and ambience.
2. Each of the three room tracks receives a deterministic seeded score.
3. Chord states move through a small weighted harmonic graph rather than one fixed repeated progression.
4. Authored motif templates are transformed by rotation, inversion-like mapping, register shifts, and selective variation.
5. Each 12-bar piece follows a multi-section arrangement arc with changing pad, keys, pluck, bass, drums, lead, and ambience density.
6. Notes use bounded microtiming, velocity, and swing variation.
7. Rendering is stereo, with voice-specific panning and cross-fed multi-tap ambience.
8. Every build creates a versioned `music-manifest.json` with title, room, style, BPM, key, duration, arrangement, renderer, channel count, and rights boundary.
9. CI runs `scripts/music-quality-check.mjs` and rejects mono files, short arrangements, duplicate tracks, collapsed stereo, implausible loudness, DC offset, or manifest drift.
10. All 36 files come from first-party synthesis code. There are no external stems, copyrighted recordings, third-party models, or imported melodies.

## What we intentionally do not copy

- Endel implementation details, trained models, node graphs, stems, or patented claim language.
- Brain.fm neural phase-locking implementation, modulation parameters, or medical/neuroscience claims.
- Mubert models, datasets, prompts, training recipes, or generated assets.
- Music from external streaming services.

The target is user-experience parity at the high level: original, room-specific, evolving background music that can play continuously without sounding like one tiny loop.


## Playback/library donor findings — September 21, 2026

The listening product now needs to be compared against mature OpenSubsonic/Jellyfin-style clients, not against a generator.

Current Navidrome's client ecosystem repeatedly surfaces the same mature-player capabilities: persistent queues, gapless or crossfade transitions, lyrics/metadata, offline caching, ReplayGain/normalization, casting, CarPlay/Android Auto, and system media controls.

For Afterlight, these map as follows:

- offline package / queue / Media Session: already implemented.
- server-side Navidrome/Subsonic search, stream and artwork: already implemented.
- line-timed provider lyrics: implemented in the phase-2 provider contract through authenticated `getLyricsBySongId` normalization.
- true crossfade/gapless: still pending; do not label simple next-track autoplay as gapless.
- ReplayGain/normalization: generator-side quality/loudness guards exist for first-party audio; provider ReplayGain remains separate future work.
- cast/car surfaces: future platform adapters.
- Jellyfin/Emby: future providers behind the same normalized contract.

References:
- https://www.navidrome.org/apps/
- https://www.navidrome.org/docs/developers/subsonic-api/
- https://opensubsonic.netlify.app/docs/endpoints/getlyricsbysongid/

### Lyrics boundary

Provider lyrics come only from the authenticated user's configured self-hosted library. Afterlight does not scrape lyric sites or bundle third-party lyric databases. The API returns a bounded line-level model and intentionally drops arbitrary provider fields.

## Creation-studio boundary

ACE-Step / prompt-to-music / stems / timeline editing / regenerate / repaint / extend belong to **Open Music Studio**, the separate Silens-derived creation product. They should not be added to Afterlight's player merely to increase feature count.

The audited tracker still has no verified owned Open Music Studio repository, so creation-studio implementation remains a repository-reconciliation task rather than an Afterlight subfolder.


## September 21, 2026 — catalog-production course correction

The current engine is retained as an owned deterministic composition source, but generator output is no longer treated as automatically catalog-worthy.

Current public product patterns reinforce this separation. Mubert exposes duration/output-mode choices including long-form mixes, while current ACE-Step 1.5 emphasizes long-form planning and editing rather than one-shot acceptance. Afterlight adopts only the product-process lesson: generate several controlled candidates, listen, reject/rework/shortlist, and promote only cleared masters.

The new Music Lab therefore adds:

- longer 24–96 bar audition renders without changing the stable production build;
- multiple deterministic seeds per room;
- blind candidate labels to reduce expectation bias;
- technical metrics and provenance;
- actual listening-time capture;
- human scores for room fit, musicality, fatigue, variation and polish;
- explicit beta vs public-production thresholds.

No external model, weights, dataset or generated third-party audio is bundled into Afterlight by this change.
