# Afterlight MVP release status

_Last verified: 2026-09-10_

## Live production state

- Vercel frontend: `https://afterlight-radio.vercel.app`
- Neon Function backend: `afterlightapi` deployment 6
- Neon database: `afterlight`
- Production verification workflow: **passing**
- Production account lifecycle workflow: **passing**
- Standard repository CI: **passing**
- Cloudflare deployment workflow: **intentionally failing until Cloudflare credentials are configured**

## Implemented and verified

- [x] Premium editorial landing/discovery experience
- [x] 12 clean room URLs and responsive room player
- [x] Three free rooms / nine Afterlight+ rooms
- [x] Favorites, share and 15/30/60 minute timers
- [x] 36 deterministic build-generated original WAV audio files
- [x] iPhone/Safari user-gesture-compatible native Audio playback implementation
- [x] Dedicated Neon `afterlight` production database
- [x] Managed Neon Auth provisioned on the production branch
- [x] First-party Vercel API proxy to the Neon Function backend
- [x] Email/password signup, session lookup and sign-out verified against production
- [x] Cross-device preference persistence verified against production
- [x] Server-side premium entitlement model
- [x] Live Stripe `Afterlight+` product
- [x] Live Stripe recurring prices: $2.99/month and $19.99/year
- [x] Live Stripe Payment Links for monthly and annual subscriptions
- [x] Stripe webhook signature verification and subscription synchronization
- [x] Live production Stripe webhook rotated and configured on Neon
- [x] Stale duplicate Stripe webhook disabled
- [x] First-party analytics and client-error ingestion
- [x] Privacy, Terms and Support pages
- [x] Account portal page and billing-management application flow
- [x] Cloudflare Worker API + Static Assets architecture checked in
- [x] Automated CI, release verification and account smoke workflows
- [x] Production verification covers readiness, auth transport, Vercel proxy, homepage, room route, account page, WAV delivery and support validation
- [x] Synthetic production account smoke covers signup, authenticated `/api/me`, preference write/read, logout and post-logout rejection
- [x] Synthetic test accounts cleaned from Neon Auth and application profiles after validation

## Remaining external production activations

- [ ] Configure GitHub repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, then complete the Cloudflare Worker deployment
- [ ] Add the eventual Cloudflare production origin to Neon Auth trusted domains
- [ ] Configure Stripe Customer Portal. Preferred path: enable Stripe's hosted portal login page and use its shareable URL; alternative path: provision a least-privilege Stripe key that can create Billing Portal sessions
- [ ] Set a real `SUPPORT_EMAIL`
- [ ] Execute a controlled real production subscription and verify webhook-driven premium unlock, renewal/cancel status propagation and premium-room access
- [ ] Run physical-device certification on iPhone Safari, Android Chrome, desktop Safari/Chrome/Firefox
- [ ] Replace or expand procedural launch audio with mastered commissioned/licensed-original content before broad paid marketing if the current music quality is not good enough

## Current release verdict

The application is a functional production MVP on Vercel + Neon with live Auth, persistence, Stripe Checkout links, webhook processing, account UX, audio delivery and passing production smoke tests.

It is **not yet launch-complete for the requested Cloudflare target** because the repository has no Cloudflare API token/account ID, and the Stripe Customer Portal configuration still requires an account-side Stripe permission/configuration that the connected credential cannot perform.

Do not call the paid Cloudflare launch 100% complete until every unchecked activation above is resolved and a real paid subscription has been verified end to end on the final production origin.
