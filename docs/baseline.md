# Static Generator Baseline (2025-11-27)

This records the current end-to-end behavior before refactors. Captured from `npm run build` (took ~7m12s wall clock) executed at 2025-11-27 20:05 local time. The run finished successfully and wrote `dist/index.html` and `dist/styles.css`.

## Run Notes
- Command: `npm run build` (invokes `tsx static-generator/generator.ts --all`)
- Result: success; OpenAI summarization completed for text items.
- External limits observed: Google Custom Search requests hit daily quota and returned 0 items for all Google sources during this run.
- Cache timestamps (ms since epoch): step1 1764269901573, step2 1764269908891, step3 1764269912464, step4 1764269912480, step5 1764270332532.

## Pipeline Behavior (Steps)
- **Step 1 – Fetch sources**: pulls 23 configured sources; RSS feeds parsed with `rss-parser`/fallbacks; items filtered to last 24h and capped by `MAX_ITEMS_PER_FEED` (10). Google search sources attempted but returned 0 items because of quota. Output: `.cache/step1-raw-feeds.json` (items keyed by feed id + feed metadata).
- **Step 2 – Extract content**: iterates cached feeds, replaces Reddit links with outbound URLs, detects YouTube/media extensions, calls `contentExtractor` otherwise. Produces structured items with publication dates. Output: `.cache/step2-extracted-content.json` (flat `items` array).
- **Step 3 – Process content**: classifies media type (`text`, `image`, `short-text`, etc.) using URL/domain/extension heuristics, sets `shouldSkipAI`, and preserves media URL. Output: `.cache/step3-processed-content.json`.
- **Step 4 – Process with OpenAI**: runs `analyzeItem` unless `shouldSkipAI` is true; adds `summary`, `hasSummary`, and `isPositive`. Skipped items default to `hasSummary: false`, `isPositive: false`. Output: `.cache/step4-ai-processed-content.json`.
- **Step 5 – Generate reports**: groups items by category, applies ranking when a category prompt exists (e.g., `tech`), and writes structured newsletter-style reports plus scoring audit. Output: `.cache/step5-reports.json` and `.cache/scoring-history.json`.
- **Step 6 – Generate HTML**: renders `static-generator/templates/index.ejs` with AI items and reports; writes `dist/index.html` and copies `dist/styles.css`.

## Cache File Structures (examples)

Step 1 (`.cache/step1-raw-feeds.json`):
```json
{
  "items": {
    "1": [
      {
        "title": "The Input Stack on Linux: An End-to-End Architecture Overview",
        "link": "https://venam.net/blog/unix/2025/11/27/input_devices_linux.html",
        "pubDate": "Thu, 27 Nov 2025 16:55:30 +0000",
        "content": "<a href=\"https://news.ycombinator.com/item?id=46071030\">Comments</a>",
        "comments": "https://news.ycombinator.com/item?id=46071030"
      }
    ]
  },
  "feedMetadata": {
    "1": {
      "title": "Hacker News",
      "description": "Links for the intellectually curious, ranked by readers.",
      "siteUrl": "https://news.ycombinator.com/",
      "iconUrl": ""
    }
  },
  "lastUpdated": 1764269901573
}
```

Step 2 (`.cache/step2-extracted-content.json`), 28 items:
```json
{
  "id": 1,
  "feedId": 1,
  "title": "The Input Stack on Linux: An End-to-End Architecture Overview",
  "url": "https://venam.net/blog/unix/2025/11/27/input_devices_linux.html",
  "content": "Intro\n\nLet's explore and deobfuscate the input stack on Linux...",
  "published": "2025-11-27T16:55:30.000Z",
  "commentsUrl": "https://news.ycombinator.com/item?id=46071030"
}
```

Step 3 (`.cache/step3-processed-content.json`), 28 items:
```json
{
  "id": 1,
  "feedId": 1,
  "title": "The Input Stack on Linux: An End-to-End Architecture Overview",
  "url": "https://venam.net/blog/unix/2025/11/27/input_devices_linux.html",
  "content": "Intro\n\nLet's explore and deobfuscate the input stack on Linux...",
  "published": "2025-11-27T16:55:30.000Z",
  "commentsUrl": "https://news.ycombinator.com/item?id=46071030",
  "mediaType": "text",
  "mediaUrl": "https://venam.net/blog/unix/2025/11/27/input_devices_linux.html",
  "shouldSkipAI": false
}
```

