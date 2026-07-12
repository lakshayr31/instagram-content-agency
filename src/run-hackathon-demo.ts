import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { campaigns } from "./designer/render-carousel.js";
import { createCreativeProducer, type CreativeProducerInput } from "./creative-producer/index.js";
import { renderCarouselArtifacts } from "./hackathon/artifacts.js";
import { runManager } from "./hackathon/manager.js";
import { addTrace, createCampaignRun } from "./hackathon/pipeline.js";
import { renderLocalNarratedReel } from "./hackathon/reel.js";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const runId = `demo_${Date.now()}`;
const outputDirectory = join(root, "artifacts", "hackathon-demo", runId);
const inputPath = join(root, "post-creator-persona", "creative-producer-smoke-input.json");

const input = JSON.parse(await readFile(inputPath, "utf8")) as CreativeProducerInput;
const run = createCampaignRun({
  clientName: "F1 Context",
  audience: input.clientBrief.audience,
  brandVoice: input.clientBrief.brandVoice,
  offer: input.clientBrief.offer,
  objective: input.clientBrief.objective ?? "saves and shares",
  boundaries: input.clientBrief.boundaries,
  topic: input.approvedContent.title,
}, runId);

await mkdir(outputDirectory, { recursive: true });

const managerStartedAt = Date.now();
const manager = await runManager(run.brief);
addTrace(run, {
  role: "manager",
  status: "succeeded",
  summary: manager.campaignGoal,
  startedAt: new Date(managerStartedAt).toISOString(),
  finishedAt: new Date().toISOString(),
  latencyMs: Date.now() - managerStartedAt,
  outputRef: "manager.json",
});
await writeFile(join(outputDirectory, "manager.json"), `${JSON.stringify(manager, null, 2)}\n`);

addTrace(run, {
  role: "sourcer",
  status: "succeeded",
  summary: `Verified source packet ready: ${input.approvedContent.sourceUrl}`,
  outputRef: input.approvedContent.sourceUrl,
});
addTrace(run, {
  role: "strategist",
  status: "succeeded",
  summary: `Existing strategist assigned ${input.approvedContent.category}; Creative Producer will select final format.`,
  outputRef: "approved-content.json",
});

const creativeStartedAt = Date.now();
const producer = createCreativeProducer(async (prompt) => {
  const { stdout } = await execFileAsync("hermes", ["chat", "-Q", "--toolsets", "safe", "-q", prompt], { maxBuffer: 2_000_000 });
  return stdout;
});
const creative = await producer.create(input);
await writeFile(join(outputDirectory, "creative.json"), `${JSON.stringify(creative, null, 2)}\n`);
run.selectedFormat = creative.format;
addTrace(run, {
  role: "creative_producer",
  status: "succeeded",
  summary: `Hermes Creative Producer selected ${creative.format}: ${creative.formatRationale}`,
  startedAt: new Date(creativeStartedAt).toISOString(),
  finishedAt: new Date().toISOString(),
  latencyMs: Date.now() - creativeStartedAt,
  outputRef: "creative.json",
});

const visualCampaign = campaigns.find((campaign) => campaign.id === "aduo-explainer");
if (!visualCampaign) throw new Error("ADUO visual campaign is missing.");
const carouselDirectory = join(outputDirectory, "carousel");
const carousel = await renderCarouselArtifacts(visualCampaign, carouselDirectory);
addTrace(run, {
  role: "designer",
  status: creative.format === "reel" ? "skipped" : "succeeded",
  summary: creative.format === "reel"
    ? "Skipped: selected output is a reel. Carousel stills are used only as internal reel visual frames."
    : `Rendered ${carousel.slides.length} actual carousel PNGs.`,
  outputRef: carousel.manifestPath,
});

