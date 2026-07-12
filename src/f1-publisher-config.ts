import type { RssSource } from "./content-fetcher/rss-adapter.js";

export const F1_RSS_SOURCES: RssSource[] = [
  { name: "planetf1", url: "https://news.google.com/rss/search?q=site:planetf1.com+F1&hl=en" },
  { name: "the-race", url: "https://news.google.com/rss/search?q=site:the-race.com+F1&hl=en" },
  { name: "autosport", url: "https://news.google.com/rss/search?q=site:autosport.com+F1&hl=en" },
  { name: "formula1", url: "https://news.google.com/rss/search?q=site:formula1.com&hl=en" },
];

export const F1_LINKUP_QUESTIONS = [
  "What are the top latest Formula 1 developments right now? Return recent, source-backed reporting with original article URLs.",
  "What is trending in Formula 1 right now across drivers, teams, races, regulations, and fan discussion? Return source-backed reporting with original article URLs.",
  "What Formula 1 stories are currently controversial or debate-worthy, and what is the factual evidence on each side? Return source-backed reporting with original article URLs.",
];
