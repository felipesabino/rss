# Multi-tenant Data Model

## System Overview
- Multi-tenant pipeline: each run is scoped to a `userId`, pulls that user's sources, and writes intermediates and reports tied to both `userId` and a `pipelineRunId`.
- Pipeline step outputs map to persisted tables: Step1 → `PipelineRun`, `FeedItem`; Step2 → `ExtractedContent`; Step3 → `ProcessedContent`; Step4 → `AIAnalysis`; Step5 → `Report`, `ReportItem`, plus optional `ScoringAudit`.
- Source configuration is user-owned (`SourceConfig`) and can represent RSS feeds or Google Custom Search queries.
- Saved items (`SavedItem`) are user-specific and exempt from automated retention cleanup; retention cleanup acts on time-varying tables by `createdAt`/`expiresAt`.
- Auditability: every table includes `createdAt` (and often `updatedAt`) to trace when data entered the system; `PipelineRun` records overall run status, and optional `RetentionAuditLog` records cleanup actions.

## Entity List and Purpose
- **User**: tenant identity (slug/email/status) that owns sources, runs, data, and outputs.
- **SourceConfig**: per-user feed/search configuration (type, URL/query, categories, active flags).
- **PipelineRun**: a single execution of the pipeline for a user (timestamps, status, error, step markers).
- **FeedItem**: raw fetched item metadata linked to source/run/user (URL, title, published).
- **ExtractedContent**: normalized/full text extracted from the feed item (content, comments URL, published).
- **ProcessedContent**: classified media and processing flags (mediaType, mediaUrl, shouldSkipAI, normalized content references).
- **AIAnalysis**: AI-generated summary/sentiment/positivity derived from processed content.
- **Report**: per-category (or configured scope) report generated in Step5 for a run.
- **ReportItem**: individual story rows within a report, linked back to feed items and AI output.
- **SavedItem**: user-curated list of feed items/summaries to persist beyond retention windows.
- **RetentionAuditLog** (optional): record of retention cleanup actions for auditability.
- **ScoringAudit** (optional but recommended): preserves Step5 scoring/ranking inputs/outputs for transparency.

## Table Definitions with Fields/Types/PK/FK

### User
- `id` (pk, text/uuid)  
- `slug` (unique, text), `email` (text), `displayName` (text, nullable)  
- `isActive` (bool, default true)  
- `createdAt` (timestamptz), `updatedAt` (timestamptz)

### SourceConfig
- `id` (pk, uuid), `userId` (fk → User.id)  
- `type` (enum: `rss` | `google`), `name` (text), `url` (text, nullable), `query` (text, nullable)  
- `categories` (text[]), `language` (text, nullable), `isActive` (bool, default true)  
- `lastFetchedAt` (timestamptz, nullable), `createdAt` (timestamptz), `updatedAt` (timestamptz)  
- Unique: (`userId`, `type`, `url`/`query`) to avoid duplicates.

### PipelineRun
- `id` (pk, uuid), `userId` (fk → User.id)  
- `startedAt` (timestamptz), `completedAt` (timestamptz, nullable), `status` (enum: running/succeeded/failed)  
- `stepCompleted` (int, nullable), `error` (text/json, nullable), `notes` (text, nullable)

### FeedItem
- `id` (pk, uuid), `userId` (fk → User.id), `sourceConfigId` (fk → SourceConfig.id), `pipelineRunId` (fk → PipelineRun.id)  
- `externalId` (text, nullable) to dedupe per source, `title` (text), `url` (text), `publishedAt` (timestamptz, nullable)  
- `rawFeed` (jsonb, optional), `siteName` (text, nullable), `commentsUrl` (text, nullable)  
- `createdAt` (timestamptz), `updatedAt` (timestamptz, nullable)
- Unique: (`userId`, `sourceConfigId`, `url`) or (`userId`, `sourceConfigId`, `externalId`) for idempotency.

### ExtractedContent
- `id` (pk, uuid), `feedItemId` (fk → FeedItem.id), `userId` (fk → User.id), `pipelineRunId` (fk → PipelineRun.id)  
- `content` (text), `publishedAt` (timestamptz, nullable), `commentsUrl` (text, nullable)  
- `createdAt` (timestamptz), `updatedAt` (timestamptz, nullable)

### ProcessedContent
- `id` (pk, uuid), `feedItemId` (fk → FeedItem.id), `userId` (fk → User.id), `pipelineRunId` (fk → PipelineRun.id)  
- `mediaType` (enum: text/image/video/short-text/etc.), `mediaUrl` (text, nullable), `shouldSkipAI` (bool), `normalizedUrl` (text, nullable)  
- `createdAt` (timestamptz), `updatedAt` (timestamptz, nullable)

