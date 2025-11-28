import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { FeedItem, FeedMetadata } from './feed-parser';
import { Report } from './openai';
import {
  aiAnalyses,
  extractedContents as extractedContentsTable,
  feedItems as feedItemsTable,
  pipelineRuns,
  processedContents as processedContentsTable,
  digests as digestsTable,
  scoringAudits as scoringAuditsTable,
  sourceConfigs,
  users
} from '../../drizzle/schema';

export interface ExtractedItem {
  id: number;
  feedId: number;
  title: string;
  url: string;
  content?: string;
  published: Date;
  commentsUrl?: string;
  mediaType?: string;
  mediaUrl?: string;
}

export interface ProcessedContentItem extends ExtractedItem {
  mediaType: string;
  mediaUrl?: string;
  shouldSkipAI: boolean;
}

export interface AIProcessedItem extends ProcessedContentItem {
  summary?: string;
  hasSummary: boolean;
  isPositive?: boolean;
}

export interface CategoryReport {
  category: string;
  report: Report;
  generatedAt: number;
  usedItemIds: number[];
}

export interface ScoringAuditRecord {
  label: string;
  scoredAt: number;
  customInstructions: string;
  scoredItems: Array<AIProcessedItem & { rankingScore?: number; recencyScore?: number; relevanceScore?: number }>;
  selectedItems: Array<AIProcessedItem & { rankingScore?: number; recencyScore?: number; relevanceScore?: number }>;
  topKPerSource: number;
}

export interface RawFeedCache {
  items: Record<number, FeedItem[]>;
  feedMetadata: Record<number, FeedMetadata & { sourceConfigId?: string; categories?: string[] }>;
  lastUpdated: number;
}

export interface ExtractedContentCache {
  items: ExtractedItem[];
  feedMetadata: Record<number, FeedMetadata & { sourceConfigId?: string; categories?: string[] }>;
  lastUpdated: number;
}

export interface ProcessedContentCache {
  items: ProcessedContentItem[];
  feedMetadata: Record<number, FeedMetadata & { sourceConfigId?: string; categories?: string[] }>;
  lastUpdated: number;
}

export interface AIProcessedContentCache {
  items: AIProcessedItem[];
  feedMetadata: Record<number, FeedMetadata & { sourceConfigId?: string; categories?: string[] }>;
  lastUpdated: number;
}

export interface ReportsCache {
  reports: CategoryReport[];
  lastUpdated: number;
}

export interface ScoringAuditCache {
  records: ScoringAuditRecord[];
  lastUpdated: number;
}

export interface PipelineStore {
  loadRawFeedCache(): Promise<RawFeedCache>;
  saveRawFeedCache(cache: RawFeedCache): Promise<void>;

  loadExtractedContentCache(): Promise<ExtractedContentCache>;
  saveExtractedContentCache(cache: ExtractedContentCache): Promise<void>;

  loadProcessedContentCache(): Promise<ProcessedContentCache>;
  saveProcessedContentCache(cache: ProcessedContentCache): Promise<void>;

  loadAIProcessedContentCache(): Promise<AIProcessedContentCache>;
  saveAIProcessedContentCache(cache: AIProcessedContentCache): Promise<void>;

  loadReportsCache(): Promise<ReportsCache>;
  saveReportsCache(cache: ReportsCache): Promise<void>;

  loadScoringAuditCache(): Promise<ScoringAuditCache>;
  saveScoringAuditCache(cache: ScoringAuditCache): Promise<void>;

  markStepCompleted?(step: number): Promise<void>;
  finalizeRun?(status: 'succeeded' | 'failed'): Promise<void>;
  getPipelineRunId?(): Promise<string | undefined>;
  getUserId?(): string;
}

