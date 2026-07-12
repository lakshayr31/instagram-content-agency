# Agency Persona Registry

Persona Markdown is a contract, not a runtime by itself. A role is real only when the orchestrator explicitly loads its contract, provides bounded input, validates JSON output, and persists the result in the run trace.

## Canonical Runtime Flow

```text
Manager
  → Sourcer: fresh RSS + Linkup evidence
  → Strategist: lane + slate format allocation
  → Creative Producer / Producer: one execution per allocated format
  ├─ post + carousel → Designer renderer
  └─ reel → Video & Audio renderer
  → Poster: publish package
  → Manager review / one rework pass
  → compliance + human approval system gates
  → optional delivery/export
```

The standard single-campaign path selects one format. The hackathon `latest-f1` slate path deliberately allocates exactly one `post`, one `carousel`, and one `reel` so judges can see every production branch in one run.

## Role Contracts and Runtime Status

| # | Role | Contract | Current runtime | Boundary |
|---|---|---|---|---|
| 1 | Manager | `src/agency-manager/AGENCY_MANAGER_PERSONA.md` | Real Hermes planning call plus Manager review/rework decision. | Does not invent facts, create media, or externally deliver. |
| 2 | Sourcer | `src/content-sourcer/CONTENT_SOURCER_PERSONA.md` | Existing RSS + Linkup research flow; writes cited evidence packet. | Does not treat a bare title/summary as independent proof. |
| 3 | Strategist | `src/strategist/STRATEGIST_PERSONA.md` | Real Hermes slate strategist in `src/hackathon/triple-pipeline.ts`; deterministic classifier remains available for pre-filtering. | Does not create media or publish. |
| 4 | Producer/Scripter | `src/producer/PRODUCER_PERSONA.md` | The existing `src/creative-producer/` Hermes adapter is currently the production runtime. It is called once per mandated format. | Does not change source scope or externally publish. |
| 5 | Designer | `src/designer/DESIGNER_PERSONA.md` | `src/hackathon/artifacts.ts` renders approved static copy into 1080×1350 PNGs. | No reel assembly, factual rewrites, or publishing. |
| 6 | Video & Audio Manager | `src/video-audio-manager/VIDEO_AUDIO_MANAGER_PERSONA.md` | `src/hackathon/reel.ts` creates narration, captions, and 1080×1920 MP4. Uses ElevenLabs when credentials are present; otherwise an explicit local fallback. | Does not change approved screenplay or claim provider output without evidence. |
| 7 | Poster | `src/poster/POSTER_PERSONA.md` | Real Hermes Poster call creates a per-asset `poster.json`. | Never bypasses human approval or publishes directly. |

## Creative Producer Consolidation

`src/creative-producer/CREATIVE_PRODUCER_PERSONA.md` is the current executable producer adapter. The separate `src/producer/PRODUCER_PERSONA.md` documents the desired long-term split Producer/Scripter role.

Do not run both as independent creative decision-makers in the same path. The current runtime uses the executable Creative Producer adapter as the Producer implementation so that format-specific assets are generated from one validated contract.

## System Gates Outside the Seven Personas

### Manager review

The Manager reviews the full slate before rendering. It can return `rework`; the `latest-f1` runner permits one new strategy/production attempt before failing closed.

### Compliance and human approval

Before any external delivery, require:

1. cited source URLs and reviewable factual support;
2. completed artifact paths;
3. required review checks;
4. explicit human approval;
5. an actual provider/export receipt persisted in the dossier.

`awaiting_approval` means the package is ready for operator review. It does not mean posted, delivered, or exported.

## Current Evidence

The latest three-format evidence folder is:

```text
artifacts/latest-f1-slate/latest_f1_1783846296086/
```

It contains the Manager plan/reviews, strategy output, three creative outputs, rendered assets, three Poster packages, `run.json`, and `dashboard.html`.

## Analyst Status

An Analyst role—post-publish metrics ingestion and feedback into the next strategy cycle—is not implemented. Do not claim an autonomous closed-loop learning system yet.
