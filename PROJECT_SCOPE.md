# Instagram Content Agency — Current Product Scope

## Purpose

Instagram Content Agency turns cited research into traceable Instagram-ready assets. It is a hackathon prototype designed to prove a coordinated agency workflow, not a generic chatbot or a fully autonomous publishing product.

The current product can create a **three-format content slate** from fresh Formula 1 research:

- one static post;
- one carousel;
- one captioned vertical reel.

Each run persists source evidence, role outputs, artifact paths, Manager review, and human-approval state.

## Current Demo Promise

> Fresh F1 research is collected from approved RSS sources and Linkup. A Manager plans the run; a Strategist selects exactly one post, carousel, and reel; production stages generate real local assets; the Manager reviews the slate and may request one rework pass. Nothing is externally delivered until a human operator approves it.

## Canonical Three-Format Flow

```text
fresh F1 RSS + Linkup research
  → Sourcer evidence packet
  → Manager plan
  → Strategist: one post + one carousel + one reel
  → Creative Producer: one structured execution per format
  → Manager slate review
      → rework once, or approve rendering
  → Designer renderer: post/carousel PNGs
  → Video & Audio renderer: narration + captions + vertical MP4
  → Poster: caption, alt text, timing, delivery checklist
  → persisted run trace + dashboard
  → human approval
  → optional external export/delivery with receipt
```

## Agency Roles and Current Runtime Reality

| Role | Runtime responsibility | Current implementation |
|---|---|---|
| Manager | Plan work, review the completed slate, request rework or approve rendering. | Real Hermes Manager call in `src/hackathon/manager.ts`; review/retry orchestration in `src/run-latest-f1-slate.ts`. |
| Sourcer | Gather current cited F1 candidates. | RSS + Linkup research in `src/run-f1-publisher-research.ts`; persisted in `artifacts/f1-publisher-research.json`. |
| Strategist | Assign lane and select exactly one post, carousel, and reel for slate mode. | Real Hermes Strategist call in `src/hackathon/triple-pipeline.ts`. |
| Producer/Scripter | Produce hook, caption, post copy, carousel slides, or reel beats. | Existing structured Hermes Creative Producer adapter, called once per required format. |
| Designer | Render approved static copy into usable images. | Generic 1080×1350 SVG-to-PNG renderer in `src/hackathon/artifacts.ts`. |
| Video & Audio Manager | Render captioned MP4 and narration from approved reel beats. | `src/hackathon/reel.ts`: ElevenLabs narration when configured; macOS narration fallback only when unavailable; ffmpeg assembly. |
| Poster | Prepare publish package without publishing. | Real Hermes Poster call via `runPoster`; writes one `poster.json` per format. |

Compliance review and human approval are system gates, not independent publishing personas. An Analyst/performance-feedback loop is not implemented yet.

## Shared Run Dossier

Every run is persisted as `run.json`. It records:

- brief and run ID;
- source references and freshness packet;
- Manager plan and review decision;
- Strategist outputs and rework attempts;
- Creative Producer outputs;
- artifact paths for PNGs, MP3, SRT, and MP4;
- Poster packages;
- role trace with statuses and available latency;
- review state and approval/export state.

A role must not be represented as complete merely because the frontend says so. Its persisted output or external receipt is the source of truth.

## Latest Verified Run

The most recent three-format run is stored at:

```text
artifacts/latest-f1-slate/latest_f1_1783846296086/
```

It includes `dashboard.html`, post/carousel/reel assets, strategy and Manager records, Poster packages, and `run.json`. It remains `awaiting_approval`; it was not exported or published externally.

## Commands

```bash
# Fresh source packet
npm run research:f1-publisher

# Full Manager → Strategist → three-format slate
npm run hackathon:latest-f1

# Earlier single-asset proof run
npm run hackathon:demo

# Human-approved export to a phone-sync or other target directory
npm run hackathon:approve -- artifacts/<run>/run.json /absolute/output/directory --approve
```

## Trust and Safety Boundaries

- Credentials remain in ignored `.env.local` only.
- Browser code does not receive Linkup, ElevenLabs, OpenAI, Composio, or delivery credentials.
- Linkup snippets are cited research leads. Creative factual claims must retain a cited source and be reviewable.
- `awaiting_approval` is not delivery, publishing, or success on an external platform.
- Export/delivery requires explicit human approval and a persisted receipt/path.
- Do not describe a reel as ElevenLabs-generated unless the run trace records the ElevenLabs provider path.

## Current Gaps Before a Stronger Demo Score

1. Rerun and inspect the latest slate with ElevenLabs enabled, then persist the provider evidence in the run trace.
2. Add token/cost fields to each trace step and dashboard.
3. Add a real Composio/Drive/Instagram-ready delivery receipt after human approval.
4. Deploy the dashboard to Cloudflare Pages after the local path is stable.
5. Add Analyst ingestion for reach, saves, comments, and next-cycle strategy recommendations.

## Verification

```bash
npm test
npm run typecheck
```

The latest verification at the time this document was updated passed 51 tests and TypeScript type checking.
