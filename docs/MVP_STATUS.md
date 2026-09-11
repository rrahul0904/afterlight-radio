# Afterlight MVP release status

_Last verified: 2026-09-11_

## Live production state

- Canonical production frontend: `https://afterlight-radio.vercel.app`
- Production API: Neon Function `afterlightapi`
- Neon database: `afterlight`
- Production readiness: **passing** (`auth`, `database`, `checkout`, `webhook` all true; `portal` remains false)
- Production account lifecycle workflow: **passing**
- Cross-browser production matrix: **passing**
- Standard repository CI on current source: **passing**
- Built-artifact WCAG accessibility gate: **passing**
- Cloudflare: **optional manual mirror**, not a production blocker
- Vercel Git integration: **not connected**; the live production deployment currently predates the September 11 legal/accessibility/security-header fixes

## Implemented and verified

- [x] Premium editorial landing/discovery experience
- [x] 12 clean room URLs and responsive room player
- [x] Three free rooms / nine Afterlight+ rooms
- [x] Favorites, share and 15/30/60 minute timers
- [x] 36 deterministic build-generated original WAV audio files
- [x] iPhone/Safari user-gesture-compatible native Audio implementation
- [x] Dedicated Neon production database
- [x] Managed Neon Auth
- [x] First-party Vercel API proxy to Neon Function
- [x] Email/password signup, session lookup and sign-out verified in production
- [x] Cross-device preference persistence verified in production
- [x] Server-side premium entitlement model
- [x] Live Stripe `Afterlight+` product
- [x] Live recurring prices: $2.99/month and $19.99/year
- [x] Live Stripe Payment Links for monthly and annual subscriptions
- [x] Stripe webhook signature verification and subscription synchronization
- [x] Live production Stripe webhook configured on Neon
- [x] Stale duplicate webhook disabled
- [x] Zero-dollar **live Stripe subscription lifecycle verified**: Stripe `active` reached Neon, then cancellation propagated to Neon as `canceled`
- [x] Verification coupon deleted after use
- [x] Synthetic Neon billing-test identity deleted; application subscription row cascade cleanup verified
- [x] First-party analytics and client-error ingestion
- [x] Persisted in-app support request flow
- [x] Explicit billing/subscription-cancellation support fallback while Stripe Portal is pending
- [x] Billing-support operator runbook with Stripe → webhook → Neon verification procedure
- [x] Privacy notice corrected to the actual Vercel + Neon + Stripe production stack
- [x] Terms corrected so they do not claim unavailable Stripe self-service
- [x] Privacy, Terms, Support and Account surfaces
- [x] Automated CI, production verification and account lifecycle workflows
- [x] Cloudflare workflow made manual-only so optional hosting cannot make normal releases red
- [x] Cross-browser production matrix passed on desktop Chromium, Firefox and WebKit plus mobile-emulated Chromium and WebKit
- [x] Production browser matrix verifies homepage, Rooftop, real WAV range delivery, Play state and account portal routing
- [x] axe/Playwright WCAG gate covering Home, Rooftop, Account, Support, Privacy and Terms on desktop and mobile
- [x] Serious contrast defects found by the new WCAG gate fixed in the built artifact
- [x] Vercel security headers defined and CI-enforced: frame denial, MIME sniffing protection, referrer policy, permissions policy and COOP
- [x] Last-24-hour Vercel runtime review found no application exception group; only a hosting/runtime `url.parse()` deprecation warning

## Remaining launch activation

- [ ] **Deploy current `main` to Vercel and establish Git integration.** The `afterlight-radio` Vercel project is not linked to GitHub, so the live alias still serves an older source snapshot. Do not treat the new legal/accessibility/security-header fixes as production-live until this is resolved and re-verified.
- [ ] Configure Stripe Customer Portal / hosted portal login. The live Stripe account currently has zero active portal configurations and the production Neon Function has no Stripe restricted API key for creating portal sessions.
- [ ] Perform one controlled **non-discounted** real customer purchase before broad paid launch to validate the actual card-payment experience in addition to the already-proven zero-dollar subscription/webhook lifecycle.
- [ ] Perform final physical-device audio UX spot-check on at least one real iPhone and one real Android device; CI covers browser engines and mobile emulation but cannot certify device speakers, mute switch behavior or OS media controls.
- [ ] Replace or expand procedural launch audio with mastered commissioned/licensed-original content before significant paid marketing if the current artistic quality is not sufficient.

## Optional, not blockers

- [ ] Configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` only if a Cloudflare mirror is still desired.
- [ ] Add a custom production domain when branding is ready.

## Current release verdict

Afterlight's **current source is a functional production MVP** with live Neon Auth/database/webhook infrastructure, Stripe checkout, persisted support, account UX, generated audio, cross-browser coverage and an accessibility gate.

The live Vercel backend remains healthy, but the frontend alias is one deployment behind current `main`. The next required release operation is to connect `rrahul0904/afterlight-radio` to the Vercel project or otherwise deploy current `main`, then re-run production verification against the resulting deployment.

The subscription state path is already proven in live Stripe without charging a card: `active` entitlement was written by the production webhook and cancellation propagated correctly. Until Stripe Customer Portal is activated, billing and cancellation requests have an explicit persisted support path and operator runbook rather than a dead-end UI.
