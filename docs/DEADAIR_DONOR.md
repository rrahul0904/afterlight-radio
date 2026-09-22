# deadair capability donor → Afterlight Broadcast Mode

## Source and boundary

Source product: deadair — https://deadair.radio/  
Source repository: https://github.com/robert-dean/deadair  
Reddit discovery: https://www.reddit.com/r/coolgithubprojects/s/pt7GL1FTx2

deadair is MIT-licensed, but this first slice does not copy its implementation. It reverse-engineers the product and architectural ideas into Afterlight's existing architecture. If later work directly reuses MIT-licensed code, preserve the original license/copyright notices and review deadair's third-party notices separately.

This donor does **not** replace the current Afterlight product. Afterlight remains a premium place-based listening experience with twelve rooms and an original first-party catalog. The deadair-derived work is an optional **Broadcast Mode / AI DJ** capability that can sit beside the existing room player.

## What deadair actually is

deadair is a self-hosted shared radio station, not a per-user playlist player. Its main system ideas are:

1. **One authoritative running order**
   - a forward lineup several hours deep;
   - one director is the only writer;
   - schedule, operator UI and models post commands rather than mutating the order directly;
   - each item owns a lifecycle such as planned → handed → airing → played / skipped.

2. **Fail-open-to-content presenter pipeline**
   - LLM-generated talk breaks are preferred;
   - deterministic built-in phrasings are the floor;
   - slow, missing or rejected model output cannot make the station silent.

3. **Grounded on-air claims**
   - factual statements about tracks are backed by stored source evidence;
   - unsupported claims are structurally excluded from the presenter context.

4. **Stateful presenter personas**
   - persona = voice + diction + behavior limits + notebook/memory;
   - the operator can change who is presenting;
   - persona memory is distinct from factual track metadata.

5. **Provider/plugin architecture**
   - music providers, metadata, news, weather, podcasts, speech, models and analysis are capability plugins;
   - host-side orchestration owns the business rules;
   - third-party integrations stay behind explicit contracts.

6. **Dedicated audio playout plane**
   - the application coordinates audio but does not decode/mix/encode it;
   - deadair delegates that to Liquidsoap/Icecast plus an analysis sidecar;
   - tracks are measured for cue points/loudness before playout.

7. **Listener-aware operation**
   - broadcast work can idle when nobody is listening;
   - the system explains why playback is quiet through explicit causal gates.

8. **Operational surface**
   - desk/running order;
   - schedule/programme;
   - library;
   - characters/voices;
   - diagnostics, cost history and logs;
   - API keys + OpenAPI/typed clients.

## Why this belongs in Afterlight

Afterlight already owns several prerequisites:

- original, provenance-tracked audio;
- durable user/account and entitlement state;
- room metadata and first-party music library;
- optional Navidrome/Subsonic provider boundary;
- protected admin portal;
- hosted API and Postgres;
- analytics/error/support persistence;
- a human-gated Music Lab pipeline.

The missing layer is orchestration for a **shared programmed broadcast** with narration and a visible forward lineup. That is the useful donor slice.

## Product model

### Existing mode — unchanged

**Places Mode**
- listener chooses a room;
- playback is personal;
- existing original catalog remains authoritative;
- no AI presenter is required.

### New optional mode

**Broadcast Mode**
- one programmed stream / station timeline;
- every listener hears the same logical running order;
- operator/admin can inspect and edit upcoming items;
- AI host can speak between tracks;
- deterministic narration is always available when AI is unavailable;
- initially uses Afterlight-owned tracks only;
- self-hosted provider tracks can be considered only after licensing/product policy is explicit.

## Target architecture

```text
Afterlight catalog / approved provider
             |
             v
       Broadcast Planner
             |
             v
    Director / Running Order  <---- Admin Desk / Schedule
             |
       +-----+------+
       |            |
       v            v
 Narration       Track item
  pipeline           |
       |             |
       +------v------+
              |
       Playout contract
              |
     streaming adapter
```

