import {
  runContentFetchCycle,
  type ContentFetchCycleDependencies,
} from "./content-fetcher/run-fetch-cycle.js";
import type { ContentFetcherPersona } from "./content-fetcher/persona.js";
import { assessContentItem, type ContentAssessment } from "./strategist/assess-content-item.js";
import type { ContentItem } from "./content-fetcher/types.js";

export interface ContentOpportunity {
  item: ContentItem;
  assessment: ContentAssessment;
}

export async function runContentIntelligenceCycle(
  persona: ContentFetcherPersona,
  dependencies: ContentFetchCycleDependencies = {},
): Promise<ContentOpportunity[]> {
  const items = await runContentFetchCycle(persona, dependencies);
  const focusTopics = persona.niche
    .split(/\s*(?:,|&|\band\b)\s*/i)
    .map((topic) => topic.trim())
    .filter(Boolean);
  const brief = { audience: persona.audience, focusTopics };

  return items.map((item) => ({ item, assessment: assessContentItem(item, brief) }));
}
