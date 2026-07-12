import assert from "node:assert/strict";
import test from "node:test";

import { assessContentItem } from "../src/strategist/assess-content-item.js";

test("prioritizes timely, audience-relevant content", () => {
  const assessment = assessContentItem({
    id: "rss:https://example.com/a",
    source: "rss",
    sourceUrl: "https://example.com/a",
    sourceLabel: "example.com",
    title: "Instagram introduces a creator feature",
    summary: "A feature relevant to social-media creators.",
    publishedAt: new Date().toISOString(),
    topics: ["instagram", "creators"],
  }, {
    audience: "independent creators and small brands",
    focusTopics: ["instagram", "creator economy"],
  });

  assert.equal(assessment.verdict, "important");
  assert.ok(assessment.score >= 70);
  assert.match(assessment.suggestedAngle, /Instagram/i);
});

test("ignores stale content with no stated audience relevance", () => {
  const assessment = assessContentItem({
    id: "rss:https://example.com/b",
    source: "rss",
    sourceUrl: "https://example.com/b",
    sourceLabel: "example.com",
    title: "Unrelated historic event",
    summary: "Archived information.",
    publishedAt: "2020-01-01T00:00:00.000Z",
    topics: ["history"],
  }, {
    audience: "independent creators and small brands",
    focusTopics: ["instagram", "creator economy"],
  });

  assert.equal(assessment.verdict, "ignore");
});
