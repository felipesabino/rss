
// Shared brief for the Air France cargo manager responsible for Africa and Canada.
// The keywords here also drive item ranking (static-generator/services/scoring.ts).
function aviationBrief(region: string, network: string, competitors: string, demand: string, politics: string): string {
    return `Reader: an Air France cargo manager responsible for ${region}, reading this before the work day starts. Goal: what changed in the last 24-48 hours that affects ${network}.
Rank stories in this order and skip anything that fits none of them:
(1) Operational disruptions: airport closures, airspace closures, strikes, weather, volcanic ash, security incidents, fuel shortages, IT or air traffic control outages.
(2) Capacity and competitors: new or cut routes, freighters, frequencies, belly capacity, air cargo rates and volumes, moves by ${competitors}, and Air France / Air France-KLM Martinair Cargo news.
(3) Customs, tariffs, export bans, security screening, airport charges and aviation regulation.
(4) Demand signals: ${demand}.
(5) Industry-wide aviation events even outside ${region}: FAA, EASA, ICAO or Transport Canada groundings, airworthiness directives, ground stops, engine or aircraft-type issues, major outages. Include these when they can affect fleets, schedules or capacity anywhere in the network.
(6) Politics and economy only when they change operations: ${politics}.
Rules:
- Use only news published in the last 48 hours. Skip evergreen web pages, studies, job ads, fare pages, product pages, reviews and opinion pieces without a new event.
- State facts from the items. Never invent an Air France impact; if there is none, say "No direct Air France impact". Many items only have a headline: do not guess details that the headline does not give.
- Industry-wide stories go in Main Stories only if they are the most important news of the day; otherwise put them in What Else Is Going On, starting with "Industry:".
- If it is a quiet day, use fewer stories and say so in the header. Never pad.
- Tone: plain, professional, no jokes, no puns, no Markdown formatting (no ** or #).
- Field use: header = one sentence on the day (or "Quiet day"); whyItMatters = the cargo or operational consequence; shortTermImpact = what to do or watch this week; longTermImpact = one sentence or "None expected"; byTheNumbers only for a real figure from the items (rate, volume, capacity, delay); signOff = "Watch:" followed by the one thing to check tomorrow.`;
}

