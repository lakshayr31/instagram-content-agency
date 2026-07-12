import assert from "node:assert/strict";
import test from "node:test";

import { buildLinkupQuery, createContentFetcherPersona, loadContentFetcherPersona } from "../../src/content-fetcher/persona.js";

test("builds a bounded research query from the configured agency persona", () => {
  const persona = createContentFetcherPersona({
    niche: "sustainable fashion",
    audience: "ethical fashion shoppers",
    rssSources: [],
  });

  const query = buildLinkupQuery(persona);

  assert.match(query, /sustainable fashion/i);
  assert.match(query, /ethical fashion shoppers/i);
  assert.match(query, /evergreen, controversial, or growth/i);
  assert.match(query, /source URL/i);
});

test("rejects a persona without a niche or audience", () => {
  assert.throws(() => createContentFetcherPersona({ niche: "", audience: "creators", rssSources: [] }), /niche/i);
  assert.throws(() => createContentFetcherPersona({ niche: "fitness", audience: "", rssSources: [] }), /audience/i);
});

test("loads the persona and RSS sources from server-side environment values", () => {
  const persona = loadContentFetcherPersona({
    CONTENT_NICHE: "creator economy",
    CONTENT_AUDIENCE: "independent creators",
    RSS_FEED_URLS: "https://publisher.example/feed.xml, https://news.example/rss",
  });

  assert.deepEqual(persona, {
    niche: "creator economy",
    audience: "independent creators",
    rssSources: [
      { name: "publisher.example", url: "https://publisher.example/feed.xml" },
      { name: "news.example", url: "https://news.example/rss" },
    ],
  });
});
