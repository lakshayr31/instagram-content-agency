import GoogleNewsDecoder from "google-news-decoder";
import RSSParser from "rss-parser";

import type { ContentItem } from "./types.js";

export interface RssSource {
  name: string;
  url: string;
}

interface RssFeedItem {
  title?: string;
  link?: string;
  contentSnippet?: string;
  content?: string;
  pubDate?: string;
}

interface RssParserLike {
  parseURL(url: string): Promise<{ items?: RssFeedItem[] }>;
}

export interface RssFetchDependencies {
  now?: Date;
  parser?: RssParserLike;
  resolveUrl?: (url: string) => Promise<string | null>;
  alreadySeen?: (url: string) => Promise<boolean>;
  blockedUrlPatterns?: RegExp[];
  maxAgeMs?: number;
  maxItemsPerSource?: number;
}

const defaultGoogleNewsDecoder = new GoogleNewsDecoder();

async function resolveGoogleNewsUrl(url: string): Promise<string | null> {
  if (!new URL(url).hostname.endsWith("news.google.com")) return url;

  const result = await defaultGoogleNewsDecoder.decodeGoogleNewsUrl(url);
  if (!result.status) return null;
  return result.decodedUrl ?? null;
}

function isRecent(publishedAt: string | undefined, now: Date, maxAgeMs: number): boolean {
  if (!publishedAt) return true;
  const timestamp = Date.parse(publishedAt);
  return Number.isNaN(timestamp) || now.getTime() - timestamp <= maxAgeMs;
}

function normalizeItem(item: RssFeedItem, source: RssSource, sourceUrl: string, now: Date): ContentItem {
  return {
    id: `rss:${sourceUrl}`,
    source: "rss",
    sourceUrl,
    sourceLabel: source.name,
    title: item.title?.trim() || "Untitled RSS item",
    summary: item.contentSnippet?.trim() ?? item.content?.trim() ?? "",
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
    fetchedAt: now.toISOString(),
    topics: [],
  };
}

export async function fetchRssSources(
  sources: RssSource[],
  dependencies: RssFetchDependencies = {},
): Promise<ContentItem[]> {
  const now = dependencies.now ?? new Date();
  const parser = dependencies.parser ?? new RSSParser();
  const resolveUrl = dependencies.resolveUrl ?? resolveGoogleNewsUrl;
  const alreadySeen = dependencies.alreadySeen ?? (async () => false);
  const blockedUrlPatterns = dependencies.blockedUrlPatterns ?? [];
  const maxAgeMs = dependencies.maxAgeMs ?? 24 * 60 * 60 * 1000;
  const maxItemsPerSource = dependencies.maxItemsPerSource ?? Number.POSITIVE_INFINITY;
  const contentItems: ContentItem[] = [];

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url);
      let acceptedFromSource = 0;
      for (const item of feed.items ?? []) {
        if (acceptedFromSource >= maxItemsPerSource) break;
        if (!item.link || !isRecent(item.pubDate, now, maxAgeMs)) continue;

        const sourceUrl = await resolveUrl(item.link);
        if (!sourceUrl || blockedUrlPatterns.some((pattern) => pattern.test(sourceUrl))) continue;
        if (await alreadySeen(sourceUrl)) continue;

        contentItems.push(normalizeItem(item, source, sourceUrl, now));
        acceptedFromSource++;
      }
    } catch (error) {
      console.warn(`RSS source failed (${source.name}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return contentItems;
}
