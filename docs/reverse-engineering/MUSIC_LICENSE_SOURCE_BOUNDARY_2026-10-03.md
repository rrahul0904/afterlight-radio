# Afterlight music license source boundary — 2026-10-03

## Rule

A creator/artist does not have one global license that automatically applies to every copy of every track on every platform.

Afterlight must bind rights evidence to the **specific track/version/source page** used to justify intake.

## Why this matters

Research on 2026-10-03 found examples where an artist has permissively licensed material on one source while another catalog/channel carries different terms.

### Ketsa

- Individual Free Music Archive pages used in the Stage-A research shortlist explicitly identify the selected tracks as **Attribution 4.0 International (CC BY 4.0)**.
- Ketsa's current licensing pages also describe CC BY/free commercial use with attribution for some catalogs.
- A separate current Ketsa download page describes its music there as **CC BY-NC-ND 4.0** and says commercial/background use needs permission or a paid license.

Therefore:
- an FMA track in the shortlist is justified by its exact individual FMA track page;
- a similarly named file obtained from another Ketsa catalog must not inherit the FMA license assumption;
- the acquired asset must be traceable to the permissively licensed version/source or separately licensed.

### HoliznaCC0

- Individual FMA pages in the shortlist explicitly label selected tracks **CC0 1.0 Universal**.
- Holizna's separate Bandcamp royalty-free catalog currently states that standard-price use is noncommercial and commercial use requires contact/Patreon.

Therefore:
- an individual CC0 FMA track page is the evidence for that specific FMA-published version;
- a Bandcamp download must follow the Bandcamp terms unless separate evidence proves it is the same CC0-distributed version under an applicable grant.

## Intake consequence

A promotion receipt must retain:
- exact license evidence URL;
- exact acquisition source;
- asset SHA-256;
- artist/title;
- license identifier;
- attribution text when required;
- reviewer/date.

Do not download a convenient copy from a differently licensed channel and attach a permissive license URL from somewhere else.

## Product consequence

If exact asset provenance cannot be established, the track remains a research candidate and does not enter `music/stage-a-catalog.json`.
