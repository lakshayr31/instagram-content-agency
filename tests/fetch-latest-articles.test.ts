import assert from "node:assert/strict";
import test from "node:test";

import { fetchLatestArticles } from "../src/fetch-latest-articles.js";

test("returns only articles published within the last two hours for every configured source", async () => {
  const now = new Date("2026-07-12T12:00:00.000Z");
  const articles = await fetchLatestArticles(
    [
      { name: "publisher-a", url: "https://publisher-a.example/feed.xml" },
      { name: "publisher-b", url: "https://publisher-b.example/feed.xml" },
    ],
    {
      now,
      parser: {
        parseURL: async (url) => ({
          items: [{
            title: url.includes("publisher-a") ? "Recent A" : "Recent B",
            link: `${url}/article`,
            pubDate: url.includes("publisher-a")
              ? "2026-07-12T10:01:00.000Z"
              : "2026-07-12T09:59:59.000Z",
          }],
        }),
      },
      resolveUrl: async (url) => url,
      alreadySeen: async () => false,
    },
  );

  assert.deepEqual(articles.map((article) => article.title), ["Recent A"]);
});
