# Instagram Content Agency — Agent Contract

## Product purpose

This project turns bounded, cited research into traceable Instagram-ready assets. It does **not** publish posts and it must never invent facts, quotes, source URLs, or successful delivery states. Human approval is required before any external export/delivery.

## Canonical hackathon flow

```text
approved RSS sources + three Linkup questions
  → cited research packet
  → Manager plan
  → Strategist: exactly one post + carousel + reel
  → format-constrained Creative Producer runs
  → Manager review / one rework attempt
  → static PNG + captioned MP4 renderers
  → Poster packages
  → durable run trace + dashboard
  → human approval before any delivery
```

### Inputs

1. **RSS sources**
   - F1 flow: PlanetF1, The Race, Autosport, and Formula1.com.
   - Hard constraint: prior 24 hours; at most five accepted articles per source.

2. **Linkup research**
   - Run server-side only with `LINKUP_API_KEY` from ignored `.env.local`.
   - The F1 publisher asks exactly three questions: latest developments, current trends, and active controversies/debates.
   - Preserve result URLs and snippets as evidence.
   - Linkup search-result payloads may lack reliable publication timestamps. Treat them as research leads unless the cited source confirms freshness.

3. **Publisher persona**
   - Role: F1 Instagram content publisher.
   - Audience: F1 fans who want timely, useful, and debate-worthy content.
   - The persona must reason from the research packet only.

## Required outputs

### Research and legacy handoffs

- `artifacts/f1-publisher-research.json`
  - Raw, source-backed RSS and Linkup evidence.
- `artifacts/f1-content-publisher-handoff.md`
  - Human-readable idea brief.
- `artifacts/f1-post-creator-handoff.json`
  - Legacy machine-readable handoff.
- `artifacts/f1-content-dashboard.json`
  - Legacy grouped-card payload.

### Canonical latest-F1 run

`npm run hackathon:latest-f1` writes `artifacts/latest-f1-slate/<run-id>/` containing:

- `dashboard.html` and `run.json`;
- Manager plan/review and Strategist attempt records;
- exactly one post directory, carousel directory, and reel directory;
- the real rendered artifacts and `poster.json` for each format.

The run may be called `awaiting_approval`, but never `delivered` or `published` without a persisted external provider/export result.

The legacy publisher handoff contains **exactly nine ideas**:
- 3 `evergreen`
- 3 `controversial`
- 3 `growth`

Every idea requires a working title, why-now rationale, recommended angle, and one or more article URLs copied byte-for-byte from the research packet.

## Ownership boundaries

- `src/content-fetcher/` owns source retrieval, source normalization, freshness windows, source limits, and research packets.
- `src/strategist/` owns relevance verdicts and evergreen / controversial / growth classification.
- Root orchestration modules may combine contracts from both folders but must not duplicate their business logic.
- `post-creator-persona/` is downstream-owned. Do not edit it unless the requested task is specifically about post creation.

## Non-negotiable guardrails

- Never put API keys in browser code, committed files, or output artifacts.
- Never claim an external action happened from a frontend success state alone.
- Never turn a Linkup result into a factual claim without preserving its cited URL.
- Label uncertainty rather than filling gaps with invented detail.
- Do not modify another agent's folder or unrelated untracked work.

## Verification

Before calling a code change complete:

```bash
npm test
npm run typecheck
```

For a fresh F1 research packet:

```bash
npm run --silent research:f1-publisher
```
