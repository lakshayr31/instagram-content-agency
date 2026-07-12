import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { campaigns } from "../../src/designer/render-carousel.js";
import { renderCarouselArtifacts, renderCopyCards } from "../../src/hackathon/artifacts.js";

test("renders generic post or carousel cards from approved copy", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agency-cards-"));
  const result = await renderCopyCards([
    { headline: "A clear hook", body: "One factual takeaway.", source: "Source: example.com" },
    { headline: "Save this", body: "A specific CTA." },
  ], directory, "agency");

  assert.equal(result.length, 2);
  await Promise.all(result.map((path) => stat(path)));
});

test("renders real PNG carousel files and a manifest from an approved campaign", async () => {
  const campaign = campaigns.find((item) => item.id === "aduo-explainer");
  assert.ok(campaign);
  const directory = await mkdtemp(join(tmpdir(), "agency-carousel-"));

  const result = await renderCarouselArtifacts(campaign, directory);

  assert.equal(result.slides.length, campaign.slides.length);
  assert.ok(result.manifestPath.endsWith("asset-manifest.json"));
  for (const slide of result.slides) {
    const file = await stat(slide);
    assert.ok(file.size > 0);
    assert.match(slide, /\.png$/);
  }
});