const RAW_FEED_CACHE_PATH = path.join(process.cwd(), '.cache', 'step1-raw-feeds.json');
const EXTRACTED_CONTENT_CACHE_PATH = path.join(process.cwd(), '.cache', 'step2-extracted-content.json');
const PROCESSED_CONTENT_CACHE_PATH = path.join(process.cwd(), '.cache', 'step3-processed-content.json');
const AI_PROCESSED_CONTENT_CACHE_PATH = path.join(process.cwd(), '.cache', 'step4-ai-processed-content.json');
const REPORTS_CACHE_PATH = path.join(process.cwd(), '.cache', 'step5-reports.json');
const SCORING_CACHE_PATH = process.env.SCORING_CACHE_PATH || path.join(process.cwd(), '.cache', 'scoring-history.json');

export class FilePipelineStore implements PipelineStore {
  async loadRawFeedCache(): Promise<RawFeedCache> {
    return this.readJson<RawFeedCache>(RAW_FEED_CACHE_PATH, {
      items: {},
      feedMetadata: {},
      lastUpdated: 0
    });
  }

  async saveRawFeedCache(cache: RawFeedCache): Promise<void> {
    await this.writeJson(RAW_FEED_CACHE_PATH, cache);
  }

  async loadExtractedContentCache(): Promise<ExtractedContentCache> {
    const cache = await this.readJson<ExtractedContentCache>(EXTRACTED_CONTENT_CACHE_PATH, {
      items: [],
      feedMetadata: {},
      lastUpdated: 0
    });

    cache.items = cache.items.map(item => ({
      ...item,
      published: new Date(item.published)
    }));

    return cache;
  }

  async saveExtractedContentCache(cache: ExtractedContentCache): Promise<void> {
    await this.writeJson(EXTRACTED_CONTENT_CACHE_PATH, cache);
  }

  async loadProcessedContentCache(): Promise<ProcessedContentCache> {
    const cache = await this.readJson<ProcessedContentCache>(PROCESSED_CONTENT_CACHE_PATH, {
      items: [],
      feedMetadata: {},
      lastUpdated: 0
    });

    cache.items = cache.items.map(item => ({
      ...item,
      published: new Date(item.published)
    }));

    return cache;
  }

  async saveProcessedContentCache(cache: ProcessedContentCache): Promise<void> {
    await this.writeJson(PROCESSED_CONTENT_CACHE_PATH, cache);
  }

  async loadAIProcessedContentCache(): Promise<AIProcessedContentCache> {
    const cache = await this.readJson<AIProcessedContentCache>(AI_PROCESSED_CONTENT_CACHE_PATH, {
      items: [],
      feedMetadata: {},
      lastUpdated: 0
    });

    cache.items = cache.items.map(item => ({
      ...item,
      published: new Date(item.published)
    }));

    return cache;
  }

  async saveAIProcessedContentCache(cache: AIProcessedContentCache): Promise<void> {
    await this.writeJson(AI_PROCESSED_CONTENT_CACHE_PATH, cache);
  }

  async loadReportsCache(): Promise<ReportsCache> {
    return this.readJson<ReportsCache>(REPORTS_CACHE_PATH, { reports: [], lastUpdated: 0 });
  }

  async saveReportsCache(cache: ReportsCache): Promise<void> {
    await this.writeJson(REPORTS_CACHE_PATH, cache);
  }

  async loadScoringAuditCache(): Promise<ScoringAuditCache> {
    const cache = await this.readJson<ScoringAuditCache>(SCORING_CACHE_PATH, {
      records: [],
      lastUpdated: 0
    });

    cache.records = cache.records.map(record => ({
      ...record,
      scoredItems: (record.scoredItems || []).map(item => ({
        ...item,
        published: new Date(item.published)
      })),
      selectedItems: (record.selectedItems || []).map(item => ({
        ...item,
        published: new Date(item.published)
      }))
    }));

    return cache;
  }

  async saveScoringAuditCache(cache: ScoringAuditCache): Promise<void> {
    await this.writeJson(SCORING_CACHE_PATH, cache);
  }

  async markStepCompleted(): Promise<void> {
    return;
  }

