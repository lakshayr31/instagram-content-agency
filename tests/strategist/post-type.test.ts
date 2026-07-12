import assert from "node:assert/strict";
import test from "node:test";

import { classifyPostType } from "../../src/strategist/assess-content-item.js";

const baseItem = {
  id: "rss:https://publisher.example/article",
  source: "rss" as const,
  sourceUrl: "https://publisher.example/article",
  sourceLabel: "publisher.example",
  publishedAt: new Date().toISOString(),
  topics: [],
};

test("labels debate-driven stories as controversial", () => {
  assert.equal(classifyPostType({ ...baseItem, title: "Creator backlash sparks debate", summary: "Two experts disagree." }), "controversial");
});

test("labels practical teaching stories as growth", () => {
  assert.equal(classifyPostType({ ...baseItem, title: "How to build a content calendar", summary: "Five practical lessons." }), "growth");
});

test("labels enduring context stories as evergreen", () => {
  assert.equal(classifyPostType({ ...baseItem, title: "The history of creator-led brands", summary: "Context for the industry." }), "evergreen");
});
