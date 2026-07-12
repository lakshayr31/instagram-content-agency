import type { ContentItem } from "./types.js";

interface LinkupResult {
  name?: string;
  url?: string;
  content?: string;
}

interface LinkupSearchResponse {
  results?: LinkupResult[];
}

export interface LinkupDependencies {
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
  now?: Date;
}

function publicUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function fetchLinkupArticles(
  query: string,
  dependencies: LinkupDependencies = {},
): Promise<ContentItem[]> {
  const apiKey = dependencies.apiKey ?? process.env.LINKUP_API_KEY;
  if (!apiKey) throw new Error("LINKUP_API_KEY is required for Linkup research.");

  const request = dependencies.fetch ?? globalThis.fetch;
  const response = await request("https://api.linkup.so/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, depth: "standard", outputType: "searchResults" }),
  });

  if (!response.ok) throw new Error(`Linkup search failed with HTTP ${response.status}.`);

  const payload = await response.json() as LinkupSearchResponse;
  const fetchedAt = (dependencies.now ?? new Date()).toISOString();

  return (payload.results ?? []).flatMap((result): ContentItem[] => {
    const sourceUrl = publicUrl(result.url);
    if (!sourceUrl) return [];

    return [{
      id: `linkup:${sourceUrl}`,
      source: "linkup",
      sourceUrl,
      sourceLabel: new URL(sourceUrl).hostname.replace(/^www\./, ""),
      title: result.name?.trim() || "Untitled Linkup result",
      summary: result.content?.trim() ?? "",
      publishedAt: undefined,
      fetchedAt,
      topics: [],
    }];
  });
}