  async finalizeRun(): Promise<void> {
    return;
  }

  async getPipelineRunId(): Promise<string | undefined> {
    return undefined;
  }

  getUserId(): string {
    return 'default';
  }

  private async readJson<T>(filePath: string, fallback: T): Promise<T> {
    try {
      const contents = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(contents) as T;
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error(`Failed to read cache ${filePath}:`, err);
      }
      return fallback;
    }
  }

  private async writeJson(filePath: string, data: unknown): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(
      filePath,
      JSON.stringify(
        data,
        (key, value) => {
          if (value instanceof Date) {
            return value.toISOString();
          }
          return value;
        },
        2
      ),
      'utf-8'
    );
  }
}

type DrizzleDb = ReturnType<typeof drizzle>;

interface DbPipelineStoreOptions {
  userId: string;
  pipelineRunId?: string;
}

export class DbPipelineStore implements PipelineStore {
  private db: DrizzleDb;
  private pool: Pool;
  private userId: string;
  private pipelineRunId?: string;

  constructor(opts: DbPipelineStoreOptions) {
    this.userId = opts.userId;
    this.pipelineRunId = opts.pipelineRunId;
    const connectionString = process.env.DATABASE_URL ?? 'postgres://rss:rss@localhost:5432/rss';
    this.pool = new Pool({ connectionString });
    this.db = drizzle(this.pool);
  }

  getUserId(): string {
    return this.userId;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async ensureUserExists() {
    const existing = await this.db.select().from(users).where(eq(users.id, this.userId));
    if (existing.length === 0) {
      await this.db.insert(users).values({
        id: this.userId,
        slug: this.userId,
        email: `${this.userId}@example.com`,
        isActive: true
      }).onConflictDoNothing();
    }
  }

  private async ensurePipelineRun(): Promise<string> {
    if (this.pipelineRunId) return this.pipelineRunId;
    await this.ensureUserExists();
    const [run] = await this.db
      .insert(pipelineRuns)
      .values({ userId: this.userId, status: 'running', startedAt: new Date() })
      .returning({ id: pipelineRuns.id });
    this.pipelineRunId = run.id;
    return run.id;
  }

  async markStepCompleted(step: number): Promise<void> {
    const runId = await this.ensurePipelineRun();
    await this.db
      .update(pipelineRuns)
      .set({ stepCompleted: step, status: 'running' })
      .where(eq(pipelineRuns.id, runId));
  }

  async finalizeRun(status: 'succeeded' | 'failed'): Promise<void> {
    const runId = await this.ensurePipelineRun();
    await this.db
      .update(pipelineRuns)
      .set({
        status,
        completedAt: new Date()
      })
      .where(eq(pipelineRuns.id, runId));
    await this.close();
  }

  private async ensureSourceConfigs(): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    const sourcesModule =
      (await import('../../config/sources.js').catch(async () => await import('../../config/sources.ts')));
    const fromConfig = sourcesModule.sources as Array<{
      id: number;
      type: string;
      name: string;
      url?: string;
      query?: string;
      categories?: string[];
      language?: string;
    }>;

    for (const source of fromConfig) {
      const normalizedType = source.type === 'google-search' ? 'google' : source.type;
      const [row] = await this.db
        .insert(sourceConfigs)
        .values({
          userId: this.userId,
          type: normalizedType,
          name: source.name,
          url: source.url,
          query: source.query,
          categories: source.categories ?? [],
          language: source.language,
          isActive: true
        })
        .onConflictDoUpdate({
          target: [
            sourceConfigs.userId,
            sourceConfigs.type,
            sourceConfigs.url,
            sourceConfigs.query
          ],
          set: {
            name: source.name,
            categories: source.categories ?? [],
            language: source.language,
            isActive: true,
            updatedAt: new Date()
          }
        })
        .returning({ id: sourceConfigs.id });
      map.set(source.id, row.id);
    }
    return map;
  }

