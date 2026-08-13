-- AlterTable
ALTER TABLE "Project" ADD COLUMN "sharePointUrl" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Photo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'photo',
    "originalPath" TEXT NOT NULL,
    "stampedPath" TEXT NOT NULL,
    "durationSeconds" REAL,
    "latitude" REAL,
    "longitude" REAL,
    "accuracy" REAL,
    "address" TEXT,
    "country" TEXT,
    "note" TEXT,
    "direction" REAL,
    "cropData" TEXT,
    "groupId" TEXT,
    "capturedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Photo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Photo" ("accuracy", "address", "capturedAt", "country", "createdAt", "cropData", "groupId", "id", "latitude", "longitude", "note", "originalPath", "projectId", "stampedPath", "updatedAt") SELECT "accuracy", "address", "capturedAt", "country", "createdAt", "cropData", "groupId", "id", "latitude", "longitude", "note", "originalPath", "projectId", "stampedPath", "updatedAt" FROM "Photo";
DROP TABLE "Photo";
ALTER TABLE "new_Photo" RENAME TO "Photo";
CREATE INDEX "Photo_projectId_idx" ON "Photo"("projectId");
CREATE INDEX "Photo_groupId_idx" ON "Photo"("groupId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
