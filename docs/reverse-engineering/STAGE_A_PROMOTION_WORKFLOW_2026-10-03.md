# Afterlight Stage-A music promotion workflow — 2026-10-03

This workflow exists to prevent a researched track from becoming runtime music through an undocumented shortcut.

## 1. Research shortlist

Source: `music/stage-a-research-candidates.json`

Requirements:
- individual track/version license evidence;
- room-fit rationale;
- duration;
- candidate remains `assetStatus: pending`.

Run:

```bash
npm run check:research-shortlist
```

Passing this means only that the research shortlist is structurally complete enough to begin acquisition. It does not mean Afterlight owns a playable copy.

## 2. Acquire the exact audio copy

Acquire the file from the same permissively licensed source/version identified by the evidence URL, or obtain a separate explicit license receipt for the alternate acquisition channel.

Do not:
- use an arbitrary mirror;
- use a differently licensed Bandcamp/store copy and attach an FMA license URL;
- rip audio from a provider player;
- infer that all tracks by an artist share one license.

## 3. Bind asset to evidence

Run `scripts/stage-a-asset-promotion.mjs` with:
- the exact candidate record;
- local acquired audio file;
- intended `/audio/curated/...` path;
- exact acquisition URL;
- reviewer identity.

The receipt records:
- SHA-256;
- file size/name;
- license evidence URL;
- acquisition source;
- attribution text;
- reviewer/time;
- `candidate-not-human-approved` status.

An acquisition channel different from the evidence channel is rejected unless `AFTERLIGHT_SEPARATE_LICENSE_RECEIPT` is supplied.

## 4. Rights decision

Before the receipt can become a Stage-A catalog entry, a rights reviewer must explicitly decide:
- commercial use allowed;
- streaming use allowed;
- territories;
- whether ambience may be mixed with the recording;
- whether a future presenter may be mixed with the recording;
- basis and reviewer identity/date.

The admission tool does not infer those answers from the license identifier.

Use `scripts/stage-a-catalog-admit.mjs` to convert the asset receipt + rights decision into a validated catalog entry.

## 5. Build the real Stage-A manifest

Add admitted entries to `music/stage-a-catalog.json`.

Run:

```bash
npm run catalog:stage-a
```

Readiness requires, per flagship room:
- 8–12 admitted tracks;
- at least 15 minutes of unique listening duration;
- no duplicate recording across rooms;
- every entry passing the curated-source/rights validator.

Until this command passes, serious listening UAT must not be described as a test of the production music baseline.

## 6. Human listening

Follow `docs/uat/SOURCE_FIRST_LISTENING_UAT.md`.

Catalog admission is not human approval. Tracks/rooms must still be listened to and may be rejected for poor musical quality, fatigue, repetition, or room mismatch even when all rights and technical checks pass.

## 7. Radio stays later

Even if a track is cleared for normal listening, `mixWithPresenterAllowed: false` must prevent it from being used under/around future AI-DJ speech until a separate rights decision changes that state.
