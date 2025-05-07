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
    name: "Hacker News",
    url: "https://news.ycombinator.com/rss",
    categories: ["tech"],
  },
  {
    name: "Reddit /r/singularity",
    url: "https://www.reddit.com/r/singularity.rss",
    categories: ["tech"],
  },
  {
    name: "Reddit /r/news",
    url: "https://www.reddit.com/r/news/.rss",
    categories: ["world news"],
  },
  {
    name: "ARS Techinica (Technology Lab)",
    url: "https://feeds.arstechnica.com/arstechnica/technology-lab",
    categories: ["tech"],
  },
  {
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
    categories: ["tech"],
  },
  {
    name: "Techcrunch",
    url: "https://techcrunch.com/feed/",
    categories: ["tech", "business"],
  },
  {
    name: "Euronews – Pan-European news",
    url: "https://www.euronews.com/rss?level=theme&name=Europe",
    categories: ["regional news", "europe"],
  },
  {
    name: "Politico Europe – European politics and policy",
    url: "https://www.politico.eu/feed/",
    categories: ["regional news", "europe"],
  },
  {
    name: "EUobserver",
    url: "https://euobserver.com/rss",
    categories: ["regional news", "europe"],
  },
  {
    name: "Le Monde",
    url: "https://www.lemonde.fr/rss/une.xml",
    categories: ["france", "regional news", "europe"],
  },
  {
    name: "France 24 (FR)",
    url: "https://www.france24.com/fr/rss",
    categories: ["france", "regional news", "europe"],
  },
  {
    name: "20 Minutes (FR)",
    url: "https://www.20minutes.fr/feeds/rss-une.xml",
    categories: ["france", "regional news", "europe"],
  },
  {
    name: "Folha de São Paulo",
    url: "https://feeds.folha.uol.com.br/poder/rss091.xml",
    categories: ["brazil", "regional news"],
  },
  {
    name: "UOL Notícias",
    url: "https://rss.uol.com.br/feed/noticias.xml",
    categories: ["brazil", "regional news"],
  },
  {
    name: "Reddit /r/brasil",
    url: "https://www.reddit.com/r/brasil.rss",
    categories: ["brazil", "regional news"],
  }, 
  {
    name: "Reddit /r/france",
    url: "https://www.reddit.com/r/france.rss",
    categories: ["france", "regional news"],
  }, 
  {
    name: "Reddit /r/paris",
    url: "https://www.reddit.com/r/paris.rss",
    categories: ["france", "regional news"],
  }, 
].map((feed, index) => {
  return {...feed, id: index+1}
});

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
