export interface CarouselSlide {
  number: number;
  headline: string;
  body?: string;
  source?: string;
  emphasis?: string;
}

export interface CarouselCampaign {
  id: "sainz-williams" | "leclerc-journey" | "aduo-explainer";
  title: string;
  kicker: string;
  palette: { background: string; accent: string; accentSoft: string; ink: string };
  slides: CarouselSlide[];
}

export const campaigns: CarouselCampaign[] = [
  {
    id: "sainz-williams",
    title: "Carlos Sainz + Williams",
    kicker: "F1 CONTEXT / THE EVIDENCE",
    palette: { background: "#061A2E", accent: "#56B4FF", accentSoft: "#CBEAFF", ink: "#F7FBFF" },
    slides: [
      { number: 1, headline: "Is Carlos Sainz already worried about Williams?", body: "What the report actually says →" },
      { number: 2, headline: "Yes—about the performance trend.", body: "Not a confirmed exit.", source: "Reported by The Race" },
      { number: 3, headline: "Williams reportedly began 2026 up to 28kg over the weight limit.", source: "Reported by The Race", emphasis: "UP TO 28KG" },
      { number: 4, headline: "Weight came off.", body: "The gap to the front and midfield leader kept growing.", source: "Sainz, via The Race" },
      { number: 5, headline: "“We don't seem to be finding the laptime that we expected in the winter.”", body: "— Carlos Sainz", source: "Quote reported by The Race" },
      { number: 6, headline: "A front wing was fast-tracked for Silverstone.", body: "The expected uplift was larger.", source: "Reported by The Race" },
      { number: 7, headline: "The verdict", body: "A real warning on pace. Not proof Sainz wants to leave.", source: "Reported by The Race" },
      { number: 8, headline: "Can Williams turn it around?", body: "Development issue? Weight compromise? Too early to judge?\n\nDrop your take below.", source: "Source: The Race" },
    ],
  },
  {
    id: "leclerc-journey",
    title: "Charles Leclerc journey",
    kicker: "F1 CONTEXT / TIMELINE",
    palette: { background: "#1A0B0A", accent: "#D8232A", accentSoft: "#FFD9CF", ink: "#FFF7EC" },
    slides: [
      { number: 1, headline: "FROM MONACO KARTING TO FERRARI GLORY.", body: "The journey of number 16." },
      { number: 2, headline: "MONTE CARLO\nAGE 5", body: "Leclerc began competitive karting.", source: "Source: approved biography record" },
      { number: 3, headline: "THE TITLES CAME FIRST.", body: "2016 — GP3 champion\n2017 — Formula 2 champion", source: "Source: approved biography record" },
      { number: 4, headline: "2018\nFORMULA 1 DEBUT.", body: "Australian Grand Prix. Sauber.", source: "Source: approved biography record" },
      { number: 5, headline: "2019\nA FERRARI DRIVER.", body: "Then his first F1 win: Belgian Grand Prix.", source: "Source: approved biography record" },
      { number: 6, headline: "2019\nMONZA.", body: "A Ferrari win at home.", source: "Source: approved biography record" },
      { number: 7, headline: "2022\nRUNNER-UP", body: "In the Drivers’ Championship.", source: "Source: approved biography record" },
      { number: 8, headline: "2024\nMONACO WON.", body: "The first Monégasque winner in 93 years.", source: "Source: approved biography record" },
      { number: 9, headline: "5 JULY 2026\nSILVERSTONE.", body: "Charles Leclerc wins for Ferrari.\n\nF1 victory no. 9.", source: "Source: official F1 results" },
      { number: 10, headline: "MONACO. FERRARI. 16.", body: "THE STORY CONTINUES.\n\nSave this journey." },
    ],
  },
  {
    id: "aduo-explainer",
    title: "ADUO engine explainer",
    kicker: "F1 CONTEXT / RULES EXPLAINED",
    palette: { background: "#11171C", accent: "#33D6C5", accentSoft: "#CBFFF8", ink: "#F4FAFA" },
    slides: [
      { number: 1, headline: "F1’s 2026 ENGINE CATCH-UP RULE, IN 20 SECONDS", body: "ADUO explained" },
      { number: 2, headline: "ADUO = Additional Development and Upgrade Opportunities.", body: "It gives eligible power-unit manufacturers extra chances to upgrade.", source: "Source: Formula1.com" },
      { number: 3, headline: "What is measured?", body: "The FIA compares combustion-engine performance using its ICE Performance Index.\n\nNot total power-unit performance.", source: "Source: Formula1.com" },
      { number: 4, headline: "2% to under 4% behind the leading ICE?", body: "1 extra upgrade this season\n+ 1 next season", source: "Source: Formula1.com", emphasis: "2%–<4%" },
      { number: 5, headline: "4% or more behind?", body: "2 extra upgrades this season\n+ 2 next season\n\nNot balance of performance. Not an instant speed boost.", source: "Source: Formula1.com", emphasis: "4%+" },
    ],
  },
];

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function wrapSlideText(value: string, maxCharacters: number): string[] {
  return value.split("\n").flatMap((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [""];
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && candidate.length > maxCharacters) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
    return lines;
  });
}

