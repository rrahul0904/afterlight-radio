# Afterlight MVP release status

_Last verified: 2026-09-10_

## Live production state

- Canonical production frontend: `https://afterlight-radio.vercel.app`
- Production API: Neon Function `afterlightapi`
- Neon database: `afterlight`
- Production readiness: **passing** (`auth`, `database`, `checkout`, `webhook` all true)
- Production verification workflow: **passing**
- Production account lifecycle workflow: **passing**
- Standard repository CI: **passing**
- Cloudflare: **optional manual mirror**, not a production blocker

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
- [x] Privacy, Terms, Support and Account portal pages
- [x] Automated CI, production verification and account lifecycle workflows
- [x] Cloudflare workflow made manual-only so optional hosting cannot make normal releases red
- [x] Cross-browser production matrix added for Chromium, Firefox, WebKit and mobile-emulated Chromium/WebKit

## Remaining launch activation

- [ ] Configure Stripe Customer Portal / hosted portal login. The connected Stripe credential currently has read access but not portal-configuration write permission.
- [ ] Complete the new cross-browser matrix run and fix any browser-specific defect it finds.
- [ ] Perform one controlled **non-discounted** real customer purchase before broad paid launch to validate the actual card-payment experience in addition to the already-proven zero-dollar subscription/webhook lifecycle.
- [ ] Perform final physical-device audio UX spot-check on at least one real iPhone and one real Android device; CI covers browser engines and mobile emulation but cannot certify device speakers, mute switch behavior or OS media controls.
- [ ] Replace or expand procedural launch audio with mastered commissioned/licensed-original content before significant paid marketing if the current artistic quality is not sufficient.

## Optional, not blockers

- [ ] Configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` only if a Cloudflare mirror is still desired.
- [ ] Add a custom production domain when branding is ready.

## Current release verdict

Afterlight is a **functional production MVP on Vercel + Neon** with live Auth, database persistence, Stripe checkout, webhook-driven subscription entitlements, support, account UX, audio delivery and passing production/account smoke tests.

The core subscription state path is now proven in live Stripe without charging a card: `active` entitlement was written by the production webhook and cancellation propagated correctly.

The only material account-side platform blocker remaining is Stripe Customer Portal configuration. Broad paid marketing should also wait for one real card checkout and final physical-device/audio-content sign-off.
