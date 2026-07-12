import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export type CreativeCategory = "evergreen" | "controversial" | "growth";
export type CreativeFormat = "carousel" | "post" | "reel";

export interface ApprovedContent {
  category: CreativeCategory;
  title: string;
  coreMessage: string;
  sourceUrl: string;
  verifiedFacts: string[];
  requiredAngle?: string;
}

export interface ClientBrief {
  audience: string;
  brandVoice: string;
  offer: string;
  boundaries: string[];
  objective?: string;
}

export interface CreativeProducerInput {
  approvedContent: ApprovedContent;
  clientBrief: ClientBrief;
}

export type ReelAudioMode = "voiceover" | "voiceover_with_background_music" | "music_led";

export interface ReelAudioDirection {
  mode: ReelAudioMode;
  direction: string;
}

export interface CarouselSlide {
  slide: number;
  onScreenCopy: string;
  visual: string;
}

export interface PostVisual {
  onVisualCopy: string;
  visual: string;
}

export interface ReelBeat {
  time: string;
  spokenOrOnScreenCopy: string;
  visual: string;
}

export interface CreativeExecution {
  category: CreativeCategory;
  format: CreativeFormat;
  formatRationale: string;
  creativeBrief: {
    audienceTakeaway: string;
    creativeConcept: string;
    hook: string;
    visualDirection: string;
    callToAction: string;
  };
  exampleExecution: {
    format: CreativeFormat;
    caption: string;
    asset: {
      carouselSlides: CarouselSlide[] | null;
      postVisual: PostVisual | null;
      reelBeats: ReelBeat[] | null;
    };
  };
  productionNotes: string[];
  factChecksRequired: string[];
  audioDirection: ReelAudioDirection | null;
}

export type CreativeModelRunner = (prompt: string) => Promise<string>;

const categories = new Set<CreativeCategory>(["evergreen", "controversial", "growth"]);
const formats = new Set<CreativeFormat>(["carousel", "post", "reel"]);
const reelAudioModes = new Set<ReelAudioMode>(["voiceover", "voiceover_with_background_music", "music_led"]);
const personaPath = fileURLToPath(new URL("./CREATIVE_PRODUCER_PERSONA.md", import.meta.url));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value;
}

function requireStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim())) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  return value;
}

function requireFormat(value: unknown, label: string): CreativeFormat {
  if (typeof value !== "string" || !formats.has(value as CreativeFormat)) {
    throw new Error(`${label} must be carousel, post, or reel.`);
  }
  return value as CreativeFormat;
}

function requireCarouselSlides(value: unknown): CarouselSlide[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("carouselSlides must be a non-empty array.");
  return value.map((slide, index) => {
    const record = requireRecord(slide, `carouselSlides[${index}]`);
    if (!Number.isInteger(record.slide) || (record.slide as number) < 1) {
      throw new Error(`carouselSlides[${index}].slide must be a positive integer.`);
    }
    return {
      slide: record.slide as number,
      onScreenCopy: requireString(record.onScreenCopy, `carouselSlides[${index}].onScreenCopy`),
      visual: requireString(record.visual, `carouselSlides[${index}].visual`),
    };
  });
}

function requirePostVisual(value: unknown): PostVisual {
  const record = requireRecord(value, "postVisual");
  return {
    onVisualCopy: requireString(record.onVisualCopy, "postVisual.onVisualCopy"),
    visual: requireString(record.visual, "postVisual.visual"),
  };
}

function requireReelBeats(value: unknown): ReelBeat[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("reelBeats must be a non-empty array.");
  return value.map((beat, index) => {
    const record = requireRecord(beat, `reelBeats[${index}]`);
    return {
      time: requireString(record.time, `reelBeats[${index}].time`),
      spokenOrOnScreenCopy: requireString(record.spokenOrOnScreenCopy, `reelBeats[${index}].spokenOrOnScreenCopy`),
      visual: requireString(record.visual, `reelBeats[${index}].visual`),
    };
  });
}

function parseJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const candidate = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error("Creative Producer returned invalid JSON.");
  }
}

export async function loadCreativeProducerPersona(): Promise<string> {
  return readFile(personaPath, "utf8");
}

