# Afterlight Radio

Afterlight is a place-based listening project. The current repository contains both the existing product and an isolated source-first rebuild candidate.

## Source-first rebuild

The focused rebuild lives at `/rebuild/` on branch `rebuild/source-first-afterlight` and is intentionally narrower than the existing product:

- four flagship rooms: Rooftop, Window Seat, Headspace, Last Bus;
- room-first listening instead of account/dashboard-first navigation;
- room-local music identity;
- Day / Evening / Night visual states;
- `Another view` preserves the current music source;
- independent ambience;
- exact room + track + view sharing;
- no account/admin/focus/library/subscription/visualizer UI in the first-session path.

The current generated WAVs are temporary demo audio. They are not source parity and are not proof of listening quality.

Start with:

- `docs/reverse-engineering/SOURCE_FIRST_REBUILD_2026-10-03.md`
- `docs/reverse-engineering/SOURCE_EVIDENCE_MATRIX_2026-10-03.md`
- `docs/reverse-engineering/MUSIC_SOURCE_DECISION_2026-10-03.md`
- `docs/reverse-engineering/YOUTUBE_PROVIDER_POLICY_2026-10-03.md`
- `docs/uat/SOURCE_FIRST_LISTENING_UAT.md`

## Verification

The latest verified code-bearing rebuild SHA is recorded in the source-first rebuild document. Current CI includes:

- source-first rebuild contract checks;
- curated music-source/rights intake checks;
- existing repository quality checks;
- Chromium + WebKit browser smoke for `/rebuild/`.

A green build does not establish music quality. Promotion requires a cleared Stage-A catalog and human listening evidence.

## Local development

```bash
npm install
npm test
npm start
```

The generated static output is written under `public/`.

## Deployment status

Production is unchanged. The source-first PR remains draft/unmerged. The dedicated GitHub Vercel Preview workflow also requires the repository's `VERCEL_TOKEN`; if that secret is absent, the workflow intentionally stops before build/deploy and no hosted exact-head claim should be made.
