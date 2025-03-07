import { z } from "zod";

// Feed configuration schema
export const feedConfigSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string().url(),
  updateInterval: z.number().default(30), // minutes
});

export type FeedConfig = z.infer<typeof feedConfigSchema>;

// Feed list configuration
export const feeds: FeedConfig[] = [
  {
    id: 1,
    name: "Hacker News",
    url: "https://news.ycombinator.com/rss",
    updateInterval: 30,
  },
  {
    id: 2,
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
    updateInterval: 60,
  },
  {
    id: 3,
    name: "Reddit /r/news",
    url: "https://www.reddit.com/r/news/.rss",
    updateInterval: 30
  }
  // Add more feeds as needed
];