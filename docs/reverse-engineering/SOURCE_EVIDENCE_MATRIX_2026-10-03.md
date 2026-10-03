# Afterlight source evidence matrix — 2026-10-03

This file separates the **primary source lineage** from later donor projects. Donors can supply bounded capabilities but must not redefine the product.

## 1. Primary source — Enikq

Original creator post:
`https://www.reddit.com/r/vibecoding/comments/1w9vgkc/made_a_small_ambient_music_website/`

Creator-described product:
- Pick a scene/place and listen while working, reading, or relaxing.
- Examples included pizzeria, cafe, road trip, camping, last bus home and others.
- Music was not re-hosted. The creator said the site used YouTube's official IFrame embed API behind custom controls.
- The source product was intentionally simple enough to leave open for long sessions.

Creator feedback loop documented in the same thread:
- Users complained about musical repetition/shared pools.
- Every room was moved to its own music pool.
- Creator reported catalog growth from roughly 340 to about 29,800 songs.
- Most rooms gained day/evening/night artwork.
- Optional room ambience was added.
- Rooms received multiple mixes, including curated decade mixes.
- Exact room + song sharing was added.
- Mobile playback, keyboard shortcuts and PWA/install behavior were improved.
- Users specifically requested non-vocal/low-distraction music and better scene-context controls.

Afterlight implication:
- The room/scene is the primary product object.
- Music depth is not incidental; a tiny repetitive catalog destroys the point of room choice.
- Visual state, ambience and music should be separable layers.
- Long-session comfort matters more than feature density.

### Current-platform correction

The source creator's historical YouTube implementation is evidence of the product model, **not an instruction to reproduce a hidden player today**. Current YouTube developer rules impose visible-player, viewport, standard-experience and audio/background-playback constraints. The rebuild therefore preserves the room-specific external-catalog idea but enforces the current policy boundary documented in `YOUTUBE_PROVIDER_POLICY_2026-10-03.md`.

## 2. Primary evolution — TunedAway

Creator update:
`https://www.reddit.com/r/vibecoding/comments/1wvpq97/i_shared_my_little_music_website_here_a_few_weeks/`

Current product:
`https://tunedaway.com/`

Observed/source-described behavior:
- Ten scenes.
- `Another view` changes background imagery while the music keeps playing.
- Photographic views are sourced to fit the mood and transition smoothly.
- A public comment reported accidental image selection, motivating pointer-inert background treatment.
- Another source comment exposed a semantic problem: a listener could interpret a view change as a music change. The rebuild must state visual-only continuity explicitly.

Afterlight implication:
- `Another view` must never restart or change the track.
- Backgrounds are decorative/non-interactive by default.
- The scene can evolve visually without turning into a visualizer product.
- Day/evening/night state should be legible while playback remains continuous.

## 3. Radio donor — deadair

Sources:
- `https://deadair.radio/`
- `https://deadair.radio/docs/features`
- `https://deadair.radio/docs/features/running-order`
- `https://github.com/robert-dean/deadair`

Donor semantics:
- It is a station, not per-listener shuffle.
- One authoritative running order owns what airs next.
- Other systems request changes; they do not write the running order directly.
- Presenter generation has a deterministic fallback so model/provider failure cannot produce silence.
- Record facts are source-backed claims; unsupported facts are omitted.
- Presenter identity is a durable character rather than stateless TTS.
- Audio is committed locally before airtime to avoid audible provider-download gaps.
- A broadcast has identity/continuity and can resume rather than silently creating a new show after restart.

Afterlight implication:
- deadair belongs only in the later radio layer.
- The current place-listening experience must succeed before radio is promoted.
- Future AI-host behavior must preserve single-writer program state, fallback speech and grounded facts.

## 4. Bounded donors

- Paxroom: focus-session ideas only.
- JellyBox / Navidrome / OpenSubsonic: provider/offline/library infrastructure only.
- Dust/nanodot: visualizer/social ideas only.

These are explicitly frozen out of the first-session critical path.

## 5. Music-source decision

See `MUSIC_SOURCE_DECISION_2026-10-03.md`.

Current direction:
- Primary production lane: first-party or explicitly cleared masters with rights receipts.
- YouTube: secondary visible-provider experiment only under current official-player rules.
- Spotify: not selected as primary commercial streaming source.
- SoundCloud: partnership/consent-only candidate when its content would materially power the product.
- Jamendo: candidate cleared/licensed catalog lane, with exact license evidence retained per promoted track/project.
- Audius: technically strong streaming experiment candidate, rights-review pending before production promotion.

The curated-source intake gate now supports `owned`, `cleared`, and policy-compliant `youtube` candidates. A cleared entry is rejected unless commercial and streaming permissions, territory, provenance and mixing rights are explicit.

## 6. Current rebuild gap matrix

| Capability | Source lesson | Rebuild status | Decision |
|---|---|---|---|
| Scene-first navigation | Enikq | Present | KEEP |
| Four flagship rooms | Focused rebuild choice | Present | KEEP UNTIL QUALITY PROVEN |
| Room-specific music identity | Enikq | Structural contract present, catalog quality unresolved | HIGHEST PRIORITY |
| Large-enough catalog depth | Enikq feedback loop | Missing | REQUIRED BEFORE PARITY CLAIM |
| Compliant external-provider model | Enikq + current provider rules | Provider-neutral contract + intake gate present; no unverified production IDs committed | KEEP / POPULATE ONLY WITH VERIFIED SOURCES |
| Rights receipt for cleared music | Production requirement | Automated intake gate present | KEEP |
| `Another view` preserves music | TunedAway | Present + Chromium/WebKit checks | KEEP |
| Visual-only continuity copy | TunedAway feedback | Present: view label says music keeps playing | KEEP |
| Decorative/pointer-inert backgrounds | TunedAway feedback | Present in rebuild styling | KEEP / VERIFY HUMAN UAT |
| Day/evening/night scene states | Enikq feedback loop | Present as semantic continuous visual states | KEEP |
| Independent ambience | Enikq | Present | KEEP, but only mix with music whose rights receipt permits it |
| Exact room+track+view sharing | Enikq/TunedAway | Present | KEEP |
| Mobile/keyboard controls | Enikq | Present at baseline + browser matrix | KEEP / HUMAN VERIFY |
| Long-session low-distraction behavior | Enikq | Not human-validated | REQUIRED HUMAN LISTENING |
| Account/admin/focus/library UI in first session | Not source-critical | Removed from rebuild | REMOVE |
| Radio running order | deadair donor | Existing separate work, not in rebuild path | DEFER UNTIL LISTENING PASSES |
| AI presenter | deadair donor | Not promoted | DEFER |
| Human listening evidence | Core product gate | Missing | REQUIRED BEFORE PROMOTION |

## 7. Music acceptance gate

Do not call the rebuild successful while the owned generated WAVs are the only meaningful catalog.

For each flagship room, require:
- a distinct curated pool/mix identity;
- enough depth that a normal listening session does not feel repetitive;
- rights/provenance receipts for every promoted external/cleared track;
- phone speaker, laptop and headphone listening;
- at least two reviewers with >=15 minutes in the room;
- explicit ratings for musical quality, room fit, fatigue, repetition and willingness to keep listening;
- provider failures to degrade visibly/recoverably rather than creating unexplained silence.

## 8. Product gate

Before radio/conversation becomes the critical path:
- 4/5 first-time users understand scene selection without instruction;
- 4/5 find a room they would leave playing;
- changing visual views is understood as visual-only;
- users do not encounter unexpected silence;
- the core product can survive removal of every account/admin/focus/social feature.