### AIAnalysis
- `id` (pk, uuid), `feedItemId` (fk → FeedItem.id), `userId` (fk → User.id), `pipelineRunId` (fk → PipelineRun.id)  
- `summary` (text), `hasSummary` (bool), `isPositive` (bool), `sentimentScore` (numeric, nullable), `model` (text)  
- `createdAt` (timestamptz), `updatedAt` (timestamptz, nullable)

### Report
- `id` (pk, uuid), `userId` (fk → User.id), `pipelineRunId` (fk → PipelineRun.id)  
- `category` (text), `header` (text), `generatedAt` (timestamptz)  
- `createdAt` (timestamptz)

### ReportItem
- `id` (pk, uuid), `reportId` (fk → Report.id), `feedItemId` (fk → FeedItem.id), `userId` (fk → User.id)  
- `sectionTag` (text, nullable), `headline` (text), `sourceName` (text), `sourceUrl` (text), `summary` (text), `sentiment` (text, nullable)  
- `score` (numeric, nullable), `shortTermImpact` (text, nullable), `longTermImpact` (text, nullable)  
- `createdAt` (timestamptz)

### SavedItem
- `id` (pk, uuid), `userId` (fk → User.id), `feedItemId` (fk → FeedItem.id)  
- `savedSummary` (text, nullable), `notes` (text, nullable)  
- `createdAt` (timestamptz), `updatedAt` (timestamptz, nullable)
- Unique: (`userId`, `feedItemId`) to keep idempotent saves.

### RetentionAuditLog (optional)
- `id` (pk, uuid), `tableName` (text), `userId` (fk → User.id, nullable), `deletedCount` (int), `retentionWindowMonths` (int)  
- `ranAt` (timestamptz), `notes` (text, nullable)

### ScoringAudit (optional)
- `id` (pk, uuid), `userId` (fk → User.id), `pipelineRunId` (fk → PipelineRun.id)  
- `label` (text/category), `customInstructions` (text), `selectedItems` (jsonb), `scoredItems` (jsonb), `topKPerSource` (int)  
- `scoredAt` (timestamptz)

## Pipeline Step → Tables
- **Step1: Fetch sources** → `PipelineRun` (started), `FeedItem` (raw items, source metadata, dedupe), optional update `SourceConfig.lastFetchedAt`.
- **Step2: Extract content** → `ExtractedContent` rows per feed item with full text/comments.
- **Step3: Process content** → `ProcessedContent` rows with media classification and skip flags.
- **Step4: AI analysis** → `AIAnalysis` rows containing summaries/positivity per feed item.
- **Step5: Generate reports** → `Report` (per category/run/user) and `ReportItem` (per story), `ScoringAudit` (ranking inputs/outputs). `SavedItem` is populated by user actions, not the pipeline, but links to the same feed items for retention.

## ERD Diagram (Mermaid)
```mermaid
erDiagram
  User ||--o{ SourceConfig : owns
  User ||--o{ PipelineRun : executes
  User ||--o{ FeedItem : ingests
  User ||--o{ ExtractedContent : extracts
  User ||--o{ ProcessedContent : classifies
  User ||--o{ AIAnalysis : analyzes
  User ||--o{ Report : receives
  User ||--o{ SavedItem : saves
  PipelineRun ||--o{ FeedItem : produces
  PipelineRun ||--o{ ExtractedContent : produces
  PipelineRun ||--o{ ProcessedContent : produces
  PipelineRun ||--o{ AIAnalysis : produces
  PipelineRun ||--o{ Report : produces
  SourceConfig ||--o{ FeedItem : sources
  FeedItem ||--o{ ExtractedContent : has
  FeedItem ||--o{ ProcessedContent : has
  FeedItem ||--o{ AIAnalysis : has
  FeedItem ||--o{ ReportItem : referenced_by
  Report ||--o{ ReportItem : contains
  FeedItem ||--o{ SavedItem : bookmarked_in
```

## Retention Rules
- Retention window: rows older than `RETENTION_MONTHS` (e.g., 3–6 months) are eligible for deletion across time-varying tables (`FeedItem`, `ExtractedContent`, `ProcessedContent`, `AIAnalysis`, `Report`, `ReportItem`, `ScoringAudit`) using `createdAt`/`generatedAt` or `expiresAt` if present.
- Saved items exemption: any `FeedItem` linked to a `SavedItem` (and its dependent `ExtractedContent`/`ProcessedContent`/`AIAnalysis`/`ReportItem` entries) must be preserved regardless of age.
- Deletion order to satisfy FK constraints: delete `ReportItem` → `Report` → `AIAnalysis` → `ProcessedContent` → `ExtractedContent` → `FeedItem`; `ScoringAudit` can be deleted independently; `PipelineRun` can be cleaned after dependent rows are removed.
- Audit: log cleanup actions into `RetentionAuditLog` with counts and window applied; optionally record per-user if scoped.
- Indexing: time-varying tables should include indexes on (`userId`, `createdAt`) to speed up retention queries and per-user reads.
