import assert from "node:assert/strict";
import test from "node:test";

import { parseManagerResponse } from "../../src/hackathon/manager.js";

test("accepts a structured manager plan with explicit skipped roles", () => {
  const plan = parseManagerResponse(JSON.stringify({
    status: "ready",
    campaignGoal: "Explain a regulation",
    tasks: [{ role: "sourcer", required: true, dependsOn: [], objective: "Find source", successCriteria: ["URL"] }],
    skippedRoles: [{ role: "designer", reason: "Reel selected" }],
    approvalGate: { required: true, conditions: ["human operator approval"] },
    risks: [],
    blockedReason: null,
  }));

  assert.equal(plan.status, "ready");
  assert.equal(plan.tasks[0]?.role, "sourcer");
});

test("rejects non-json manager output", () => {
  assert.throws(() => parseManagerResponse("I have a plan"), /JSON/i);
});
