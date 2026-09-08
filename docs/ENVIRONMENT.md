# Production environment contract

The listening experience runs without secrets, while accounts and billing activate when these Cloudflare Worker values are configured.

## Public/runtime variables
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`)
- `STRIPE_PRICE_MONTHLY`
- `STRIPE_PRICE_ANNUAL`
- `SUPPORT_EMAIL`

## Secrets
- `SUPABASE_SECRET_KEY` (`sb_secret_...`; backend only)
- `STRIPE_RESTRICTED_KEY` (minimum Stripe permissions for Checkout, Customer, Subscription and Billing Portal operations)
- `STRIPE_WEBHOOK_SECRET`

Never expose the secret values in browser code or GitHub.

## Supabase
Apply `supabase/migrations/20260908_afterlight_mvp.sql` to the dedicated Afterlight project. Configure the Auth Site URL and redirect allowlist for the Cloudflare production URL and local development URL. Magic-link email authentication is used.

## Stripe
Create one product, **Afterlight+**, with flat recurring prices of $2.99/month and $19.99/year. Create a webhook endpoint at `https://<production-domain>/api/stripe/webhook` for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`. Enable Customer Portal. Do not enable automatic Stripe Tax collection until a relevant tax registration exists.

## Cloudflare
Build: `npm run build`
Deploy: `npx wrangler deploy`
Production branch: `main`

`GET /api/health` reports integration readiness without revealing secret values.
