# Composition Engine v3 mastering audit

## Baseline evidence

The first full FFmpeg `loudnorm` audit of the 36-track Composition Engine v3 production build measured:

- tracks: 36
- within the current Afterlight mastering window: 3
- outside the window: 33
- integrated loudness: **-22.90 to -19.86 LUFS**
- catalog loudness spread: **3.04 LU**
- true peak: **-10.07 to -6.74 dBTP**
- loudness range: **3.9 to 6.2 LU**

Every reported outlier failed for the same reason: integrated loudness was below the internal -20 LUFS floor. The audit did not identify an overly loud true peak or excessive loudness-range problem.

## Course correction

The evidence shows a gain-staging problem rather than a composition or dynamics problem. Composition Engine v3 therefore keeps its existing synthesis, section arrangement, saturation and stereo processing unchanged and adds a **+5 dB linear post-render master trim**.

The trim is applied after the existing renderer has produced the PCM master. It does not add another nonlinear saturation stage. Before samples are rewritten, the mastering utility computes the projected sample peak and fails closed if the trim would approach clipping.

Based on the measured baseline, +5 dB should move the catalog to approximately:

- integrated loudness: about **-17.9 to -14.9 LUFS**
- highest true peak: about **-1.7 dBTP** before exact remeasurement
- loudness range: effectively unchanged

Those are predictions only. The exact post-change values are certified by the same full-catalog FFmpeg audit in CI.

## Enforcement

After the gain correction, `npm run music:audit-catalog` runs with `--enforce` as part of `npm test`.

A future change fails CI if any of the 36 generated release tracks falls outside the current `music/mastering-policy.json` window. The structural music-quality check also requires the manifest to carry:

- `masterGainDb: 5`
- `masteringMethod: linear-post-render-v1`

This makes the mastering decision explicit provenance rather than an undocumented amplitude constant.

## Scope

This correction applies to the generated **production catalog build**. Higher-fidelity studio masters continue through their own intake, mastering report, human review and explicit release-certificate path. Human listening quality is still required; loudness compliance does not mean a composition is good.