  async loadRawFeedCache(): Promise<RawFeedCache> {
    await this.ensureUserExists();
    const runId = this.pipelineRunId ?? (await this.getLatestRunId());
    if (!runId) {
      return { items: {}, feedMetadata: {}, lastUpdated: 0 };
    }

    const sources = await this.db
      .select({
        id: sourceConfigs.id,
        name: sourceConfigs.name,
        categories: sourceConfigs.categories,
        language: sourceConfigs.language
      })
      .from(sourceConfigs)
      .where(eq(sourceConfigs.userId, this.userId));

    const sourceMap = new Map<string, { title: string; categories?: string[]; language?: string }>();
    for (const s of sources) {
      sourceMap.set(s.id, { title: s.name, categories: s.categories ?? [], language: s.language ?? undefined });
    }

    const rows = await this.db
      .select({
        id: feedItemsTable.id,
        externalId: feedItemsTable.externalId,
        url: feedItemsTable.url,
        title: feedItemsTable.title,
        publishedAt: feedItemsTable.publishedAt,
        content: feedItemsTable.rawFeed,
        comments: feedItemsTable.commentsUrl,
        sourceConfigId: feedItemsTable.sourceConfigId,
        siteName: feedItemsTable.siteName
      })
      .from(feedItemsTable)
      .where(
        and(
          eq(feedItemsTable.userId, this.userId),
          eq(feedItemsTable.pipelineRunId, runId)
        )
      );

    const items: Record<number, FeedItem[]> = {};
    const feedMetadata: RawFeedCache['feedMetadata'] = {};
    for (const row of rows) {
      const feedId = row.externalId ? Number(row.externalId) : 0;
      if (!items[feedId]) items[feedId] = [];

      const src = row.sourceConfigId ? sourceMap.get(row.sourceConfigId) : undefined;
      if (!feedMetadata[feedId]) {
        feedMetadata[feedId] = {
          title: src?.title ?? row.siteName ?? 'Unknown Source',
          description: '',
          siteUrl: '',
          lastBuildDate: row.publishedAt?.toISOString(),
          categories: src?.categories,
          sourceConfigId: row.sourceConfigId ?? undefined,
          language: src?.language
        } as any;
      }

      items[feedId].push({
        title: row.title,
        link: row.url,
        pubDate: row.publishedAt ? new Date(row.publishedAt).toISOString() : undefined,
        content: (row.content as any)?.content ?? undefined,
        comments: row.comments ?? undefined
      });
    }

    return {
      items,
      feedMetadata,
      lastUpdated: Date.now()
    };
  }

  async saveRawFeedCache(cache: RawFeedCache): Promise<void> {
    const runId = await this.ensurePipelineRun();
    const hasMetaIds = Object.values(cache.feedMetadata || {}).some(meta => meta?.sourceConfigId);
    const sourceMap = hasMetaIds ? new Map<number, string>() : await this.ensureSourceConfigs();

    for (const [feedIdStr, feedItems] of Object.entries(cache.items)) {
      const feedId = Number(feedIdStr);
      const meta = cache.feedMetadata?.[feedId];
      const sourceConfigId = meta?.sourceConfigId || sourceMap.get(feedId);
      if (!sourceConfigId) continue;

      for (const item of feedItems) {
        const publishedAt = item.pubDate ? new Date(item.pubDate) : null;
        await this.db
          .insert(feedItemsTable)
          .values({
            userId: this.userId,
            sourceConfigId,
            pipelineRunId: runId,
            externalId: feedId.toString(),
            title: item.title,
            url: item.link,
            publishedAt: publishedAt ?? undefined,
            rawFeed: item.content ? { content: item.content } : null,
            commentsUrl: item.comments ?? null
          })
          .onConflictDoUpdate({
            target: [
              feedItemsTable.userId,
              feedItemsTable.sourceConfigId,
              feedItemsTable.url
            ],
            set: {
              title: item.title,
              publishedAt: publishedAt ?? undefined,
              rawFeed: item.content ? { content: item.content } : null,
              commentsUrl: item.comments ?? null,
              pipelineRunId: runId,
              updatedAt: new Date()
            }
          });
      }
    }
  }

