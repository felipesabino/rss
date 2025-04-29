import { z } from "zod";

// Feed configuration schema
export const feedConfigSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string().url(),
  categories: z.array(z.string()).default([]),
});

export type FeedConfig = z.infer<typeof feedConfigSchema>;

// Feed list configuration
export const feeds: FeedConfig[] = [
  {
    id: 1,
    name: "Hacker News",
    url: "https://news.ycombinator.com/rss",
    categories: ["tech"],
  },
  {
    id: 18,
    name: "Reddit /r/singularity",
    url: "https://www.reddit.com/r/singularity.rss",
    categories: ["tech"],
  },
  {
    id: 3,
    name: "Reddit /r/news",
    url: "https://www.reddit.com/r/news/.rss",
    categories: ["world news"],
  },
  {
    id: 5,
    name: "ARS Techinica (Technology Lab)",
    url: "https://feeds.arstechnica.com/arstechnica/technology-lab",
    categories: ["tech"],
  },
  {
    id: 2,
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
    categories: ["tech"],
  },
  {
    id: 6,
    name: "Techcrunch",
    url: "https://techcrunch.com/feed/",
    categories: ["tech", "business"],
  },
  {
    id: 7,
    name: "Euronews – Pan-European news",
    url: "https://www.euronews.com/rss?level=theme&name=Europe",
    categories: ["regional news", "europe"],
  },
  {
    id: 8,
    name: "Politico Europe – European politics and policy",
    url: "https://www.politico.eu/feed/",
    categories: ["regional news", "europe"],
  },
  {
    id: 9,
    name: "EUobserver",
    url: "https://euobserver.com/rss",
    categories: ["regional news", "europe"],
  },
  {
    id: 10,
    name: "Le Monde",
    url: "https://www.lemonde.fr/rss/une.xml",
    categories: ["france", "regional news", "europe"],
  },
  {
    id: 11,
    name: "France 24 (FR)",
    url: "https://www.france24.com/fr/rss",
    categories: ["france", "regional news", "europe"],
  },
  {
    id: 15,
    name: "20 Minutes (FR)",
    url: "https://www.20minutes.fr/feeds/rss-une.xml",
    categories: ["france", "regional news", "europe"],
  },
  {
    id: 12,
    name: "Folha de São Paulo",
    url: "https://feeds.folha.uol.com.br/poder/rss091.xml",
    categories: ["brazil", "regional news"],
  },
  {
    id: 14,
    name: "UOL Notícias",
    url: "https://rss.uol.com.br/feed/noticias.xml",
    categories: ["brazil", "regional news"],
  },
  {
    id: 17,
    name: "Reddit /r/brasil",
    url: "https://www.reddit.com/r/brasil.rss",
    categories: ["brazil", "regional news"],
  }, 
  {
    id: 19,
    name: "Reddit /r/france",
    url: "https://www.reddit.com/r/france.rss",
    categories: ["france", "regional news"],
  }, 
  {
    id: 20,
    name: "Reddit /r/paris",
    url: "https://www.reddit.com/r/paris.rss",
    categories: ["france", "regional news"],
  }, 
];

// Get all unique categories
export function getAllCategories(): string[] {
  const categoriesSet = new Set<string>();

  feeds.forEach((feed) => {
    feed.categories.forEach((category) => {
      categoriesSet.add(category);
    });
  });

  return Array.from(categoriesSet).sort();
}
