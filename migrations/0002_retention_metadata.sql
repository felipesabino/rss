ALTER TABLE "feed_items" ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;
ALTER TABLE "extracted_contents" ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;
ALTER TABLE "processed_contents" ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;
ALTER TABLE "ai_analyses" ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;

ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;

ALTER TABLE "report_items" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
ALTER TABLE "report_items" ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;