### 1. Director

The director becomes the only writer of the broadcast running order.

Proposed domain objects:

- `broadcasts`
  - id
  - name
  - status
  - brief
  - active_persona_id
  - started_at
  - ended_at

- `broadcast_items`
  - id
  - broadcast_id
  - ordinal
  - kind: track | break | ident | segment
  - source_id
  - state: planned | ready | handed | airing | played | skipped | removed
  - scheduled_for
  - started_at
  - ended_at
  - failure_reason

- `broadcast_events`
  - broadcast_id
  - event_type
  - payload
  - actor
  - created_at

Only the director service can change ordering/state. HTTP/admin/model inputs become commands.

### 2. Planner

The planner should first operate only on the existing Afterlight catalog.

Inputs:
- room / mood;
- duration;
- optional textual brief;
- repetition window;
- artist/track cooldown;
- explicit content policy.

Outputs:
- bounded list of track IDs;
- reasons / rule evidence for every selection;
- no opaque model-only output.

The deterministic planner is the floor. AI can propose a set, but the host validates and tops up/rejects it.

### 3. Presenter pipeline

A narration request includes:
- previous track;
- next track;
- room/station context;
- approved track facts;
- recent scripts;
- active persona;
- time-of-day/timezone.

Writers are ordered:
1. configured LLM;
2. deterministic template writer.

Validation rejects narration that:
- refers to unsupported facts;
- invents a nonexistent track/artist;
- violates length/timing policy;
- uses obviously incorrect time-of-day language;
- contains unsafe markup or unexpected tool output.

Every attempt, accepted or rejected, is stored with a reason.

### 4. Grounded fact store

Do not let a presenter improvise factual metadata as truth.

Proposed records:
- track_fact_id;
- track_id;
- claim;
- source_url/source_type;
- evidence_excerpt/hash;
- confidence;
- approved;
- created_at.

For first-party original music, facts can include composition/provenance metadata from the Music Lab and manifest. External provider facts need traceable sources.

### 5. Personas and voices

Persona fields:
- name/key;
- display name;
- style/diction;
- verbosity;
- banned patterns;
- voice adapter;
- active/inactive;
- memory policy.

Memory is split:
- **said**: something that actually aired;
- **trait**: inferred characterization requiring operator approval before reuse.

Do not conflate character memory with factual catalog metadata.

### 6. Plugin/provider contracts

Afterlight should not import deadair's entire plugin host initially. Use a narrower adapter surface consistent with the existing codebase:

- `MusicSourceAdapter`
- `NarrationModelAdapter`
- `SpeechAdapter`
- `MetadataAdapter`
- `StreamingAdapter`

The existing disabled-by-default Navidrome/Subsonic boundary can become the first external MusicSourceAdapter. First-party Afterlight remains the default.

### 7. Audio and streaming

Phase 1 should avoid putting audio transcoding into the current serverless API.

Recommended split:
- Vercel/Neon continue owning account, admin, catalog and broadcast-control APIs;
- a separate long-running broadcast worker owns timing, playout leases and stream production;
- output may use Icecast/Liquidsoap or another dedicated streaming plane;
- the worker must fail closed when lease/ownership is lost;
- production Afterlight web playback remains unchanged until the broadcast stream is certified.

This avoids trying to make a continuously running radio station fit inside request/response serverless execution.

### 8. Listener-demand gate

Broadcast worker can pause expensive generation when no listeners are connected.

Important: pausing should never corrupt the running-order state. Resume must reconcile from authoritative director state.

### 9. Admin surface

Add a protected **Broadcast** section to the current admin portal:

- Now Playing;
- running order;
- skip/remove/reorder planned items;
- start/stop broadcast;
- active persona;
- narration attempts and rejection reasons;
- schedule;
- listener count;
- health/quiet reason;
- model/TTS cost ledger;
- event log.

All mutations need audit events.

## APIs — proposed first contract

