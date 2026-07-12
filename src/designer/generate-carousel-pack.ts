import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { campaigns, createCarouselSlideSvg, type CarouselCampaign } from "./render-carousel.js";

const execFileAsync = promisify(execFile);
const outputRoot = join(process.cwd(), "artifacts", "designed-carousel-pack");

export function createOpenAiImageRequest(prompt: string) {
  return {
    model: "gpt-image-1",
    size: "1024x1536",
    quality: "medium",
    output_format: "png",
    prompt: `${prompt}\n\nCreate original editorial illustration only. No logos, brand names, team marks, watermarks, readable text, or identifiable real people. Do not imitate a specific photographer or image agency. Leave clean negative space for typography.`,
  };
}

const heroPrompts: Record<CarouselCampaign["id"], string> = {
  "sainz-williams": "A fictional Formula One-style driver in a blue-and-white racing suit beside a sleek blue open-wheel car in a shadowed garage. Deep navy, electric blue, restrained warning red, high-contrast editorial motorsport poster composition.",
  "leclerc-journey": "A fictional young Monegasque-style open-wheel racing driver in a red racing suit, elegant close portrait, a faint Monaco street-map texture and thin timeline line. Ferrari-red, charcoal black, warm cream and track-grey editorial composition.",
  "aduo-explainer": "A premium minimal technical motorsport infographic background: charcoal blueprint outline of a hybrid racing power unit, luminous cyan benchmark line, subtle amber highlight nodes, structured engineering grid.",
};

async function generateHero(campaign: CarouselCampaign, apiKey: string): Promise<Buffer> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(createOpenAiImageRequest(heroPrompts[campaign.id])),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI image generation failed for ${campaign.id}: HTTP ${response.status} ${message.slice(0, 300)}`);
  }
  const payload = await response.json() as { data?: Array<{ b64_json?: string }> };
  const base64 = payload.data?.[0]?.b64_json;
  if (!base64) throw new Error(`OpenAI image generation returned no PNG payload for ${campaign.id}.`);
  return Buffer.from(base64, "base64");
}

async function renderSvg(svgPath: string, pngPath: string): Promise<void> {
  await execFileAsync("rsvg-convert", ["--output", pngPath, svgPath]);
}

function previewHtml(records: Array<{ campaign: CarouselCampaign; images: string[] }>): string {
  const sections = records.map(({ campaign, images }) => `
<section>
  <header><p>${campaign.kicker}</p><h1>${campaign.title}</h1><span>${images.length} rendered slides · original AI visual concept + original infographic layout</span></header>
  <div class="slides">${images.map((image, index) => `<figure><img src="${image}" alt="${campaign.title} slide ${index + 1}"><figcaption>Slide ${index + 1}</figcaption></figure>`).join("\n")}</div>
</section>`).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Designed F1 Carousel Pack</title><style>
:root{--paper:#f4f0ea;--ink:#151515;--rule:#d5cec4}*{box-sizing:border-box}body{margin:0;background:var(--paper);font-family:Arial,Helvetica,sans-serif;color:var(--ink)}main{max-width:1500px;margin:auto;padding:48px 28px 80px}section{border-top:2px solid var(--ink);padding:28px 0 48px}header p{font-size:12px;font-weight:800;letter-spacing:.16em;margin:0 0 8px}h1{font-family:Georgia,serif;font-size:42px;margin:0 0 8px}header span{color:#5b5751;font-size:15px}.slides{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px;margin-top:28px}figure{margin:0;background:#fff;border:1px solid var(--rule);padding:8px}img{display:block;width:100%;height:auto}figcaption{font-size:12px;margin:8px 3px 1px;color:#5b5751}@media(max-width:600px){main{padding:24px 14px}h1{font-size:32px}.slides{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}</style></head><body><main><p>DESIGNED CAROUSEL PACK / SOURCE-SAFE CONCEPT ART</p>${sections}</main></body></html>`;
}

export async function generateCarouselPack(apiKey = process.env.OPENAI_API_KEY): Promise<void> {
  if (!apiKey) throw new Error("OPENAI_API_KEY is required.");
  await mkdir(outputRoot, { recursive: true });
  const records: Array<{ campaign: CarouselCampaign; images: string[] }> = [];

  for (const campaign of campaigns) {
    const campaignDir = join(outputRoot, campaign.id);
    await mkdir(campaignDir, { recursive: true });
    const heroPath = join(campaignDir, "hero.png");
    await writeFile(heroPath, await generateHero(campaign, apiKey));
    const images: string[] = [];
    for (const slide of campaign.slides) {
      const basename = `slide-${String(slide.number).padStart(2, "0")}`;
      const svgPath = join(campaignDir, `${basename}.svg`);
      const pngPath = join(campaignDir, `${basename}.png`);
      await writeFile(svgPath, createCarouselSlideSvg(campaign, slide, "hero.png"), "utf8");
      await renderSvg(svgPath, pngPath);
      images.push(`${campaign.id}/${basename}.png`);
    }
    records.push({ campaign, images });
    process.stdout.write(`Rendered ${campaign.id}: ${images.length} slides.\n`);
  }
  await writeFile(join(outputRoot, "index.html"), previewHtml(records), "utf8");
  await writeFile(join(outputRoot, "README.txt"), "Original AI visual concepts and original SVG infographic layouts. Verify all factual claims and image-use rights before publishing.\n", "utf8");
}

if (process.argv[1] && process.argv[1].endsWith("generate-carousel-pack.ts")) {
  generateCarouselPack().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
