import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  createCreativeProducer,
  loadCreativeProducerPersona,
  type CreativeExecution,
  type CreativeProducerInput,
  validateCreativeExecution,
} from "./creative-producer/index.js";
import { renderCopyCards } from "./hackathon/artifacts.js";
import { runManager } from "./hackathon/manager.js";
import { addTrace, createCampaignRun, type ContentFormat } from "./hackathon/pipeline.js";
import { renderLocalNarratedReel } from "./hackathon/reel.js";
import { runHermesJson, runPoster, runThreeFormatStrategist, type FormatRecommendation } from "./hackathon/triple-pipeline.js";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const research = JSON.parse(await readFile(join(root, "artifacts", "f1-publisher-research.json"), "utf8")) as {
  generatedAt: string;
  rss: { articles: Array<{ sourceUrl: string; title: string; summary: string }> };
  linkupResearch: Array<{ articles: Array<{ sourceUrl: string; title: string; summary: string }> }>;
};
const runId = `latest_f1_${Date.now()}`;
const outputDirectory = join(root, "artifacts", "latest-f1-slate", runId);
const brief = {
  clientName: "F1 Context",
  audience: "Indian F1 fans seeking timely, useful, and debate-worthy content",
  brandVoice: "very simple, confident, never condescending",
  offer: "independent Formula 1 explainer and news page",
  objective: "saves, shares, and new-follower reach",
  boundaries: ["Use only supplied source facts", "Do not manufacture controversy", "No unsupported driver-transfer or performance claims"],
  topic: "latest Formula 1 developments",
};

function sourceCandidates(): Array<{ url: string; title: string; facts: string[]; summary: string }> {
  const items = [
    ...research.rss.articles,
    ...research.linkupResearch.flatMap((entry) => entry.articles),
  ].filter((item) => /formula.?1|\bf1\b|ferrari|mclaren|aston martin|mercedes|red bull|norris|verstappen/i.test(`${item.title} ${item.sourceUrl}`))
    .filter((item) => !/motogp/i.test(`${item.title} ${item.sourceUrl}`));
  const unique = new Map<string, { url: string; title: string; facts: string[]; summary: string }>();
  for (const item of items) {
    if (!unique.has(item.sourceUrl) && item.summary.trim()) {
      unique.set(item.sourceUrl, { url: item.sourceUrl, title: item.title, summary: item.summary, facts: [item.summary] });
    }
  }
  return [...unique.values()].slice(0, 12);
}

async function produceForFormat(recommendation: FormatRecommendation): Promise<CreativeExecution> {
  const input: CreativeProducerInput = {
    approvedContent: {
      category: recommendation.category,
      title: recommendation.title,
      coreMessage: recommendation.angle,
      sourceUrl: recommendation.sourceUrl,
      verifiedFacts: recommendation.verifiedFacts,
      requiredAngle: recommendation.angle,
    },
    clientBrief: {
      audience: brief.audience,
      brandVoice: brief.brandVoice,
      offer: brief.offer,
      boundaries: brief.boundaries,
      objective: brief.objective,
    },
  };
  const persona = await loadCreativeProducerPersona();
  for (let attempt = 1; attempt <= 2; attempt++) {
    const producer = createCreativeProducer(async () => {
      const prompt = `${persona}\n\nMANDATORY FORMAT: ${recommendation.format}. Do not choose another format. Create a publish-ready execution using only this approved handoff. Return JSON only.\n${JSON.stringify(input, null, 2)}`;
      return runHermesJson(prompt);
    });
    const execution = await producer.create(input);
    if (execution.format === recommendation.format) return execution;
  }
  throw new Error(`Creative Producer did not honor mandatory ${recommendation.format} output after two attempts.`);
}

function cardsForExecution(execution: CreativeExecution): Array<{ headline: string; body?: string; source?: string }> {
  const source = `Source: ${execution.factChecksRequired.length ? "verify before publish" : "approved source"}`;
  if (execution.format === "post") {
    return [{ headline: execution.exampleExecution.asset.postVisual?.onVisualCopy ?? execution.creativeBrief.hook, body: execution.exampleExecution.caption, source }];
  }
  if (execution.format === "carousel") {
    return (execution.exampleExecution.asset.carouselSlides ?? []).map((slide) => ({ headline: slide.onScreenCopy, body: slide.visual, source }));
  }
  return (execution.exampleExecution.asset.reelBeats ?? []).map((beat) => ({ headline: beat.spokenOrOnScreenCopy, body: beat.visual, source }));
}