Read:
- `GET /api/admin/broadcast/status`
- `GET /api/admin/broadcast/lineup`
- `GET /api/admin/broadcast/events`
- `GET /api/admin/broadcast/personas`

Commands:
- `POST /api/admin/broadcast/start`
- `POST /api/admin/broadcast/stop`
- `POST /api/admin/broadcast/rebrief`
- `POST /api/admin/broadcast/recast`
- `POST /api/admin/broadcast/items/:id/skip`
- `POST /api/admin/broadcast/items/:id/remove`

Public/listener:
- `GET /api/broadcast/now`
- stream URL is separate from the control API.

## Security and rights boundary

- Admin mutations remain authenticated and admin-authorized.
- Provider credentials remain server-side/encrypted.
- External URLs use the existing SSRF/private-host protections.
- No API should return stored provider/model secrets.
- Every autonomous/model-generated command is validated by host rules before state mutation.
- A public music stream is **not** automatically licensed because the software can produce one. Keep the first beta on first-party Afterlight audio unless rights for provider content are explicitly established.
- Speech/model plugins must have budgets, timeouts and deterministic fallback.
- If direct deadair source reuse is introduced later, preserve MIT attribution and audit bundled third-party licenses.

## Testing gates

### Unit
- lineup state machine;
- only-director-writes invariant;
- planner repeat/cooldown rules;
- narration validation/fallback;
- persona memory approval;
- grounded-fact schema;
- lease expiry / duplicate worker protection.

### Integration
- catalog → planner → lineup;
- lineup → worker → stream adapter;
- LLM failure → deterministic narration;
- TTS failure → safe no-break/ident behavior;
- admin edits persist and survive worker restart;
- listener count gates expensive work without losing state.

### Security
- admin authorization;
- command tampering;
- SSRF/provider URL validation;
- secret redaction;
- replay/idempotency;
- worker lease fencing;
- rate limiting for control APIs.

### Browser/UAT
- start broadcast;
- inspect future running order;
- edit a planned item;
- see now-playing update;
- switch persona;
- model-off mode continues talking deterministically;
- worker failure surfaces one clear quiet reason;
- current Places Mode is unchanged.

## Phased implementation

### Phase 0 — reverse engineering / boundary
- [x] Source product and repository identified.
- [x] Architecture mapped.
- [x] Consolidation target selected: Afterlight Radio.
- [x] Product boundary documented.
- [ ] Add master tracker row.

### Phase 1 — repository-contained director
- [ ] broadcast schema/migration;
- [ ] director state machine;
- [ ] deterministic planner over the 36 first-party tracks;
- [ ] admin read-only lineup/status endpoints;
- [ ] unit/integration tests.

### Phase 2 — operator controls
- [ ] start/stop;
- [ ] skip/remove/reorder planned items;
- [ ] protected Broadcast admin UI;
- [ ] audit/event history;
- [ ] restart/idempotency tests.

### Phase 3 — AI presenter
- [ ] persona model;
- [ ] deterministic templates;
- [ ] LLM adapter with bounded timeout;
- [ ] narration validation;
- [ ] TTS adapter;
- [ ] grounded track facts;
- [ ] cost ledger.

### Phase 4 — streaming worker
- [ ] separate long-running worker;
- [ ] fenced ownership/lease;
- [ ] playout protocol;
- [ ] stream adapter;
- [ ] listener count / demand gate;
- [ ] failure/quiet diagnostics.

### Phase 5 — certification
- [ ] full CI;
- [ ] exact-head integration evidence;
- [ ] security/abuse testing;
- [ ] browser UAT;
- [ ] rights/licensing review for any non-first-party audio;
- [ ] beta run using only approved Afterlight audio.

## Smallest truthful next implementation slice

Implement **Phase 1 only**: repository-contained running-order state machine + deterministic planner + read-only admin status/lineup API, backed by tests.

That proves the core architectural invariant without adding streaming infrastructure, model/TTS credentials, or changing the current production player.
