import assert from "node:assert/strict";
import test from "node:test";

import { runContentIntelligenceCycle } from "../src/content-intelligence-cycle.js";
import { createContentFetcherPersona } from "../src/content-fetcher/persona.js";

const item = {
  id: "linkup:https://publisher.example/article",
  source: "linkup" as const,
  sourceUrl: "https://publisher.example/article",
  sourceLabel: "publisher.example",
  title: "How to grow in the creator economy",
  summary: "A practical guide for independent creators.",
  publishedAt: new Date().toISOString(),
  topics: [],
};

test("turns fetched articles into post opportunities with a post type", async () => {
  const persona = createContentFetcherPersona({
    niche: "creator economy",
    audience: "independent creators",
    rssSources: [],
  });

  const opportunities = await runContentIntelligenceCycle(persona, {
    fetchRss: async () => [],
    fetchLinkup: async () => [item],
  });

  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0]?.assessment.verdict, "important");
  assert.equal(opportunities[0]?.assessment.postType, "growth");
});

test("uses each niche component as a strategist focus topic", async () => {
  const persona = createContentFetcherPersona({
    niche: "creator economy and Instagram",
    audience: "independent creators",
    rssSources: [],
  });

  const opportunities = await runContentIntelligenceCycle(persona, {
    fetchRss: async () => [],
    fetchLinkup: async () => [{ ...item, publishedAt: undefined }],
  });

  assert.equal(opportunities[0]?.assessment.verdict, "watch");
});
