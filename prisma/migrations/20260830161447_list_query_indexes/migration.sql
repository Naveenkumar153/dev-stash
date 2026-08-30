-- DropIndex
DROP INDEX "collections_userId_idx";

-- DropIndex
DROP INDEX "items_userId_idx";

-- CreateIndex
CREATE INDEX "collections_userId_createdAt_idx" ON "collections"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "collections_userId_isFavorite_createdAt_idx" ON "collections"("userId", "isFavorite", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "items_userId_createdAt_id_idx" ON "items"("userId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "items_userId_isPinned_createdAt_id_idx" ON "items"("userId", "isPinned", "createdAt" DESC, "id" DESC);
