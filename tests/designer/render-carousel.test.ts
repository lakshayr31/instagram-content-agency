import assert from "node:assert/strict";
import test from "node:test";

import {
  createOpenAiImageRequest,
} from "../../src/designer/generate-carousel-pack.js";
import { scenePlan } from "../../src/designer/generate-carousel-scenes.js";
import {
  campaigns,
  createCarouselSlideSvg,
  wrapSlideText,
} from "../../src/designer/render-carousel.js";

test("builds an OpenAI image request for original, non-branded editorial illustration", () => {
  const request = createOpenAiImageRequest("A fictional blue open-wheel driver in a garage.");

  assert.equal(request.model, "gpt-image-1");
  assert.equal(request.size, "1024x1536");
  assert.equal(request.output_format, "png");
  assert.match(request.prompt, /No logos/i);
  assert.match(request.prompt, /fictional blue open-wheel driver/i);
});

test("plans varied visual scenes across the carousel bridges instead of reusing one image", () => {
  assert.deepEqual(
    scenePlan.map((scene) => `${scene.campaignId}:${scene.slideNumber}`),
    [
      "sainz-williams:2",
      "sainz-williams:3",
      "sainz-williams:4",
      "sainz-williams:5",
      "sainz-williams:6",
      "sainz-williams:7",
      "leclerc-journey:3",
      "leclerc-journey:6",
      "leclerc-journey:9",
      "aduo-explainer:2",
      "aduo-explainer:4",
    ],
  );
});

test("wraps long slide copy into safe portrait-width lines", () => {
  assert.deepEqual(
    wrapSlideText("Is Carlos Sainz already worried about Williams?", 22),
    ["Is Carlos Sainz", "already worried about", "Williams?"],
  );
});

test("defines the three approved campaigns with their complete slide counts", () => {
  assert.deepEqual(
    campaigns.map((campaign) => [campaign.id, campaign.slides.length]),
    [
      ["sainz-williams", 8],
      ["leclerc-journey", 10],
      ["aduo-explainer", 5],
    ],
  );
});

test("renders a portrait SVG with the campaign copy, source label, and safe generated-art treatment", () => {
  const campaign = campaigns.find((item) => item.id === "sainz-williams");
  assert.ok(campaign);

  const cover = campaign.slides[0];
  assert.ok(cover);
  const svg = createCarouselSlideSvg(campaign, cover, "hero-sainz.png");

  assert.match(svg, /viewBox="0 0 1080 1350"/);
  assert.match(svg, /Carlos Sainz/);
  assert.match(svg, /AI visual concept/);
  assert.match(svg, /hero-sainz\.png/);
  assert.doesNotMatch(svg, /confirmed exit plan/i);
});

test("renders a supplied Commons photo credit instead of an AI-art disclosure", () => {
  const campaign = campaigns.find((item) => item.id === "leclerc-journey");
  assert.ok(campaign);
  const cover = campaign.slides[0];
  assert.ok(cover);

  const svg = createCarouselSlideSvg(campaign, cover, "leclerc-cover.jpg", "Photo: Wastrick / CC BY-SA 4.0");

  assert.match(svg, /leclerc-cover\.jpg/);
  assert.match(svg, /opacity="0\.9"/);
  assert.match(svg, /id="photo-text-panel"/);
  assert.match(svg, /Photo: Wastrick \/ CC BY-SA 4\.0/);
  assert.doesNotMatch(svg, /AI visual concept/);
});

test("uses a compact image-led composition for narrative bridge slides", () => {
  const campaign = campaigns.find((item) => item.id === "aduo-explainer");
  assert.ok(campaign);
  const slide = campaign.slides[1];
  assert.ok(slide);

  const svg = createCarouselSlideSvg(campaign, slide, "scene-02.png", "AI visual concept", "image-led");

  assert.match(svg, /scene-02\.png/);
  assert.match(svg, /opacity="0\.9"/);
  assert.match(svg, /id="photo-text-panel"/);
  assert.match(svg, /font-size="54"/);
});

test("can protect a portrait subject with a right-side image-led text panel", () => {
  const campaign = campaigns.find((item) => item.id === "sainz-williams");
  assert.ok(campaign);
  const slide = campaign.slides[0];
  assert.ok(slide);

  const svg = createCarouselSlideSvg(campaign, slide, "sainz-portrait-ai.png", "AI visual concept", "image-led-right");

  assert.match(svg, /id="photo-text-panel" x="400"/);
  assert.match(svg, /<text x="430" y="410"/);
});

test("includes factual source attribution on slides that make factual claims", () => {
  const campaign = campaigns.find((item) => item.id === "aduo-explainer");
  assert.ok(campaign);

  const factualSlide = campaign.slides[1];
  assert.ok(factualSlide);
  const svg = createCarouselSlideSvg(campaign, factualSlide, "hero-aduo.png");

  assert.match(svg, /Source: Formula1\.com/);
});
