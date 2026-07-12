import { buildLinkupQuery, type ContentFetcherPersona } from "./persona.js";
import { fetchLatestArticles } from "./fetch-latest-articles.js";
import { fetchLinkupArticles } from "./linkup-adapter.js";
import type { ContentItem } from "./types.js";

export interface ContentFetchCycleDependencies {
  fetchRss?: typeof fetchLatestArticles;
  fetchLinkup?: typeof fetchLinkupArticles;
}

export async function runContentFetchCycle(
  persona: ContentFetcherPersona,
  dependencies: ContentFetchCycleDependencies = {},
): Promise<ContentItem[]> {
  const fetchRss = dependencies.fetchRss ?? fetchLatestArticles;
  const fetchLinkup = dependencies.fetchLinkup ?? fetchLinkupArticles;
  const [rssItems, linkupItems] = await Promise.all([
    fetchRss(persona.rssSources),
    fetchLinkup(buildLinkupQuery(persona)),
  ]);

  const uniqueByUrl = new Map<string, ContentItem>();
  for (const item of [...rssItems, ...linkupItems]) {
    uniqueByUrl.set(item.sourceUrl, uniqueByUrl.get(item.sourceUrl) ?? item);
  }

  return [...uniqueByUrl.values()];
}
