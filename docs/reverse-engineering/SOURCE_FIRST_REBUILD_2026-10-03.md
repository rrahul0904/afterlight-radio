# Afterlight source-first rebuild — 2026-10-03

## Why this branch exists

The previous Afterlight implementation accumulated useful infrastructure but drifted from the product behavior that made the original reference compelling. In particular, we reproduced scenes while replacing the original music experience with a small synthetic catalog whose technical validity did not establish listening quality.

This branch treats source evidence as the product specification and existing code only as optional infrastructure.

## Reference hierarchy

### Primary lineage — Enikq → TunedAway

Original Enikq launch:
`https://www.reddit.com/r/vibecoding/comments/1w9vgkc/made_a_small_ambient_music_website/`

Current product:
`https://tunedaway.com/`

Source-backed lessons from the creator and comments:

- Pick a place/scene and leave it open while working, reading, or relaxing.
- Music was delivered through YouTube's official IFrame embed API; the creator did not host/re-upload those tracks.
- Shuffle was on by default.
- User feedback led to room-specific music pools because shared pools weakened the point of choosing a place.
- The reported catalogue grew from roughly 340 to 29,800 songs.
- Rooms gained day/evening/night artwork, optional ambience, multiple mixes, progress UI, exact room+song share links, mobile improvements and keyboard shortcuts.
- TunedAway later separated **Another view** from music state so visual changes do not interrupt the current song.

Current-policy correction: the historical YouTube implementation is source evidence, not permission to reproduce a hidden audio engine today. Current official-player constraints are documented in `YOUTUBE_PROVIDER_POLICY_2026-10-03.md`; the rebuild preserves the room-specific external-catalog idea without hiding, obscuring or extracting audio from a provider player.

### Radio donor — deadair

Product/source:
- `https://deadair.radio/`
- `https://github.com/robert-dean/deadair`

Donor semantics:

- A radio station is not a per-listener playlist.
- One authoritative running order owns what plays next.
- Presenter generation has a deterministic fallback; a model cannot make the station go silent.
- Claims about records are grounded in stored/source-backed facts.
- Presenter characters have stable voice/diction/briefness and accumulate continuity.
- Listener phone-in/conversation is a separate turn-based program mode, not an excuse to call ordinary TTS 'radio'.

### Bounded donors

- Paxroom: focus session/task behavior.
- JellyBox/Navidrome/OpenSubsonic: library/offline/provider behavior.
- Dust/nanodot: reactive visualizer/social listening ideas.

These donors do not redefine the core product.

## New product thesis

Afterlight should first be excellent at one sentence:

> Pick somewhere else to be, press play, and stay there.

Only after this works should it become:

> A place-based radio world with a believable host you can occasionally talk to.

## Golden journey — Phase 1

1. Open Afterlight directly into the scene catalogue.
2. Choose one flagship place.
3. Music begins after explicit user intent.
4. The scene has its own music pool/mix identity.
5. Next/previous/shuffle never escape the room's pool.
6. `Another view` changes only the visual state.
7. Visual state is explicit Day / Evening / Night and states that music keeps playing.
8. Optional ambience is independent of music.
9. Share restores the exact room + view + track identity where the provider allows it.
10. No dashboard, account or subscription UI interrupts the listening surface.

## Golden journey — Phase 2 radio

1. The chosen room can opt into a station/radio mode.
2. One director owns the running order.
3. Presenter breaks occur between records with deterministic fallback text.
4. Facts are grounded or omitted.
5. Music ducks/fades intentionally around speech.
6. No model/provider failure creates dead air.
7. Presenter identity remains stable.

## Golden journey — Phase 3 conversation

1. User explicitly chooses to speak.
2. Listening/thinking/speaking/returning-to-music states are visible.
3. A real transcript/audio event is required before the host claims to have heard anything.
4. Barge-in/cancel preserves playback state.
5. The host answers briefly using bounded session context and then hands back to music.

## Keep / replace / remove matrix

### Keep only if it supports the new product

- room slug/routing primitives
- provider/server security boundaries
- Media Session support
- offline/range infrastructure for owned audio
- mastering/studio-master evidence tools
- deadair director work after it is reconciled against upstream semantics

### Replace

- synthetic 36-track catalog as the assumed canonical music experience
- room shell if it prioritizes navigation/account/product chrome over the scene
- feature-first home experience
- any audio QA process that equates metrics with taste

### Remove from first-session critical path

- admin/account surfaces
- Focus/Todo UI
- library/provider management
- visualizer controls
- subscription upsell
- creator/social expansion

Those features may remain elsewhere but cannot sit between scene selection and listening.

## Music strategy

See `MUSIC_SOURCE_DECISION_2026-10-03.md`.

The production path is now deliberately split:

- **owned / explicitly cleared masters** for the primary low-distraction experience;
- provider experiments only where current terms and UX constraints are compatible.

The curated-source intake gate rejects a cleared track unless provenance, rights evidence, commercial use, streaming use, territory and ambience/presenter mixing permissions are explicit. A public API entry is not itself treated as proof of commercial rights.

Do not silently substitute a tiny generated catalog and call it parity.

## Automated verification

Latest verified code-bearing SHA: `73710160ac5e2d2e60c148f69c1071f0f1612604`.

- GitHub Actions CI run `37150834607`: **PASS**.
- Browser Matrix run `37150834581`: **PASS**.
- The Browser Matrix explicitly runs the source-first `/rebuild/` smoke in Chromium and WebKit/mobile-sized conditions.
- It checks flagship-room presence, room-local track selection, exact room/track/view state, Day/Evening/Night visual continuity, `Another view` preserving the audio source, and absence of Sign in / Upgrade / Dashboard leakage in the listening surface.

Vercel Preview run `37150834616`: **BLOCKED BEFORE DEPLOYMENT**.
- exact PR SHA checkout passed;
- `Require preview authorization` failed;
- build, deploy and hosted verification were skipped because `VERCEL_TOKEN` is not configured.

This is an authorization blocker, not evidence of an application build failure. There is no exact-head hosted Preview claim for this rebuild yet.

The current branch head may include documentation-only commits after the verified code-bearing SHA. Any later code change must receive fresh CI/browser evidence before the verified SHA moves forward.

## Quality gates

- Four flagship rooms must each have a clearly distinct music identity.
- Human listening on phone speaker, headphones and laptop.
- At least two reviewers spend >= 15 minutes in each flagship room before a music baseline is promoted.
- `Another view` never changes or restarts the current track.
- No unexpected silence on provider failure; fallback is explicit and recoverable.
- Radio/presenter claims remain disabled until the presenter and playout behavior pass their own evidence gates.
- Follow `docs/uat/SOURCE_FIRST_LISTENING_UAT.md` before production promotion.

## Truthful status

Draft, unmerged, and production unchanged. The source contract, rights intake boundary and local browser behavior are verified. The core product is **not yet proven** because real catalog depth, human listening quality and hosted exact-head Preview verification remain open.
