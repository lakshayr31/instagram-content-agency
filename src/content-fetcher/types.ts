export type ContentSource = "rss" | "linkup";

export interface ContentItem {
  id: string;
  source: ContentSource;
  sourceUrl: string;
  sourceLabel: string;
  title: string;
  summary: string;
  publishedAt?: string;
  fetchedAt?: string;
  topics: string[];
}

export interface RssItemInput {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
}

function hostFor(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

function requireHttpUrl(value: string | undefined, message: string): string {
  if (!value) throw new Error(message);

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(message);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(message);
  }

  return url.toString();
}

export function normalizeRssItem(input: RssItemInput, feedUrl: string): ContentItem {
  const sourceUrl = requireHttpUrl(input.link, "An RSS item needs a public article URL.");
  const normalizedFeedUrl = requireHttpUrl(feedUrl, "An RSS feed needs a public URL.");
  const title = input.title?.trim() || "Untitled RSS item";

  return {
    id: `rss:${sourceUrl}`,
    source: "rss",
    sourceUrl,
    sourceLabel: hostFor(normalizedFeedUrl),
    title,
    summary: input.description?.trim() ?? "",
    publishedAt: input.pubDate,
    fetchedAt: undefined,
    topics: [],
  };
}