function parseManagerReview(raw: string): { decision: "approve" | "rework"; reason: string } {
  const value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as { decision?: string; reason?: string };
  if ((value.decision !== "approve" && value.decision !== "rework") || typeof value.reason !== "string") throw new Error("Manager review returned invalid JSON.");
  return value as { decision: "approve" | "rework"; reason: string };
}

async function managerReview(slate: Array<{ recommendation: FormatRecommendation; execution: CreativeExecution }>): Promise<{ decision: "approve" | "rework"; reason: string }> {
  const prompt = `You are the Agency Manager. Review this latest-F1 three-format slate. Approve only if it has exactly one post, carousel, and reel; all outputs retain source URLs/facts; each output is distinct; and the outputs fit the brief. Return JSON only: {"decision":"approve|rework","reason":"string"}.\n${JSON.stringify({ brief, slate: slate.map(({ recommendation, execution }) => ({ recommendation, format: execution.format, hook: execution.creativeBrief.hook, caption: execution.exampleExecution.caption })) }, null, 2)}`;
  return parseManagerReview(await runHermesJson(prompt));
}

await mkdir(outputDirectory, { recursive: true });
const run = createCampaignRun(brief, runId);
const managerStarted = Date.now();
const manager = await runManager(brief);
addTrace(run, { role: "manager", status: "succeeded", summary: manager.campaignGoal, startedAt: new Date(managerStarted).toISOString(), finishedAt: new Date().toISOString(), latencyMs: Date.now() - managerStarted, outputRef: "manager-plan.json" });
await writeFile(join(outputDirectory, "manager-plan.json"), `${JSON.stringify(manager, null, 2)}\n`);

const candidates = sourceCandidates();
if (candidates.length < 3) throw new Error("Fresh F1 research did not produce enough cited source candidates.");
addTrace(run, { role: "sourcer", status: "succeeded", summary: `Fresh RSS + Linkup research from ${research.generatedAt} yielded ${candidates.length} usable F1 sources.`, outputRef: "../f1-publisher-research.json" });

let approvedSlate: Array<{ recommendation: FormatRecommendation; execution: CreativeExecution }> | undefined;
let reviewReason = "";
for (let attempt = 1; attempt <= 2; attempt++) {
  const strategyStarted = Date.now();
  const strategy = await runThreeFormatStrategist({ audience: brief.audience, objective: brief.objective, boundaries: brief.boundaries, sources: candidates });
  addTrace(run, { role: "strategist", status: "succeeded", summary: `Attempt ${attempt}: Strategist selected exactly one post, carousel, and reel from current F1 sources.`, startedAt: new Date(strategyStarted).toISOString(), finishedAt: new Date().toISOString(), latencyMs: Date.now() - strategyStarted, outputRef: `strategy-attempt-${attempt}.json` });
  await writeFile(join(outputDirectory, `strategy-attempt-${attempt}.json`), `${JSON.stringify(strategy, null, 2)}\n`);

  const slate: Array<{ recommendation: FormatRecommendation; execution: CreativeExecution }> = [];
  for (const recommendation of strategy.recommendations) {
    const started = Date.now();
    const execution = await produceForFormat(recommendation);
    addTrace(run, { role: "creative_producer", status: "succeeded", summary: `Produced required ${recommendation.format}: ${execution.creativeBrief.hook}`, startedAt: new Date(started).toISOString(), finishedAt: new Date().toISOString(), latencyMs: Date.now() - started, outputRef: `creative-${recommendation.format}.json` });
    await writeFile(join(outputDirectory, `creative-${recommendation.format}.json`), `${JSON.stringify(execution, null, 2)}\n`);
    slate.push({ recommendation, execution });
  }
  const review = await managerReview(slate);
  reviewReason = review.reason;
  addTrace(run, { role: "manager", status: review.decision === "approve" ? "succeeded" : "failed", summary: `Slate review attempt ${attempt}: ${review.decision}. ${review.reason}`, outputRef: `manager-review-${attempt}.json` });
  await writeFile(join(outputDirectory, `manager-review-${attempt}.json`), `${JSON.stringify(review, null, 2)}\n`);
  if (review.decision === "approve") {
    approvedSlate = slate;
    break;
  }
}
if (!approvedSlate) throw new Error(`Manager rejected both strategy attempts: ${reviewReason}`);

