import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRssItem } from "../src/content-fetcher.js";

test("normalizes a valid RSS item into the agency content-item format", () => {
  const item = normalizeRssItem({
    title: "Creator economy trends for 2026",
    link: "https://example.com/creator-economy",
    description: "A new report on creator-led media.",
    pubDate: "2026-07-12T10:00:00.000Z",
  }, "https://example.com/feed.xml");

  assert.deepEqual(item, {
    id: "rss:https://example.com/creator-economy",
    source: "rss",
    sourceUrl: "https://example.com/creator-economy",
    sourceLabel: "example.com",
    title: "Creator economy trends for 2026",
    summary: "A new report on creator-led media.",
    publishedAt: "2026-07-12T10:00:00.000Z",
    fetchedAt: undefined,
    topics: [],
  });
});

test("rejects an RSS item without a public article URL", () => {
  assert.throws(
    () => normalizeRssItem({ title: "Missing URL" }, "https://example.com/feed.xml"),
    /public article URL/i,
  );
});
