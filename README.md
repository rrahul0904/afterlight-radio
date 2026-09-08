# Afterlight

**Somewhere else, for a while.**

Afterlight is a premium consumer listening product: twelve illustrated places with original music and ambience for working, reading, unwinding and sleep.

## Architecture

- Cloudflare Worker + Static Assets
- dedicated Neon Postgres project in `us-east-2`
- managed Neon Auth proxied as first-party `/api/auth/*`
- 12 clean room routes
- 36 build-generated original WAV tracks (3 per room)
- cross-device saved places and listening preferences
- Stripe-hosted Checkout + Customer Portal
- verified Stripe webhooks drive premium entitlements
- first-party product analytics and client-error capture
- Privacy, Terms and Support pages
- GitHub Actions build/runtime/Worker dry-run certification

## Product model

Free: Rooftop, Window Seat and Pizzeria Roma.

Afterlight+: $2.99/month or $19.99 founding annual.

The browser never decides whether a customer is premium. Premium access comes from the server-side subscription record synchronized by verified Stripe webhook events.

## Local

```bash
npm install
npm test
npm run serve
```

The static listening experience works without secrets. Full account/billing flows require the Worker environment described in [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

## Deployment

```bash
npm run cf:dev
npm run cf:deploy
```

See [docs/MVP_STATUS.md](docs/MVP_STATUS.md) for release closure.
