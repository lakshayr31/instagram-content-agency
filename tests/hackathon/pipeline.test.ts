import assert from "node:assert/strict";
import test from "node:test";

import {
  buildManagerPlan,
  canExport,
  createCampaignRun,
  type CampaignBrief,
} from "../../src/hackathon/pipeline.js";

const brief: CampaignBrief = {
  clientName: "F1 Context",
  audience: "Formula 1 fans seeking timely explainers",
  brandVoice: "clear, evidence-led, energetic",
  offer: "daily F1 context",
  objective: "saves and comments",
  boundaries: ["Use cited facts only", "No unsupported driver-transfer claims"],
  topic: "2026 F1 regulations",
};

test("creates a durable campaign run with a PM-visible intake trace", () => {
  const run = createCampaignRun(brief, "run_test");

  assert.equal(run.id, "run_test");
  assert.equal(run.status, "intake_complete");
  assert.equal(run.trace[0]?.role, "intake");
});

test("manager dynamically skips video production for a carousel", () => {
  const plan = buildManagerPlan("carousel");

  assert.deepEqual(plan.activeRoles, ["sourcer", "strategist", "creative_producer", "designer", "poster", "reviewer"]);
  assert.equal(plan.skippedRoles[0]?.role, "video_audio_manager");
});

test("manager dynamically skips design production for a reel", () => {
  const plan = buildManagerPlan("reel");

  assert.ok(plan.activeRoles.includes("video_audio_manager"));
  assert.ok(plan.skippedRoles.some((role) => role.role === "designer"));
});

test("blocks export before reviewer pass and human approval", () => {
  const run = createCampaignRun(brief, "run_blocked");

  assert.equal(canExport(run), false);
  run.review = { status: "pass", checks: [] };
  run.artifacts = [{ kind: "carousel_slide", path: "/tmp/slide-01.png" }];
  assert.equal(canExport(run), false);
  run.approvedAt = new Date().toISOString();
  assert.equal(canExport(run), true);
});
