# Afterlight MVP release status

## Implemented and provisioned

- [x] Premium editorial landing/discovery experience
- [x] 12 clean room URLs and responsive room player
- [x] Three free rooms / nine Afterlight+ rooms
- [x] Favorites, share and 15/30/60 minute timers
- [x] 36 deterministic build-generated original audio files
- [x] iPhone/Safari user-gesture-compatible native Audio playback
- [x] Dedicated Neon `afterlight-radio` production database
- [x] Managed Neon Auth provisioned on the production branch
- [x] First-party auth proxy and email/password account UX
- [x] Cross-device preference persistence API and database tables
- [x] Server-side premium entitlement model
- [x] Live Stripe `Afterlight+` product
- [x] Live Stripe recurring prices: $2.99/month and $19.99/year
- [x] Stripe-hosted Checkout endpoint
- [x] Live Stripe Payment Links for monthly and annual subscriptions
- [x] Stripe Customer Portal endpoint in application code
- [x] Stripe webhook signature verification and subscription synchronization
- [x] First-party analytics and client-error ingestion
- [x] Privacy, Terms and Support pages
- [x] Cloudflare Worker API + Static Assets architecture
- [x] Automated CI checks including Worker dry-run bundling

## External production activations still required

- [ ] Connect/deploy GitHub `main` to Cloudflare
- [ ] Set the Neon `DATABASE_URL` as a Cloudflare Worker secret
- [ ] Add the resulting Cloudflare production URL to Neon Auth trusted domains
- [ ] Enable/configure Stripe Customer Portal (restricted API key is only required for portal-session creation)
- [ ] Enable/configure Stripe Customer Portal
- [ ] Create the Stripe production webhook endpoint and set `STRIPE_WEBHOOK_SECRET`
- [ ] Set a real `SUPPORT_EMAIL`
- [ ] Execute a real production subscription using a controlled customer account and verify premium unlock/cancel lifecycle
- [ ] Run physical-device certification on iPhone Safari, Android Chrome, desktop Safari/Chrome/Firefox
- [ ] Replace or expand procedural launch audio with mastered commissioned/licensed-original content before broad paid marketing if the current music quality is not good enough

## Release rule

Do not call the paid website launch-complete until every external activation above is checked and a real Stripe subscription can unlock a premium room on the production Cloudflare URL.
