# Afterlight music pipeline

## What the donor sites actually do

The JellyBox donor is a **music client**, not a music-generation service. It connects to a Jellyfin, Emby, or Navidrome/Subsonic library and plays media that already exists on that server. Features such as queue generation, offline downloads, lyrics, Studio Mode, CarPlay, and artwork theming operate on an existing catalog; they do not synthesize songs.

Afterlight is different because it promises a listening catalog of its own. That means playback reverse-engineering and music-content creation are two separate systems.

## Current Afterlight model

Afterlight now renders 36 original instrumental tracks at build time with `scripts/audio-library.mjs`.

Composition Engine v3 gives every room:
- its own BPM, key/mode, style, warmth, groove, ambience, and instrument balance
- three distinct production arrangements: **arrival arc**, **motion arc**, and **late-night arc**
- voiced chord progressions with changing inversions
- deterministic melodic motifs and answer phrases
- electric-piano, muted-pluck/guitar, bass, restrained drums, fills, tape/room texture, wow/flutter, and multi-tap reverb
- intro/A/B/outro dynamics and fade boundaries rather than one flat oscillator loop
- deterministic mastering so the same source revision rebuilds the same audio

The output remains uncompressed PCM WAV because browser support is universal and byte-range/offline behavior is deterministic. The build emits `public/music-manifest.json` with BPM, key, style, arrangement, duration, format, and generation provenance for all 36 tracks.

## Why we do not copy donor music

Afterlight does not scrape, download, or redistribute music from JellyBox users, Jellyfin/Emby/Navidrome servers, streaming sites, or reference products. Their audio belongs to their users/rightsholders and is not part of the donor application source.

The clean-room rule is:
1. learn product behavior and architecture from the reference;
2. implement player/library behavior independently;
3. create or license our own catalog separately.

## Higher-fidelity path

Composition Engine v3 is the reproducible baseline, not the ceiling. A later catalog pipeline can replace individual WAV masters with higher-fidelity original productions while keeping the same stable track IDs and manifest contract. The preferred production workflow is:

1. compose/render original masters outside the request path;
2. run loudness, clipping, duration, silence, and uniqueness QC;
3. attach rights/provenance metadata;
4. publish immutable media;
5. update the catalog manifest;
6. certify seeking, offline packages, queue restore, and playback on the exact hosted revision.

Do not generate expensive music during a listener request. Music generation belongs in a build/content pipeline; playback belongs in the product runtime.


## Music Lab: candidates are not catalog

The production build still emits the stable 36-track catalog. Music Lab is a separate offline/content-production path used to improve the catalog deliberately.

Run a long-form audition batch for one room:

```bash
npm run music:lab -- --room rooftop --count 4 --bars 48
```

The output is written under `.music-lab/<room>/` and is intentionally gitignored. A batch contains:

- multiple long-form stereo WAV candidates generated from distinct deterministic seeds;
- `manifest.json` with hashes, provenance and technical measurements;
- `review.html` for blind listening and scoring;
- `review-template.json` for manual/second-review workflows;
- `lab-summary.json`.

The review package tracks Room fit, Musicality, Low fatigue, Variation and Production polish. It also records actual listening time. A technical pass does **not** mean the candidate is approved.

### Promotion gate

Human review policy is versioned in `music/catalog-policy.json`.

Beta shortlisting requires at least one reviewer and meaningful listening time. Public-production approval requires at least two reviewers, stronger score thresholds and explicit shortlist votes. Any technical failure, reject vote, insufficient listening coverage or uncleared provenance blocks promotion.

Example:

```bash
npm run music:review-gate -- \
  --stage production \
  --manifest .music-lab/rooftop/manifest.json \
  --reviews reviewer-a.json,reviewer-b.json
```

This gate is deliberately separate from the normal application CI: human music quality cannot be proven by unit tests.
