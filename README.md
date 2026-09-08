# Afterlight Radio

An original 12-room place-based listening experience built for Cloudflare Workers + Static Assets.

## What is implemented

- 12 atmospheric listening rooms with clean URLs
- 3 original audio tracks per room
- Safari/iPhone-safe HTMLMediaElement playback
- Play/pause, previous/next track, mute and volume controls
- Room browser, keyboard navigation and browser history
- Local persistence for room/track/volume/mute state
- Responsive desktop/mobile UI
- Cloudflare Workers Static Assets deployment config
- Build-time generation of the public site and original WAV audio assets
- CI validation on every push

## Run locally

```bash
npm install
npm run build
npm run serve
```

Open http://localhost:4173/rooftop/

## Cloudflare

The project is configured for Cloudflare Workers + Static Assets.

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Production branch: `main`
- Worker name: `afterlight-radio`

The generated `public/` directory is intentionally not committed.

## Audio

The build generates original project-owned PCM WAV tracks. No third-party copyrighted songs are bundled. The player boundary can later be replaced with licensed streams/catalog audio without changing the room UX.
