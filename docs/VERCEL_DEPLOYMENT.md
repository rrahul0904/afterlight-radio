# Vercel production deployment

Canonical project:

- Vercel project: `afterlight-radio`
- Project ID: `prj_MrkrMOOEYpE5WWrc0dhZeSXuJtUA`
- Team: `rrahul0904-5013s-projects`
- Team ID: `team_zmEezpOKGZy2sH5nqTfO44LD`
- Production alias: `https://afterlight-radio.vercel.app`
- GitHub repository: `rrahul0904/afterlight-radio`
- Production branch: `main`

## Release paths

The existing Vercel project is not currently connected to GitHub. There are therefore two supported release paths; do not create a second Vercel project.

### Preferred: connect the canonical Vercel project to GitHub

In Vercel, open **afterlight-radio → Settings → Git**, connect `rrahul0904/afterlight-radio`, keep the project root at the repository root, and set the production branch to `main`. The repository already declares the build command, public output directory, API rewrite and security headers in `vercel.json`.

Once connected, pushes to `main` become the normal production path and the live alias cannot silently drift behind the repository.

### Guarded GitHub Actions fallback

`.github/workflows/deploy-vercel.yml` is the repository-controlled fallback. If the repository secret `VERCEL_TOKEN` exists, it:

1. checks out the exact `main` revision,
2. runs the complete `npm test` release gate,
3. installs the pinned Vercel CLI,
4. pulls the canonical production project settings,
5. builds a production artifact, and
6. deploys that exact prebuilt artifact to the canonical project.

`VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` are intentionally fixed to the canonical team/project. The token is never committed. When the token is absent, the workflow reports that deployment was intentionally skipped rather than pretending a production release happened.

## Verified artifact fallback

The GitHub workflow **Export Vercel Source** runs on every `main` push. It checks out the exact commit, runs the release gate, creates `vercel-source.zip` with `git archive`, and publishes that short-lived artifact. This is useful when Git integration or CI credentials are unavailable.

## September 12, 2026 quota incident

A preview for commit `878d1d2721a35a5710ea90f032a2f06851debeb8` was built successfully as Vercel deployment `dpl_9LLhtYtXJeF755NAUwBccfDNQsfU`. It produced all 12 room routes and 36 generated audio files and reached `READY`.

The subsequent production publish was rejected by the Vercel Hobby account because the team had exhausted the `api-deployments-free-per-day` limit (100 API deployments/day). The quota reset reported by Vercel was September 13, 2026 at approximately 01:13 ET.

Do not rebuild merely to work around this limit. Vercel supports promoting an existing validated deployment without rebuilding via:

```text
POST /v10/projects/{projectId}/promote/{deploymentId}
```

or with the CLI:

```bash
vercel promote <deployment-id-or-url> --yes
```

If promotion is unavailable to the active automation surface, wait for the account quota reset and deploy the then-current verified `main` revision once. Avoid repeated API deployment attempts.

## Post-deploy verification

A deployment is not considered current until all of the following are verified against `https://afterlight-radio.vercel.app`:

- `/api/ready` reports `ok`, auth, database, checkout and webhook readiness.
- Google OAuth initiation returns an HTTPS redirect from `/api/auth/sign-in/social` with provider `google`.
- `/privacy/` names Vercel, Neon and Stripe and does not describe Supabase as a current processor.
- `/terms/` and `/support/` describe the billing-support cancellation fallback while Stripe Customer Portal is unavailable.
- `/runtime-enhancements.js` and `/mobile-visual-polish.js` return the current visual/auth runtime.
- `/rooftop/` can fetch `/audio/rooftop/1.wav` and enter the playing state after a user click.
- Security response headers include `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Referrer Policy, Permissions Policy and COOP.
- Browser Matrix and CI are green for the deployed source revision.
- Vercel runtime error scan shows no new application error cluster after smoke traffic.

## Stripe billing behavior

The live monthly and annual Stripe Payment Links are active subscriptions and the live entitlement webhook is enabled for checkout completion and subscription create/update/delete events.

Stripe Customer Portal remains a separate optional self-service capability. If the backend reports `portalEnabled: false`, both account surfaces route subscribers to the in-product billing support flow instead of a broken portal button. Support includes a dedicated **Subscription cancellation** topic and stores the request in the Afterlight backend for handling. The product must never claim that self-service portal access is active when it is not.
