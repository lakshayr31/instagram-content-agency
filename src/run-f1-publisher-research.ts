import { mkdir, writeFile } from "node:fs/promises";

import { F1_LINKUP_QUESTIONS, F1_RSS_SOURCES } from "./f1-publisher-config.js";
import { researchWithLinkupQuestions } from "./content-fetcher/publisher-research.js";
import { fetchRssSources } from "./content-fetcher/rss-adapter.js";

const rssArticles = await fetchRssSources(F1_RSS_SOURCES, {
  maxAgeMs: 24 * 60 * 60 * 1000,
  maxItemsPerSource: 5,
});
const linkupResearch = await researchWithLinkupQuestions(F1_LINKUP_QUESTIONS);

const researchPacket = {
  generatedAt: new Date().toISOString(),
  publisherPersona: {
    role: "Formula 1 Instagram content publisher",
    audience: "Formula 1 fans seeking timely, useful, and debate-worthy content",
  },
  rss: {
    lookbackHours: 24,
    maxArticlesPerSource: 5,
    sources: F1_RSS_SOURCES,
    articles: rssArticles,
  },
  linkupResearch,
};

await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/f1-publisher-research.json", `${JSON.stringify(researchPacket, null, 2)}\n`);

console.log(JSON.stringify({
  artifact: "artifacts/f1-publisher-research.json",
  rssArticleCount: rssArticles.length,
  linkupResultCounts: linkupResearch.map(({ question, articles }) => ({ question, count: articles.length })),
}, null, 2));

// google-news-decoder may retain a network handle; scheduled runs must terminate.
process.exit(0);
