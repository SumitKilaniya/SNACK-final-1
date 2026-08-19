-- CreateEnum: (none needed)

-- CreateTable: Reviews
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Wishlists
CREATE TABLE "wishlists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint per (user, menuItem) on reviews
CREATE UNIQUE INDEX "reviews_userId_menuItemId_key" ON "reviews"("userId", "menuItemId");

-- CreateIndex: For listing reviews by menu item (newest first)
CREATE INDEX "reviews_menuItemId_createdAt_idx" ON "reviews"("menuItemId", "createdAt");

-- CreateIndex: For listing a user's own reviews
CREATE INDEX "reviews_userId_idx" ON "reviews"("userId");

-- CreateIndex: Unique constraint per (user, menuItem) on wishlists
CREATE UNIQUE INDEX "wishlists_userId_menuItemId_key" ON "wishlists"("userId", "menuItemId");

-- CreateIndex: For listing a user's wishlisted items
CREATE INDEX "wishlists_userId_idx" ON "wishlists"("userId");

-- AlterTable: Add reviewCount to menu_items (additive, zero data loss)
ALTER TABLE "menu_items" ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey: Reviews -> Users
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Reviews -> MenuItems
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Wishlists -> Users
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Wishlists -> MenuItems
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
