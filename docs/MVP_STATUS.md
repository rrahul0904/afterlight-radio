# Afterlight MVP release status

## Implemented in source

- [x] Premium editorial landing/discovery experience
- [x] 12 clean room URLs and responsive room player
- [x] Three free rooms / nine Afterlight+ rooms
- [x] Favorites, share and 15/30/60 minute timers
- [x] 36 deterministic build-generated original audio files
- [x] iPhone/Safari user-gesture-compatible native Audio playback
- [x] Passwordless account UI and Supabase Auth integration contract
- [x] Cross-device preference persistence API
- [x] Secure server-side premium entitlement model
- [x] Stripe hosted Checkout endpoint for monthly/annual subscriptions
- [x] Stripe Customer Portal endpoint
- [x] Stripe webhook signature verification and subscription synchronization
- [x] First-party analytics and client error ingestion
- [x] Privacy, Terms and Support pages
- [x] Cloudflare Worker API + Static Assets architecture
- [x] Automated CI checks for product, backend, RLS and audio assets

## External production activations still required

These are account/infrastructure actions, not missing source code:

- [ ] Create a dedicated Supabase project and apply the committed migration
- [ ] Configure Supabase Auth Site URL / redirect allowlist
- [ ] Set Cloudflare Supabase public/secret values
- [ ] Create Stripe Afterlight+ product and two recurring prices
- [ ] Enable Stripe Customer Portal
- [ ] Create Stripe webhook endpoint and set its signing secret
- [ ] Set the Stripe restricted key and price IDs in Cloudflare
- [ ] Set a real support email
- [ ] Connect GitHub main to Cloudflare and verify the production deployment
- [ ] Run physical-device certification on iPhone Safari, Android Chrome, desktop Safari/Chrome/Firefox
- [ ] Replace/expand procedural launch audio with mastered commissioned/licensed-original content if higher artistic quality is required for paid launch

## Release rule

Do not call the paid website launch-complete until every external activation above is checked and a real Stripe subscription can unlock a premium room on the production Cloudflare URL.
