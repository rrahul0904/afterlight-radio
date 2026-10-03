# Afterlight YouTube provider boundary — 2026-10-03

## Decision

The Enikq creator described using YouTube's official IFrame player behind custom controls. We will preserve the **product lesson** (room-specific access to a large external music catalog) but will not blindly reproduce any implementation detail that conflicts with current YouTube API policy.

Official references reviewed on 2026-10-03:
- `https://developers.google.com/youtube/iframe_api_reference`
- `https://developers.google.com/youtube/terms/required-minimum-functionality`
- `https://developers.google.com/youtube/terms/developer-policies-guide`
- `https://developers.google.com/youtube/player_parameters`

## Enforced boundary

Any future YouTube-backed Afterlight adapter must:
- use the official YouTube embedded/IFrame player;
- keep the player viewport at least 200x200;
- keep the player visible when initiating automated/scripted playback;
- not cover or obscure the embedded player with Afterlight UI;
- preserve required YouTube metadata/standard player behavior and branding;
- not extract or isolate audio from the video;
- not implement background playback outside the supported YouTube experience;
- handle embed-disabled videos and player errors as normal provider failures;
- retain provider identity/metadata instead of pretending external music is first-party Afterlight audio.

## Product consequence

A compliant YouTube adapter may be visually integrated into a scene, but it cannot be an invisible audio engine hidden behind the scene. If a visible player materially damages the desired low-distraction experience, the product must prefer cleared/owned audio or another provider whose terms support the intended listening UX.

## Catalog consequence

No third-party video ID is committed merely because it plays in a normal browser tab. Candidate sources require an explicit provenance record and an embed-availability check before they enter a room pool.

## Truthful status

The current rebuild catalog contains only temporary owned demo tracks. The YouTube entry in `rebuild/catalog.js` is a policy contract, not a working catalog and not parity with Enikq's reported catalog depth.
