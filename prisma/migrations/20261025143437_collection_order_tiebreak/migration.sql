-- DropIndex
DROP INDEX "collections_userId_createdAt_idx";

-- DropIndex
DROP INDEX "collections_userId_isFavorite_createdAt_idx";

-- CreateIndex
CREATE INDEX "collections_userId_createdAt_id_idx" ON "collections"("userId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "collections_userId_isFavorite_createdAt_id_idx" ON "collections"("userId", "isFavorite", "createdAt" DESC, "id" DESC);
