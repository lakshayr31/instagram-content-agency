import { loadContentFetcherPersona } from "./content-fetcher/persona.js";
import { runContentIntelligenceCycle } from "./content-intelligence-cycle.js";

const persona = loadContentFetcherPersona();
const opportunities = await runContentIntelligenceCycle(persona);

console.log(JSON.stringify({
  fetchedAt: new Date().toISOString(),
  persona: { niche: persona.niche, audience: persona.audience },
  opportunities: opportunities.map(({ item, assessment }) => ({
    title: item.title,
    sourceUrl: item.sourceUrl,
    source: item.source,
    verdict: assessment.verdict,
    postType: assessment.postType,
    rationale: assessment.rationale,
    suggestedAngle: assessment.suggestedAngle,
  })),
}, null, 2));
