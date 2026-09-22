# Studio master intake

Afterlight's production catalog must not be permanently coupled to the procedural Composition Engine.

The studio-master intake is the boundary for bringing a higher-fidelity **original or explicitly licensed** master into Music Lab without bypassing the same human audition policy used for procedural candidates.

## Accepted audio

The current intake slice accepts:

- RIFF/WAVE
- uncompressed PCM
- stereo
- 16-bit or 24-bit
- 32 kHz, 44.1 kHz or 48 kHz
- 90 seconds through 10 minutes

The parser walks WAV chunks rather than assuming audio always starts at byte 44. This allows ordinary professional WAV files that contain extra RIFF chunks while still rejecting unsupported codecs.

Intake measures sample peak, RMS, crest factor, stereo difference, channel balance, DC offset and near-clipping samples. These checks are **technical screening**, not mastering certification and not a substitute for listening.

## Provenance contract

Every master requires a JSON sidecar. See `music/master-intake.example.json`.

Required assertions include:

- canonical Afterlight room
- creator
- source revision or generation identifier
- source type: `open-music-studio`, `human-produced`, or `commissioned-original`
- rights state: `first-party` or `licensed-for-afterlight`
- explicit `commercialUseCleared: true`
- model disclosure when AI-assisted
- clearance reference when third-party samples are present
- license reference when the master is licensed rather than first-party

These fields are evidence inputs. They do not magically establish ownership; source documents and contracts must remain available outside the repo where applicable.

## Import

```bash
npm run music:intake-master -- \
  --audio /path/to/master.wav \
  --metadata /path/to/master.json \
  --out .music-lab/rooftop-master-001
```

The command creates an audition-only package containing:

- `candidates/master.wav`
- `manifest.json`
- `review.html`
- `review-template.json`

The exact master is SHA-256 bound to the package. Reviews carry the package ID and candidate SHA so a review from an older batch cannot be replayed against a replacement audio file.

## Promotion

Technical intake never publishes audio.

The imported package must still pass `music:review-gate`. Production review currently requires two distinct reviewer identities, sufficient listening coverage, threshold scores, explicit shortlist votes, no reject vote, technical validity and cleared provenance.

Example:

```bash
npm run music:review-gate -- \
  --stage production \
  --manifest .music-lab/rooftop-master-001/manifest.json \
  --reviews reviewer-a.json,reviewer-b.json
```

A future Open Music Studio pipeline should emit this sidecar contract directly. Afterlight should remain the catalog/listening product; generation and editing stay outside the runtime request path.