  async loadExtractedContentCache(): Promise<ExtractedContentCache> {
    const runId = this.pipelineRunId ?? (await this.getLatestRunId());
    if (!runId) {
      return { items: [], feedMetadata: {}, lastUpdated: 0 };
    }

    const rows = await this.db
      .select({
        feedId: feedItemsTable.externalId,
        title: feedItemsTable.title,
        url: feedItemsTable.url,
        publishedAt: feedItemsTable.publishedAt,
        commentsUrl: feedItemsTable.commentsUrl,
        content: extractedContentsTable.content,
        sourceConfigId: feedItemsTable.sourceConfigId,
        sourceName: sourceConfigs.name,
        categories: sourceConfigs.categories,
        language: sourceConfigs.language
      })
      .from(extractedContentsTable)
      .innerJoin(feedItemsTable, eq(extractedContentsTable.feedItemId, feedItemsTable.id))
      .leftJoin(sourceConfigs, eq(feedItemsTable.sourceConfigId, sourceConfigs.id))
      .where(
        and(
          eq(extractedContentsTable.userId, this.userId),
          eq(extractedContentsTable.pipelineRunId, runId)
        )
      );

    const feedMetadata: RawFeedCache['feedMetadata'] = {};
    const items: ExtractedItem[] = rows.map((row, idx) => ({
      id: idx + 1,
      feedId: Number(row.feedId ?? 0),
      title: row.title,
      url: row.url,
      content: row.content ?? undefined,
      published: row.publishedAt ? new Date(row.publishedAt) : new Date(),
      commentsUrl: row.commentsUrl ?? undefined
    }));

    for (const row of rows) {
      const feedId = Number(row.feedId ?? 0);
      if (!feedMetadata[feedId]) {
        feedMetadata[feedId] = {
          title: row.sourceName ?? 'Unknown Source',
          description: '',
          siteUrl: '',
          lastBuildDate: row.publishedAt?.toISOString(),
          sourceConfigId: row.sourceConfigId ?? undefined,
          categories: row.categories ?? [],
          language: row.language ?? undefined
        } as any;
      }
    }

    return { items, feedMetadata, lastUpdated: Date.now() };
  }

  async saveExtractedContentCache(cache: ExtractedContentCache): Promise<void> {
    const runId = await this.ensurePipelineRun();
    const feedMap = await this.fetchFeedItemIds(cache.items.map(i => i.url));

    for (const item of cache.items) {
      const feedItemId = feedMap.get(item.url);
      if (!feedItemId) continue;

      await this.db
        .delete(extractedContentsTable)
        .where(eq(extractedContentsTable.feedItemId, feedItemId));

      await this.db.insert(extractedContentsTable).values({
        feedItemId,
        userId: this.userId,
        pipelineRunId: runId,
        content: item.content ?? '',
        publishedAt: item.published ?? undefined,
        commentsUrl: item.commentsUrl ?? null
      });
    }
  }

