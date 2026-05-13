-- CreateTable
CREATE TABLE "story_template" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "theme" TEXT NOT NULL,
    "language" TEXT,
    "cover_image_url" TEXT,
    "cover_image_object_key" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "story_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "story_template_user_id_idx" ON "story_template"("user_id");

-- CreateIndex
CREATE INDEX "story_template_enabled_sort_order_idx" ON "story_template"("enabled", "sort_order");

-- AddForeignKey
ALTER TABLE "story_template" ADD CONSTRAINT "story_template_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
