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

## Mastering certification

Production approval for a studio master also requires an FFmpeg loudness report. FFmpeg must be installed and available as `ffmpeg`, or its path supplied through `FFMPEG_BIN`.

Run certification after intake and before final production review:

```bash
npm run music:mastering-certify -- \
  --manifest .music-lab/rooftop-master-001/manifest.json
```

The command writes `mastering-report.json` beside the manifest. The report is bound to:

- the audition `packageId`
- the exact manifest SHA-256
- the exact candidate audio SHA-256
- the current `music/mastering-policy.json` SHA-256
- the FFmpeg version that performed measurement

The current policy is an **Afterlight internal background-listening consistency window**, not a claim that every streaming service or genre should use the same mastering target. It currently requires:

- integrated loudness between **-20 and -13 LUFS**, with -16 LUFS as the internal center target
- true peak no higher than **-1.0 dBTP**
- loudness range no higher than **18 LU**

Measurement uses FFmpeg `loudnorm` first-pass analysis. The report captures integrated loudness, true peak and loudness range without normalizing or altering the candidate master.

A failed mastering report remains useful evidence, but the production review gate fails closed until a passing report for the exact package exists. Beta listening can still happen before mastering certification so reviewers can identify musically promising material that needs rework.

## Production review

Technical intake and mastering certification never publish audio.

The imported package must still pass `music:review-gate`. Production review currently requires two distinct reviewer identities, sufficient listening coverage, threshold scores, explicit shortlist votes, no reject vote, technical validity, a current passing mastering report, and cleared provenance.

Example:

```bash
npm run music:review-gate -- \
  --stage production \
  --manifest .music-lab/rooftop-master-001/manifest.json \
  --reviews reviewer-a.json,reviewer-b.json
```

## Explicit release certificate

A passing production review still does not mean the audio should silently become the live catalog. An operator must create a release certificate for a specific stable room/track slot:

```bash
npm run music:release-certificate -- \
  --manifest .music-lab/rooftop-master-001/manifest.json \
  --reviews reviewer-a.json,reviewer-b.json \
  --operator "Release Operator" \
  --slot rooftop:1 \
  --candidate rooftop-master-001
```

The command re-runs the production review gate, re-hashes the candidate audio, and writes `release-certificate.json`. The certificate binds:

- target room and one of its three stable track slots
- exact candidate SHA-256
- audition package ID and manifest SHA-256
- mastering-report SHA-256 for studio masters
- hashes and reviewer identities for the review files
- human score averages and shortlist-vote evidence
- explicit operator identity and decision timestamp

Its status is `approved-for-release-packaging`. That wording is deliberate: the certificate **does not deploy, publish, upload, or replace production audio**. Actual media publication and hosted exact-revision verification remain separate release actions. If the reviewed audio changes after approval, certificate generation fails.

A future Open Music Studio pipeline should emit the provenance sidecar directly. Afterlight should remain the catalog/listening product; generation and editing stay outside the runtime request path.
