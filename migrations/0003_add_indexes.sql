CREATE INDEX IF NOT EXISTS "feed_items_user_published_idx" ON "feed_items" ("user_id", "published_at");
CREATE INDEX IF NOT EXISTS "extracted_contents_user_feed_idx" ON "extracted_contents" ("user_id", "feed_item_id");
CREATE INDEX IF NOT EXISTS "processed_contents_user_feed_idx" ON "processed_contents" ("user_id", "feed_item_id");
CREATE INDEX IF NOT EXISTS "ai_analyses_user_feed_idx" ON "ai_analyses" ("user_id", "feed_item_id");
CREATE INDEX IF NOT EXISTS "reports_user_generated_idx" ON "reports" ("user_id", "generated_at");
CREATE INDEX IF NOT EXISTS "report_items_feed_item_idx" ON "report_items" ("feed_item_id");
