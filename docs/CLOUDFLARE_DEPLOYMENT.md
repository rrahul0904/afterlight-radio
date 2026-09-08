# Cloudflare deployment

This repository is configured for **Cloudflare Workers + Static Assets**.

## Workers Builds settings

- Production branch: `main`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Worker name: `afterlight-radio`
- Static assets directory: `./public`

The build creates the root page plus 12 clean room routes. The audio loops are rendered into WAV blobs in the browser and played through `HTMLAudioElement`, so no copyrighted third-party audio or binary media files are required in Git.

## Direct CLI deployment

After authenticating Wrangler to the intended Cloudflare account:

```bash
npm install
npm test
npm run cf:deploy
```

## GitHub integration

Cloudflare Workers Builds can connect directly to this repository. Use `main` as the production branch with the build/deploy commands above.
