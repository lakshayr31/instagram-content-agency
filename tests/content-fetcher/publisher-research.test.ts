import assert from "node:assert/strict";
import test from "node:test";

import { researchWithLinkupQuestions } from "../../src/content-fetcher/publisher-research.js";

test("runs every publisher question and preserves its source-backed results", async () => {
  const calls: string[] = [];
  const research = await researchWithLinkupQuestions(
    ["Latest F1 developments", "What is trending in F1", "What F1 debates are active"],
    {
      search: async (question) => {
        calls.push(question);
        return [{
          id: `linkup:https://publisher.example/${calls.length}`,
          source: "linkup" as const,
          sourceUrl: `https://publisher.example/${calls.length}`,
          sourceLabel: "publisher.example",
          title: question,
          summary: "Cited source material",
          topics: [],
        }];
      },
    },
  );

  assert.deepEqual(calls, ["Latest F1 developments", "What is trending in F1", "What F1 debates are active"]);
  assert.equal(research.length, 3);
  assert.equal(research[2]?.articles[0]?.sourceUrl, "https://publisher.example/3");
});
