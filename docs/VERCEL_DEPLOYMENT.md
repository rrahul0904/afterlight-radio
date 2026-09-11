# Vercel production deployment

Canonical project:

- Vercel project: `afterlight-radio`
- Project ID: `prj_MrkrMOOEYpE5WWrc0dhZeSXuJtUA`
- Team: `rrahul0904-5013s-projects`
- Team ID: `team_zmEezpOKGZy2sH5nqTfO44LD`
- Production alias: `https://afterlight-radio.vercel.app`
- GitHub repository: `rrahul0904/afterlight-radio`
- Production branch: `main`

## Current deployment blocker

The existing Vercel project is not connected to a Git repository. Because of that, pushes to `main` do not automatically create a production deployment and the live alias can drift behind the source repository.

## Preferred one-time fix

In the Vercel dashboard:

1. Open the existing **afterlight-radio** project.
2. Open **Settings → Git**.
3. Connect a Git repository.
4. Choose GitHub repository **`rrahul0904/afterlight-radio`**.
5. Set the production branch to **`main`**.
6. Keep project root at the repository root.
7. Confirm the project uses `vercel.json`; the repository already declares:
   - build command: `npm run build`
   - output directory: `public`
   - API rewrite: `/api/:path*` → `/api?path=:path*`
8. Deploy the current `main` revision to production.

Once connected, normal pushes to `main` should become the production deployment path. Do not create a second `afterlight-radio` Vercel project just to obtain Git integration; connect the existing canonical project so the existing production alias remains authoritative.

Vercel also documents the CLI alternative `vercel git connect` for connecting the Git repository associated with a locally linked project.

## Verified artifact fallback

Until Git integration is active, the GitHub workflow **Export Vercel Source** runs on every `main` push. It:

1. checks out the exact commit,
2. runs the full `npm test` release gate,
3. creates `vercel-source.zip` using `git archive`, and
4. uploads that exact revision as a short-lived GitHub Actions artifact.

The export is complete by construction; it no longer relies on a hand-maintained file list.

## Post-deploy verification

A deployment is not considered current until all of the following are verified against `https://afterlight-radio.vercel.app`:

- `/api/ready` returns `ok: true`, `auth: true`, `database: true`, `checkout: true`, `webhook: true`.
- `/privacy/` names **Vercel, Neon and Stripe** and does not name Supabase as a current processor.
- `/terms/` describes the billing-support fallback while Customer Portal remains inactive.
- `/support/` includes **Subscription cancellation** as a topic.
- `/runtime-enhancements.js` returns 200.
- `/rooftop/` can fetch `/audio/rooftop/1.wav` and enter the playing state after a user click.
- Security response headers include `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, the configured Referrer Policy, Permissions Policy and COOP.
- The Browser Matrix, CI and Accessibility workflows are green for the source revision being deployed.

## Customer Portal is separate

Git/Vercel deployment does not resolve Stripe Customer Portal. `/api/ready` may continue to report `portal: false` until the Stripe account has an active Customer Portal configuration and the production backend has an authorized way to create portal sessions.
