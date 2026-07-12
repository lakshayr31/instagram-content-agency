import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { loadElevenLabsConfig, synthesizeElevenLabsSpeech } from "./reel/elevenlabs.js";

const execFileAsync = promisify(execFile);
const outputDirectory = join("artifacts", "aduo-reel-v3");
const palette = { background: "#07151E", ink: "#F4FAFA", accent: "#33D6C5", muted: "#A6C8CC" };
const narration = [
  "F1 has a 2026 engine catch-up rule called ADUO.",
  "It applies to power-unit manufacturers, not teams or drivers.",
  "The FIA compares combustion-engine performance, not the whole power unit.",
  "Two to under four percent behind earns one extra upgrade now and one next season.",
  "Four percent or more earns two each season.",
  "It is extra development chances, not instant pace. Save this for 2026.",
].join(" ");

const cards = [
  { kicker: "F1 RULES / 2026", headline: ["F1 HAS AN ENGINE", "CATCH-UP RULE"], body: ["It is called ADUO."], accent: "ADUO" },
  { kicker: "WHO QUALIFIES?", headline: ["MANUFACTURERS", "NOT TEAMS"], body: ["Power-unit manufacturers qualify.", "Drivers do not."], accent: "THE ENTITY" },
  { kicker: "WHAT IS MEASURED?", headline: ["ICE", "PERFORMANCE"], body: ["Not total power-unit performance."], accent: "NOT THE WHOLE PU" },
  { kicker: "BEHIND BY 2%–<4%?", headline: ["+1 NOW", "+1 NEXT SEASON"], body: ["One extra upgrade opportunity", "in each season."], accent: "LIMITED HELP" },
  { kicker: "BEHIND BY 4%+?", headline: ["+2 NOW", "+2 NEXT SEASON"], body: ["Two extra upgrade opportunities", "in each season."], accent: "BIGGER GAP" },
  { kicker: "THE SIMPLE VERSION", headline: ["A CHANCE TO", "CATCH UP"], body: ["Extra development chances.", "Not instant pace."], accent: "SAVE THIS" },
] as const;

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function lines(values: readonly string[], x: number, y: number, size: number, fill: string, weight = 700, lineHeight = 1.08): string {
  return values.map((value, index) => `<text x="${x}" y="${y + index * size * lineHeight}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(value)}</text>`).join("\n");
}

function createCardSvg(index: number): string {
  const card = cards[index];
  if (!card) throw new Error(`Missing reel card ${index}.`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E2D3A"/><stop offset="0.58" stop-color="${palette.background}"/><stop offset="1" stop-color="#02080C"/></linearGradient>
    <pattern id="grid" width="72" height="72" patternUnits="userSpaceOnUse"><path d="M72 0H0V72" fill="none" stroke="${palette.accent}" stroke-opacity="0.13" stroke-width="1"/></pattern>
  </defs>
  <rect width="1080" height="1920" fill="url(#shade)"/>
  <rect width="1080" height="1920" fill="url(#grid)"/>
  <rect x="72" y="190" width="120" height="10" rx="5" fill="${palette.accent}"/>
  <text x="72" y="260" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" letter-spacing="4" fill="${palette.muted}">${escapeXml(card.kicker)}</text>
  <text x="1008" y="260" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="${palette.muted}">${String(index + 1).padStart(2, "0")}/06</text>
  <text x="72" y="490" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="800" letter-spacing="3" fill="${palette.accent}">${escapeXml(card.accent)}</text>
  ${lines(card.headline, 72, 710, 94, palette.ink, 800)}
  ${lines(card.body, 72, 1090, 52, palette.muted, 500, 1.35)}
  <line x1="72" y1="1450" x2="1008" y2="1450" stroke="${palette.accent}" stroke-opacity="0.6" stroke-width="3"/>
  <text x="72" y="1545" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="600" fill="${palette.muted}">Source: Formula1.com / ADUO explainer</text>
  <text x="72" y="1635" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" fill="${palette.ink}">F1 RULES, SIMPLY EXPLAINED</text>
</svg>`;
}

async function audioDuration(audioPath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audioPath]);
  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Could not determine narration duration.");
  return duration;
}

async function main(): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  const audioPath = join(outputDirectory, "narration.mp3");
  const videoPath = join(outputDirectory, "aduo-explainer-reel-v3.mp4");
  const audio = await synthesizeElevenLabsSpeech(loadElevenLabsConfig(), narration);
  await writeFile(audioPath, audio);

  const duration = await audioDuration(audioPath);
  if (duration > 30 || duration < 10) throw new Error(`Narration is ${duration.toFixed(1)} seconds; reel must be 10–30 seconds.`);
  const segmentDuration = duration / cards.length;
  const framePaths: string[] = [];
  for (let index = 0; index < cards.length; index += 1) {
    const svgPath = join(outputDirectory, `card-${String(index + 1).padStart(2, "0")}.svg`);
    const pngPath = join(outputDirectory, `card-${String(index + 1).padStart(2, "0")}.png`);
    await writeFile(svgPath, createCardSvg(index), "utf8");
    await execFileAsync("sips", ["-s", "format", "png", svgPath, "--out", pngPath]);
    framePaths.push(pngPath);
  }

  const inputs = framePaths.flatMap((path) => ["-loop", "1", "-t", segmentDuration.toFixed(3), "-i", path]);
  const filtered = framePaths.map((_, index) => `[${index}:v]setsar=1[v${index}]`).join(";");
  const concat = framePaths.map((_, index) => `[v${index}]`).join("");
  await execFileAsync("ffmpeg", [
    "-y", ...inputs, "-i", audioPath,
    "-filter_complex", `${filtered};${concat}concat=n=${framePaths.length}:v=1:a=0,format=yuv420p[v]`,
    "-map", "[v]", "-map", `${framePaths.length}:a`, "-t", duration.toFixed(3), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", videoPath,
  ], { maxBuffer: 2_000_000 });

  await writeFile(join(outputDirectory, "manifest.json"), `${JSON.stringify({
    kind: "reel_video", durationSeconds: duration, narration: "ElevenLabs", audioTreatment: "voiceover", visualTreatment: "original text cards", videoPath,
  }, null, 2)}\n`, "utf8");
  process.stdout.write(`${videoPath}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
