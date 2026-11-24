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
// Google News RSS search, limited to the last day (when:1d goes first: Google drops it from the end of long queries).
// shortcut: its links are Google redirects, so article text isn't extracted and items reach the report as headlines only; decode the links if summaries are needed.
function googleNews(query: string, lang: "en" | "fr" = "en"): string {
  const locale = lang === "fr" ? "hl=fr&gl=FR&ceid=FR:fr" : "hl=en-US&gl=US&ceid=US:en";
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`when:1d ${query}`)}&${locale}`;
}

const sourceInputs: SourceInput[] = [
  {
    name: "Hacker News",
    url: "https://hnrss.org/frontpage",
    categories: ["tech"],
    type: "rss" as const,
  },
  {
    name: "BBC News – World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
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
    name: "Printful Blog",
    url: "https://www.printful.com/blog/feed",
    categories: ["pod"],
    type: "rss" as const,
  },
  {
    name: "Shopify Changelog",
    url: "https://changelog.shopify.com/feed",
    categories: ["pod"],
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
    name: "Google Search - POD Platform & Fulfillment Changes",
    query: "(\"print on demand\" OR POD) (Printful OR Printify OR Gelato OR Gooten OR \"CustomCat\" OR \"SPOD\" OR Apliiq) (update OR launch OR pricing OR shipping OR \"product catalog\" OR integration OR Shopify OR quality OR \"fulfillment time\")",
    num: 10,
    dateRestrict: "d7",
    categories: ["pod"],
    type: "google-search" as const,
  },
  {
    name: "Google Search - Shopify Apparel Growth Strategy",
    query: "(Shopify OR ecommerce) (apparel OR \"graphic t-shirt\" OR \"t shirt brand\") (marketing OR conversion OR \"email marketing\" OR \"product page\" OR \"customer acquisition\" OR \"creator partnership\" OR \"social commerce\")",
    num: 10,
    dateRestrict: "d7",
    categories: ["pod"],
    type: "google-search" as const,
  },
  {
    name: "Google Search - Hobby Culture & Giftable Apparel Ideas",
    query: "(\"new hobby\" OR \"hobby hopping\" OR \"hobby collector\" OR \"beginner hobby\" OR \"craft trend\" OR \"maker trend\") (trend OR community OR viral OR gift OR apparel OR t-shirt)",
    num: 10,
    dateRestrict: "d14",
    categories: ["pod"],
    type: "google-search" as const,
  },
  // Aviation – Africa / Canada: daily brief for an Air France cargo manager.
  // Sources tagged with both categories are global air cargo and aviation news.
  ...[
    { name: "The Loadstar", url: "https://theloadstar.com/feed/" },
    { name: "Air Cargo News", url: "https://www.aircargonews.net/feed/" },
    { name: "Air Cargo Week", url: "https://aircargoweek.com/feed/" },
    { name: "STAT Times", url: "https://www.stattimes.com/rss" },
    { name: "CargoForwarder Global", url: "https://www.cargoforwarder.eu/feed/" },
    { name: "AeroTime", url: "https://aerotime.aero/feed" },
    { name: "FlightGlobal", url: "https://www.flightglobal.com/rss" },
    { name: "Leeham News", url: "https://leehamnews.com/feed/" },
    { name: "The Air Current", url: "https://theaircurrent.com/feed/" },
    { name: "EASA News", url: "https://www.easa.europa.eu/en/newsroom-and-events/news/rss.xml" },
    {
      name: "Google News - Aviation safety & groundings",
      url: googleNews('(FAA OR EASA OR ICAO OR "Transport Canada") (grounding OR grounded OR "airworthiness directive" OR "ground stop" OR outage OR "airspace closure")'),
    },
  ].map((s) => ({ ...s, categories: ["aviation - africa", "aviation - canada"], type: "rss" as const })),
  ...[
    { name: "RFI Afrique", url: "https://www.rfi.fr/fr/afrique/rss" },
    { name: "Le Monde Afrique", url: "https://www.lemonde.fr/afrique/rss_full.xml" },
    { name: "France 24 Afrique", url: "https://www.france24.com/fr/afrique/rss" },
    { name: "Logistics Update Africa", url: "https://www.logupdateafrica.com/rss" },
    {
      name: "Google News - Africa air cargo",
      url: googleNews('("air cargo" OR "air freight" OR freighter OR "cargo airline") (Africa OR Senegal OR Dakar OR Ivoire OR Abidjan OR Ghana OR Nigeria OR Lagos OR Cameroon OR Douala OR Gabon OR Congo OR Kinshasa OR Angola OR Luanda OR Djibouti OR Chad)'),
    },
    {
      name: "Google News - Fret aérien Afrique",
      url: googleNews('("fret aérien" OR "cargo aérien" OR "Air France") (Afrique OR Dakar OR Nouakchott OR Conakry OR Abidjan OR Lomé OR Cotonou OR Douala OR Yaoundé OR Malabo OR Libreville OR "Port-Gentil" OR Brazzaville OR "Pointe-Noire" OR Kinshasa OR Ndjamena OR Djibouti)', "fr"),
    },
    {
      name: "Google News - Africa airport & airspace disruptions",
      url: googleNews('(airport OR airspace OR "flights suspended" OR "flights cancelled" OR strike) (Senegal OR Mauritania OR Guinea OR Ivoire OR Ghana OR Togo OR Benin OR Nigeria OR Cameroon OR "Equatorial Guinea" OR Gabon OR Congo OR Chad OR Angola OR Djibouti)'),
    },
    {
      name: "Google News - Antilles & Guyane aérien",
      url: googleNews('(aéroport OR vols OR "fret aérien" OR grève OR cyclone OR ouragan) (Martinique OR Guadeloupe OR Guyane OR "Fort-de-France" OR "Pointe-à-Pitre" OR Cayenne)', "fr"),
    },
  ].map((s) => ({ ...s, categories: ["aviation - africa"], type: "rss" as const })),
  ...[
    { name: "CBC News - Canada", url: "https://www.cbc.ca/webfeed/rss/rss-canada" },
    {
      name: "Google News - Canada air cargo",
      url: googleNews('("air cargo" OR "air freight" OR freighter OR "Air Canada Cargo" OR Cargojet) (Canada OR Montreal OR Toronto OR Vancouver OR Calgary OR Halifax)'),
    },
    {
      name: "Google News - Canada airport & airspace disruptions",
      url: googleNews('(airport OR "NAV CANADA" OR "air traffic" OR "flights cancelled" OR strike OR "ground stop") (Canada OR Montreal OR Toronto OR Vancouver OR Calgary)'),
    },
  ].map((s) => ({ ...s, categories: ["aviation - canada"], type: "rss" as const })),
  ...[
    { name: "20 Minutes Paris", url: "https://www.20minutes.fr/feeds/rss-paris.xml" },
    { name: "actu.fr Île-de-France", url: "https://www.actu.fr/ile-de-france/rss.xml" },
    { name: "Sortir à Paris", url: "https://www.sortiraparis.com/rss/actualites" },
    {
      name: "Google News - Paris transport & strikes",
      url: googleNews('(grève OR "trafic perturbé" OR fermeture OR travaux OR "mouvement social") (RATP OR SNCF OR RER OR métro OR Transilien OR périphérique) Paris', "fr"),
    },
    {
      name: "Google News - Paris weather & alerts",
      url: googleNews('(vigilance OR "Météo-France" OR canicule OR "pic de pollution" OR orages OR inondation OR neige) Paris', "fr"),
    },
    {
      name: "Google News - What changes in France",
      url: googleNews('("ce qui change" OR "à partir du 1er" OR "nouvelles règles" OR "date limite") (impôts OR CAF OR APL OR loyer OR "titre de séjour" OR Navigo OR retraite) France', "fr"),
    },
  ].map((s) => ({ ...s, categories: ["paris"], type: "rss" as const })),
  ...[
    { name: "Modern Retail", url: "https://www.modernretail.co/feed/" },
    { name: "Practical Ecommerce", url: "https://www.practicalecommerce.com/feed" },
    { name: "Colossal", url: "https://www.thisiscolossal.com/feed/" },
    { name: "Creative Bloq", url: "https://www.creativebloq.com/feeds/all" },
    {
      name: "Google News - Indie brands & small shops",
      url: googleNews('("indie brand" OR "small business owners" OR "DTC brand" OR "Etsy sellers" OR "Shopify merchants" OR "creator economy")'),
    },
  ].map((s) => ({ ...s, categories: ["indie e-commerce"], type: "rss" as const })),
  ...[
    { name: "Show HN", url: "https://hnrss.org/show?points=10" },
    { name: "Lobsters", url: "https://lobste.rs/rss" },
    { name: "Simon Willison", url: "https://simonwillison.net/atom/everything/" },
    { name: "Ink & Switch", url: "https://www.inkandswitch.com/index.xml" },
    { name: "Product Hunt", url: "https://www.producthunt.com/feed" },
  ].map((s) => ({ ...s, categories: ["personal tools"], type: "rss" as const })),
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
