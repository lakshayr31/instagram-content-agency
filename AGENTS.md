# Instagram Content Agency — Agent Contract

## Product purpose

This project turns bounded, cited research into a handoff for a downstream post-creator. It does **not** publish posts and it must never invent facts, quotes, source URLs, or successful delivery states.

## Canonical F1 publisher flow

```text
approved RSS sources + three Linkup questions
  → research packet
  → Hermes content-publisher agent
  → exactly nine post ideas
  → post-creator handoff JSON / Markdown / dashboard JSON
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

### Required outputs

- `artifacts/f1-publisher-research.json`
  - Raw, source-backed RSS and Linkup evidence.
- `artifacts/f1-content-publisher-handoff.md`
  - Human-readable brief for the post creator.
- `artifacts/f1-post-creator-handoff.json`
  - Canonical machine-readable workflow payload.
- `artifacts/f1-content-dashboard.json`
  - Frontend-ready, grouped payload with three content sections and card data.

The publisher handoff must contain **exactly nine ideas**:
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
