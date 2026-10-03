# Audio Quality v4 acceptance gate

This acceptance gate exists because Afterlight previously allowed technically valid audio to get too close to launch without proving that people actually wanted to listen to it.

A candidate may be called **audio-quality approved** only when all of the following are true:

- It is rendered through the v4 audition path or imported through the studio-master path.
- The exact candidate SHA is recorded.
- The candidate passes structural audio checks and the FFmpeg mastering policy.
- At least two reviewers complete the existing Music Lab review with >=90 seconds of listening each.
- Both reviewers explicitly shortlist the candidate.
- Mean review scores meet the existing production thresholds for room fit, musicality, low fatigue, variation and production polish.
- Reviewers compare the candidate against the current room track or an untreated candidate, not in isolation.
- A release certificate is created only after the approved file is frozen.
- Hosted UAT is performed on at least one phone speaker, one headphone/AirPods-class device and one laptop/desktop playback path.
- No production replacement occurs merely because objective DSP metrics improved.

## Flagship-first rule

Do not regenerate all 36 production tracks at once. Qualify `rooftop`, `window`, `headspace` and `last-bus` first. If the v4 path does not produce a clear human preference in those contrasting rooms, stop and improve the synthesis/source material instead of scaling a weak pipeline.
