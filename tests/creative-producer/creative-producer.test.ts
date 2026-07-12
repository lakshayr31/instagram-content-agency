import assert from "node:assert/strict";
import test from "node:test";

import {
  createCreativeProducer,
  createCreativeProducerPrompt,
  type CreativeProducerInput,
} from "../../src/creative-producer/index.js";

const input: CreativeProducerInput = {
  approvedContent: {
    category: "growth",
    title: "Three ways to improve your Instagram carousel hook",
    coreMessage: "Strong carousel hooks make the audience understand the value of swiping immediately.",
    sourceUrl: "https://example.com/carousel-hooks",
    verifiedFacts: [
      "The supplied source gives three hook patterns: a direct promise, a contrast, and a mistake to avoid.",
    ],
    requiredAngle: "Make the lesson practical for independent creators.",
  },
  clientBrief: {
    audience: "independent creators",
    brandVoice: "clear, direct, useful",
    offer: "Instagram education for small brands",
    boundaries: ["Do not promise follower growth."],
    objective: "saves and shares",
  },
};

const carouselOutput = {
  category: "growth",
  format: "carousel",
  formatRationale: "The three patterns are naturally swipeable and saveable.",
  creativeBrief: {
    audienceTakeaway: "Pick a hook pattern that gives a reader a reason to keep swiping.",
    creativeConcept: "Three opening lines, one clear promise.",
    hook: "Your carousel is losing readers on slide one.",
    visualDirection: "Use one pattern per slide with large, high-contrast text.",
    callToAction: "Save this before your next carousel draft.",
  },
  exampleExecution: {
    format: "carousel",
    caption: "Three hook patterns to try.\n\nSave this for your next draft.",
    asset: {
      carouselSlides: [
        { slide: 1, onScreenCopy: "Your carousel is losing readers on slide one.", visual: "Bold cover." },
        { slide: 2, onScreenCopy: "1. Make a direct promise.", visual: "Simple type card." },
      ],
      postVisual: null,
      reelBeats: null,
    },
  },
  productionNotes: ["Design in 4:5 portrait."],
  factChecksRequired: [],
  audioDirection: null,
};

test("builds an isolated creative-producer prompt with only the approved handoff", () => {
  const prompt = createCreativeProducerPrompt(input);

  assert.match(prompt, /Creative Producer Persona/i);
  assert.match(prompt, /already been selected and classified/i);
  assert.match(prompt, /Three ways to improve your Instagram carousel hook/);
  assert.match(prompt, /Do not promise follower growth/);
  assert.match(prompt, /valid JSON only/i);
});

test("returns validated publish-ready carousel copy from a model runner", async () => {
  const producer = createCreativeProducer(async () => JSON.stringify(carouselOutput));

  const result = await producer.create(input);

  assert.equal(result.format, "carousel");
  assert.equal(result.category, "growth");
  assert.equal(result.exampleExecution.asset.carouselSlides?.length, 2);
  assert.equal(result.exampleExecution.asset.postVisual, null);
  assert.equal(result.exampleExecution.asset.reelBeats, null);
  assert.match(result.exampleExecution.caption, /Three hook patterns/);
});

test("rejects a model response that changes the strategist's assigned category", async () => {
  const producer = createCreativeProducer(async () => JSON.stringify({ ...carouselOutput, category: "controversial" }));

  await assert.rejects(() => producer.create(input), /must preserve the approved category/i);
});

test("rejects a carousel response that fills an unused asset type", async () => {
  const producer = createCreativeProducer(async () => JSON.stringify({
    ...carouselOutput,
    exampleExecution: {
      ...carouselOutput.exampleExecution,
      asset: {
        ...carouselOutput.exampleExecution.asset,
        postVisual: { onVisualCopy: "Also a post", visual: "Wrong extra asset" },
      },
    },
  }));

  await assert.rejects(() => producer.create(input), /only carouselSlides/i);
});

test("rejects a model response with no publishable copy", async () => {
  const producer = createCreativeProducer(async () => JSON.stringify({
    ...carouselOutput,
    exampleExecution: { ...carouselOutput.exampleExecution, caption: "" },
  }));

  await assert.rejects(() => producer.create(input), /caption must be a non-empty string/i);
});

test("preserves the selected reel audio direction in the production handoff", async () => {
  const reelOutput = {
    ...carouselOutput,
    format: "reel",
    formatRationale: "A 30-second narrated explainer makes the comparison easier to grasp.",
    exampleExecution: {
      format: "reel",
      caption: "A fast reel explainer with a save prompt.",
      asset: {
        carouselSlides: null,
        postVisual: null,
        reelBeats: [
          { time: "0:00–0:03", spokenOrOnScreenCopy: "Here is the simple version.", visual: "Animated hook." },
        ],
      },
    },
    audioDirection: {
      mode: "voiceover_with_background_music",
      direction: "Conversational voiceover over low-energy instrumental music; duck music below speech.",
    },
  };
  const producer = createCreativeProducer(async () => JSON.stringify(reelOutput));

  const result = await producer.create(input);

  assert.deepEqual((result as unknown as { audioDirection?: unknown }).audioDirection, reelOutput.audioDirection);
});