  async loadProcessedContentCache(): Promise<ProcessedContentCache> {
    const runId = this.pipelineRunId ?? (await this.getLatestRunId());
    if (!runId) {
      return { items: [], feedMetadata: {}, lastUpdated: 0 };
    }

    const rows = await this.db
      .select({
        feedId: feedItemsTable.externalId,
        title: feedItemsTable.title,
        url: feedItemsTable.url,
        publishedAt: feedItemsTable.publishedAt,
        commentsUrl: feedItemsTable.commentsUrl,
        content: extractedContentsTable.content,
        mediaType: processedContentsTable.mediaType,
        mediaUrl: processedContentsTable.mediaUrl,
        shouldSkipAI: processedContentsTable.shouldSkipAI,
        sourceConfigId: feedItemsTable.sourceConfigId,
        sourceName: sourceConfigs.name,
        categories: sourceConfigs.categories,
        language: sourceConfigs.language
      })
      .from(processedContentsTable)
      .innerJoin(feedItemsTable, eq(processedContentsTable.feedItemId, feedItemsTable.id))
      .leftJoin(extractedContentsTable, eq(processedContentsTable.feedItemId, extractedContentsTable.feedItemId))
      .leftJoin(sourceConfigs, eq(feedItemsTable.sourceConfigId, sourceConfigs.id))
      .where(
        and(
          eq(processedContentsTable.userId, this.userId),
          eq(processedContentsTable.pipelineRunId, runId)
        )
      );

    const feedMetadata: RawFeedCache['feedMetadata'] = {};
    const items: ProcessedContentItem[] = rows.map((row, idx) => ({
      id: idx + 1,
      feedId: Number(row.feedId ?? 0),
      title: row.title,
      url: row.url,
      content: row.content ?? undefined,
      published: row.publishedAt ? new Date(row.publishedAt) : new Date(),
      commentsUrl: row.commentsUrl ?? undefined,
      mediaType: row.mediaType ?? 'unknown',
      mediaUrl: row.mediaUrl ?? undefined,
      shouldSkipAI: row.shouldSkipAI ?? false
    }));

    for (const row of rows) {
      const feedId = Number(row.feedId ?? 0);
      if (!feedMetadata[feedId]) {
        feedMetadata[feedId] = {
          title: row.sourceName ?? 'Unknown Source',
          description: '',
          siteUrl: '',
          lastBuildDate: row.publishedAt?.toISOString(),
          sourceConfigId: row.sourceConfigId ?? undefined,
          categories: row.categories ?? [],
          language: row.language ?? undefined
        } as any;
      }
    }

    return { items, feedMetadata, lastUpdated: Date.now() };
  }

  async saveProcessedContentCache(cache: ProcessedContentCache): Promise<void> {
    const runId = await this.ensurePipelineRun();
    const feedMap = await this.fetchFeedItemIds(cache.items.map(i => i.url));

    for (const item of cache.items) {
      const feedItemId = feedMap.get(item.url);
      if (!feedItemId) continue;

      await this.db
        .delete(processedContentsTable)
        .where(eq(processedContentsTable.feedItemId, feedItemId));

      await this.db.insert(processedContentsTable).values({
        feedItemId,
        userId: this.userId,
        pipelineRunId: runId,
        mediaType: item.mediaType,
        mediaUrl: item.mediaUrl ?? null,
        shouldSkipAI: item.shouldSkipAI,
        normalizedUrl: item.url
      });
    }
  }

