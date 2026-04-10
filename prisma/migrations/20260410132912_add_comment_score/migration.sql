-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "detail_mistakes" TEXT,
ADD COLUMN     "score" TEXT,
ALTER COLUMN "content" DROP NOT NULL;
