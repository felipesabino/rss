-- Enable UUID generation for defaultRandom()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY,
  "slug" text NOT NULL,
  "email" text,
  "display_name" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_slug_key" ON "users" ("slug");

CREATE TABLE IF NOT EXISTS "source_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE cascade,
  "type" text NOT NULL,
  "name" text NOT NULL,
  "url" text,
  "query" text,
  "categories" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "language" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_fetched_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "source_configs_type_check" CHECK ("type" IN ('rss', 'google'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "source_configs_user_type_url_query_idx"
  ON "source_configs" ("user_id", "type", "url", "query");

CREATE TABLE IF NOT EXISTS "pipeline_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE cascade,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz,
  "status" text NOT NULL DEFAULT 'running',
  "step_completed" integer,
  "error" jsonb,
  "notes" text,
  CONSTRAINT "pipeline_runs_status_check" CHECK ("status" IN ('running', 'succeeded', 'failed'))
);
CREATE INDEX IF NOT EXISTS "pipeline_runs_user_idx" ON "pipeline_runs" ("user_id");

CREATE TABLE IF NOT EXISTS "feed_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE cascade,
  "source_config_id" uuid NOT NULL REFERENCES "source_configs" ("id") ON DELETE cascade,
  "pipeline_run_id" uuid REFERENCES "pipeline_runs" ("id") ON DELETE set null,
  "external_id" text,
  "title" text NOT NULL,
  "url" text NOT NULL,
  "published_at" timestamptz,
  "raw_feed" jsonb,
  "site_name" text,
  "comments_url" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "feed_items_user_created_idx" ON "feed_items" ("user_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "feed_items_user_source_url_idx"
  ON "feed_items" ("user_id", "source_config_id", "url");

CREATE TABLE IF NOT EXISTS "extracted_contents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "feed_item_id" uuid NOT NULL REFERENCES "feed_items" ("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE cascade,
  "pipeline_run_id" uuid REFERENCES "pipeline_runs" ("id") ON DELETE set null,
  "content" text NOT NULL,
  "published_at" timestamptz,
  "comments_url" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "extracted_contents_feed_item_idx" ON "extracted_contents" ("feed_item_id");

CREATE TABLE IF NOT EXISTS "processed_contents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "feed_item_id" uuid NOT NULL REFERENCES "feed_items" ("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE cascade,
  "pipeline_run_id" uuid REFERENCES "pipeline_runs" ("id") ON DELETE set null,
  "media_type" text NOT NULL,
  "media_url" text,
  "should_skip_ai" boolean NOT NULL DEFAULT false,
  "normalized_url" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "processed_contents_feed_item_idx" ON "processed_contents" ("feed_item_id");

CREATE TABLE IF NOT EXISTS "ai_analyses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "feed_item_id" uuid NOT NULL REFERENCES "feed_items" ("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE cascade,
  "pipeline_run_id" uuid REFERENCES "pipeline_runs" ("id") ON DELETE set null,
  "summary" text,
  "has_summary" boolean NOT NULL DEFAULT false,
  "is_positive" boolean NOT NULL DEFAULT false,
  "sentiment_score" numeric(5, 2),
  "model" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ai_analyses_feed_item_idx" ON "ai_analyses" ("feed_item_id");

CREATE TABLE IF NOT EXISTS "reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE cascade,
  "pipeline_run_id" uuid REFERENCES "pipeline_runs" ("id") ON DELETE set null,
  "category" text NOT NULL,
  "header" text,
  "generated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "reports_user_created_idx" ON "reports" ("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "report_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "report_id" uuid NOT NULL REFERENCES "reports" ("id") ON DELETE cascade,
  "feed_item_id" uuid REFERENCES "feed_items" ("id") ON DELETE set null,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE cascade,
  "section_tag" text,
  "headline" text NOT NULL,
  "source_name" text,
  "source_url" text,
  "summary" text,
  "sentiment" text,
  "score" numeric(10, 2),
  "short_term_impact" text,
  "long_term_impact" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "report_items_report_idx" ON "report_items" ("report_id");

CREATE TABLE IF NOT EXISTS "saved_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE cascade,
  "feed_item_id" uuid NOT NULL REFERENCES "feed_items" ("id") ON DELETE cascade,
  "saved_summary" text,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "saved_items_user_feed_item_idx"
  ON "saved_items" ("user_id", "feed_item_id");

CREATE TABLE IF NOT EXISTS "retention_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "table_name" text NOT NULL,
  "user_id" text REFERENCES "users" ("id") ON DELETE set null,
  "deleted_count" integer,
  "retention_window_months" integer,
  "ran_at" timestamptz NOT NULL DEFAULT now(),
  "notes" text
);

CREATE TABLE IF NOT EXISTS "scoring_audits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE cascade,
  "pipeline_run_id" uuid REFERENCES "pipeline_runs" ("id") ON DELETE set null,
  "label" text NOT NULL,
  "custom_instructions" text,
  "selected_items" jsonb,
  "scored_items" jsonb,
  "top_k_per_source" integer,
  "scored_at" timestamptz NOT NULL DEFAULT now()
);
