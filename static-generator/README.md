# Static Site Generator for RSS Feeds

This is a static site generator for RSS feeds that creates a lightweight, fast-loading HTML page with minimal dependencies. The generator:

1. Fetches content from configured RSS feeds
2. Extracts the main content from each article
3. Optionally generates AI summaries for longer articles
4. Renders a static HTML page with all feed items organized by source

## How to Use

### Configuration

Edit the feed configuration in `config/feeds.ts` to add or remove feed sources:

```ts
export const feeds: FeedConfig[] = [
  {
    id: 1, 
    name: "Feed Name",
    url: "https://example.com/rss",
    updateInterval: 30, // minutes
  },
  // Add more feeds as needed
];
```

### Commands

- `npm run build` - Generate the static site (fetch feeds, process content, and build HTML)
- `npm run preview` - Preview the generated static site locally
- `npm run generate` - Run the generator script independently

## Design Philosophy

This project follows a brutalist design aesthetic, focusing on:

- Minimal styling
- Fast loading times
- Content readability
- No client-side JavaScript dependencies (except for the summary toggle feature)