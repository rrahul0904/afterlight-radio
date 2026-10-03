# Afterlight music source decision — 2026-10-03

The rebuild cannot be called successful while its only meaningful catalog is 36 short generated WAVs. The primary product problem is now music depth + rights, not more UI.

## Decision

Use a two-lane music strategy:

1. **Production lane: first-party or explicitly cleared masters**
   - Afterlight-owned originals, direct artist agreements, or commercial licenses whose evidence explicitly covers the required web/app/streaming territories.
   - Store a rights receipt with each promoted catalog entry.
   - This lane may use normal HTML audio and therefore supports the low-distraction room experience, ambience layering, transitions, and later radio semantics without pretending a third-party platform grants rights it did not grant.

2. **Provider-experiment lane: platform APIs/embeds only when their current rules fit the experience**
   - Providers remain visibly attributed and technically isolated behind adapters.
   - A provider experiment does not become the production catalog until its rights/terms and UX constraints pass the same release gate as owned/cleared audio.

## Provider findings

### YouTube

Official docs reviewed:
- `https://developers.google.com/youtube/iframe_api_reference`
- `https://developers.google.com/youtube/terms/required-minimum-functionality`
- `https://developers.google.com/youtube/terms/developer-policies-guide`

Current policy makes a hidden audio-engine interpretation unsuitable. A future YouTube adapter must use the official visible player, keep the required viewport, avoid overlays/obscuring, preserve YouTube metadata/experience, and cannot extract audio or create unsupported background playback. See `YOUTUBE_PROVIDER_POLICY_2026-10-03.md`.

Verdict: **secondary visible-provider experiment, not invisible primary music engine.**

### Spotify

Sources:
- `https://developer.spotify.com/policy`
- `https://developer.spotify.com/documentation/web-playback-sdk/reference`

Current developer policy says streaming applications may not be commercial and prohibits synchronizing Spotify recordings with visual media. The Afterlight product intentionally combines music with an evolving visual place and is intended to become commercial.

Verdict: **do not use as the primary Afterlight streaming integration.**

### SoundCloud

Sources:
- `https://soundcloud.com/terms-of-use/09-2025`
- `https://developers.soundcloud.com/docs/api/html5-widget`

The Widget API supports embedded playback and JavaScript control. However, SoundCloud's terms say prior written consent is required when SoundCloud players/widgets are used to aggregate SoundCloud content into a separate destination where that content forms a material part of the service.

Verdict: **partnership/consent-only candidate, not a default catalog dependency.**

### Jamendo

Sources:
- `https://developer.jamendo.com/v3.0`
- `https://licensing.jamendo.com/en/pricing`

Jamendo exposes a large developer catalog and its licensing products explicitly distinguish web, app, radio, and streaming usage tiers. The exact license purchased for a track/project must be retained as evidence; a public API entry alone is not treated as proof of commercial streaming rights.

Verdict: **strong candidate for a cleared catalog lane, subject to purchasing/confirming the correct project license.**

### Audius

Sources:
- `https://docs.audius.co/`
- `https://docs.audius.co/api/`

Audius explicitly provides APIs/SDKs for third-party apps to query and stream tracks and describes the Open Audio Protocol as an app-building surface. That makes it technically aligned with room-specific streaming pools. Production commercial/monetization rights still need a rights review rather than being inferred from the API docs.

Verdict: **strong technical experiment candidate; rights-review pending before production promotion.**

## Production catalog receipt

Every promoted external/cleared track must record at least:
- stable internal catalog ID;
- room/mix assignment;
- title + artist;
- source/provider;
- source URL or master hash;
- provenance;
- exact license/rights evidence reference;
- commercial-use permission;
- streaming/web/app scope as relevant;
- allowed territories;
- expiration/review date if applicable;
- date verified;
- reviewer identity/process;
- whether Afterlight may layer ambience / transition / radio-host audio with the track.

## Product rule

Do not solve a licensing restriction by hiding provider UI, extracting audio, proxying around a provider player, or claiming ownership of third-party material.

If a platform's compliant experience conflicts with the calm room UX, choose different music rather than weakening the compliance boundary.
