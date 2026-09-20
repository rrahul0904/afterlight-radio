# JellyBox donor analysis for Afterlight Radio

Source target: `avdept/JellyBoxPlayer` (JellyBox), an AGPL-3.0 Flutter client for Jellyfin, Emby, and Navidrome/Subsonic-compatible libraries.

## Why this belongs in Afterlight

Afterlight is the listening product. Open Music Studio remains the separate creation/generation product. JellyBox contributes playback, library, offline, and device-integration patterns, so its useful ideas map to Afterlight rather than to the generation studio.

## Clean-room boundary

JellyBox is AGPL-3.0. This branch does **not** copy JellyBox source, UI, assets, shaders, or implementation details. It uses public product behavior and architectural ideas as requirements and implements those requirements independently in Afterlight's existing JavaScript/Vercel/Neon architecture.

## Donor capability map

| JellyBox capability | Afterlight mapping | Status in this branch |
| --- | --- | --- |
| Full offline mode + downloads | Explicit per-room offline save with cached route + all three WAV tracks | Implemented |
| Playback memory | Persist and restore position for the same track | Implemented |
| Progressive media caching | Cache Storage + service worker media path | Implemented, explicit-save first |
| Range-aware playback | Serve byte ranges from cached WAV responses | Implemented |
| Queue / playlist management | Preserve Afterlight's three-track room rotation; add a normalized queue contract later | Planned |
| Jellyfin / Emby / Navidrome servers | Provider adapter boundary with normalized track shape | Contract only |
| Synced lyrics | Optional lyric layer for owned/generated tracks | Planned |
| Artwork-driven theming | Existing Afterlight room palettes and illustrated scenes already cover this product need | Existing |
| Media keys / system controls | Existing Media Session integration | Existing |
| AirPlay / DLNA / car surfaces | Native/cast adapters after core web library contract is stable | Later |

## Security and privacy rules

- External media-server credentials must never be stored in browser localStorage or committed configuration.
- Future Jellyfin, Emby, or Navidrome connectors terminate server-side and return normalized library data to the browser.
- Offline caching is same-origin only and refuses arbitrary third-party URLs.
- Premium gating remains in the existing Afterlight runtime; the offline button calls the same gate before saving a room.
- Offline state and playback position remain local to the device in this slice.

## Initial implementation

`scripts/library-runtime.js`
- registers the offline service worker
- adds a per-room **Save offline** / **Offline** control
- saves and removes the room route plus its three audio tracks
- persists playback position locally and restores it for the matching track
- exposes `window.__afterlightLibrary` with a versioned provider contract

`scripts/offline-worker.js`
- accepts bounded same-origin cache/remove commands
- caches full room WAV files
- serves cached WAV byte ranges with HTTP 206 semantics
- falls back to cached room HTML when navigation is offline

## Next bounded slices

1. Normalized queue/history model with shuffle/repeat and deterministic restore.
2. Lyrics model for generated/owned tracks.
3. Server-side provider interface and one adapter behind explicit configuration; Navidrome/Subsonic is the smallest protocol surface.
4. Library search and browse UI separated from the twelve curated Afterlight rooms.
5. Hosted browser verification: save room, force offline, cold-load saved route, seek within a cached WAV, resume playback position.

No production-readiness claim should be made until the hosted offline/cold-start and range-seek evidence is collected on the exact deployed commit.
