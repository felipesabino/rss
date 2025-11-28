CREATE TABLE IF NOT EXISTS "digests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE cascade,
  "pipeline_run_id" uuid REFERENCES "pipeline_runs" ("id") ON DELETE set null,
  "status" text NOT NULL DEFAULT 'ready',
  "payload" jsonb NOT NULL,
  "config" jsonb,
  "custom_prompt" text,
  "theme" jsonb,
  "error" jsonb,
  "generated_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "digests_user_generated_idx" ON "digests" ("user_id", "generated_at");
CREATE INDEX IF NOT EXISTS "digests_user_status_idx" ON "digests" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "digests_pipeline_run_idx" ON "digests" ("pipeline_run_id");

CREATE TABLE IF NOT EXISTS "digest_html" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "digest_id" uuid NOT NULL REFERENCES "digests" ("id") ON DELETE cascade,
  "html" text NOT NULL,
  "format" text NOT NULL DEFAULT 'web',
  "generated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "digest_html_digest_idx" ON "digest_html" ("digest_id");
CREATE UNIQUE INDEX IF NOT EXISTS "digest_html_digest_format_idx" ON "digest_html" ("digest_id", "format");
