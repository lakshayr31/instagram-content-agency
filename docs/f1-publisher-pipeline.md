# F1 Content Publisher Pipeline

## Purpose

This pipeline gives a post-creator agent a bounded, source-backed F1 content brief. It is an operator-controlled research and selection step; it does not publish content.

## What a run does

1. **Collects RSS evidence** from four configured F1 publishers:
   - PlanetF1
   - The Race
   - Autosport
   - Formula1.com

   RSS collection uses a 24-hour lookback and accepts at most five articles per publisher.

2. **Calls the live Linkup Search API** three times, using these publisher questions:
   - What are the top latest Formula 1 developments right now?
   - What is trending in Formula 1 right now?
   - What Formula 1 stories are currently controversial or debate-worthy?

   Linkup result URLs and snippets are normalized and preserved as source evidence. The API key is read only from the ignored server-side `.env.local` file.

3. **Writes a research packet** to:
   - `artifacts/f1-publisher-research.json`

   The packet contains the RSS articles, the three Linkup questions, and all returned Linkup source items.

4. **Runs a Hermes Agent as an F1 content publisher.**

   The agent is restricted to reading the research packet and writing the handoff. It must produce exactly nine ideas:
   - 3 evergreen ideas
   - 3 controversial ideas
   - 3 growth ideas

   Every article URL in the handoff must be copied from the research packet; the output must not invent claims or URLs.

5. **Produces post-creator handoffs:**
   - `artifacts/f1-content-publisher-handoff.md` — human-readable brief
   - `artifacts/f1-post-creator-handoff.json` — canonical workflow payload
   - `artifacts/f1-content-dashboard.json` — frontend-friendly grouped card payload

## Run commands

Collect live research:

```bash
npm run --silent research:f1-publisher
```

Then run the Hermes publisher agent against the resulting research packet to regenerate the Markdown handoff.

## Guardrails

- RSS items are hard-filtered to the prior 24 hours.
- RSS collection stops after five accepted items for each publisher.
- Linkup is called server-side only; no credential belongs in browser code or output artifacts.
- Linkup results are retrieved at run time, but the search result payload may not contain a reliable publication timestamp. Treat them as current research leads unless the cited source verifies freshness.
- The post creator must preserve source attribution and stated uncertainty.
