# Production environment contract

Afterlight uses a dedicated Neon backend and Cloudflare Worker. The public listening experience works without billing secrets, while account/subscription features activate when the required Worker secrets are present.

## Provisioned infrastructure

- Neon project: `afterlight-radio` (`silent-recipe-83740325`)
- Production branch: `production` (`br-proud-breeze-axhwv7rx`)
- Database: `afterlight`
- Neon Auth: managed Better Auth, provisioned
- Stripe product: `Afterlight+` (`prod_VDx8nP5oUjNnCk`)
- Monthly price: `price_1UDVEkRB8OGmEnBw7xEw07J0` — $2.99/month
- Founding annual price: `price_1UDVEmRB8OGmEnBwO1DeztjQ` — $19.99/year

The non-secret Auth URL and Stripe IDs are pinned in `wrangler.jsonc`.

## Cloudflare secrets still required

- `DATABASE_URL` — the privileged Neon pooled connection string; Worker only
- `STRIPE_RESTRICTED_KEY` — a restricted live Stripe key with the minimum permissions required for Checkout Sessions, Customers, Subscriptions and Billing Portal sessions
- `STRIPE_WEBHOOK_SECRET` — signing secret created after the production webhook URL exists
- `SUPPORT_EMAIL` — may be stored as a normal Worker variable rather than a secret

Never commit the database URL, Stripe restricted key, or webhook signing secret.

## Authentication

The Worker proxies `/api/auth/*` to the managed Neon Auth endpoint. This keeps the auth cookie first-party on the Afterlight domain. Email/password sign-up and sign-in are enabled. Once the Cloudflare production URL exists, add it to the Neon Auth trusted-domain allowlist. Localhost is already allowed by the Neon project.

## Stripe

Customer-facing Checkout is Stripe-hosted. The application does not collect card data.

A webhook endpoint must be created at:

`https://<production-domain>/api/stripe/webhook`

Subscribe to:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Enable the Stripe Customer Portal before launch. Do not turn on automatic Stripe Tax collection unless there is an applicable active tax registration.

## Cloudflare

Build command: `npm run build`
Deploy command: `npx wrangler deploy`
Production branch: `main`

`GET /api/health` reports whether auth/database/billing are configured without disclosing secret values.
