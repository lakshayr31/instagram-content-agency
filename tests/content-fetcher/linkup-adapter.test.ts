import assert from "node:assert/strict";
import test from "node:test";

import { fetchLinkupArticles } from "../../src/content-fetcher/linkup-adapter.js";

test("sends an authenticated Linkup search and normalizes its cited results", async () => {
  let request: Request | undefined;
  const articles = await fetchLinkupArticles("recent creator economy news", {
    apiKey: "test-key",
    now: new Date("2026-07-12T12:00:00.000Z"),
    fetch: async (input, init) => {
      request = new Request(input, init);
      return new Response(JSON.stringify({
        results: [{
          name: "Creator economy report",
          url: "https://publisher.example/report",
          content: "A cited research result for creators.",
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  assert.equal(request?.headers.get("authorization"), "Bearer test-key");
  assert.deepEqual(await request?.json(), {
    q: "recent creator economy news",
    depth: "standard",
    outputType: "searchResults",
  });
  assert.deepEqual(articles, [{
    id: "linkup:https://publisher.example/report",
    source: "linkup",
    sourceUrl: "https://publisher.example/report",
    sourceLabel: "publisher.example",
    title: "Creator economy report",
    summary: "A cited research result for creators.",
    publishedAt: undefined,
    fetchedAt: "2026-07-12T12:00:00.000Z",
    topics: [],
  }]);
});

test("fails closed when Linkup credentials are absent", async () => {
  await assert.rejects(() => fetchLinkupArticles("test", { apiKey: "" }), /LINKUP_API_KEY/i);
});
