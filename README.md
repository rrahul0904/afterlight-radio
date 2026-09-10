# Afterlight

**Somewhere else, for a while.**

Afterlight is a premium consumer listening product: twelve illustrated places with original music and ambience for working, reading, unwinding and sleep.

## Production architecture

- **Vercel** is the canonical production frontend at `https://afterlight-radio.vercel.app`
- **Neon Function** `afterlightapi` is the production API backend
- dedicated Neon Postgres `afterlight` database in `us-east-2`
- managed Neon Auth, proxied first-party through `/api/auth/*`
- 12 clean room routes
- 36 build-generated original WAV tracks (3 per room)
- cross-device saved places and listening preferences
- Stripe-hosted monthly and annual checkout links
- verified Stripe webhooks drive premium entitlements and cancellation state
- first-party analytics, client-error capture and persisted support requests
- Privacy, Terms, Support and Account portal surfaces
- GitHub Actions CI, production verification, account lifecycle and browser-matrix checks

Cloudflare support remains checked in as an **optional manual mirror**; it is not the production release target.

## Product model

Free: Rooftop, Window Seat and Pizzeria Roma.

Afterlight+: **$2.99/month** or **$19.99 founding annual**.

The browser never decides whether a customer is premium. Premium access comes from the server-side subscription record synchronized by verified Stripe webhook events.

## Verified production behavior

- homepage, Rooftop, account portal and WAV delivery
- Auth transport and production signup/session/logout
- cross-device preference writes and reads
- Stripe webhook readiness
- zero-dollar live subscription lifecycle: `active` entitlement reached Neon, cancellation propagated back as `canceled`
- synthetic production identities are removed after verification

## Local

```bash
npm install
npm test
npm run serve
```

## Release operations

See:

- [docs/MVP_STATUS.md](docs/MVP_STATUS.md)
- [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)

The optional Cloudflare mirror can be invoked manually from `.github/workflows/deploy-cloudflare.yml` after Cloudflare credentials are configured.
