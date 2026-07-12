import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  createCarouselSlideSvg,
  type CarouselCampaign,
} from "../designer/render-carousel.js";

const execFileAsync = promisify(execFile);

export interface CarouselArtifactResult {
  slides: string[];
  manifestPath: string;
}

export interface CopyCard {
  headline: string;
  body?: string;
  source?: string;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrap(value: string, width = 22): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > width && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

function createCopyCardSvg(card: CopyCard, label: string, index: number, count: number): string {
  const headline = wrap(card.headline).map((line, lineIndex) => `<text x="72" y="${430 + lineIndex * 95}" font-family="Arial, Helvetica, sans-serif" font-size="82" font-weight="800" fill="#F6FAFF">${escapeXml(line)}</text>`).join("");
  const body = wrap(card.body ?? "", 34).map((line, lineIndex) => `<text x="72" y="${830 + lineIndex * 54}" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="500" fill="#CBEAFF">${escapeXml(line)}</text>`).join("");
  const source = card.source ? `<text x="72" y="1254" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="600" fill="#CBEAFF">${escapeXml(card.source)}</text>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><rect width="1080" height="1350" fill="#071A2B"/><circle cx="930" cy="190" r="260" fill="#1675C8" opacity=".22"/><rect x="72" y="72" width="150" height="8" fill="#56B4FF"/><text x="72" y="124" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#CBEAFF">${escapeXml(label.toUpperCase())}</text><text x="1008" y="124" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#CBEAFF">${String(index + 1).padStart(2, "0")}/${String(count).padStart(2, "0")}</text>${headline}${body}<line x1="72" y1="1172" x2="1008" y2="1172" stroke="#56B4FF" stroke-opacity=".55" stroke-width="2"/>${source}</svg>`;
}

export async function renderCopyCards(cards: CopyCard[], outputDirectory: string, label: string): Promise<string[]> {
  await mkdir(outputDirectory, { recursive: true });
  const paths: string[] = [];
  for (const [index, card] of cards.entries()) {
    const stem = `${String(index + 1).padStart(2, "0")}`;
    const svgPath = join(outputDirectory, `${stem}.svg`);
    const pngPath = join(outputDirectory, `${stem}.png`);
    await writeFile(svgPath, createCopyCardSvg(card, label, index, cards.length), "utf8");
    await rasterizeSvg(svgPath, pngPath);
    paths.push(pngPath);
  }
  return paths;
}

async function runFfmpeg(args: string[]): Promise<void> {
  await execFileAsync("ffmpeg", args, { maxBuffer: 2_000_000 });
}

async function rasterizeSvg(svgPath: string, pngPath: string): Promise<void> {
  await execFileAsync("sips", ["-s", "format", "png", svgPath, "--out", pngPath], { maxBuffer: 2_000_000 });
}

export async function renderCarouselArtifacts(
  campaign: CarouselCampaign,
  outputDirectory: string,
): Promise<CarouselArtifactResult> {
  await mkdir(outputDirectory, { recursive: true });
  const heroPath = join(outputDirectory, "hero.png");

  await runFfmpeg([
    "-y", "-f", "lavfi", "-i", `color=c=${campaign.palette.background}:s=1080x1350`,
    "-frames:v", "1", heroPath,
  ]);

  const slides: string[] = [];
  for (const slide of campaign.slides) {
    const number = String(slide.number).padStart(2, "0");
    const svgPath = join(outputDirectory, `slide-${number}.svg`);
    const pngPath = join(outputDirectory, `slide-${number}.png`);
    await writeFile(svgPath, createCarouselSlideSvg(campaign, slide, "hero.png"), "utf8");
    await rasterizeSvg(svgPath, pngPath);
    slides.push(pngPath);
  }

  const manifestPath = join(outputDirectory, "asset-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify({
    kind: "carousel",
    campaignId: campaign.id,
    title: campaign.title,
    sourceSlideCount: campaign.slides.length,
    slides: slides.map((path) => path.split("/").at(-1)),
    generatedAt: new Date().toISOString(),
  }, null, 2)}\n`, "utf8");

  return { slides, manifestPath };
}
