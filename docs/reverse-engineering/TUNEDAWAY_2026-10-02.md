# RE-101 donor refresh — Tunedaway / Enikq

Date: 2026-10-02

## Identity / deduplication

Tunedaway is the renamed/evolved Enikq product. Enikq is already the source inspiration tracked by RE-101 → Afterlight Radio. This research therefore updates RE-101 and does **not** allocate a new reverse-engineering ID.

Current Tunedaway post:
- https://www.reddit.com/r/vibecoding/comments/1wvpq97/i_shared_my_little_music_website_here_a_few_weeks/

Earlier Enikq post:
- https://www.reddit.com/r/vibecoding/comments/1w9vgkc/made_a_small_ambient_music_website/

Product:
- https://tunedaway.com/

## What changed in Tunedaway

The October 2 update describes an “Another view” interaction across 10 scenes. The scene keeps its current music while the visual background changes. The implementation described by the creator can pull mood-fitting imagery from Unsplash and Pexels.

That separation is the valuable donor concept: **place/room state owns music, view state owns presentation**. A visual change should not be routed through the audio transport.

## Reddit feedback converted into product requirements

### 1. The interface still felt too busy

A commenter specifically wanted a fully decluttered view and listed the remaining room name, genre, app name, time/weather-style metadata, player and quotes as too much. The creator later added a “Hide after 5 seconds” display setting.

Afterlight response:
- Default mode keeps normal controls.
- Focus mode hides room copy/navigation after inactivity while preserving the player.
- Canvas mode hides the whole interface after inactivity, with pointer/keyboard activity restoring it.
- Auto-hide is a preference rather than a forced product-wide choice.

### 2. Background selection / pointer leakage

A commenter reported being able to select the background image. The creator said the issue was fixed by disabling pointer events.

Afterlight response:
- painted/decorative scene surfaces are explicitly `pointer-events:none` and `user-select:none`.
- this is verified as a source contract.

### 3. View changes were mistaken for music changes

A commenter watching the demo thought the music stopped when the visual changed. The creator clarified that changing **scene** changes music/genre while changing the **background/view inside a scene** does not.

Afterlight response:
- the affordance is named “Another view”.
- accessible copy says “Music keeps playing”.
- the visual runtime has a test-enforced boundary forbidding direct playback calls.

### 4. Earlier Enikq feedback

The earlier Enikq discussion also surfaced requests for:
- more low-distraction/instrumental music,
- contextual control styling,
- more subtle/dynamic scene motion,
- better mobile controls,
- keyboard shortcuts,
- optional room ambience such as rain/campfire/train,
- looped driving/rain visuals,
- more places around the world,
- share links that preserve exact room/song state,
- PWA/install support,
- and no advertising.

Several of these are already represented in Afterlight’s current product and roadmap. This slice concentrates on the remaining visual/display continuity delta.

## Clean-room implementation decision

Afterlight does not copy Tunedaway branding, artwork, layouts or code. It keeps the existing first-party illustrated room system and first-party generated audio catalog.

The original Enikq implementation described a hidden YouTube IFrame player. Afterlight deliberately does not inherit that dependency because its first-party transport, catalog and offline behavior are already more controllable and auditable.

## External-image provider decision

Live stock-image APIs are **not a Phase A dependency**.

Current provider references reviewed on 2026-10-02:
- Unsplash API guidelines: https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines
- Unsplash attribution guidance: https://help.unsplash.com/en/articles/2511315-guideline-attribution
- Pexels API documentation: https://www.pexels.com/api/documentation/
- Pexels API-key status: https://help.pexels.com/hc/en-us/articles/900004904026-How-do-I-get-an-API-key

Unsplash currently requires API hotlinking, attribution, and confidential API credentials. Pexels documents attribution/rate limits and, as of this research date, says new API-key issuance is paused. Therefore Phase A implements a provider-neutral local view model. External providers can be added only behind a server-side adapter after credentials, attribution, caching/hotlink behavior and then-current provider terms are verified.

## Phase A implementation

Branch: `feature/re101-tunedaway-views`
Issue: #24

Runtime behavior:
- independent per-room visual view preference,
- Original / Closer / Soft glow / After dark treatments,
- “Another view” control with explicit music-continuity copy,
- Default / Focus / Canvas display modes,
- optional 5-second inactivity hide,
- fullscreen action,
- V keyboard shortcut for another view,
- D shortcut for display settings,
- defensive local preference persistence,
- reduced-motion support,
- decorative layers cannot intercept pointer input,
- visual runtime cannot invoke play/pause/new Audio or mutate media `src` by contract check.

## Acceptance evidence required before merge

1. repository checks pass on the exact branch SHA;
2. build output includes `visual-view-runtime.js` on every room route;
3. browser verification proves “Another view” changes visual state but leaves the current track/time/play state intact;
4. 5-second hiding and activity restore work in Focus and Canvas modes;
5. keyboard focus/forms are not hijacked by shortcuts;
6. reduced-motion path removes view transitions;
7. mobile layout remains usable;
8. preview deployment is inspected before any production/readiness claim.
