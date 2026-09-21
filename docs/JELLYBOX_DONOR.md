# JellyBox donor analysis for Afterlight Radio

Source target: `avdept/JellyBoxPlayer` (JellyBox), an AGPL-3.0 Flutter client for Jellyfin, Emby, and Navidrome/Subsonic-compatible libraries.

## Why this belongs in Afterlight

Afterlight is the listening product. Open Music Studio remains the separate creation/generation product. JellyBox contributes playback, library, offline, and device-integration patterns, so its useful ideas map to Afterlight rather than to the generation studio.

## Clean-room boundary

JellyBox is AGPL-3.0. This branch does **not** copy JellyBox source, UI, assets, shaders, or implementation details. It uses public product behavior and architectural ideas as requirements and implements those requirements independently in Afterlight's existing JavaScript/Vercel/Neon architecture.

## Donor capability map

| JellyBox capability | Afterlight mapping | Status in this branch |
| --- | --- | --- |
| Full offline mode + downloads | Explicit per-room offline save with cached route, shared runtime shell, and all three WAV tracks | Implemented |
| Playback memory | Persist and restore position for the same track | Implemented |
| Progressive media caching | Cache Storage + service worker media path | Implemented, explicit-save first |
| Range-aware playback | Serve byte ranges from cached WAV responses | Implemented |
| Queue / playlist management | Durable per-device queue state, recent listening history, deterministic shuffle, repeat-one/all/off, and room-track selection | Implemented |
| Jellyfin / Emby / Navidrome servers | Disabled-by-default server-side Navidrome/Subsonic adapter with normalized search, first-party artwork/audio proxy, auth requirement, HTTPS/private-host guardrails, and Range forwarding | Implemented backend boundary |
| Library browse / search | Searchable first-party surface over all 36 owned Afterlight tracks, rooms, and moods | Implemented |
| Synced lyrics | Bounded authenticated OpenSubsonic line-timed lyrics for user-owned/self-hosted provider tracks; first-party catalog remains instrumental | Provider backend implemented; UI deferred until content/provider playback surface exists |
| Artwork-driven theming | Existing Afterlight room palettes and illustrated scenes already cover this product need | Existing |
| Media keys / system controls | Existing Media Session integration | Existing |
| AirPlay / DLNA / car surfaces | Native/cast adapters after core web library contract is stable | Later |

## Security and privacy rules

- External media-server credentials must never be stored in browser localStorage or committed configuration.
- The adapter accepts a precomputed Subsonic token + salt; raw provider passwords are deliberately unsupported.
- Future Jellyfin, Emby, or Navidrome connectors terminate server-side and return normalized library data to the browser.
- Offline caching is same-origin only and refuses arbitrary third-party URLs.
- Premium gating remains in the existing Afterlight runtime; the offline button calls the same gate before saving a room.
- Offline state and playback position remain local to the device in this slice.

## Initial implementation

`scripts/library-runtime.js`
- registers the offline service worker
- adds a per-room **Save offline** / **Offline** control
- saves the room route, shared runtime shell, and its three audio tracks; removing one room preserves the shared shell for other saved rooms
- persists playback position locally and restores it for the matching track
- exposes `window.__afterlightLibrary` with a versioned provider contract

`scripts/queue-runtime.js`
- keeps queue mode, deterministic shuffle order, repeat mode, and recent playback history in local device storage
- preserves the existing three-track room product while making navigation explicit and inspectable
- exposes `window.__afterlightQueue` for deterministic browser verification

`scripts/library-browser.js`
- indexes the existing 12 rooms × 3 owned tracks into a 36-track first-party catalog
- searches track titles, places, mood, and room story without an external service
- selects exact room/track while preserving premium gating
- exposes `window.__afterlightCatalog` for deterministic browser verification

`scripts/offline-worker.js`
- accepts bounded same-origin cache/remove commands
- caches full room WAV files plus the shared JavaScript shell required for a true cold offline start
- keeps the runtime shell network-first while online so deployments can update normally, then falls back to cached shell assets when offline
- serves cached WAV byte ranges with HTTP 206 semantics
- falls back to cached room HTML when navigation is offline

## Next bounded slices

1. Enable and verify the Navidrome/Subsonic backend only in a non-production environment with server-side secrets.
2. Add external-library browse/playback UI only after provider search/streaming has hosted evidence.
3. Extend the normalized adapter to Jellyfin/Emby only if needed; do not mix provider-specific credentials into browser code.
4. Lyrics support only when Afterlight has owned vocal/lyric content to display.
5. Hosted browser verification: save room, force offline, cold-load saved route with browser cache disabled, load the cached runtime shell, seek within a cached WAV, and resume playback position.

No production-readiness claim should be made until the hosted offline/cold-start and range-seek evidence is collected on the exact deployed commit.


## Server-side provider implementation

The shared API core and production Neon Function now expose:

- `GET /api/library/provider/status`
- `GET /api/library/provider/search?q=...`
- `GET /api/library/provider/lyrics?id=...`
- `GET|HEAD /api/library/provider/stream?id=...`
- `GET|HEAD /api/library/provider/artwork?id=...`

Every route requires an authenticated Afterlight session. Provider base URLs must be HTTPS and cannot target localhost, RFC1918-style IPv4 ranges, or `.local` hosts. Search requests are bounded and normalized into the same provider-track shape already defined by the browser contract. Provider tracks now include a same-origin `lyricsUrl`. Lyrics are normalized from OpenSubsonic `getLyricsBySongId` into bounded line-level timing, language, offset and text; raw provider responses and credentials are not exposed. Stream and artwork responses never expose Navidrome credentials; the server performs the upstream request and returns selected media headers only.
