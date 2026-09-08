# Afterlight

**Somewhere else, for a while.**

Afterlight is a premium consumer listening product: twelve illustrated places with original music and ambience for working, reading, unwinding and sleep.

## Architecture

- Cloudflare Workers + Static Assets
- 12 clean room routes
- 36 build-generated original WAV tracks (3 per room)
- Supabase passwordless authentication and cross-device preferences
- Stripe Checkout subscriptions + Customer Portal
- Webhook-driven premium entitlements
- First-party product analytics and client-error capture
- Privacy, Terms and Support surfaces
- GitHub Actions release checks

## Product model

Free: Rooftop, Window Seat and Pizzeria Roma.

Afterlight+: $2.99/month or $19.99 founding annual. Premium entitlement is never trusted from browser state; it comes from the server-side subscription record synchronized by verified Stripe webhooks.

## Local

```bash
npm install
npm test
npm run serve
```

The listening experience works without backend secrets. Accounts and billing report as unavailable until the production environment is configured.

## Cloudflare

```bash
npm run cf:dev
npm run cf:deploy
```

See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) and [docs/MVP_STATUS.md](docs/MVP_STATUS.md).
