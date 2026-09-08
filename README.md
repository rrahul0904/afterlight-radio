# Afterlight Radio

An original 12-room place-based listening experience built for Cloudflare Workers + Static Assets.

## What is implemented

- 12 atmospheric listening rooms with clean URLs
- 3 distinct original music loops per room
- Native `HTMLAudioElement` playback with `playsinline` for iPhone/Safari
- Audible WAV rendering with melody, bass, pad, kick and brushed percussion
- Play/pause, previous/next track, mute and volume controls
- Room browser, keyboard navigation and browser history
- Local persistence for room/track/volume/mute state
- Responsive desktop/mobile UI
- Cloudflare Workers Static Assets deployment config
- Deterministic `public/` route build
- GitHub Actions CI on every push

## Run locally

```bash
npm install
npm test
npm run serve
```

Open `http://localhost:4173/rooftop/`.

## Cloudflare

The project is configured for Cloudflare Workers + Static Assets.

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Production branch: `main`
- Worker name: `afterlight-radio`
- Output directory: `public/`

Cloudflare Workers Builds can connect directly to this GitHub repository.

## Audio implementation

Audio is rendered locally into PCM WAV blobs and assigned to a native browser `Audio` element before playback. This removes the nearly-silent Web Audio gain bug from the earlier prototype and keeps playback behind a direct user Play gesture for mobile Safari.

The loops are original project-generated audio; no third-party copyrighted recordings are bundled. The player can later be switched to licensed catalog/stream URLs without replacing the room UX.