  async loadAIProcessedContentCache(): Promise<AIProcessedContentCache> {
    const runId = this.pipelineRunId ?? (await this.getLatestRunId());
    if (!runId) {
      return { items: [], feedMetadata: {}, lastUpdated: 0 };
    }

    const rows = await this.db
      .select({
        feedId: feedItemsTable.externalId,
        title: feedItemsTable.title,
        url: feedItemsTable.url,
        publishedAt: feedItemsTable.publishedAt,
        commentsUrl: feedItemsTable.commentsUrl,
        content: extractedContentsTable.content,
        mediaType: processedContentsTable.mediaType,
        mediaUrl: processedContentsTable.mediaUrl,
        shouldSkipAI: processedContentsTable.shouldSkipAI,
        summary: aiAnalyses.summary,
        hasSummary: aiAnalyses.hasSummary,
        isPositive: aiAnalyses.isPositive,
        sourceConfigId: feedItemsTable.sourceConfigId,
        sourceName: sourceConfigs.name,
        categories: sourceConfigs.categories,
        language: sourceConfigs.language
      })
      .from(aiAnalyses)
      .innerJoin(feedItemsTable, eq(aiAnalyses.feedItemId, feedItemsTable.id))
      .leftJoin(extractedContentsTable, eq(aiAnalyses.feedItemId, extractedContentsTable.feedItemId))
      .leftJoin(processedContentsTable, eq(aiAnalyses.feedItemId, processedContentsTable.feedItemId))
      .leftJoin(sourceConfigs, eq(feedItemsTable.sourceConfigId, sourceConfigs.id))
      .where(and(eq(aiAnalyses.userId, this.userId), eq(aiAnalyses.pipelineRunId, runId)));

    const feedMetadata: RawFeedCache['feedMetadata'] = {};
    const items: AIProcessedItem[] = rows.map((row, idx) => ({
      id: idx + 1,
      feedId: Number(row.feedId ?? 0),
      title: row.title,
      url: row.url,
      content: row.content ?? undefined,
      published: row.publishedAt ? new Date(row.publishedAt) : new Date(),
      commentsUrl: row.commentsUrl ?? undefined,
      mediaType: row.mediaType ?? 'unknown',
      mediaUrl: row.mediaUrl ?? undefined,
      shouldSkipAI: row.shouldSkipAI ?? false,
      summary: row.summary ?? undefined,
      hasSummary: row.hasSummary ?? false,
      isPositive: row.isPositive ?? false
    }));

    for (const row of rows) {
      const feedId = Number(row.feedId ?? 0);
      if (!feedMetadata[feedId]) {
        feedMetadata[feedId] = {
          title: row.sourceName ?? 'Unknown Source',
          description: '',
          siteUrl: '',
          lastBuildDate: row.publishedAt?.toISOString(),
          sourceConfigId: row.sourceConfigId ?? undefined,
          categories: row.categories ?? [],
          language: row.language ?? undefined
        } as any;
      }
    }

    return { items, feedMetadata, lastUpdated: Date.now() };
  }

  async saveAIProcessedContentCache(cache: AIProcessedContentCache): Promise<void> {
    const runId = await this.ensurePipelineRun();
    const feedMap = await this.fetchFeedItemIds(cache.items.map(i => i.url));

    for (const item of cache.items) {
      const feedItemId = feedMap.get(item.url);
      if (!feedItemId) continue;

      await this.db.delete(aiAnalyses).where(eq(aiAnalyses.feedItemId, feedItemId));

      await this.db.insert(aiAnalyses).values({
        feedItemId,
        userId: this.userId,
        pipelineRunId: runId,
        summary: item.summary ?? null,
        hasSummary: item.hasSummary,
        isPositive: item.isPositive ?? false
      });
    }
  }

  async loadReportsCache(): Promise<ReportsCache> {
    const runId = this.pipelineRunId ?? (await this.getLatestRunId());
    if (!runId) {
      return { reports: [], lastUpdated: 0 };
    }

    const digestRows = await this.db
      .select({
        id: digestsTable.id,
        payload: digestsTable.payload,
        generatedAt: digestsTable.generatedAt,
        pipelineRunId: digestsTable.pipelineRunId
      })
      .from(digestsTable)
      .where(and(eq(digestsTable.userId, this.userId), eq(digestsTable.pipelineRunId, runId)));

    if (!digestRows.length) {
      return { reports: [], lastUpdated: 0 };
    }

    const reports: CategoryReport[] = digestRows.map(row => {
      const payload = (row.payload ?? {}) as any;
      const category = payload.category ?? 'Uncategorized';
      const reportPayload = (payload.report ?? {}) as Report;
      return {
        category,
        report: {
          header: reportPayload.header ?? '',
          mainStories: reportPayload.mainStories ?? [],
          whatElseIsGoingOn: reportPayload.whatElseIsGoingOn ?? [],
          byTheNumbers: reportPayload.byTheNumbers,
          signOff: reportPayload.signOff ?? ''
        },
        generatedAt: row.generatedAt?.getTime() ?? Date.now(),
        usedItemIds: payload.usedItemIds ?? []
      };
    });

    return { reports, lastUpdated: Date.now() };
  }

