import assert from "node:assert/strict";
import test from "node:test";

import { fetchRssSources } from "../src/rss-adapter.js";

test("fetches recent RSS items, resolves URLs, and omits duplicates and blocked URLs", async () => {
  const items = await fetchRssSources(
    [{ name: "creator-news", url: "https://news.google.com/rss/search?q=instagram&hl=en" }],
    {
      now: new Date("2026-07-12T12:00:00.000Z"),
      parser: {
        parseURL: async () => ({
          items: [
            { title: "Fresh item", link: "https://news.google.com/rss/articles/fresh", pubDate: "2026-07-12T10:00:00.000Z" },
            { title: "Duplicate", link: "https://news.google.com/rss/articles/duplicate", pubDate: "2026-07-12T10:00:00.000Z" },
            { title: "Forum thread", link: "https://news.google.com/rss/articles/forum", pubDate: "2026-07-12T10:00:00.000Z" },
            { title: "Stale", link: "https://news.google.com/rss/articles/stale", pubDate: "2026-07-10T10:00:00.000Z" },
          ],
        }),
      },
      resolveUrl: async (url) => ({
        "https://news.google.com/rss/articles/fresh": "https://publisher.example/fresh",
        "https://news.google.com/rss/articles/duplicate": "https://publisher.example/duplicate",
        "https://news.google.com/rss/articles/forum": "https://forums.example/thread",
        "https://news.google.com/rss/articles/stale": "https://publisher.example/stale",
      })[url] ?? null,
      alreadySeen: async (url) => url.endsWith("duplicate"),
      blockedUrlPatterns: [/^https:\/\/forums\.example\//],
    },
  );

  assert.deepEqual(items, [{
    id: "rss:https://publisher.example/fresh",
    source: "rss",
    sourceUrl: "https://publisher.example/fresh",
    sourceLabel: "creator-news",
    title: "Fresh item",
    summary: "",
    publishedAt: "2026-07-12T10:00:00.000Z",
    fetchedAt: "2026-07-12T12:00:00.000Z",
    topics: [],
  }]);
});

test("continues when one RSS source fails", async () => {
  const items = await fetchRssSources(
    [
      { name: "broken", url: "https://broken.example/feed" },
      { name: "healthy", url: "https://healthy.example/feed" },
    ],
    {
      now: new Date("2026-07-12T12:00:00.000Z"),
      parser: {
        parseURL: async (url) => {
          if (url.includes("broken")) throw new Error("network failure");
          return { items: [{ title: "Healthy", link: "https://healthy.example/article", pubDate: "2026-07-12T11:00:00.000Z" }] };
        },
      },
      resolveUrl: async (url) => url,
      alreadySeen: async () => false,
      blockedUrlPatterns: [],
    },
  );

  assert.equal(items.length, 1);
  assert.equal(items[0]?.sourceLabel, "healthy");
});
