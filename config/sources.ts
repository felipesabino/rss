import { z } from "zod";

// Source configuration schema
export const sourceConfigSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string().optional(), // URL is optional for google-search
  query: z.string().optional(), // Query is for google-search
  num: z.number().optional(), // Number of results for google-search
  dateRestrict: z.string().optional(), // Date restriction for google-search
  type: z.enum(["rss", "google-search"]).default("rss"),
  categories: z.array(z.string()).default([]),
});

export type SourceConfig = z.infer<typeof sourceConfigSchema>;

export type SourceInput = Omit<SourceConfig, "id">;

// Source list configuration
const sourceInputs: SourceInput[] = [
  {
    name: "Hacker News",
    url: "https://news.ycombinator.com/rss",
    categories: ["tech"],
    type: "rss" as const,
  },
  {
    name: "Reddit /r/singularity",
    url: "https://www.reddit.com/r/singularity.rss",
    categories: ["tech"],
    type: "rss" as const,
  },
  {
    name: "Reddit /r/news",
    url: "https://www.reddit.com/r/news/.rss",
    categories: ["world news"],
    type: "rss" as const,
  },
  {
    name: "ARS Techinica (Technology Lab)",
    url: "https://feeds.arstechnica.com/arstechnica/technology-lab",
    categories: ["tech"],
    type: "rss" as const,
  },
  {
    name: "Techcrunch",
    url: "https://techcrunch.com/feed/",
    categories: ["tech", "business"],
    type: "rss" as const,
  },
  {
    name: "Euronews – Pan-European news",
    url: "https://www.euronews.com/rss?level=theme&name=Europe",
    categories: ["regional news", "europe"],
    type: "rss" as const,
  },
  {
    name: "Politico Europe – European politics and policy",
    url: "https://www.politico.eu/feed/",
    categories: ["regional news", "europe"],
    type: "rss" as const,
  },
  {
    name: "EUobserver",
    url: "https://euobserver.com/rss",
    categories: ["regional news", "europe"],
    type: "rss" as const,
  },
  {
    name: "Le Monde",
    url: "https://www.lemonde.fr/rss/une.xml",
    categories: ["france", "regional news", "europe"],
    type: "rss" as const,
  },
  {
    name: "20 Minutes (FR)",
    url: "https://www.20minutes.fr/feeds/rss-une.xml",
    categories: ["france", "regional news", "europe"],
    type: "rss" as const,
  },
  {
    name: "Folha de São Paulo",
    url: "https://feeds.folha.uol.com.br/poder/rss091.xml",
    categories: ["brazil", "regional news"],
    type: "rss" as const,
  },
  {
    name: "UOL Notícias",
    url: "https://rss.uol.com.br/feed/noticias.xml",
    categories: ["brazil", "regional news"],
    type: "rss" as const,
  },
  {
    name: "Reddit /r/brasil",
    url: "https://www.reddit.com/r/brasil.rss",
    categories: ["brazil", "regional news"],
    type: "rss" as const,
  },
  {
    name: "Reddit /r/france",
    url: "https://www.reddit.com/r/france.rss",
    categories: ["france", "regional news"],
    type: "rss" as const,
  },
  {
    name: "Reddit /r/paris",
    url: "https://www.reddit.com/r/paris.rss",
    categories: ["france", "regional news"],
    type: "rss" as const,
  },
  {
    name: "Google Search - Developer Tools, CLI Enhancements, Agentic Coding, IDE Integrations",
    query: "(\"developer tools\" OR \"CLI tool\" OR \"coding assistant\" OR \"AI coding tool\" OR \"agentic coding\" OR \"terminal assistant\" OR \"developer workflow\" OR \"code generation tool\" OR \"AI mode\" OR \"IDE integration\") (\"new release\" OR \"announced\" OR \"preview\" OR \"beta\")",
    categories: ["tech"],
    type: "google-search" as const,
  },
  {
    name: "Google Search - AI Model Releases & Research Papers",
    query: "(\"new ai model\" OR \"new language model\" OR \"multimodal model\" OR \"agentic ai\" OR \"1 million token\" OR \"model card\" OR \"benchmark results\" OR \"error-free LLM\" OR \"deep think mode\" OR \"context window\" OR \"AI reasoning improvements\" OR \"AI CLI\" OR \"research paper\" OR \"arxiv preprint\")",
    categories: ["tech"],
    type: "google-search" as const,
  },
  {
    name: "Google Search - Technical Books, PDFs, and In-Depth Publications",
    query: "(\"technical book pdf\" OR \"research pdf\" OR \"academic publication\" OR \"computational mathematics\" OR \"formal methods\" OR \"complexity theory\")",
    categories: ["tech"],
    type: "google-search" as const,
  },
  {
    name: "Google Search - Africa - Diplomacy & Policy",
    query: "(France OR French) (Africa OR African OR Mali OR Niger OR Burkina Faso OR Chad OR Senegal OR Gabon OR Congo OR Morocco OR Algeria OR Tunisia OR Ethiopia) (diplomacy OR summit OR cooperation OR agreement OR embassy OR ambassador OR sanctions OR \"foreign policy\" OR \"bilateral relations\")",
    num: 10,
    dateRestrict: "d7",
    categories: ["africa"],
    type: "google-search" as const,
  },
  {
    name: "Google Search - Africa - Military & Security",
    query: "(France OR French) (Mali OR Niger OR Burkina Faso OR Chad OR Sahel OR Africa OR African) (\"military cooperation\" OR \"troop withdrawal\" OR \"security pact\" OR counterterrorism OR Wagner OR Barkhane OR junta OR coup)",
    num: 10,
    dateRestrict: "d7",
    categories: ["africa"],
    type: "google-search" as const,
  },
  {
    name: "Google Search - Africa - Economic, Energy & Logistics",
    query: "(France OR French) (Africa OR African OR Niger OR Gabon OR Congo OR Senegal OR Morocco OR Algeria OR Tunisia OR Ethiopia) (uranium OR Orano OR TotalEnergies OR investment OR \"trade deal\" OR oil OR gas OR infrastructure OR \"development aid\" OR logistics OR \"supply chain\" OR \"air cargo\" OR \"air freight\" OR port OR harbor OR \"shipping line\" OR \"CMA CGM\")",
    num: 10,
    dateRestrict: "d7",
    categories: ["africa"],
    type: "google-search" as const,
  },
  {
    name: "Google Search - Africa - Aviation & Air Cargo",
    query: "(\"Air France\" OR \"CMA CGM Air Cargo\" OR \"cargo airline\" OR \"air cargo\" OR \"air freight\" OR \"belly cargo\" OR \"freighter\" OR \"air route\" OR \"air service agreement\") (Africa OR African OR Mali OR Niger OR Burkina Faso OR Chad OR Senegal OR Gabon OR Congo OR Morocco OR Algeria OR Tunisia OR Ethiopia) (France OR French)",
    num: 15,
    dateRestrict: "d7",
    categories: ["africa"],
    type: "google-search" as const,
  },
  {
    name: "Google Search - Africa - Disruptions & Natural Hazards",
    query:
      "(" +
        "volcano OR eruption OR \"ash cloud\" OR \"volcanic ash\" OR earthquake OR " +
        "flood OR flooding OR cyclone OR hurricane OR storm OR landslide OR " +
        "\"dust storm\" OR wildfire OR drought OR \"natural disaster\" OR " +
        "\"geological event\"" +
      ") " +
      "(" +
        "airport OR airspace OR flights OR \"flight cancellations\" OR \"flight disruption\" OR " +
        "\"air traffic\" OR NOTAM OR runway OR \"air route\" OR \"air corridor\" OR " +
        "port OR harbour OR harbor OR canal OR \"shipping lane\" OR \"container ship\" OR " +
        "\"supply chain\" OR logistics OR \"trade route\" OR \"vessel traffic\" OR " +
        "\"navigation warning\"" +
      ") " +
      "(" +
        "Africa OR African OR Ethiopia OR Kenya OR Tanzania OR Uganda OR Rwanda OR " +
        "Somalia OR Sudan OR \"Red Sea\" OR \"Gulf of Aden\" OR \"Bab el-Mandeb\" OR " +
        "\"Suez Canal\" OR Niger OR Nigeria OR Ghana OR Senegal OR Congo OR " +
        "Mozambique OR Angola" +
      ")",
    num: 10,
    dateRestrict: "d7",
    categories: ["africa"],
    type: "google-search" as const,
  }
];

export const sources: SourceConfig[] = sourceInputs.map((source, index) => {
  return { ...source, id: index + 1 }
});

// Get all unique categories
export function getAllCategories(): string[] {
  const categoriesSet = new Set<string>();

  sources.forEach((source) => {
    source.categories.forEach((category) => {
      categoriesSet.add(category);
    });
  });

  return Array.from(categoriesSet).sort();
}
