import type { RssSource } from "./rss-adapter.js";

export interface ContentFetcherPersona {
  niche: string;
  audience: string;
  rssSources: RssSource[];
}

export function createContentFetcherPersona(persona: ContentFetcherPersona): ContentFetcherPersona {
  const niche = persona.niche.trim();
  const audience = persona.audience.trim();

  if (!niche) throw new Error("A content-fetcher persona needs a niche.");
  if (!audience) throw new Error("A content-fetcher persona needs an audience.");

  return { niche, audience, rssSources: persona.rssSources };
}

export function loadContentFetcherPersona(environment: NodeJS.ProcessEnv = process.env): ContentFetcherPersona {
  const rssSources = (environment.RSS_FEED_URLS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((url) => {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error(`RSS feed must use HTTP or HTTPS: ${url}`);
      }
      return { name: parsed.hostname.replace(/^www\./, ""), url: parsed.toString() };
    });

  return createContentFetcherPersona({
    niche: environment.CONTENT_NICHE ?? "",
    audience: environment.CONTENT_AUDIENCE ?? "",
    rssSources,
  });
}

export function buildLinkupQuery(persona: ContentFetcherPersona): string {
  return [
    `Find recent, source-backed developments in ${persona.niche} relevant to ${persona.audience}.`,
    "Prioritize original reporting and primary sources published in the last two hours when available.",
    "Identify material that could become an evergreen, controversial, or growth Instagram post.",
    "Return source URL, title, and a concise evidence-backed snippet for every result.",
  ].join(" ");
}
