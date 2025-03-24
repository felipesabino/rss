import { z } from "zod";

// Feed configuration schema
export const feedConfigSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string().url(),
});

export type FeedConfig = z.infer<typeof feedConfigSchema>;

// Feed list configuration
export const feeds: FeedConfig[] = [
  {
    id: 1,
    name: "Hacker News",
    url: "https://news.ycombinator.com/rss",
  },
  {
    id: 2,
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
  },
  // {
  //   id: 3,
  //   name: "Reddit /r/news",
  //   url: "https://www.reddit.com/r/news/.rss",
  // },
  // {
  //   id: 4,
  //   name: "Wired (top stories)",
  //   url: "https://www.wired.com/feed/rss",
  // },
  // {
  //   id: 5,
  //   name: "ARS Techinica (Technology Lab)",
  //   url: "https://feeds.arstechnica.com/arstechnica/technology-lab",
  // },
  // {
  //   id: 6,
  //   name: "Techcrunch",
  //   url: "https://techcrunch.com/feed/",
  // }
  // Add more feeds as needed
];