function textLines(value: string, x: number, y: number, size: number, weight: number, fill: string, lineHeight = 1.1): string {
  return escapeXml(value).split("\n").map((line, index) =>
    `<text x="${x}" y="${y + index * size * lineHeight}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${line}</text>`,
  ).join("\n");
}

export type CarouselLayout = "type-led" | "image-led" | "image-led-right";

export function createCarouselSlideSvg(
  campaign: CarouselCampaign,
  slide: CarouselSlide,
  heroImageFilename: string,
  visualCredit = "AI visual concept",
  layout: CarouselLayout = "type-led",
): string {
  const { background, accent, accentSoft, ink } = campaign.palette;
  const isRightPanel = layout === "image-led-right";
  const isImageLed = layout !== "type-led" || visualCredit !== "AI visual concept";
  const headlineSize = isImageLed ? 54 : slide.headline.length > 34 ? 68 : 78;
  const headline = wrapSlideText(slide.headline, isRightPanel ? 19 : isImageLed ? 26 : headlineSize === 68 ? 22 : 20).join("\n");
  const body = slide.body ? wrapSlideText(slide.body, isRightPanel ? 26 : isImageLed ? 40 : 34).join("\n") : "";
  const textX = isRightPanel ? 430 : 72;
  const headlineY = 410;
  const bodyY = isRightPanel ? 770 : 860;
  const source = slide.source ? `<text x="72" y="1254" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="600" fill="${accentSoft}">${escapeXml(slide.source)}</text>` : "";
  const emphasis = slide.emphasis ? `<text x="72" y="330" font-family="Arial, Helvetica, sans-serif" font-size="50" font-weight="800" fill="${accent}">${escapeXml(slide.emphasis)}</text>` : "";
  const imageOpacity = isImageLed ? "0.9" : slide.number === 1 ? "0.54" : "0.24";
  const shade = isImageLed
    ? `<linearGradient id="shade" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${background}" stop-opacity="0.62"/><stop offset="0.55" stop-color="${background}" stop-opacity="0.12"/><stop offset="1" stop-color="${background}" stop-opacity="0.42"/></linearGradient>`
    : `<linearGradient id="shade" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${background}" stop-opacity="0.06"/><stop offset="1" stop-color="${background}" stop-opacity="0.94"/></linearGradient>`;
  const photoTextPanel = isImageLed
    ? `<rect id="photo-text-panel" x="${isRightPanel ? 400 : 44}" y="276" width="${isRightPanel ? 636 : 748}" height="${isRightPanel ? 390 : 290}" rx="10" fill="${background}" fill-opacity="0.66"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1080 1350" width="1080" height="1350">
  <defs>
    ${shade}
    <pattern id="grid" width="54" height="54" patternUnits="userSpaceOnUse"><path d="M54 0H0V54" fill="none" stroke="${accent}" stroke-opacity="0.12" stroke-width="1"/></pattern>
  </defs>
  <rect width="1080" height="1350" fill="${background}"/>
  <image href="${escapeXml(heroImageFilename)}" xlink:href="${escapeXml(heroImageFilename)}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice" opacity="${imageOpacity}"/>
  <rect width="1080" height="1350" fill="url(#shade)"/>
  <rect width="1080" height="1350" fill="url(#grid)"/>
  ${photoTextPanel}
  <rect x="72" y="72" width="130" height="8" fill="${accent}"/>
  <text x="72" y="124" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" letter-spacing="2" fill="${accentSoft}">${escapeXml(campaign.kicker)}</text>
  <text x="1008" y="124" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="${accentSoft}">${String(slide.number).padStart(2, "0")}/${String(campaign.slides.length).padStart(2, "0")}</text>
  ${emphasis}
  ${textLines(headline, textX, headlineY, headlineSize, 800, ink, 1.06)}
  ${body ? textLines(body, textX, bodyY, isRightPanel ? 36 : 42, 500, accentSoft, 1.35) : ""}
  <line x1="72" y1="1172" x2="1008" y2="1172" stroke="${accent}" stroke-opacity="0.55" stroke-width="2"/>
  ${source}
  <text x="1008" y="1254" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="600" fill="${accentSoft}">${escapeXml(visualCredit)}</text>
</svg>`;
}
