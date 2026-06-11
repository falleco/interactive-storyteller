ALTER TABLE "book_page"
  ADD COLUMN "game" JSONB,
  ADD COLUMN "game_completed_at" TIMESTAMP(3),
  ADD COLUMN "game_result" JSONB;
