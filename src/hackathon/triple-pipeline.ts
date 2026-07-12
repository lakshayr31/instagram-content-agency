import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export type StrategyFormat = "post" | "carousel" | "reel";

export interface FormatRecommendation {
  format: StrategyFormat;
  sourceUrl: string;
  category: "evergreen" | "controversial" | "growth";
  title: string;
  angle: string;
  verifiedFacts: string[];
  rationale: string;
}

export interface ThreeFormatStrategy {
  recommendations: FormatRecommendation[];
}

const execFileAsync = promisify(execFile);
const strategistPersonaPath = fileURLToPath(new URL("../strategist/STRATEGIST_PERSONA.md", import.meta.url));
const posterPersonaPath = fileURLToPath(new URL("../poster/POSTER_PERSONA.md", import.meta.url));

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value;
}

export function parseThreeFormatStrategy(raw: string): ThreeFormatStrategy {
  let payload: unknown;
  try {
    payload = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    throw new Error("Strategist returned invalid JSON.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Strategist result must be an object.");
  const recommendations = (payload as { recommendations?: unknown }).recommendations;
  if (!Array.isArray(recommendations) || recommendations.length !== 3) throw new Error("Strategist must return exactly three recommendations.");
  const parsed = recommendations.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`recommendations[${index}] must be an object.`);
    const record = item as Record<string, unknown>;
    const format = requireString(record.format, `recommendations[${index}].format`);
    if (format !== "post" && format !== "carousel" && format !== "reel") throw new Error("Invalid recommendation format.");
    const category = requireString(record.category, `recommendations[${index}].category`);
    if (category !== "evergreen" && category !== "controversial" && category !== "growth") throw new Error("Invalid strategy category.");
    const facts = record.verifiedFacts;
    if (!Array.isArray(facts) || facts.length === 0 || !facts.every((fact) => typeof fact === "string" && fact.trim())) {
      throw new Error(`recommendations[${index}].verifiedFacts must contain approved facts.`);
    }
    return {
      format,
      sourceUrl: requireString(record.sourceUrl, `recommendations[${index}].sourceUrl`),
      category,
      title: requireString(record.title, `recommendations[${index}].title`),
      angle: requireString(record.angle, `recommendations[${index}].angle`),
      verifiedFacts: facts as string[],
      rationale: requireString(record.rationale, `recommendations[${index}].rationale`),
    } as FormatRecommendation;
  });
  const formats = new Set(parsed.map((item) => item.format));
  if (formats.size !== 3 || !formats.has("post") || !formats.has("carousel") || !formats.has("reel")) {
    throw new Error("Strategist must return exactly one post, carousel, and reel.");
  }
  return { recommendations: parsed.sort((a, b) => ["post", "carousel", "reel"].indexOf(a.format) - ["post", "carousel", "reel"].indexOf(b.format)) };
}

export async function runHermesJson(prompt: string): Promise<string> {
  const { stdout } = await execFileAsync("hermes", ["chat", "-Q", "--toolsets", "safe", "-q", prompt], { maxBuffer: 2_000_000 });
  return stdout;
}

export async function runThreeFormatStrategist(input: { audience: string; objective: string; boundaries: string[]; sources: Array<{ url: string; title: string; facts: string[]; summary: string }> }): Promise<ThreeFormatStrategy> {
  const persona = await readFile(strategistPersonaPath, "utf8");
  const prompt = `${persona}\n\nYou are selecting a three-output agency slate. Return JSON only in this exact shape:\n{"recommendations":[{"format":"post|carousel|reel","sourceUrl":"string","category":"evergreen|controversial|growth","title":"string","angle":"string","verifiedFacts":["only input facts"],"rationale":"string"}]}\nReturn exactly three recommendations: one post, one carousel, one reel. Use only sources and facts supplied below.\n${JSON.stringify(input, null, 2)}`;
  return parseThreeFormatStrategy(await runHermesJson(prompt));
}

export async function runPoster(input: unknown): Promise<Record<string, unknown>> {
  const persona = await readFile(posterPersonaPath, "utf8");
  const raw = await runHermesJson(`${persona}\n\nPrepare the publishing package for this approved asset. Return JSON only.\n${JSON.stringify(input, null, 2)}`);
  const value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Poster returned invalid JSON.");
  return value as Record<string, unknown>;
}
