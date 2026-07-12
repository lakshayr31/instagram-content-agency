import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { createOpenAiImageRequest } from "./generate-carousel-pack.js";
import { campaigns, createCarouselSlideSvg, type CarouselCampaign } from "./render-carousel.js";

const execFileAsync = promisify(execFile);
const outputRoot = join(process.cwd(), "artifacts", "designed-carousel-pack");

export interface CarouselScene {
  campaignId: CarouselCampaign["id"];
  slideNumber: number;
  prompt: string;
}

export const scenePlan: CarouselScene[] = [
  {
    campaignId: "sainz-williams",
    slideNumber: 2,
    prompt: "Image-led Formula 1 editorial visual: a fictional blue open-wheel car exiting a shadowed garage, split by one clean bright line suggesting evidence versus speculation, deep Williams-style blue and white, no logos, no readable words, leave upper-left space for typography.",
  },
  {
    campaignId: "sainz-williams",
    slideNumber: 3,
    prompt: "Editorial motorsport technical still life: a blue open-wheel race car represented on a precision engineering weight scale, clean garage light, visible 28kg-style measurement concept without any readable words, deep navy and electric blue, plenty of empty upper-left space for overlay typography.",
  },
  {
    campaignId: "sainz-williams",
    slideNumber: 4,
    prompt: "Editorial data-driven motorsport image: a fictional blue Formula-style car viewed from above on a dark track, one elegant descending line and one rising line as abstract visual motifs, deep blue and cyan light, no logos, no readable words or numbers, leave upper-left space for typography.",
  },
  {
    campaignId: "sainz-williams",
    slideNumber: 5,
    prompt: "Dramatic editorial racing portrait concept: anonymous helmeted open-wheel driver in a blue garage, reflective visor, large empty shadowed negative space, thoughtful performance-pressure mood, no team marks, no logos, no readable text, leave upper-left space for a quote.",
  },
  {
    campaignId: "sainz-williams",
    slideNumber: 6,
    prompt: "Cinematic macro editorial illustration of a modern carbon-fibre open-wheel racing front wing in a trackside garage, subtle airflow lines and engineering detail, dark navy, silver and electric blue, crisp contrast, blank upper-left space for typography.",
  },
  {
    campaignId: "sainz-williams",
    slideNumber: 7,
    prompt: "High-contrast editorial motorsport conclusion image: blue open-wheel car emerging from a tunnel of light, clean two-tone visual tension between warning and restraint, deep navy, cyan and muted silver, no logos, no readable text, leave upper-left space for typography.",
  },
  {
    campaignId: "leclerc-journey",
    slideNumber: 3,
    prompt: "Premium motorsport timeline still life: two elegant junior-racing trophies and a clean race-number plaque, cinematic red, charcoal and cream palette, editorial museum display lighting, no people, no logos, no readable writing, leave upper-left space for typography.",
  },
  {
    campaignId: "leclerc-journey",
    slideNumber: 6,
    prompt: "Dynamic Monza-inspired motorsport atmosphere: abstract grandstand lights, Italian tricolour kerb detail, a red open-wheel car silhouette at speed, celebratory but restrained editorial photography style, no logos or readable text, leave upper-left space for typography.",
  },
  {
    campaignId: "leclerc-journey",
    slideNumber: 9,
    prompt: "Cinematic British circuit victory atmosphere: wet reflective track, silver sky, a red open-wheel race car silhouette crossing a finish-line-inspired stripe, premium editorial racing image, no logos or readable text, leave upper-left space for typography.",
  },
  {
    campaignId: "aduo-explainer",
    slideNumber: 2,
    prompt: "High-end industrial engineering image: a clean modern power-unit manufacturer workshop with one hybrid racing engine on a stand, teal-white work lights, charcoal technical atmosphere, no brands, no readable text, leave upper-left space for typography.",
  },
  {
    campaignId: "aduo-explainer",
    slideNumber: 4,
    prompt: "Minimal dynamic technical visual: glowing cyan performance benchmark ladder beside a stylised hybrid racing engine, a clear two-band progression concept, dark charcoal grid, no logos, no readable words or numbers, leave upper-left space for typography.",
  },
];

async function createSceneImage(scene: CarouselScene, apiKey: string): Promise<Buffer> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(createOpenAiImageRequest(scene.prompt)),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI image generation failed for ${scene.campaignId} slide ${scene.slideNumber}: HTTP ${response.status} ${message.slice(0, 300)}`);
  }
  const payload = await response.json() as { data?: Array<{ b64_json?: string }> };
  const base64 = payload.data?.[0]?.b64_json;
  if (!base64) throw new Error(`OpenAI returned no image payload for ${scene.campaignId} slide ${scene.slideNumber}.`);
  return Buffer.from(base64, "base64");
}

export async function generateCarouselScenes(
  apiKey = process.env.OPENAI_API_KEY,
  scenes: CarouselScene[] = scenePlan,
): Promise<void> {
  if (!apiKey) throw new Error("OPENAI_API_KEY is required.");
  for (const scene of scenes) {
    const campaign = campaigns.find((item) => item.id === scene.campaignId);
    const slide = campaign?.slides.find((item) => item.number === scene.slideNumber);
    if (!campaign || !slide) throw new Error(`Invalid scene plan for ${scene.campaignId}:${scene.slideNumber}.`);
    const campaignDir = join(outputRoot, campaign.id);
    const basename = `slide-${String(scene.slideNumber).padStart(2, "0")}`;
    const sceneFilename = `scene-${String(scene.slideNumber).padStart(2, "0")}.png`;
    await writeFile(join(campaignDir, sceneFilename), await createSceneImage(scene, apiKey));
    const svgPath = join(campaignDir, `${basename}.svg`);
    const pngPath = join(campaignDir, `${basename}.png`);
    await writeFile(svgPath, createCarouselSlideSvg(campaign, slide, sceneFilename, "AI visual concept", "image-led"), "utf8");
    await execFileAsync("rsvg-convert", ["--output", pngPath, svgPath]);
    process.stdout.write(`Generated and rendered ${campaign.id} slide ${scene.slideNumber}.\n`);
  }
  await writeFile(join(outputRoot, "scene-manifest.json"), JSON.stringify(scenePlan, null, 2));
}

if (process.argv[1] && process.argv[1].endsWith("generate-carousel-scenes.ts")) {
  generateCarouselScenes().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