export function createCreativeProducerPrompt(
  input: CreativeProducerInput,
  persona = "# Creative Producer Persona\nYou receive an item that has already been selected and classified upstream. Return valid JSON only.",
): string {
  return `${persona}\n\nCreate one publish-ready Instagram execution for this approved handoff now. Return JSON only.\n${JSON.stringify(input, null, 2)}`;
}

export function validateCreativeExecution(input: CreativeProducerInput, candidate: unknown): CreativeExecution {
  const result = requireRecord(candidate, "Creative Producer output");
  const category = requireString(result.category, "category") as CreativeCategory;
  if (!categories.has(category)) throw new Error("category must be evergreen, controversial, or growth.");
  if (category !== input.approvedContent.category) throw new Error("Creative Producer must preserve the approved category.");

  const format = requireFormat(result.format, "format");
  const creativeBrief = requireRecord(result.creativeBrief, "creativeBrief");
  const exampleExecution = requireRecord(result.exampleExecution, "exampleExecution");
  const exampleFormat = requireFormat(exampleExecution.format, "exampleExecution.format");
  if (exampleFormat !== format) throw new Error("exampleExecution.format must match format.");
  const asset = requireRecord(exampleExecution.asset, "exampleExecution.asset");

  const carouselSlides = asset.carouselSlides;
  const postVisual = asset.postVisual;
  const reelBeats = asset.reelBeats;
  let parsedAsset: CreativeExecution["exampleExecution"]["asset"];
  if (format === "carousel") {
    if (postVisual !== null || reelBeats !== null) throw new Error("Carousel executions may populate only carouselSlides.");
    parsedAsset = { carouselSlides: requireCarouselSlides(carouselSlides), postVisual: null, reelBeats: null };
  } else if (format === "post") {
    if (carouselSlides !== null || reelBeats !== null) throw new Error("Post executions may populate only postVisual.");
    parsedAsset = { carouselSlides: null, postVisual: requirePostVisual(postVisual), reelBeats: null };
  } else {
    if (carouselSlides !== null || postVisual !== null) throw new Error("Reel executions may populate only reelBeats.");
    parsedAsset = { carouselSlides: null, postVisual: null, reelBeats: requireReelBeats(reelBeats) };
  }

  let audioDirection: ReelAudioDirection | null;
  if (format === "reel") {
    const audio = requireRecord(result.audioDirection, "audioDirection");
    const mode = requireString(audio.mode, "audioDirection.mode") as ReelAudioMode;
    if (!reelAudioModes.has(mode)) {
      throw new Error("audioDirection.mode must be voiceover, voiceover_with_background_music, or music_led.");
    }
    audioDirection = { mode, direction: requireString(audio.direction, "audioDirection.direction") };
  } else {
    if (result.audioDirection !== null) throw new Error("Non-reel executions must set audioDirection to null.");
    audioDirection = null;
  }

  return {
    category,
    format,
    formatRationale: requireString(result.formatRationale, "formatRationale"),
    creativeBrief: {
      audienceTakeaway: requireString(creativeBrief.audienceTakeaway, "creativeBrief.audienceTakeaway"),
      creativeConcept: requireString(creativeBrief.creativeConcept, "creativeBrief.creativeConcept"),
      hook: requireString(creativeBrief.hook, "creativeBrief.hook"),
      visualDirection: requireString(creativeBrief.visualDirection, "creativeBrief.visualDirection"),
      callToAction: requireString(creativeBrief.callToAction, "creativeBrief.callToAction"),
    },
    exampleExecution: {
      format: exampleFormat,
      caption: requireString(exampleExecution.caption, "caption"),
      asset: parsedAsset,
    },
    productionNotes: requireStringArray(result.productionNotes, "productionNotes"),
    factChecksRequired: requireStringArray(result.factChecksRequired, "factChecksRequired"),
    audioDirection,
  };
}

export function createCreativeProducer(runner: CreativeModelRunner) {
  return {
    async create(input: CreativeProducerInput): Promise<CreativeExecution> {
      const persona = await loadCreativeProducerPersona();
      const raw = await runner(createCreativeProducerPrompt(input, persona));
      return validateCreativeExecution(input, parseJsonObject(raw));
    },
  };
}
