# Instagram Content Agency

A general-purpose, source-backed content intelligence foundation for an Instagram management agency. It is intentionally not tied to F1: each client supplies an audience and focus topics.

## Current vertical slice

1. **Content Fetcher** normalizes RSS articles into a common `ContentItem` shape with a canonical source URL, source label, title, summary, timestamp, and topics.
2. **Strategist** scores each item for a client brief and returns `important`, `watch`, or `ignore`, plus a rationale and suggested Instagram angle.

The next source adapters will be:
- Linkup operator-initiated web research (server-side only)
- RSS feed fetching/parsing

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
