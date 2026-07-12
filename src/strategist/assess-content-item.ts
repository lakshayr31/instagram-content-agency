import type { ContentItem } from "../content-fetcher/types.js";

export type ContentVerdict = "important" | "watch" | "ignore";
export type PostType = "evergreen" | "controversial" | "growth";

export interface StrategyBrief {
  audience: string;
  focusTopics: string[];
}

export interface ContentAssessment {
  verdict: ContentVerdict;
  postType: PostType;
  score: number;
  rationale: string;
  suggestedAngle: string;
}

const CONTROVERSY_PATTERN = /backlash|controvers|critici[sz]|debate|disagree|dispute|feud|outrage|versus|\bvs\.?\b/i;
const GROWTH_PATTERN = /how to|guide|lesson|learn|tips?|strategy|mistakes?|explained|tutorial/i;

export function classifyPostType(item: ContentItem): PostType {
  const text = `${item.title} ${item.summary}`;
  if (CONTROVERSY_PATTERN.test(text)) return "controversial";
  if (GROWTH_PATTERN.test(text)) return "growth";
  return "evergreen";
}

function isFresh(publishedAt: string | undefined): boolean {
  if (!publishedAt) return false;
  const timestamp = Date.parse(publishedAt);
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= 1000 * 60 * 60 * 72;
}

function matchingTopics(item: ContentItem, brief: StrategyBrief): string[] {
  const itemText = `${item.title} ${item.summary} ${item.topics.join(" ")}`.toLowerCase();
  return brief.focusTopics.filter((topic) => itemText.includes(topic.toLowerCase()));
}

export function assessContentItem(item: ContentItem, brief: StrategyBrief): ContentAssessment {
  const matches = matchingTopics(item, brief);
  const fresh = isFresh(item.publishedAt);
  const score = Math.min(100, matches.length * 40 + (fresh ? 30 : 0));
  const topicPhrase = matches[0] ?? "the agency's audience";
  const postType = classifyPostType(item);

  if (score >= 65) {
    return {
      verdict: "important",
      postType,
      score,
      rationale: `Timely and relevant to ${matches.join(", ")}.`,
      suggestedAngle: `What ${item.title} means for ${brief.audience} on Instagram.`,
    };
  }

  if (score >= 30) {
    return {
      verdict: "watch",
      postType,
      score,
      rationale: `Potentially useful for ${topicPhrase}, but needs more context or confirmation.`,
      suggestedAngle: `A practical takeaway for ${brief.audience} from ${item.title}.`,
    };
  }

  return {
    verdict: "ignore",
    postType,
    score,
    rationale: "Not timely enough or relevant enough to the stated audience focus.",
    suggestedAngle: "No post recommended.",
  };
}
