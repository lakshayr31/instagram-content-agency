# Instagram Content Agency

A general-purpose, source-backed content intelligence foundation for an Instagram management agency. It is intentionally not tied to F1: each client supplies an audience and focus topics.

## Current vertical slices

### Content intelligence foundation

1. **Content Fetcher** normalizes RSS articles into a common `ContentItem` shape with a canonical source URL, source label, title, summary, timestamp, and topics.
2. **Strategist** scores each item for a client brief, then labels the resulting opportunity as `evergreen`, `controversial`, or `growth` with a rationale and suggested Instagram angle.
3. **Creative Producer** receives an approved, fact-scoped item and writes the actual selected Instagram asset: carousel slide copy, static-post copy, or a reel script with caption and production direction.

### Hackathon agency slate

`npm run hackathon:latest-f1` is the current proof path: fresh F1 research → Manager → Strategist → one post, carousel, and reel → Manager review/rework → real rendered assets → Poster packages → durable dashboard and approval gate.

The implemented source adapters are:
- `src/content-fetcher/rss-adapter.ts`: RSS fetching, source-level fault isolation, optional Google News redirect resolution, blocked-URL filtering, and injectable duplicate checking.
- `src/content-fetcher/fetch-latest-articles.ts`: backend ingestion hook that restricts every configured source to the latest two hours.
- `src/strategist/assess-content-item.ts`: audience-aware `important` / `watch` / `ignore` scoring plus evergreen / controversial / growth post-type classification.
- `src/content-fetcher/linkup-adapter.ts`: server-only Linkup retrieval with source URLs preserved.
- `src/content-intelligence-cycle.ts`: orchestration layer that combines RSS and Linkup, removes duplicate URLs, and produces post opportunities.

The RSS adapter is deliberately storage-agnostic. A future database layer supplies the `alreadySeen(url)` dependency, rather than coupling ingestion to a specific provider.

## Credentials

Secrets belong only in `.env.local`, which is excluded by `.gitignore`.

```bash
cd /Users/lakshayr/instagram-content-agency
# Open the already-created local secrets file and add your real key.
open -e .env.local
```

Set:

```dotenv
LINKUP_API_KEY=your_real_linkup_key
ELEVENLABS_API_KEY=your_real_elevenlabs_key
ELEVENLABS_VOICE_ID=your_elevenlabs_voice_id
CONTENT_NICHE=creator economy and Instagram
CONTENT_AUDIENCE=independent creators and small brands
RSS_FEED_URLS=https://publisher.example/feed.xml
```

Run one operator-controlled cycle with:

```bash
npm run fetch:cycle
```

The command uses the configured persona, retrieves only the latest two hours from each RSS source, runs a Linkup research query, deduplicates cited URLs, and emits post opportunities.

Create a publish-ready creative execution from an approved, fact-scoped handoff with:

```bash
npm run creative:produce -- post-creator-persona/creative-producer-smoke-input.json
```

The command invokes the Creative Producer persona through Hermes, validates the structured response, and prints the complete carousel/post/reel copy and production handoff as JSON.

## Live Cloudflare app

The public no-tunnel prototype is deployed at:

```text
https://instagram-content-agency.rastogilakshay31.workers.dev
```

It is a single Cloudflare Worker + Static Assets deployment. The browser never receives OpenAI, Linkup, or ElevenLabs credentials. The Worker stores sessions, runs, explicit approvals, and page-level feedback memory in D1.

The live flow is:

```text
email signup → Manager brief confirmation → sourced idea approval
→ script approval → downloadable post/carousel/reel assets
```

The Manager waits at both review gates. Feedback is stored as run memory and supplied to later Strategist/Producer calls. The reel download is an animated WebM rendered in-browser; the narration endpoint uses ElevenLabs only when server-side credentials are configured. The app does not claim external publishing.

## Latest F1 three-format slate

To run fresh RSS + Linkup research and ask the Strategist for exactly one post, carousel, and reel, use:

```bash
npm run research:f1-publisher
npm run hackathon:latest-f1
```

The latest-slate runner invokes the Manager, Strategist, three Creative Producer runs, Poster, Designer, and Video & Audio Manager. The Manager reviews the full slate and can request one retry before assets are rendered. A successful run writes a single rendered output folder under `artifacts/latest-f1-slate/` containing:

- one post PNG plus poster package;
- one carousel PNG sequence plus poster package;
- one captioned vertical MP4, audio file, captions, and poster package;
- Manager plan/review records, strategy records, agent trace, citations, and `dashboard.html`.

It remains `awaiting_approval`; it does not publish or export externally without the explicit approval command.

## Hackathon proof run

Run the complete rubric-oriented agency tracer bullet with:

```bash
npm run hackathon:demo
```

This performs real Manager and Creative Producer Hermes calls, preserves the source/strategy/creative trace in a durable `run.json`, renders real carousel PNG frames, and produces a 1080×1920 MP4 with subtitles. The command prints the unique artifact directory under `artifacts/hackathon-demo/`; open its `dashboard.html` to inspect the Manager plan, agent/tool trace, source evidence, review state, and playable reel.

The Reel renderer calls ElevenLabs when both `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are available server-side. If either is absent, it uses an explicitly labelled macOS fallback. Inspect the run trace before claiming ElevenLabs narration; only a trace recording the ElevenLabs provider path is valid evidence.

The generated run remains `awaiting_approval`. To explicitly approve and copy it to a synced phone folder or other output directory:

```bash
npm run hackathon:approve -- artifacts/hackathon-demo/<run-id>/run.json /absolute/path/to/phone-sync-folder --approve
```

The approval command persists an approval/export trace and copies the complete run directory, including the MP4, audio, captions, carousel frames, and manifest. It cannot run without the explicit `--approve` flag.

## Development

```bash
npm install
npm test
npm run typecheck
```

## Demo promise

An agency operator can collect cited, recent source items and receive a transparent recommendation about whether each is worth turning into an Instagram post for a specific client audience.