for (const { recommendation, execution } of approvedSlate) {
  const formatDirectory = join(outputDirectory, recommendation.format);
  const cards = cardsForExecution(execution);
  const pngs = await renderCopyCards(cards, formatDirectory, recommendation.format);
  if (recommendation.format === "reel") {
    const beats = execution.exampleExecution.asset.reelBeats;
    if (!beats) throw new Error("Approved reel execution has no beats.");
    const reel = await renderLocalNarratedReel(beats, pngs, formatDirectory);
    run.artifacts.push({ kind: "reel_audio", path: reel.audioPath }, { kind: "reel_video", path: reel.videoPath });
    addTrace(run, { role: "video_audio_manager", status: "succeeded", summary: reel.narrationProvider === "elevenlabs" ? "Rendered reel with ElevenLabs narration." : "Rendered reel with local narration fallback; ElevenLabs is not configured.", outputRef: reel.videoPath });
  } else {
    run.artifacts.push(...pngs.map((path) => ({ kind: "carousel_slide" as const, path })));
    addTrace(run, { role: "designer", status: "succeeded", summary: `Rendered ${pngs.length} real ${recommendation.format} PNG asset(s).`, outputRef: formatDirectory });
  }
  const poster = await runPoster({
    clientBrief: { audience: brief.audience, brandVoice: brief.brandVoice, objective: brief.objective, boundaries: brief.boundaries, timezone: "Asia/Kolkata" },
    approvedContent: { sourceUrl: recommendation.sourceUrl, verifiedFacts: recommendation.verifiedFacts, format: recommendation.format, hook: execution.creativeBrief.hook, callToAction: execution.creativeBrief.callToAction },
    asset: { pathOrUrl: formatDirectory, durationSeconds: recommendation.format === "reel" ? 30 : 0 },
    performanceContext: { knownBestWindows: [], notes: "No historical performance data supplied." },
  });
  await writeFile(join(formatDirectory, "poster.json"), `${JSON.stringify(poster, null, 2)}\n`);
  addTrace(run, { role: "poster", status: "succeeded", summary: `Poster prepared the ${recommendation.format} caption, accessibility copy, timing recommendation, and delivery checklist.`, outputRef: join(formatDirectory, "poster.json") });
}

run.review = { status: "pass", checks: [{ name: "manager_approved_slate", passed: true, detail: reviewReason }, { name: "three_formats", passed: true, detail: "Exactly one post, carousel, and reel rendered." }, { name: "fresh_research", passed: true, detail: `Research generated at ${research.generatedAt}.` }] };
run.status = "awaiting_approval";
addTrace(run, { role: "reviewer", status: "succeeded", summary: "Manager-approved three-format slate rendered. Awaiting explicit human approval before any external delivery.", outputRef: "run.json" });
await writeFile(join(outputDirectory, "run.json"), `${JSON.stringify(run, null, 2)}\n`);

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Latest F1 Agency Slate</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0b1020;color:#eef4ff;margin:0;padding:32px;max-width:1180px}h1{margin:0}.sub{color:#aab9d6}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:20px}.card{background:#151d33;border:1px solid #2c395b;border-radius:14px;padding:16px}.trace{border-left:3px solid #56b4ff;padding:8px 12px;margin:8px 0;background:#10182b}.ok{color:#7be0aa}.warn{color:#ffd176}img,video{width:100%;border-radius:10px;background:#000}a{color:#7fc9ff}</style></head><body><h1>Latest F1 Agency Slate</h1><p class="sub">Fresh research: ${research.generatedAt} · Manager-approved post + carousel + reel · ${run.status}</p><div class="grid">${approvedSlate.map(({ recommendation, execution }) => `<section class="card"><h2>${recommendation.format.toUpperCase()}</h2><p>${execution.creativeBrief.hook}</p><p class="sub">${recommendation.rationale}</p>${recommendation.format === "reel" ? `<video controls src="reel/reel.mp4"></video>` : `<img src="${recommendation.format}/01.png">`}<p><a href="${recommendation.format}/poster.json">Poster package</a> · <a href="creative-${recommendation.format}.json">Creative output</a></p></section>`).join("")}</div><section class="card"><h2>Manager and agent trace</h2>${run.trace.map((event) => `<div class="trace"><b>${event.role}</b> · ${event.status}<br><span class="sub">${event.summary}</span></div>`).join("")}</section><section class="card"><p class="warn">Human approval is still required before external delivery/export.</p><p><a href="run.json">Full run record</a> · <a href="manager-plan.json">Manager plan</a></p></section></body></html>`;
await writeFile(join(outputDirectory, "dashboard.html"), html, "utf8");
console.log(JSON.stringify({ runId, outputDirectory, status: run.status, formats: approvedSlate.map(({ recommendation }) => recommendation.format) }, null, 2));
