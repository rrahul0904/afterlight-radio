# OpenStream provider integration

Afterlight can optionally connect to an operator-owned OpenStream Kernel instance for self-hosted music-library and channel metadata.

This is a clean integration against OpenStream's documented HTTP API. It does not copy OpenStream implementation code into Afterlight.

## Supported slice

Authenticated Afterlight users can access these read-only provider routes:

- `GET /api/providers/openstream/status`
- `GET /api/providers/openstream/library`
- `GET /api/providers/openstream/channels`
- `GET /api/providers/openstream/state`

The adapter maps them to the OpenStream endpoints:

- `/health` and `/api/capabilities`
- `/api/library` using control authority
- `/api/channels` using listen authority
- `/api/state/snapshot` using listen authority

Responses are bounded and sanitized before they reach the browser. Fields whose names look like keys, tokens, secrets, passwords, or authorization data are redacted, and credential-like query strings are scrubbed.

When the provider is enabled and reachable, the existing Afterlight Music Library exposes a **Self-hosted** source tab. It renders normalized server-library items and active channels with text-only DOM construction. When the provider is disabled, unreachable, or the user is signed out, that source remains hidden and the normal 36-track Afterlight catalog behaves unchanged.

## Environment

Configure secrets only in the server deployment:

```text
OPENSTREAM_URL=https://music.example.com
OPENSTREAM_LISTEN_KEY=...
OPENSTREAM_CONTROL_KEY=...
```

Optional development/operator overrides:

```text
OPENSTREAM_ALLOW_INSECURE=1
OPENSTREAM_ALLOW_PRIVATE=1
```

By default Afterlight requires HTTPS and rejects loopback, link-local, metadata, and RFC1918 IPv4 targets. These overrides exist for explicitly trusted self-hosted deployments and should not be enabled casually on a public deployment.

## Authentication boundary

OpenStream routes require an existing Afterlight signed-in session before the provider adapter is invoked.

On Vercel, `api/index.js` validates the session against the existing Afterlight backend and then calls the provider adapter locally so OpenStream credentials never transit through the browser or Neon proxy.

On Cloudflare Workers, `src/api-core.js` validates the Neon Auth session before invoking the same provider adapter.

## Browser/runtime integration

The OpenStream browser adapter ships with runtime shell revision `offline3`, so users who previously cached the JellyBox/offline2 shell receive a distinct asset revision after this provider slice deploys. The adapter itself degrades offline by hiding the Self-hosted source; owned Afterlight tracks continue to use the certified offline package.

## Deliberately not included yet

This slice does **not** expose:

- OpenStream listen/control keys to browser JavaScript
- `/api/remote` control mutations
- channel creation/restart/delete
- HTTP live ingest
- arbitrary source resolution or probing
- general web-page extraction
- long-lived MP3 relay through Vercel serverless functions

OpenStream's direct MP3 stream is long-lived, while the current Afterlight Vercel function is intentionally short-lived. Pretending that function is a durable streaming relay would create a fragile product. A later transport slice can use a bounded HLS/proxy design or a dedicated streaming edge service without exposing the listen key.

## Fail-closed behavior

If `OPENSTREAM_URL` is missing or invalid, the provider reports disabled.

If a route needs a listen or control key that is absent, it returns a 503 configuration error rather than weakening upstream authorization.

Private/insecure targets require explicit environment opt-in.

## Verification

`npm run check:openstream` uses a deterministic mock upstream to verify:

- HTTPS/private-network policy
- listen vs control key separation
- provider route/method bounds
- library/channel normalization
- secret redaction
- missing-key fail-closed behavior

No production-readiness claim is made until a real operator-owned OpenStream instance is configured and exercised from the hosted Afterlight deployment.