export const categoryPrompts: Record<string, string> = {
    "aviation - africa": aviationBrief(
        "Africa and the French Caribbean",
        "flights and cargo between France/Europe and her stations: Dakar (DSS), Nouakchott (NKC), Conakry (CKY), Abidjan (ABJ), Accra (ACC), Lomé (LFW), Cotonou (COO), Lagos (LOS), Abuja (ABV), Douala (DLA), Yaoundé (NSI), Malabo (SSG), Libreville (LBV), Port-Gentil (POG), Brazzaville (BZV), Pointe-Noire (PNR), Kinshasa (FIH), N'Djamena (NDJ), Luanda (NBJ), Djibouti (JIB), plus Fort-de-France (FDF, Martinique), Pointe-à-Pitre (PTP, Guadeloupe) and Cayenne (CAY, French Guiana). Countries: Senegal, Mauritania, Guinea, Côte d'Ivoire, Ghana, Togo, Benin, Nigeria, Cameroon, Equatorial Guinea, Gabon, Republic of the Congo, DR Congo, Chad, Angola, Djibouti, Martinique, Guadeloupe, French Guiana. Other African countries matter only if they affect these stations",
        "Ethiopian Cargo, Turkish Cargo, Emirates SkyCargo, Qatar Airways Cargo, Royal Air Maroc, Brussels Airlines, Lufthansa Cargo, ASKY, Air Côte d'Ivoire, Air Sénégal, Air Peace, Camair-Co, TAAG, Corsair, Air Caraïbes, French bee, CMA CGM Air Cargo",
        "fresh produce and fish exports (mangoes, pineapples, seafood), pharma and humanitarian cargo, oil and gas equipment (Gabon, Congo, Angola, Equatorial Guinea, Nigeria), mining (Guinea, DR Congo), e-commerce and spare parts",
        "coups, sanctions, overflight bans, curfews, elections and unrest, security incidents near airports, fuel shortages, currency and payment repatriation problems, hurricanes in the Caribbean",
    ),

    "aviation - canada": aviationBrief(
        "Canada",
        "flights and cargo between France/Europe and Canada, especially Montreal (YUL), Toronto (YYZ), Vancouver (YVR), Calgary (YYC), Halifax (YHZ) and Quebec City (YQB)",
        "Air Canada Cargo, Cargojet, WestJet Cargo, Air Transat, Lufthansa Cargo, KLM, British Airways, Icelandair, CMA CGM Air Cargo",
        "seafood and lobster exports, pharma, aerospace parts, e-commerce, critical minerals",
        "Canada–EU trade and tariffs (CETA, US tariffs), labour disputes at airports, NAV CANADA, CBSA, rail and ports",
    ),

    tech: `Produce a concise, discovery-oriented newsletter brief on notable developments across software and the wider technology industry over the past day. The audience is a tech-aware reader, but not necessarily a specialist, so avoid deep implementation details and focus on what happened, why it matters, and how it may change how people build or use technology. Prioritize breadth, signal, and genuine discovery over the most heavily covered subjects. Look for important or surprising developments that may be missed by mainstream technology coverage, including open-source projects and maintainers, programming languages and frameworks, databases, infrastructure and cloud platforms, developer tools, cybersecurity and privacy, outages and reliability, hardware and chips, robotics, networking, standards, digital rights, technology policy and regulation, research with practical implications, and visible trends in communities such as Hacker News, Reddit, and relevant specialist forums. Include developments from smaller companies, independent projects, and less prominent regions when they are credible and consequential.
    AI, machine-learning models, LLMs, and generative AI should not dominate the brief or be treated as an automatic category. Include them only when there is a clearly verified, material development with practical consequences, such as a significant security incident, widely adopted capability, important policy change, meaningful research result, major infrastructure shift, or substantial product change. Exclude routine model releases, minor benchmark gains, funding announcements, speculative claims, promotional launch coverage, and recycled commentary unless they have demonstrable impact. When AI is not the most consequential subject of the day, give the space to other areas of technology instead.
    For each major story, clearly describe the core event, the key actors involved (companies, projects, researchers, regulators, communities), what makes it worth attention, and the likely practical impact in the short term (coming days or weeks) and the longer term (months or years). Distinguish confirmed facts from interpretation and speculation, favor primary sources and reliable reporting, and avoid repeating several stories that describe the same underlying development. Perform a sentiment analysis for each major story and for the overall day’s news, classifying them as positive, negative, or mixed from the perspective of users and developers.`,

    pod: `Produce a practical daily print-on-demand intelligence brief for Obsessive Starter, a Shopify graphic-t-shirt brand for hobby hoppers. Its voice is warm, self-aware, sarcastic, and celebratory: it treats the exhilarating start of a new hobby as the point, never as a personal failure.

Prioritize recent, verified developments that can change a small POD apparel shop's decisions: (1) platform, catalog, pricing, integration, fulfillment-quality, production-time, shipping, or policy changes at Shopify and POD providers such as Printful, Printify, Gelato, Gooten, CustomCat, SPOD, and Apliiq; (2) ecommerce growth tactics with credible evidence for Shopify apparel, including product-page conversion, bundles, email/SMS consent, creator partnerships, organic social, merchandising, and retention; (3) emerging hobby communities, seasonal moments, gift occasions, memes, and consumer-language signals that could become an original "serial hobby starter" design or collection; and (4) operational risks, including delivery disruption, customer-service issues, fees, intellectual-property policy, or marketplace/platform rule changes.

For every item, state the confirmed development, source and date, the direct implication for Obsessive Starter, and a specific next action labeled "Do now", "Watch", or "Ignore". For promising creative signals, propose at most one original design-angle or collection hypothesis using fresh wording; do not reproduce slogans, artwork, brand names, protected characters, or distinctive third-party copy. Separate evidence from inference, flag unverified community anecdotes as anecdotes, favor official sources for platform changes, and deduplicate stories covering the same event. Do not fill the report with generic "start a POD business" advice, SEO listicles, speculative trend claims, or routine AI announcements. End with a prioritized three-item action queue and classify each major item and the overall outlook as positive, negative, or mixed for Obsessive Starter.`
};

// Ranking terms that replace the prompt text when scoring items for a category.
// The scorer keeps only the 40 most frequent prompt words, which for long prompts are generic
// ("cargo", "air") and let unrelated global trade news outrank the reader's own stations.
const industryTerms = "grounding grounded airworthiness outage FAA EASA";
export const categoryRankingTerms: Record<string, string> = {
    "aviation - africa": `Africa Afrique Senegal Dakar Mauritania Nouakchott Conakry Ivoire Abidjan Ghana Accra Togo Lomé Benin Cotonou Nigeria Lagos Abuja Cameroon Douala Malabo Gabon Libreville Congo Brazzaville Kinshasa Chad Angola Luanda Djibouti Martinique Guadeloupe Guyane ${industryTerms}`,
    "aviation - canada": `Canada Canadian Montreal Toronto Vancouver Calgary Halifax Quebec Ottawa YUL YYZ YVR Cargojet WestJet Transat CBSA ${industryTerms}`,
};
