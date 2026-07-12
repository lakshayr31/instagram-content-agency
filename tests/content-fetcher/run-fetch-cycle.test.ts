import assert from "node:assert/strict";
import test from "node:test";

import { runContentFetchCycle } from "../../src/content-fetcher/run-fetch-cycle.js";
import { createContentFetcherPersona } from "../../src/content-fetcher/persona.js";

const item = {
  id: "rss:https://publisher.example/article",
  source: "rss" as const,
  sourceUrl: "https://publisher.example/article",
  sourceLabel: "publisher.example",
  title: "One article",
  summary: "Source material",
  topics: [],
};

test("combines RSS and Linkup results and removes duplicate URLs", async () => {
  const persona = createContentFetcherPersona({
    niche: "creator economy",
    audience: "independent creators",
    rssSources: [{ name: "publisher", url: "https://publisher.example/feed.xml" }],
  });

  const articles = await runContentFetchCycle(persona, {
    fetchRss: async () => [item],
    fetchLinkup: async () => [
      item,
      { ...item, id: "linkup:https://second.example/article", source: "linkup", sourceUrl: "https://second.example/article" },
    ],
  });

  assert.deepEqual(articles.map((article) => article.sourceUrl), [
    "https://publisher.example/article",
    "https://second.example/article",
  ]);
});