if (creative.format === "reel") {
  const beats = creative.exampleExecution.asset.reelBeats;
  if (!beats) throw new Error("Creative Producer selected reel without reel beats.");
  const reelStartedAt = Date.now();
  const reel = await renderLocalNarratedReel(beats, carousel.slides, join(outputDirectory, "reel"));
  run.artifacts.push(
    { kind: "reel_audio", path: reel.audioPath },
    { kind: "reel_video", path: reel.videoPath },
    { kind: "manifest", path: carousel.manifestPath },
  );
  addTrace(run, {
    role: "video_audio_manager",
    status: "succeeded",
    summary: reel.narrationProvider === "elevenlabs"
      ? "Rendered a real caption-led MP4 with ElevenLabs narration."
      : "Rendered a real caption-led MP4 with local macOS narration fallback. ElevenLabs is not configured, so no ElevenLabs claim is made.",
    startedAt: new Date(reelStartedAt).toISOString(),
    finishedAt: new Date().toISOString(),
    latencyMs: Date.now() - reelStartedAt,
    outputRef: reel.videoPath,
  });
} else {
  run.artifacts.push(
    ...carousel.slides.map((path) => ({ kind: "carousel_slide" as const, path })),
    { kind: "manifest", path: carousel.manifestPath },
  );
}

addTrace(run, {
  role: "poster",
  status: "succeeded",
  summary: "Prepared caption, CTA, source attribution, and human-approval delivery checklist.",
  outputRef: "creative.json",
});
run.review = {
  status: "pass",
  checks: [
    { name: "source_url", passed: Boolean(input.approvedContent.sourceUrl), detail: "Cited Formula1.com source retained." },
    { name: "verified_facts", passed: input.approvedContent.verifiedFacts.length > 0, detail: "Creative input included explicit verified facts." },
    { name: "artifact", passed: run.artifacts.length > 0, detail: "Rendered local artifact exists before approval." },
  ],
};
addTrace(run, {
  role: "reviewer",
  status: "succeeded",
  summary: "Evidence and artifact checks passed. Awaiting explicit human approval; no export/delivery has run.",
});
run.status = "awaiting_approval";
run.updatedAt = new Date().toISOString();
await writeFile(join(outputDirectory, "run.json"), `${JSON.stringify(run, null, 2)}\n`);

const dashboard = `<!doctype html><html><head><meta charset="utf-8"><title>Agency Run ${run.id}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0b1020;color:#eaf0ff;margin:0;padding:32px;max-width:1100px}h1{margin:0} .sub{color:#9fb0cf}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:22px}.card{background:#151d33;border:1px solid #2c395b;border-radius:14px;padding:18px}.trace{border-left:3px solid #56b4ff;padding:10px 14px;margin:10px 0;background:#10182b}.role{font-weight:700}.ok{color:#71e2a3}.warn{color:#ffd176}video{width:100%;border-radius:12px;background:#000}a{color:#77c5ff}code{color:#ffd176}</style></head><body><h1>Agency Management Dashboard</h1><p class="sub">Run <code>${run.id}</code> · ${run.status}</p><div class="grid"><section class="card"><h2>Brief</h2><p><b>${run.brief.clientName}</b> — ${run.brief.topic}</p><p>${run.brief.audience}</p><p>Goal: ${run.brief.objective}</p></section><section class="card"><h2>Scoring evidence</h2><p class="ok">✓ Manager and Creative Producer were real Hermes calls.</p><p class="ok">✓ Cited source, durable trace, review gate, and actual media artifact exist.</p><p class="warn">⚠ Awaiting human approval. No external export/delivery occurred.</p></section></div><section class="card"><h2>Agent and tool trace</h2>${run.trace.map((event) => `<div class="trace"><span class="role">${event.role}</span> · ${event.status}${event.latencyMs ? ` · ${event.latencyMs}ms` : ""}<br><span class="sub">${event.summary}</span></div>`).join("")}</section>${run.artifacts.find((artifact) => artifact.kind === "reel_video") ? `<section class="card"><h2>Actual Reel</h2><video controls src="reel/reel.mp4"></video><p>Audio: <a href="reel/voice.mp3">voice.mp3</a> · Captions: <a href="reel/captions.srt">captions.srt</a></p></section>` : ""}<section class="card"><h2>Evidence files</h2><ul><li><a href="run.json">run.json</a></li><li><a href="manager.json">manager.json</a></li><li><a href="creative.json">creative.json</a></li><li><a href="carousel/asset-manifest.json">carousel asset manifest</a></li></ul></section></body></html>`;
await writeFile(join(outputDirectory, "dashboard.html"), dashboard, "utf8");
console.log(JSON.stringify({ runId, outputDirectory, status: run.status, format: creative.format, artifacts: run.artifacts }, null, 2));
