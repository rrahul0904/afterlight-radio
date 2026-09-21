# Production environment contract

Afterlight currently runs as a Vercel frontend backed by a Neon Function and Neon Postgres. Cloudflare remains available as an optional mirror, not the canonical production target.

## Live production

- Frontend: `https://afterlight-radio.vercel.app`
- Neon project: `afterlight-radio` (`silent-recipe-83740325`)
- Neon branch: `production` (`br-proud-breeze-axhwv7rx`)
- Database: `afterlight`
- Neon Function: `afterlightapi`
- Neon Auth: managed Better Auth
- Stripe product: `Afterlight+` (`prod_VDx8nP5oUjNnCk`)
- Monthly price: `price_1UDVEkRB8OGmEnBw7xEw07J0` — $2.99/month
- Founding annual price: `price_1UDVEmRB8OGmEnBwO1DeztjQ` — $19.99/year

## Runtime responsibility

The Neon Function owns privileged backend work:

- database access
- session-aware account APIs
- preference persistence
- support requests
- Stripe webhook verification
- premium entitlement synchronization
- optional external music-library search and streaming proxy

Vercel serves the product UI and proxies `/api/*` to the Neon Function so Auth cookies remain first-party on the Afterlight domain.

## Stripe checkout

Customer-facing purchase uses Stripe-hosted Payment Links. No card data enters Afterlight.

The live webhook is configured against the Neon Function and listens for:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

The webhook signing secret is stored in the Neon Function environment and is not committed to GitHub.

A zero-dollar live subscription verification has proven that Stripe `active` status reaches Neon and immediate cancellation propagates back as `canceled`.

## Stripe Customer Portal

Self-service billing management remains disabled until the Stripe account permits creation/configuration of a Billing Customer Portal. The connected Stripe credential can currently read portal configuration but cannot create one.

Preferred production setup is Stripe's hosted customer-portal login/session flow. Once Stripe portal permission/configuration is available, the Account page can expose self-service payment-method updates and cancellation without changing the subscription entitlement model.

## Support

Support does **not** depend on an email environment variable. `/support/` submits directly to `/api/support`, which persists the request in the production database.

## Cloudflare release mirror

Vercel remains the canonical production hostname, but `.github/workflows/deploy-cloudflare.yml` now provides a second hosted release path. It runs on relevant pushes to `main` and can also be invoked manually.

The mirror is fail-closed: it requires repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, runs the full test suite, stamps `public/release.txt` with the exact Git SHA, verifies the v2 36-track music manifest, and only then deploys with Wrangler.

This mirror is useful for exact-revision launch verification when Vercel Git auto-deploy or the repository `VERCEL_TOKEN` path is unavailable. It does not change the canonical Vercel domain or the Neon production backend contract.

## Optional external music library

The JellyBox-inspired Navidrome/Subsonic adapter is **disabled by default**. It is enabled only when all four server-side secrets are present:

- `NAVIDROME_BASE_URL` — HTTPS server origin; localhost/private-network targets are rejected
- `NAVIDROME_USERNAME`
- `NAVIDROME_TOKEN` — precomputed Subsonic token, not the raw password
- `NAVIDROME_SALT` — salt paired with the precomputed token
- optional `NAVIDROME_CLIENT_NAME` — defaults to `afterlight-radio`

Do **not** store `NAVIDROME_PASSWORD` in the application environment. The browser never receives provider credentials. Search returns normalized metadata only; artwork and audio are proxied through first-party `/api/library/provider/*` routes. Stream requests preserve HTTP `Range` semantics so seeking works without exposing provider query credentials.

All provider routes require an authenticated Afterlight session. Configuration/status is exposed only as a boolean capability through `/api/config`.

## Readiness endpoints

- `GET /api/health` — component configuration summary
- `GET /api/ready` — active production readiness check

A production release should not be considered healthy unless `/api/ready` returns HTTP 200 with `ok: true`.