  async saveReportsCache(cache: ReportsCache): Promise<void> {
    const runId = await this.ensurePipelineRun();
    await this.db
      .delete(digestsTable)
      .where(and(eq(digestsTable.userId, this.userId), eq(digestsTable.pipelineRunId, runId)));

    for (const categoryReport of cache.reports) {
      await this.db.insert(digestsTable).values({
        userId: this.userId,
        pipelineRunId: runId,
        status: 'ready',
        payload: {
          category: categoryReport.category,
          report: categoryReport.report,
          usedItemIds: categoryReport.usedItemIds ?? []
        },
        config: { category: categoryReport.category },
        generatedAt: new Date(categoryReport.generatedAt)
      });
    }
  }

  async loadScoringAuditCache(): Promise<ScoringAuditCache> {
    const runId = this.pipelineRunId ?? (await this.getLatestRunId());
    if (!runId) {
      return { records: [], lastUpdated: 0 };
    }

    const rows = await this.db
      .select({
        label: scoringAuditsTable.label,
        customInstructions: scoringAuditsTable.customInstructions,
        scoredItems: scoringAuditsTable.scoredItems,
        selectedItems: scoringAuditsTable.selectedItems,
        topKPerSource: scoringAuditsTable.topKPerSource,
        scoredAt: scoringAuditsTable.scoredAt
      })
      .from(scoringAuditsTable)
      .where(and(eq(scoringAuditsTable.userId, this.userId), eq(scoringAuditsTable.pipelineRunId, runId)))
      .orderBy(desc(scoringAuditsTable.scoredAt));

    const records: ScoringAuditRecord[] = rows.map(row => ({
      label: row.label,
      customInstructions: row.customInstructions ?? '',
      scoredItems: (row.scoredItems as any) ?? [],
      selectedItems: (row.selectedItems as any) ?? [],
      topKPerSource: row.topKPerSource ?? 0,
      scoredAt: row.scoredAt?.getTime() ?? Date.now()
    }));

    return { records, lastUpdated: Date.now() };
  }

  async saveScoringAuditCache(cache: ScoringAuditCache): Promise<void> {
    const runId = await this.ensurePipelineRun();

    for (const record of cache.records) {
      await this.db.insert(scoringAuditsTable).values({
        userId: this.userId,
        pipelineRunId: runId,
        label: record.label,
        customInstructions: record.customInstructions,
        scoredItems: record.scoredItems as any,
        selectedItems: record.selectedItems as any,
        topKPerSource: record.topKPerSource,
        scoredAt: new Date(record.scoredAt)
      });
    }
  }

  private async getLatestRunId(): Promise<string | undefined> {
    const rows = await this.db
      .select({ id: pipelineRuns.id })
      .from(pipelineRuns)
      .where(eq(pipelineRuns.userId, this.userId))
      .orderBy(desc(pipelineRuns.startedAt))
      .limit(1);
    return rows[0]?.id;
  }

  async getPipelineRunId(): Promise<string | undefined> {
    if (this.pipelineRunId) {
      return this.pipelineRunId;
    }
    return this.getLatestRunId();
  }

  private async fetchFeedItemIds(urls: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!urls.length) return map;

    const rows = await this.db
      .select({ id: feedItemsTable.id, url: feedItemsTable.url })
      .from(feedItemsTable)
      .where(and(eq(feedItemsTable.userId, this.userId), inArray(feedItemsTable.url, urls)));
    for (const row of rows) {
      map.set(row.url, row.id);
    }
    return map;
  }

  private async fetchAllFeedItems(): Promise<Map<string, string>> {
    const rows = await this.db
      .select({ id: feedItemsTable.id, url: feedItemsTable.url })
      .from(feedItemsTable)
      .where(eq(feedItemsTable.userId, this.userId));
    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.url, row.id);
    }
    return map;
  }
}
