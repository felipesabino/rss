import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    email: text('email'),
    displayName: text('display_name'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => ({
    slugIdx: uniqueIndex('users_slug_key').on(table.slug)
  })
);

export const sourceConfigs = pgTable(
  'source_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // rss | google
    name: text('name').notNull(),
    url: text('url'),
    query: text('query'),
    categories: text('categories').array().notNull().default(sql`ARRAY[]::text[]`),
    language: text('language'),
    isActive: boolean('is_active').notNull().default(true),
    lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => ({
    dedupe: uniqueIndex('source_configs_user_type_url_query_idx').on(
      table.userId,
      table.type,
      table.url,
      table.query
    )
  })
);

export const pipelineRuns = pgTable(
  'pipeline_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    status: text('status').notNull().default('running'),
    stepCompleted: integer('step_completed'),
    error: jsonb('error'),
    notes: text('notes')
  },
  table => ({
    userIdx: index('pipeline_runs_user_idx').on(table.userId)
  })
);

export const feedItems = pgTable(
  'feed_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sourceConfigId: uuid('source_config_id')
      .notNull()
      .references(() => sourceConfigs.id, { onDelete: 'cascade' }),
    pipelineRunId: uuid('pipeline_run_id').references(() => pipelineRuns.id, {
      onDelete: 'set null'
    }),
    externalId: text('external_id'),
    title: text('title').notNull(),
    url: text('url').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    rawFeed: jsonb('raw_feed'),
    siteName: text('site_name'),
    commentsUrl: text('comments_url'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => ({
    userCreatedIdx: index('feed_items_user_created_idx').on(table.userId, table.createdAt),
    userPublishedIdx: index('feed_items_user_published_idx').on(table.userId, table.publishedAt),
    urlDedupe: uniqueIndex('feed_items_user_source_url_idx').on(
      table.userId,
      table.sourceConfigId,
      table.url
    )
  })
);

export const extractedContents = pgTable(
  'extracted_contents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    feedItemId: uuid('feed_item_id')
      .notNull()
      .references(() => feedItems.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pipelineRunId: uuid('pipeline_run_id').references(() => pipelineRuns.id, {
      onDelete: 'set null'
    }),
    content: text('content').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    commentsUrl: text('comments_url'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => ({
    feedItemIdx: index('extracted_contents_feed_item_idx').on(table.feedItemId),
    userFeedIdx: index('extracted_contents_user_feed_idx').on(table.userId, table.feedItemId)
  })
);

export const processedContents = pgTable(
  'processed_contents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    feedItemId: uuid('feed_item_id')
      .notNull()
      .references(() => feedItems.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pipelineRunId: uuid('pipeline_run_id').references(() => pipelineRuns.id, {
      onDelete: 'set null'
    }),
    mediaType: text('media_type').notNull(),
    mediaUrl: text('media_url'),
    shouldSkipAI: boolean('should_skip_ai').notNull().default(false),
    normalizedUrl: text('normalized_url'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => ({
    feedItemIdx: index('processed_contents_feed_item_idx').on(table.feedItemId),
    userFeedIdx: index('processed_contents_user_feed_idx').on(table.userId, table.feedItemId)
  })
);

export const aiAnalyses = pgTable(
  'ai_analyses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    feedItemId: uuid('feed_item_id')
      .notNull()
      .references(() => feedItems.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pipelineRunId: uuid('pipeline_run_id').references(() => pipelineRuns.id, {
      onDelete: 'set null'
    }),
    summary: text('summary'),
    hasSummary: boolean('has_summary').notNull().default(false),
    isPositive: boolean('is_positive').notNull().default(false),
    sentimentScore: numeric('sentiment_score', { precision: 5, scale: 2 }),
    model: text('model'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => ({
    feedItemIdx: index('ai_analyses_feed_item_idx').on(table.feedItemId),
    userFeedIdx: index('ai_analyses_user_feed_idx').on(table.userId, table.feedItemId)
  })
);

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pipelineRunId: uuid('pipeline_run_id').references(() => pipelineRuns.id, {
      onDelete: 'set null'
    }),
    category: text('category').notNull(),
    header: text('header'),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => ({
    userCreatedIdx: index('reports_user_created_idx').on(table.userId, table.createdAt),
    userGeneratedIdx: index('reports_user_generated_idx').on(table.userId, table.generatedAt)
  })
);

export const reportItems = pgTable(
  'report_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reportId: uuid('report_id')
      .notNull()
      .references(() => reports.id, { onDelete: 'cascade' }),
    feedItemId: uuid('feed_item_id').references(() => feedItems.id, { onDelete: 'set null' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sectionTag: text('section_tag'),
    headline: text('headline').notNull(),
    sourceName: text('source_name'),
    sourceUrl: text('source_url'),
    summary: text('summary'),
    sentiment: text('sentiment'),
    score: numeric('score', { precision: 10, scale: 2 }),
    shortTermImpact: text('short_term_impact'),
    longTermImpact: text('long_term_impact'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => ({
    reportIdx: index('report_items_report_idx').on(table.reportId),
    reportItemFeedIdx: index('report_items_feed_item_idx').on(table.feedItemId)
  })
);

export const savedItems = pgTable(
  'saved_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    feedItemId: uuid('feed_item_id')
      .notNull()
      .references(() => feedItems.id, { onDelete: 'cascade' }),
    savedSummary: text('saved_summary'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => ({
    uniqueSaved: uniqueIndex('saved_items_user_feed_item_idx').on(table.userId, table.feedItemId)
  })
);

export const retentionAuditLogs = pgTable('retention_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tableName: text('table_name').notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  deletedCount: integer('deleted_count'),
  retentionWindowMonths: integer('retention_window_months'),
  ranAt: timestamp('ran_at', { withTimezone: true }).notNull().defaultNow(),
  notes: text('notes')
});

export const scoringAudits = pgTable('scoring_audits', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  pipelineRunId: uuid('pipeline_run_id').references(() => pipelineRuns.id, { onDelete: 'set null' }),
  label: text('label').notNull(),
  customInstructions: text('custom_instructions'),
  selectedItems: jsonb('selected_items'),
  scoredItems: jsonb('scored_items'),
  topKPerSource: integer('top_k_per_source'),
  scoredAt: timestamp('scored_at', { withTimezone: true }).notNull().defaultNow()
});
