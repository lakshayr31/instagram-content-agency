# Instagram Content Agency

A general-purpose, source-backed content intelligence foundation for an Instagram management agency. It is intentionally not tied to F1: each client supplies an audience and focus topics.

## Current vertical slice

1. **Content Fetcher** normalizes RSS articles into a common `ContentItem` shape with a canonical source URL, source label, title, summary, timestamp, and topics.
2. **Strategist** scores each item for a client brief and returns `important`, `watch`, or `ignore`, plus a rationale and suggested Instagram angle.

The implemented source adapters are:
- `src/rss-adapter.ts`: RSS fetching, source-level fault isolation, optional Google News redirect resolution, blocked-URL filtering, and injectable duplicate checking.
- `src/fetch-latest-articles.ts`: backend ingestion hook that restricts every configured source to the latest two hours.
- Linkup operator-initiated web research (server-side only; adapter to be added next)

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
RSS_FEED_URLS=https://publisher.example/feed.xml
```

Never place these values in client-side code, commit them, or send them in a chat message.

## Development

```bash
npm install
npm test
npm run typecheck
```

## Demo promise

An agency operator can collect cited, recent source items and receive a transparent recommendation about whether each is worth turning into an Instagram post for a specific client audience.
