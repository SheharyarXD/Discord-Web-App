-- AlterTable
ALTER TABLE "EquipmentSet" ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "versionBasis" TEXT,
ADD COLUMN     "versionKey" TEXT,
ADD COLUMN     "versionLabel" TEXT;

-- AlterTable
ALTER TABLE "JewelrySet" ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "versionBasis" TEXT,
ADD COLUMN     "versionKey" TEXT,
ADD COLUMN     "versionLabel" TEXT;

-- CreateTable
CREATE TABLE "GearFamily" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "sourceTitle" TEXT,
    "sourceStatus" TEXT NOT NULL DEFAULT 'SOURCED',
    "reviewStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GearFamily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GearFamily_slug_key" ON "GearFamily"("slug");

-- AddForeignKey
ALTER TABLE "EquipmentSet" ADD CONSTRAINT "EquipmentSet_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "GearFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JewelrySet" ADD CONSTRAINT "JewelrySet_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "GearFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;

