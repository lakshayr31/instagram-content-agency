# Instagram Content Agency

A general-purpose, source-backed content intelligence foundation for an Instagram management agency. It is intentionally not tied to F1: each client supplies an audience and focus topics.

## Current vertical slice

1. **Content Fetcher** normalizes RSS articles into a common `ContentItem` shape with a canonical source URL, source label, title, summary, timestamp, and topics.
2. **Strategist** scores each item for a client brief, then labels the resulting opportunity as `evergreen`, `controversial`, or `growth` with a rationale and suggested Instagram angle.

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
CONTENT_NICHE=creator economy and Instagram
CONTENT_AUDIENCE=independent creators and small brands
RSS_FEED_URLS=https://publisher.example/feed.xml
```

Run one operator-controlled cycle with:

```bash
npm run fetch:cycle
```

The command uses the configured persona, retrieves only the latest two hours from each RSS source, runs a Linkup research query, deduplicates cited URLs, and emits post opportunities.

## Development

```bash
npm install
npm test
npm run typecheck
```

## Demo promise

An agency operator can collect cited, recent source items and receive a transparent recommendation about whether each is worth turning into an Instagram post for a specific client audience.
