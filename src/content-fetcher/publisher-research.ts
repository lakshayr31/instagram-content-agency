import { fetchLinkupArticles } from "./linkup-adapter.js";
import type { ContentItem } from "./types.js";

export interface PublisherResearchResult {
  question: string;
  articles: ContentItem[];
}

export interface PublisherResearchDependencies {
  search?: typeof fetchLinkupArticles;
}

export async function researchWithLinkupQuestions(
  questions: string[],
  dependencies: PublisherResearchDependencies = {},
): Promise<PublisherResearchResult[]> {
  const search = dependencies.search ?? fetchLinkupArticles;

  return Promise.all(questions.map(async (question) => ({
    question,
    articles: await search(question),
  })));
}
