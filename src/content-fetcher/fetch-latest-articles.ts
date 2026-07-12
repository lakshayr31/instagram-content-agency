import { fetchRssSources, type RssFetchDependencies, type RssSource } from "./rss-adapter.js";

export const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Backend ingestion hook: fetch the current two-hour article window for every
 * configured RSS source. Source configuration stays outside this function so
 * each agency client can provide its own approved publishers.
 */
export function fetchLatestArticles(
  sources: RssSource[],
  dependencies: RssFetchDependencies = {},
) {
  return fetchRssSources(sources, { ...dependencies, maxAgeMs: TWO_HOURS_MS });
}
