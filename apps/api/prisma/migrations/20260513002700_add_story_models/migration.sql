-- CreateTable
CREATE TABLE "child_profile" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "age" INTEGER NOT NULL,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storyteller" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "preview_audio_url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storyteller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "child_profile_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "mode" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "storyteller" TEXT NOT NULL,
    "template_id" TEXT,
    "template_label" TEXT,
    "theme" TEXT,
    "title" TEXT NOT NULL,
    "character_description" TEXT,
    "cover_image_prompt" TEXT,
    "cover_image_url" TEXT,
    "cover_image_object_key" TEXT,
    "title_audio_url" TEXT,
    "title_audio_object_key" TEXT,
    "snapshot_url" TEXT,
    "snapshot_object_key" TEXT,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "page_count" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "completed_read_count" INTEGER NOT NULL DEFAULT 0,
    "last_completed_read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_page" (
    "id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "page_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "narration_text" TEXT NOT NULL,
    "text_asset_url" TEXT,
    "text_asset_object_key" TEXT,
    "image_prompt" TEXT,
    "image_url" TEXT,
    "image_object_key" TEXT,
    "audio_url" TEXT,
    "audio_object_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_choice" (
    "id" TEXT NOT NULL,
    "book_page_id" TEXT NOT NULL,
    "choice_index" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "image_prompt" TEXT,
    "image_url" TEXT,
    "image_object_key" TEXT,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_choice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "child_profile_user_id_idx" ON "child_profile"("user_id");

-- CreateIndex
CREATE INDEX "storyteller_language_enabled_sort_order_idx" ON "storyteller"("language", "enabled", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "storyteller_language_identifier_key" ON "storyteller"("language", "identifier");

-- CreateIndex
CREATE INDEX "book_user_id_created_at_idx" ON "book"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "book_child_profile_id_idx" ON "book"("child_profile_id");

-- CreateIndex
CREATE INDEX "book_page_book_id_created_at_idx" ON "book_page"("book_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "book_page_book_id_page_number_key" ON "book_page"("book_id", "page_number");

-- CreateIndex
CREATE INDEX "book_choice_book_page_id_created_at_idx" ON "book_choice"("book_page_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "book_choice_book_page_id_choice_index_key" ON "book_choice"("book_page_id", "choice_index");

-- AddForeignKey
ALTER TABLE "child_profile" ADD CONSTRAINT "child_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book" ADD CONSTRAINT "book_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book" ADD CONSTRAINT "book_child_profile_id_fkey" FOREIGN KEY ("child_profile_id") REFERENCES "child_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_page" ADD CONSTRAINT "book_page_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_choice" ADD CONSTRAINT "book_choice_book_page_id_fkey" FOREIGN KEY ("book_page_id") REFERENCES "book_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
