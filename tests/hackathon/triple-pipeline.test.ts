import assert from "node:assert/strict";
import test from "node:test";

import { parseThreeFormatStrategy } from "../../src/hackathon/triple-pipeline.js";

test("requires exactly one post, carousel, and reel recommendation", () => {
  const result = parseThreeFormatStrategy(JSON.stringify({
    recommendations: [
      { format: "post", sourceUrl: "https://example.com/post", category: "growth", title: "Post", angle: "One claim", verifiedFacts: ["Fact"], rationale: "Why" },
      { format: "carousel", sourceUrl: "https://example.com/carousel", category: "evergreen", title: "Carousel", angle: "Steps", verifiedFacts: ["Fact"], rationale: "Why" },
      { format: "reel", sourceUrl: "https://example.com/reel", category: "controversial", title: "Reel", angle: "Debate", verifiedFacts: ["Fact"], rationale: "Why" },
    ],
  }));

  assert.deepEqual(result.recommendations.map((item) => item.format), ["post", "carousel", "reel"]);
});

test("rejects strategy output that duplicates a format", () => {
  assert.throws(() => parseThreeFormatStrategy(JSON.stringify({
    recommendations: [
      { format: "post", sourceUrl: "https://example.com/a", category: "growth", title: "A", angle: "A", verifiedFacts: ["Fact"], rationale: "Why" },
      { format: "post", sourceUrl: "https://example.com/b", category: "growth", title: "B", angle: "B", verifiedFacts: ["Fact"], rationale: "Why" },
      { format: "reel", sourceUrl: "https://example.com/c", category: "growth", title: "C", angle: "C", verifiedFacts: ["Fact"], rationale: "Why" },
    ],
  })), /exactly one/i);
});
