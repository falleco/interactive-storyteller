CREATE TABLE "curated_book" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "builder_phase" TEXT NOT NULL DEFAULT 'text',
  "base_language" TEXT NOT NULL DEFAULT 'en',
  "storyteller" TEXT NOT NULL DEFAULT 'sparkle',
  "default_voice" TEXT NOT NULL DEFAULT 'sparkle',
  "age_min" INTEGER NOT NULL DEFAULT 3,
  "age_max" INTEGER NOT NULL DEFAULT 8,
  "prompt" TEXT NOT NULL,
  "style_prompt" TEXT,
  "image_aspect" TEXT NOT NULL DEFAULT 'phone',
  "cover_image_prompt" TEXT,
  "cover_image_url" TEXT,
  "cover_image_object_key" TEXT,
  "characters" JSONB,
  "generation_meta" JSONB,
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "curated_book_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "curated_book_localization" (
  "id" TEXT NOT NULL,
  "book_id" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "curated_book_localization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "curated_book_page" (
  "id" TEXT NOT NULL,
  "book_id" TEXT NOT NULL,
  "page_number" INTEGER NOT NULL,
  "page_type" TEXT NOT NULL DEFAULT 'story',
  "image_aspect" TEXT NOT NULL DEFAULT 'phone',
  "image_prompt" TEXT,
  "image_url" TEXT,
  "image_object_key" TEXT,
  "character_ids" JSONB,
  "game" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "curated_book_page_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "curated_book_page_localization" (
  "id" TEXT NOT NULL,
  "page_id" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "content_html" TEXT,
  "narration_text" TEXT NOT NULL,
  "narration_html" TEXT,
  "narration_blocks" JSONB,
  "audio_url" TEXT,
  "audio_object_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "curated_book_page_localization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "curated_book_slug_key" ON "curated_book"("slug");
CREATE INDEX "curated_book_status_published_at_idx" ON "curated_book"("status", "published_at");

CREATE UNIQUE INDEX "curated_book_localization_book_id_language_key" ON "curated_book_localization"("book_id", "language");
CREATE INDEX "curated_book_localization_language_idx" ON "curated_book_localization"("language");

CREATE UNIQUE INDEX "curated_book_page_book_id_page_number_key" ON "curated_book_page"("book_id", "page_number");
CREATE INDEX "curated_book_page_book_id_created_at_idx" ON "curated_book_page"("book_id", "created_at");

CREATE UNIQUE INDEX "curated_book_page_localization_page_id_language_key" ON "curated_book_page_localization"("page_id", "language");
CREATE INDEX "curated_book_page_localization_language_idx" ON "curated_book_page_localization"("language");

ALTER TABLE "curated_book_localization"
  ADD CONSTRAINT "curated_book_localization_book_id_fkey"
  FOREIGN KEY ("book_id") REFERENCES "curated_book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "curated_book_page"
  ADD CONSTRAINT "curated_book_page_book_id_fkey"
  FOREIGN KEY ("book_id") REFERENCES "curated_book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "curated_book_page_localization"
  ADD CONSTRAINT "curated_book_page_localization_page_id_fkey"
  FOREIGN KEY ("page_id") REFERENCES "curated_book_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
