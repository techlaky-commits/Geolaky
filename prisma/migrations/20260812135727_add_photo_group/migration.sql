-- AlterTable
ALTER TABLE "Photo" ADD COLUMN "groupId" TEXT;

-- CreateIndex
CREATE INDEX "Photo_groupId_idx" ON "Photo"("groupId");
