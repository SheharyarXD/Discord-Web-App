-- CreateTable
CREATE TABLE "GearFamily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "sourceTitle" TEXT,
    "sourceStatus" TEXT NOT NULL DEFAULT 'SOURCED',
    "reviewStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EquipmentSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "description" TEXT,
    "descriptionEs" TEXT,
    "translationStatus" TEXT NOT NULL DEFAULT 'MISSING',
    "imageUrl" TEXT,
    "tierStacking" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "reviewStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "metadata" JSONB,
    "familyId" TEXT,
    "versionKey" TEXT,
    "versionLabel" TEXT,
    "versionBasis" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EquipmentSet_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "GearFamily" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EquipmentSet" ("createdAt", "description", "descriptionEs", "id", "imageUrl", "metadata", "name", "nameEs", "reviewStatus", "slug", "tierStacking", "translationStatus", "updatedAt") SELECT "createdAt", "description", "descriptionEs", "id", "imageUrl", "metadata", "name", "nameEs", "reviewStatus", "slug", "tierStacking", "translationStatus", "updatedAt" FROM "EquipmentSet";
DROP TABLE "EquipmentSet";
ALTER TABLE "new_EquipmentSet" RENAME TO "EquipmentSet";
CREATE UNIQUE INDEX "EquipmentSet_slug_key" ON "EquipmentSet"("slug");
CREATE TABLE "new_JewelrySet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "description" TEXT,
    "descriptionEs" TEXT,
    "translationStatus" TEXT NOT NULL DEFAULT 'MISSING',
    "imageUrl" TEXT,
    "structureStatus" TEXT NOT NULL DEFAULT 'UNCONFIRMED',
    "tierStacking" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "reviewStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "metadata" JSONB,
    "familyId" TEXT,
    "versionKey" TEXT,
    "versionLabel" TEXT,
    "versionBasis" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JewelrySet_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "GearFamily" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_JewelrySet" ("createdAt", "description", "descriptionEs", "id", "imageUrl", "metadata", "name", "nameEs", "reviewStatus", "slug", "structureStatus", "tierStacking", "translationStatus", "updatedAt") SELECT "createdAt", "description", "descriptionEs", "id", "imageUrl", "metadata", "name", "nameEs", "reviewStatus", "slug", "structureStatus", "tierStacking", "translationStatus", "updatedAt" FROM "JewelrySet";
DROP TABLE "JewelrySet";
ALTER TABLE "new_JewelrySet" RENAME TO "JewelrySet";
CREATE UNIQUE INDEX "JewelrySet_slug_key" ON "JewelrySet"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "GearFamily_slug_key" ON "GearFamily"("slug");