Step 4 (`.cache/step4-ai-processed-content.json`), 28 items:
```json
{
  "id": 1,
  "feedId": 1,
  "title": "The Input Stack on Linux: An End-to-End Architecture Overview",
  "url": "https://venam.net/blog/unix/2025/11/27/input_devices_linux.html",
  "content": "Intro\n\nLet's explore and deobfuscate the input stack on Linux...",
  "published": "2025-11-27T16:55:30.000Z",
  "commentsUrl": "https://news.ycombinator.com/item?id=46071030",
  "mediaType": "text",
  "mediaUrl": "https://venam.net/blog/unix/2025/11/27/input_devices_linux.html",
  "shouldSkipAI": false,
  "summary": "The text provides a detailed technical overview of Linux's input subsystem, including kernel input handling, device hierarchy, sysfs interface, HID protocol, and evdev.",
  "hasSummary": true,
  "isPositive": false
}
```

Step 5 (`.cache/step5-reports.json`), 7 reports:
```json
{
  "category": "brazil",
  "generatedAt": 1764269997833,
  "usedItemIds": [21, 22, 19, 20, 23],
  "report": {
    "header": "Bom dia, Brasil. Justica, politica e curiosidades em uma edicao afiada.",
    "mainStories": [
      {
        "sectionTag": "JUSTICA",
        "headline": "STF divulga video das condicoes da Papudinha, onde Anderson Torres esta preso",
        "sourceName": "Folha de S. Paulo",
        "sourceUrl": "https://redir.folha.com.br/redir/online/poder/rss091/*https://www1.folha.uol.com.br/poder/2025/11/stf-divulga-video-sobre-condicoes-da-papudinha-onde-esta-preso-anderson-torres-veja.shtml",
        "whatHappened": "STF publicou video com imagens das condicoes da Papudinha, onde o ex-ministro esta detido.",
        "whyItMatters": "Transparencia em detencao de figura publica e debate sobre condicoes prisionais.",
        "shortTermImpact": "semanas",
        "longTermImpact": "6-24 meses",
        "sentiment": "Mixed"
      }
    ]
  }
}
```

Scoring audit (`.cache/scoring-history.json`), 8 records:
```json
{
  "label": "tech",
  "scoredAt": 1764270228866,
  "customInstructions": "Produce a concise, newsletter-style daily brief on notable developments in software...",
  "selectedItems": [
    { "id": 1, "title": "The Input Stack on Linux: An End-to-End Architecture Overview", "summary": "..." },
    { "id": 8, "title": "Glid won Startup Battlefield 2025...", "summary": "..." }
  ]
}
```

## Inputs (required to reproduce)
- Environment variables: `OPENAI_API_KEY`, `OPENAI_API_BASE_URL`, `OPENAI_MODEL_NAME`, `OPENAI_SENTIMENT_MODEL_NAME`, `OPENAI_REPORT_MODEL_NAME`, `MAX_ITEMS_PER_FEED`, `GOOGLE_SEARCH_API_KEY`, `GOOGLE_SEARCH_CX_DEFAULT` (see `.env.example`).
- Configuration: `config/sources.ts` (source list, categories), `config/category-prompts.ts` (per-category prompts), `config/constants.ts` (media heuristics).
- Templates/assets: `static-generator/templates/index.ejs`, `static-generator/templates/styles.css`.
- Runtime: Node + `tsx`; OpenAI endpoint reachable; Google Custom Search quota available for Google sources.

## Outputs Generated by the Run
- Cache: `.cache/step1-raw-feeds.json`, `.cache/step2-extracted-content.json`, `.cache/step3-processed-content.json`, `.cache/step4-ai-processed-content.json`, `.cache/step5-reports.json`, `.cache/scoring-history.json`.
- Static site: `dist/index.html`, `dist/styles.css`.
- Logs: stdout (see above) noting Google Search quota exhaustion; no build errors.
