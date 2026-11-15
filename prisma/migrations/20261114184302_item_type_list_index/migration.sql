-- CreateIndex
CREATE INDEX "items_userId_itemTypeId_createdAt_id_idx" ON "items"("userId", "itemTypeId", "createdAt" DESC, "id" DESC);
