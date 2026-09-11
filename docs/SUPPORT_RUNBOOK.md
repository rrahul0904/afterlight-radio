# Afterlight support and billing operations

This runbook keeps billing support actionable while Stripe self-service Customer Portal activation is pending.

## Current support path

Customers submit `/support/` requests through `/api/support`. Requests are persisted in the production Neon `afterlight` database in `public.support_requests`.

Use the `Billing` or `Subscription cancellation` subject for subscription requests.

## Triage open requests

Read-only queue query:

```sql
select id, user_id, email, subject, message, created_at
from public.support_requests
where status = 'open'
order by created_at asc;
```

For a billing request, resolve the subscription identity before taking action:

```sql
select
  sr.id as support_request_id,
  sr.email,
  p.stripe_customer_id,
  s.stripe_subscription_id,
  s.plan,
  s.status,
  s.current_period_end,
  s.cancel_at_period_end
from public.support_requests sr
left join public.profiles p
  on p.user_id = sr.user_id or lower(p.email) = lower(sr.email)
left join public.subscriptions s
  on s.user_id = p.user_id
where sr.id = <REQUEST_ID>;
```

Never infer a Stripe customer from a similar-looking email. If the request cannot be mapped unambiguously, ask the customer to sign in or provide enough information to identify the account.

## Cancellation procedure

1. Confirm the support request is asking for cancellation and identify the exact `stripe_subscription_id`.
2. Cancel the subscription in Stripe using the connected Stripe operator tooling or the Stripe Dashboard. Prefer cancellation at period end unless the customer explicitly requests an immediate cancellation and the business policy allows it.
3. Do **not** manually edit the `subscriptions` entitlement row to imitate a Stripe cancellation. Stripe is the billing source of truth; the verified production webhook must synchronize the resulting state into Neon.
4. Verify the production database reflects the Stripe event:

```sql
select stripe_subscription_id, status, cancel_at_period_end, current_period_end, updated_at
from public.subscriptions
where stripe_subscription_id = '<STRIPE_SUBSCRIPTION_ID>';
```

5. After successful synchronization, resolve the support request:

```sql
update public.support_requests
set status = 'resolved', resolved_at = now()
where id = <REQUEST_ID> and status = 'open';
```

Database writes are operational actions and should only be run after the Stripe state has been confirmed.

## Other billing requests

Until Customer Portal is active, payment-method changes should be handled through Stripe-hosted mechanisms or Stripe support tooling; Afterlight must never collect card numbers in the support form or application database.

## Verification expectations

A billing case is finished only when all three agree:

- Stripe shows the intended subscription state.
- Neon `public.subscriptions` shows the webhook-synchronized state.
- The support request is marked resolved after verification.

## Portal activation

Once Stripe Customer Portal is configured and `/api/ready` reports `portal: true`, keep this runbook as an escalation path but direct ordinary customer self-service billing to the Account portal.
