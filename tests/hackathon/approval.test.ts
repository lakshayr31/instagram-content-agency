import assert from "node:assert/strict";
import { mkdtemp, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { approveAndExport } from "../../src/hackathon/approval.js";

test("requires an explicit approval flag before exporting a reviewed reel", async () => {
  const root = await mkdtemp(join(tmpdir(), "agency-approval-"));
  const runDirectory = join(root, "run_demo");
  const exportDirectory = join(root, "phone");
  await writeFile(join(root, "run.json"), JSON.stringify({
    id: "run_demo",
    status: "awaiting_approval",
    review: { status: "pass", checks: [] },
    artifacts: [{ kind: "reel_video", path: join(runDirectory, "reel.mp4") }],
    trace: [],
  }));
  await assert.rejects(() => approveAndExport(join(root, "run.json"), exportDirectory, false), /approval/i);
});

test("copies an approved artifact directory and persists an export trace", async () => {
  const root = await mkdtemp(join(tmpdir(), "agency-approved-"));
  const runDirectory = join(root, "run_demo");
  const reelDirectory = join(runDirectory, "reel");
  const exportDirectory = join(root, "phone");
  await (await import("node:fs/promises")).mkdir(reelDirectory, { recursive: true });
  await writeFile(join(reelDirectory, "reel.mp4"), "demo");
  const runPath = join(runDirectory, "run.json");
  await writeFile(runPath, JSON.stringify({
    id: "run_demo",
    status: "awaiting_approval",
    review: { status: "pass", checks: [] },
    artifacts: [{ kind: "reel_video", path: join(reelDirectory, "reel.mp4") }],
    trace: [],
  }));

  const result = await approveAndExport(runPath, exportDirectory, true);

  assert.equal(result.status, "exported");
  await access(join(exportDirectory, "run_demo", "reel", "reel.mp4"));
});
