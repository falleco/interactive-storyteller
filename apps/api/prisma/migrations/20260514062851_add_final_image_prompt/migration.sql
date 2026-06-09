-- AlterTable
ALTER TABLE "book" ADD COLUMN     "final_cover_image_prompt" TEXT;

-- AlterTable
ALTER TABLE "book_choice" ADD COLUMN     "final_image_prompt" TEXT;

-- AlterTable
ALTER TABLE "book_page" ADD COLUMN     "final_image_prompt" TEXT;
