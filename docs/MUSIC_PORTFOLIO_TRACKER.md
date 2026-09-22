# Music reverse-engineering portfolio

This document is the repository-side boundary for the music entries in the audited reverse-engineering tracker.

## Product boundaries

### Afterlight Radio — listening product

Canonical repository: `rrahul0904/afterlight-radio`.

Donors and inspirations that belong here:

- **Enikq** — immersive place-based listening/product inspiration.
- **Paxroom** — focus-room donor: timer, ambient controls, local tasks and session history.
- **JellyBox** — playback/library donor: offline packages, playback memory, queue/history, self-hosted library patterns, media controls and future device surfaces.

Afterlight is not the AI song-generation studio. Its job is to deliver original/owned music and user-authorized self-hosted libraries through a calm listening experience.

### Open Music Studio — creation product

Donor: **Silens**, plus current research into browser-based AI music creation/editing workflows.

This must remain a separate product and repository from Afterlight. Generation/editing concepts such as prompt-to-music, stems, timeline editing, repaint/extend/cover, vocal/BGM workflows and export belong there.

The audited tracker currently has no verified owned `rrahul0904/open-music-studio` repository. Do not hide that gap by placing creation code inside Afterlight.

### AnyDub and OutLoud — standalone products

These remain separate from both Afterlight and Open Music Studio. They should not be folded into the listening product merely because they involve audio.

## Afterlight capability reconciliation

Implemented in current `main`:

- 12-room immersive listening experience.
- Composition Engine v3: 36 original deterministic stereo arrangements.
- versioned music manifest and audio-quality CI.
- local focus sessions, todos, generated ambience and session history.
- explicit per-room offline packages.
- cold-offline runtime shell and cached HTTP 206 byte-range playback.
- playback-position memory.
- queue/history, deterministic shuffle and repeat off/one/all.
- searchable first-party 36-track library.
- Media Session/system control integration.
- authenticated, server-side Navidrome/Subsonic provider boundary.
- provider search, stream, artwork and Range forwarding.
- Music Lab long-form candidate rendering, blind audition packages and human review/promotion policy.
- source-agnostic studio-master intake for higher-fidelity Open Music Studio/human-produced candidates with SHA/provenance binding.
- FFmpeg-based studio mastering certification with LUFS, true-peak and loudness-range evidence bound to the exact audition package before production approval.
- credentials kept server-side with HTTPS/private-host guardrails.

## Catalog-quality workstream

Current production audio remains the deterministic v3 36-track baseline. The Music Lab workstream exists because technical QC does not establish musical quality.

The target process is:

1. generate or produce several longer candidates for a room;
2. automatically reject broken/clipping/collapsed-stereo candidates;
3. run mastering consistency analysis for studio masters and reject stale/missing evidence at production gate;
4. blind-listen and score room fit, musicality, fatigue, variation and polish;
5. reject/rework/shortlist;
6. require stronger multi-reviewer thresholds before public-production promotion;
7. keep the released catalog immutable until a reviewed master is deliberately promoted.

The Music Lab is not a user-facing song generator and does not collapse the Open Music Studio boundary.

## Remaining reverse-engineering gaps

Ordered by useful product value rather than by donor name:

1. **Provider lyrics and metadata**
   - normalize user-owned/self-hosted line-timed lyrics behind the authenticated provider boundary.
   - do not scrape lyrics or import copyrighted lyric databases.
2. **External-library browser/playback UI**
   - expose the already-implemented provider search/stream contract only after hosted evidence.
3. **Transition quality**
   - prefetch upcoming owned tracks and remove avoidable dead air.
   - only call behavior “crossfade” when two-track overlap is actually implemented and certified.
4. **Hosted offline certification**
   - save room → force offline → cold-load → seek cached WAV → restore position on the exact deployed revision.
5. **Provider expansion**
   - add Jellyfin/Emby only through the same normalized server-side contract.
6. **Device surfaces**
   - AirPlay/Cast/DLNA/car integrations after the web playback contract is stable.
7. **Lyrics UI**
   - only for Afterlight-owned lyric content or lyrics returned by the user’s authorized self-hosted provider.

## Stale tracker notes corrected here

The older JellyBox tracker note listed queue work as pending. Queue/history/shuffle/repeat are already implemented and merged. The provider backend is also already implemented for Navidrome/Subsonic. The remaining provider work is hosted enablement, browser UX, lyrics and optional Jellyfin/Emby parity.

## Launch boundary

Repository completion is not the same as hosted certification. Composition Engine v3 is merged and repository-certified, but the canonical production deployment must not be described as the v3 release until the deployed `release.txt` matches the exact main SHA and the hosted music manifest/audio verification passes.
