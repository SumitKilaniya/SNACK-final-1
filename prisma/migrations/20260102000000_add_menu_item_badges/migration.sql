-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN "badge" TEXT,
ADD COLUMN "isBestseller" BOOLEAN NOT NULL DEFAULT false;
