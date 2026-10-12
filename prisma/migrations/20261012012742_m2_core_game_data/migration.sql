/*
  Warnings:

  - You are about to alter the column `numericValue` on the `Condition` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Decimal`.
  - You are about to alter the column `chancePercent` on the `Effect` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Decimal`.
  - You are about to alter the column `value` on the `Effect` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Decimal`.

*/
-- AlterTable
ALTER TABLE "ConditionValue" ADD COLUMN "nameEs" TEXT;

-- AlterTable
ALTER TABLE "EquipmentSetBonus" ADD COLUMN "descriptionEs" TEXT;

-- AlterTable
ALTER TABLE "EquipmentSlot" ADD COLUMN "nameEs" TEXT;

-- AlterTable
ALTER TABLE "JewelryType" ADD COLUMN "nameEs" TEXT;

-- CreateTable
CREATE TABLE "SourceAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "path" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "capturedAt" DATETIME,
    "capturedNote" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "fullyLegible" BOOLEAN,
    "duplicateOfId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SourceAsset_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "SourceAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SourceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "section" TEXT,
    "field" TEXT,
    "sourceText" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "ambiguityNote" TEXT,
    "supersededById" TEXT,
    "ninjaId" TEXT,
    "abilityId" TEXT,
    "talentOptionId" TEXT,
    "statusEffectId" TEXT,
    "effectId" TEXT,
    "statisticId" TEXT,
    "formationId" TEXT,
    "roleId" TEXT,
    "equipmentId" TEXT,
    "equipmentSetId" TEXT,
    "jewelryId" TEXT,
    "jewelrySetId" TEXT,
    "gemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SourceRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "SourceAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SourceRecord_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "SourceRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SourceRecord_ninjaId_fkey" FOREIGN KEY ("ninjaId") REFERENCES "Ninja" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SourceRecord_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "Ability" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SourceRecord_talentOptionId_fkey" FOREIGN KEY ("talentOptionId") REFERENCES "TalentOption" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SourceRecord_statusEffectId_fkey" FOREIGN KEY ("statusEffectId") REFERENCES "StatusEffect" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SourceRecord_effectId_fkey" FOREIGN KEY ("effectId") REFERENCES "Effect" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SourceRecord_statisticId_fkey" FOREIGN KEY ("statisticId") REFERENCES "Statistic" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SourceRecord_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SourceRecord_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "NinjaRole" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SourceRecord_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SourceRecord_equipmentSetId_fkey" FOREIGN KEY ("equipmentSetId") REFERENCES "EquipmentSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SourceRecord_jewelryId_fkey" FOREIGN KEY ("jewelryId") REFERENCES "Jewelry" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SourceRecord_jewelrySetId_fkey" FOREIGN KEY ("jewelrySetId") REFERENCES "JewelrySet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SourceRecord_gemId_fkey" FOREIGN KEY ("gemId") REFERENCES "Gem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatisticAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statisticId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    CONSTRAINT "StatisticAlias_statisticId_fkey" FOREIGN KEY ("statisticId") REFERENCES "Statistic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Formation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "translationStatus" TEXT NOT NULL DEFAULT 'MISSING',
    "positionNote" TEXT,
    "primaryStatisticId" TEXT,
    "maxPerTeam" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Formation_primaryStatisticId_fkey" FOREIGN KEY ("primaryStatisticId") REFERENCES "Statistic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NinjaRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NinjaType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "translationStatus" TEXT NOT NULL DEFAULT 'MISSING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StatusEffect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'STATUS',
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "description" TEXT,
    "descriptionEs" TEXT,
    "translationStatus" TEXT NOT NULL DEFAULT 'MISSING',
    "polarity" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "cleansability" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "cleansabilityNote" TEXT,
    "overrideDocumented" BOOLEAN NOT NULL DEFAULT false,
    "timingNote" TEXT,
    "note" TEXT,
    "structuredStatus" TEXT NOT NULL DEFAULT 'STRUCTURED',
    "reviewStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StatusEffectAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statusEffectId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    CONSTRAINT "StatusEffectAlias_statusEffectId_fkey" FOREIGN KEY ("statusEffectId") REFERENCES "StatusEffect" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatusCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "StatusEffectCategory" (
    "statusEffectId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    PRIMARY KEY ("statusEffectId", "categoryId"),
    CONSTRAINT "StatusEffectCategory_statusEffectId_fkey" FOREIGN KEY ("statusEffectId") REFERENCES "StatusEffect" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StatusEffectCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StatusCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatusEffectModifier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statusEffectId" TEXT NOT NULL,
    "statLabel" TEXT NOT NULL,
    "statisticId" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'INCREASE',
    "magnitude" DECIMAL,
    "valueType" TEXT NOT NULL DEFAULT 'PERCENT',
    "overridable" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StatusEffectModifier_statusEffectId_fkey" FOREIGN KEY ("statusEffectId") REFERENCES "StatusEffect" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StatusEffectModifier_statisticId_fkey" FOREIGN KEY ("statisticId") REFERENCES "Statistic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NinjaBaseStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ninjaId" TEXT NOT NULL,
    "statisticId" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "baseValue" DECIMAL NOT NULL,
    "growthRate" DECIMAL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NinjaBaseStat_ninjaId_fkey" FOREIGN KEY ("ninjaId") REFERENCES "Ninja" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NinjaBaseStat_statisticId_fkey" FOREIGN KEY ("statisticId") REFERENCES "Statistic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NinjaNature" (
    "ninjaId" TEXT NOT NULL,
    "natureId" TEXT NOT NULL,

    PRIMARY KEY ("ninjaId", "natureId"),
    CONSTRAINT "NinjaNature_ninjaId_fkey" FOREIGN KEY ("ninjaId") REFERENCES "Ninja" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NinjaNature_natureId_fkey" FOREIGN KEY ("natureId") REFERENCES "ConditionValue" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserTalentSelection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserTalentSelection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserTalentSelection_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "TalentOption" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JewelryGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "JewelryGroup_setId_fkey" FOREIGN KEY ("setId") REFERENCES "JewelrySet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Ability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ninjaId" TEXT NOT NULL,
    "abilityTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "description" TEXT,
    "descriptionEs" TEXT,
    "translationStatus" TEXT NOT NULL DEFAULT 'MISSING',
    "triggerText" TEXT,
    "stage" INTEGER,
    "imageUrl" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ability_ninjaId_fkey" FOREIGN KEY ("ninjaId") REFERENCES "Ninja" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ability_abilityTypeId_fkey" FOREIGN KEY ("abilityTypeId") REFERENCES "AbilityType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Ability" ("abilityTypeId", "createdAt", "description", "id", "imageUrl", "name", "ninjaId", "sortOrder", "updatedAt") SELECT "abilityTypeId", "createdAt", "description", "id", "imageUrl", "name", "ninjaId", "sortOrder", "updatedAt" FROM "Ability";
DROP TABLE "Ability";
ALTER TABLE "new_Ability" RENAME TO "Ability";
CREATE INDEX "Ability_ninjaId_idx" ON "Ability"("ninjaId");
CREATE INDEX "Ability_abilityTypeId_idx" ON "Ability"("abilityTypeId");
CREATE TABLE "new_Condition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "effectId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'ACTIVATION',
    "conditionTypeId" TEXT NOT NULL,
    "conditionValueId" TEXT,
    "ninjaId" TEXT,
    "formationId" TEXT,
    "roleId" TEXT,
    "operator" TEXT NOT NULL DEFAULT 'REQUIRES',
    "numericValue" DECIMAL,
    "note" TEXT,
    "sourceText" TEXT,
    "alternativeGroup" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Condition_effectId_fkey" FOREIGN KEY ("effectId") REFERENCES "Effect" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Condition_conditionTypeId_fkey" FOREIGN KEY ("conditionTypeId") REFERENCES "ConditionType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Condition_conditionValueId_fkey" FOREIGN KEY ("conditionValueId") REFERENCES "ConditionValue" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Condition_ninjaId_fkey" FOREIGN KEY ("ninjaId") REFERENCES "Ninja" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Condition_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Condition_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "NinjaRole" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Condition" ("alternativeGroup", "conditionTypeId", "conditionValueId", "effectId", "id", "note", "numericValue", "operator", "sortOrder") SELECT "alternativeGroup", "conditionTypeId", "conditionValueId", "effectId", "id", "note", "numericValue", "operator", "sortOrder" FROM "Condition";
DROP TABLE "Condition";
ALTER TABLE "new_Condition" RENAME TO "Condition";
CREATE INDEX "Condition_effectId_idx" ON "Condition"("effectId");
CREATE INDEX "Condition_conditionTypeId_conditionValueId_idx" ON "Condition"("conditionTypeId", "conditionValueId");
CREATE INDEX "Condition_ninjaId_idx" ON "Condition"("ninjaId");
CREATE INDEX "Condition_formationId_idx" ON "Condition"("formationId");
CREATE INDEX "Condition_roleId_idx" ON "Condition"("roleId");
CREATE TABLE "new_Effect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statisticId" TEXT,
    "value" DECIMAL,
    "valueType" TEXT NOT NULL DEFAULT 'FLAT',
    "statusEffectId" TEXT,
    "magnitudeOverride" DECIMAL,
    "targetId" TEXT,
    "targetText" TEXT,
    "durationTurns" INTEGER,
    "chancePercent" DECIMAL,
    "triggerText" TEXT,
    "conditionText" TEXT,
    "structuredStatus" TEXT NOT NULL DEFAULT 'STRUCTURED',
    "sourceText" TEXT,
    "description" TEXT,
    "descriptionEs" TEXT,
    "translationStatus" TEXT NOT NULL DEFAULT 'MISSING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "abilityId" TEXT,
    "talentOptionId" TEXT,
    "equipmentId" TEXT,
    "equipmentSetBonusId" TEXT,
    "jewelryId" TEXT,
    "jewelrySetBonusId" TEXT,
    "gemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Effect_statisticId_fkey" FOREIGN KEY ("statisticId") REFERENCES "Statistic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Effect_statusEffectId_fkey" FOREIGN KEY ("statusEffectId") REFERENCES "StatusEffect" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Effect_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "EffectTarget" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Effect_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "Ability" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Effect_talentOptionId_fkey" FOREIGN KEY ("talentOptionId") REFERENCES "TalentOption" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Effect_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Effect_equipmentSetBonusId_fkey" FOREIGN KEY ("equipmentSetBonusId") REFERENCES "EquipmentSetBonus" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Effect_jewelryId_fkey" FOREIGN KEY ("jewelryId") REFERENCES "Jewelry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Effect_jewelrySetBonusId_fkey" FOREIGN KEY ("jewelrySetBonusId") REFERENCES "JewelrySetBonus" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Effect_gemId_fkey" FOREIGN KEY ("gemId") REFERENCES "Gem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Effect" ("abilityId", "chancePercent", "createdAt", "description", "durationTurns", "equipmentId", "equipmentSetBonusId", "gemId", "id", "jewelryId", "jewelrySetBonusId", "sortOrder", "statisticId", "talentOptionId", "targetId", "updatedAt", "value", "valueType") SELECT "abilityId", "chancePercent", "createdAt", "description", "durationTurns", "equipmentId", "equipmentSetBonusId", "gemId", "id", "jewelryId", "jewelrySetBonusId", "sortOrder", "statisticId", "talentOptionId", "targetId", "updatedAt", "value", "valueType" FROM "Effect";
DROP TABLE "Effect";
ALTER TABLE "new_Effect" RENAME TO "Effect";
CREATE INDEX "Effect_abilityId_idx" ON "Effect"("abilityId");
CREATE INDEX "Effect_talentOptionId_idx" ON "Effect"("talentOptionId");
CREATE INDEX "Effect_equipmentId_idx" ON "Effect"("equipmentId");
CREATE INDEX "Effect_equipmentSetBonusId_idx" ON "Effect"("equipmentSetBonusId");
CREATE INDEX "Effect_jewelryId_idx" ON "Effect"("jewelryId");
CREATE INDEX "Effect_jewelrySetBonusId_idx" ON "Effect"("jewelrySetBonusId");
CREATE INDEX "Effect_gemId_idx" ON "Effect"("gemId");
CREATE INDEX "Effect_statisticId_valueType_value_idx" ON "Effect"("statisticId", "valueType", "value");
CREATE INDEX "Effect_statusEffectId_idx" ON "Effect"("statusEffectId");
CREATE TABLE "new_Equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "description" TEXT,
    "descriptionEs" TEXT,
    "translationStatus" TEXT NOT NULL DEFAULT 'MISSING',
    "slotId" TEXT,
    "setId" TEXT,
    "imageUrl" TEXT,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Equipment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "EquipmentSlot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Equipment_setId_fkey" FOREIGN KEY ("setId") REFERENCES "EquipmentSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Equipment" ("createdAt", "id", "imageUrl", "metadata", "name", "setId", "slotId", "slug", "status", "updatedAt") SELECT "createdAt", "id", "imageUrl", "metadata", "name", "setId", "slotId", "slug", "status", "updatedAt" FROM "Equipment";
DROP TABLE "Equipment";
ALTER TABLE "new_Equipment" RENAME TO "Equipment";
CREATE UNIQUE INDEX "Equipment_slug_key" ON "Equipment"("slug");
CREATE INDEX "Equipment_slotId_idx" ON "Equipment"("slotId");
CREATE INDEX "Equipment_setId_idx" ON "Equipment"("setId");
CREATE INDEX "Equipment_status_idx" ON "Equipment"("status");
CREATE INDEX "Equipment_name_idx" ON "Equipment"("name");
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_EquipmentSet" ("createdAt", "description", "id", "imageUrl", "metadata", "name", "slug", "updatedAt") SELECT "createdAt", "description", "id", "imageUrl", "metadata", "name", "slug", "updatedAt" FROM "EquipmentSet";
DROP TABLE "EquipmentSet";
ALTER TABLE "new_EquipmentSet" RENAME TO "EquipmentSet";
CREATE UNIQUE INDEX "EquipmentSet_slug_key" ON "EquipmentSet"("slug");
CREATE TABLE "new_Jewelry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "description" TEXT,
    "descriptionEs" TEXT,
    "translationStatus" TEXT NOT NULL DEFAULT 'MISSING',
    "typeId" TEXT,
    "setId" TEXT,
    "groupId" TEXT,
    "imageUrl" TEXT,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Jewelry_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "JewelryType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Jewelry_setId_fkey" FOREIGN KEY ("setId") REFERENCES "JewelrySet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Jewelry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "JewelryGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Jewelry" ("createdAt", "id", "imageUrl", "metadata", "name", "setId", "slug", "status", "typeId", "updatedAt") SELECT "createdAt", "id", "imageUrl", "metadata", "name", "setId", "slug", "status", "typeId", "updatedAt" FROM "Jewelry";
DROP TABLE "Jewelry";
ALTER TABLE "new_Jewelry" RENAME TO "Jewelry";
CREATE UNIQUE INDEX "Jewelry_slug_key" ON "Jewelry"("slug");
CREATE INDEX "Jewelry_typeId_idx" ON "Jewelry"("typeId");
CREATE INDEX "Jewelry_setId_idx" ON "Jewelry"("setId");
CREATE INDEX "Jewelry_groupId_idx" ON "Jewelry"("groupId");
CREATE INDEX "Jewelry_status_idx" ON "Jewelry"("status");
CREATE INDEX "Jewelry_name_idx" ON "Jewelry"("name");
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_JewelrySet" ("createdAt", "description", "id", "imageUrl", "metadata", "name", "slug", "updatedAt") SELECT "createdAt", "description", "id", "imageUrl", "metadata", "name", "slug", "updatedAt" FROM "JewelrySet";
DROP TABLE "JewelrySet";
ALTER TABLE "new_JewelrySet" RENAME TO "JewelrySet";
CREATE UNIQUE INDEX "JewelrySet_slug_key" ON "JewelrySet"("slug");
CREATE TABLE "new_JewelrySetBonus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setId" TEXT NOT NULL,
    "groupId" TEXT,
    "requirementKind" TEXT NOT NULL DEFAULT 'PIECE_COUNT',
    "requiredPieces" INTEGER,
    "description" TEXT,
    "descriptionEs" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "JewelrySetBonus_setId_fkey" FOREIGN KEY ("setId") REFERENCES "JewelrySet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JewelrySetBonus_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "JewelryGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_JewelrySetBonus" ("description", "id", "requiredPieces", "requirementKind", "setId", "sortOrder") SELECT "description", "id", "requiredPieces", "requirementKind", "setId", "sortOrder" FROM "JewelrySetBonus";
DROP TABLE "JewelrySetBonus";
ALTER TABLE "new_JewelrySetBonus" RENAME TO "JewelrySetBonus";
CREATE INDEX "JewelrySetBonus_setId_idx" ON "JewelrySetBonus"("setId");
CREATE INDEX "JewelrySetBonus_groupId_idx" ON "JewelrySetBonus"("groupId");
CREATE TABLE "new_Ninja" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "description" TEXT,
    "descriptionEs" TEXT,
    "translationStatus" TEXT NOT NULL DEFAULT 'MISSING',
    "imageUrl" TEXT,
    "roleId" TEXT,
    "formationId" TEXT,
    "ratingId" TEXT,
    "ninjaTypeId" TEXT,
    "clientCombatClass" TEXT,
    "releaseYear" INTEGER,
    "releaseMonth" INTEGER,
    "releaseOrder" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ninja_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "NinjaRole" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ninja_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ninja_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "NinjaRating" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ninja_ninjaTypeId_fkey" FOREIGN KEY ("ninjaTypeId") REFERENCES "NinjaType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Ninja" ("createdAt", "description", "id", "imageUrl", "metadata", "name", "roleId", "slug", "status", "updatedAt") SELECT "createdAt", "description", "id", "imageUrl", "metadata", "name", "roleId", "slug", "status", "updatedAt" FROM "Ninja";
DROP TABLE "Ninja";
ALTER TABLE "new_Ninja" RENAME TO "Ninja";
CREATE UNIQUE INDEX "Ninja_slug_key" ON "Ninja"("slug");
CREATE INDEX "Ninja_roleId_idx" ON "Ninja"("roleId");
CREATE INDEX "Ninja_status_idx" ON "Ninja"("status");
CREATE INDEX "Ninja_formationId_idx" ON "Ninja"("formationId");
CREATE INDEX "Ninja_ratingId_idx" ON "Ninja"("ratingId");
CREATE INDEX "Ninja_ninjaTypeId_idx" ON "Ninja"("ninjaTypeId");
CREATE INDEX "Ninja_clientCombatClass_idx" ON "Ninja"("clientCombatClass");
CREATE INDEX "Ninja_releaseYear_releaseMonth_releaseOrder_idx" ON "Ninja"("releaseYear", "releaseMonth", "releaseOrder");
CREATE INDEX "Ninja_name_idx" ON "Ninja"("name");
CREATE TABLE "new_NinjaRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "mappedFormationId" TEXT,
    "mappingStatus" TEXT NOT NULL DEFAULT 'UNMAPPED',
    "mappingNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NinjaRole_mappedFormationId_fkey" FOREIGN KEY ("mappedFormationId") REFERENCES "Formation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_NinjaRole" ("createdAt", "description", "id", "key", "name", "sortOrder", "updatedAt") SELECT "createdAt", "description", "id", "key", "name", "sortOrder", "updatedAt" FROM "NinjaRole";
DROP TABLE "NinjaRole";
ALTER TABLE "new_NinjaRole" RENAME TO "NinjaRole";
CREATE UNIQUE INDEX "NinjaRole_key_key" ON "NinjaRole"("key");
CREATE TABLE "new_Statistic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "translationStatus" TEXT NOT NULL DEFAULT 'MISSING',
    "description" TEXT,
    "category" TEXT,
    "defaultValueType" TEXT NOT NULL DEFAULT 'FLAT',
    "reviewStatus" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Statistic" ("createdAt", "defaultValueType", "description", "id", "isActive", "key", "name", "sortOrder", "updatedAt") SELECT "createdAt", "defaultValueType", "description", "id", "isActive", "key", "name", "sortOrder", "updatedAt" FROM "Statistic";
DROP TABLE "Statistic";
ALTER TABLE "new_Statistic" RENAME TO "Statistic";
CREATE UNIQUE INDEX "Statistic_key_key" ON "Statistic"("key");
CREATE INDEX "Statistic_category_idx" ON "Statistic"("category");
CREATE TABLE "new_TalentGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ninjaId" TEXT NOT NULL,
    "name" TEXT,
    "selectionMode" TEXT NOT NULL DEFAULT 'ONE_OF',
    "minSelections" INTEGER NOT NULL DEFAULT 1,
    "maxSelections" INTEGER NOT NULL DEFAULT 1,
    "reviewStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TalentGroup_ninjaId_fkey" FOREIGN KEY ("ninjaId") REFERENCES "Ninja" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TalentGroup" ("createdAt", "id", "maxSelections", "minSelections", "name", "ninjaId", "selectionMode", "sortOrder", "updatedAt") SELECT "createdAt", "id", "maxSelections", "minSelections", "name", "ninjaId", "selectionMode", "sortOrder", "updatedAt" FROM "TalentGroup";
DROP TABLE "TalentGroup";
ALTER TABLE "new_TalentGroup" RENAME TO "TalentGroup";
CREATE INDEX "TalentGroup_ninjaId_idx" ON "TalentGroup"("ninjaId");
CREATE TABLE "new_TalentOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "description" TEXT,
    "descriptionEs" TEXT,
    "translationStatus" TEXT NOT NULL DEFAULT 'MISSING',
    "imageUrl" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TalentOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TalentGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TalentOption" ("description", "groupId", "id", "imageUrl", "isDefault", "name", "sortOrder") SELECT "description", "groupId", "id", "imageUrl", "isDefault", "name", "sortOrder" FROM "TalentOption";
DROP TABLE "TalentOption";
ALTER TABLE "new_TalentOption" RENAME TO "TalentOption";
CREATE INDEX "TalentOption_groupId_idx" ON "TalentOption"("groupId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SourceAsset_path_key" ON "SourceAsset"("path");

-- CreateIndex
CREATE UNIQUE INDEX "SourceRecord_key_key" ON "SourceRecord"("key");

-- CreateIndex
CREATE INDEX "SourceRecord_assetId_idx" ON "SourceRecord"("assetId");

-- CreateIndex
CREATE INDEX "SourceRecord_reviewStatus_idx" ON "SourceRecord"("reviewStatus");

-- CreateIndex
CREATE INDEX "SourceRecord_ninjaId_idx" ON "SourceRecord"("ninjaId");

-- CreateIndex
CREATE INDEX "SourceRecord_statusEffectId_idx" ON "SourceRecord"("statusEffectId");

-- CreateIndex
CREATE INDEX "SourceRecord_effectId_idx" ON "SourceRecord"("effectId");

-- CreateIndex
CREATE INDEX "SourceRecord_abilityId_idx" ON "SourceRecord"("abilityId");

-- CreateIndex
CREATE INDEX "SourceRecord_equipmentId_idx" ON "SourceRecord"("equipmentId");

-- CreateIndex
CREATE INDEX "SourceRecord_equipmentSetId_idx" ON "SourceRecord"("equipmentSetId");

-- CreateIndex
CREATE INDEX "SourceRecord_jewelryId_idx" ON "SourceRecord"("jewelryId");

-- CreateIndex
CREATE INDEX "SourceRecord_jewelrySetId_idx" ON "SourceRecord"("jewelrySetId");

-- CreateIndex
CREATE INDEX "StatisticAlias_normalized_idx" ON "StatisticAlias"("normalized");

-- CreateIndex
CREATE UNIQUE INDEX "StatisticAlias_statisticId_normalized_key" ON "StatisticAlias"("statisticId", "normalized");

-- CreateIndex
CREATE UNIQUE INDEX "Formation_key_key" ON "Formation"("key");

-- CreateIndex
CREATE UNIQUE INDEX "NinjaRating_key_key" ON "NinjaRating"("key");

-- CreateIndex
CREATE UNIQUE INDEX "NinjaType_key_key" ON "NinjaType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "StatusEffect_key_key" ON "StatusEffect"("key");

-- CreateIndex
CREATE INDEX "StatusEffect_kind_idx" ON "StatusEffect"("kind");

-- CreateIndex
CREATE INDEX "StatusEffect_polarity_idx" ON "StatusEffect"("polarity");

-- CreateIndex
CREATE INDEX "StatusEffect_cleansability_idx" ON "StatusEffect"("cleansability");

-- CreateIndex
CREATE INDEX "StatusEffectAlias_normalized_idx" ON "StatusEffectAlias"("normalized");

-- CreateIndex
CREATE UNIQUE INDEX "StatusEffectAlias_statusEffectId_normalized_key" ON "StatusEffectAlias"("statusEffectId", "normalized");

-- CreateIndex
CREATE UNIQUE INDEX "StatusCategory_key_key" ON "StatusCategory"("key");

-- CreateIndex
CREATE INDEX "StatusEffectCategory_categoryId_idx" ON "StatusEffectCategory"("categoryId");

-- CreateIndex
CREATE INDEX "StatusEffectModifier_statusEffectId_idx" ON "StatusEffectModifier"("statusEffectId");

-- CreateIndex
CREATE INDEX "StatusEffectModifier_statisticId_idx" ON "StatusEffectModifier"("statisticId");

-- CreateIndex
CREATE INDEX "NinjaBaseStat_statisticId_baseValue_idx" ON "NinjaBaseStat"("statisticId", "baseValue");

-- CreateIndex
CREATE INDEX "NinjaBaseStat_statisticId_growthRate_idx" ON "NinjaBaseStat"("statisticId", "growthRate");

-- CreateIndex
CREATE UNIQUE INDEX "NinjaBaseStat_ninjaId_statisticId_key" ON "NinjaBaseStat"("ninjaId", "statisticId");

-- CreateIndex
CREATE INDEX "NinjaNature_natureId_idx" ON "NinjaNature"("natureId");

-- CreateIndex
CREATE INDEX "UserTalentSelection_optionId_idx" ON "UserTalentSelection"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTalentSelection_userId_optionId_key" ON "UserTalentSelection"("userId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "JewelryGroup_setId_key_key" ON "JewelryGroup"("setId", "key");

-- ─────────────────────────────────────────────────────────────────────────────
-- Integrity triggers (Milestone 2)
--
-- Prisma cannot express CHECK-style rules for SQLite, so they are enforced by triggers.
-- This file is the reference copy; the same statements are part of the
-- `m2_core_game_data` migration. IMPORTANT: when a later migration REDEFINES one of these
-- tables (Prisma does that on SQLite by create-copy-drop-rename), the table's triggers are
-- dropped with it and MUST be re-created in that migration. tests/constraints.test.ts fails
-- if any trigger listed here is missing from a freshly migrated database.
-- ─────────────────────────────────────────────────────────────────────────────

-- Ninja: release month is 1–12 and never stored without a year.
CREATE TRIGGER "trg_ninja_release_ins" BEFORE INSERT ON "Ninja"
WHEN NEW."releaseMonth" IS NOT NULL AND (NEW."releaseMonth" < 1 OR NEW."releaseMonth" > 12 OR NEW."releaseYear" IS NULL)
BEGIN SELECT RAISE(ABORT, 'CHECK Ninja.releaseMonth: must be 1-12 and requires releaseYear'); END;

CREATE TRIGGER "trg_ninja_release_upd" BEFORE UPDATE OF "releaseMonth", "releaseYear" ON "Ninja"
WHEN NEW."releaseMonth" IS NOT NULL AND (NEW."releaseMonth" < 1 OR NEW."releaseMonth" > 12 OR NEW."releaseYear" IS NULL)
BEGIN SELECT RAISE(ABORT, 'CHECK Ninja.releaseMonth: must be 1-12 and requires releaseYear'); END;

-- Ninja: the client's combat class is TANK, DPS or unassigned — a single value, never both.
CREATE TRIGGER "trg_ninja_combat_class_ins" BEFORE INSERT ON "Ninja"
WHEN NEW."clientCombatClass" IS NOT NULL AND NEW."clientCombatClass" NOT IN ('TANK', 'DPS')
BEGIN SELECT RAISE(ABORT, 'CHECK Ninja.clientCombatClass: must be TANK, DPS or NULL'); END;

CREATE TRIGGER "trg_ninja_combat_class_upd" BEFORE UPDATE OF "clientCombatClass" ON "Ninja"
WHEN NEW."clientCombatClass" IS NOT NULL AND NEW."clientCombatClass" NOT IN ('TANK', 'DPS')
BEGIN SELECT RAISE(ABORT, 'CHECK Ninja.clientCombatClass: must be TANK, DPS or NULL'); END;

-- Effect: exactly one owner.
CREATE TRIGGER "trg_effect_single_owner_ins" BEFORE INSERT ON "Effect"
WHEN ((NEW."abilityId" IS NOT NULL) + (NEW."talentOptionId" IS NOT NULL) + (NEW."equipmentId" IS NOT NULL)
    + (NEW."equipmentSetBonusId" IS NOT NULL) + (NEW."jewelryId" IS NOT NULL)
    + (NEW."jewelrySetBonusId" IS NOT NULL) + (NEW."gemId" IS NOT NULL)) <> 1
BEGIN SELECT RAISE(ABORT, 'CHECK Effect: exactly one owner column must be set'); END;

CREATE TRIGGER "trg_effect_single_owner_upd" BEFORE UPDATE OF "abilityId", "talentOptionId", "equipmentId", "equipmentSetBonusId", "jewelryId", "jewelrySetBonusId", "gemId" ON "Effect"
WHEN ((NEW."abilityId" IS NOT NULL) + (NEW."talentOptionId" IS NOT NULL) + (NEW."equipmentId" IS NOT NULL)
    + (NEW."equipmentSetBonusId" IS NOT NULL) + (NEW."jewelryId" IS NOT NULL)
    + (NEW."jewelrySetBonusId" IS NOT NULL) + (NEW."gemId" IS NOT NULL)) <> 1
BEGIN SELECT RAISE(ABORT, 'CHECK Effect: exactly one owner column must be set'); END;

-- Effect: an activation chance is a percentage; a magnitude override needs a status to override.
CREATE TRIGGER "trg_effect_values_ins" BEFORE INSERT ON "Effect"
WHEN (NEW."chancePercent" IS NOT NULL AND (NEW."chancePercent" < 0 OR NEW."chancePercent" > 100))
  OR (NEW."magnitudeOverride" IS NOT NULL AND NEW."statusEffectId" IS NULL)
  OR (NEW."durationTurns" IS NOT NULL AND NEW."durationTurns" < 0)
BEGIN SELECT RAISE(ABORT, 'CHECK Effect: chancePercent 0-100, durationTurns >= 0, magnitudeOverride requires statusEffectId'); END;

CREATE TRIGGER "trg_effect_values_upd" BEFORE UPDATE OF "chancePercent", "magnitudeOverride", "statusEffectId", "durationTurns" ON "Effect"
WHEN (NEW."chancePercent" IS NOT NULL AND (NEW."chancePercent" < 0 OR NEW."chancePercent" > 100))
  OR (NEW."magnitudeOverride" IS NOT NULL AND NEW."statusEffectId" IS NULL)
  OR (NEW."durationTurns" IS NOT NULL AND NEW."durationTurns" < 0)
BEGIN SELECT RAISE(ABORT, 'CHECK Effect: chancePercent 0-100, durationTurns >= 0, magnitudeOverride requires statusEffectId'); END;

-- Condition: closed value sets.
CREATE TRIGGER "trg_condition_enums_ins" BEFORE INSERT ON "Condition"
WHEN NEW."scope" NOT IN ('ACTIVATION', 'TARGET') OR NEW."operator" NOT IN ('REQUIRES', 'EXCLUDES')
BEGIN SELECT RAISE(ABORT, 'CHECK Condition: invalid scope or operator'); END;

CREATE TRIGGER "trg_condition_enums_upd" BEFORE UPDATE OF "scope", "operator" ON "Condition"
WHEN NEW."scope" NOT IN ('ACTIVATION', 'TARGET') OR NEW."operator" NOT IN ('REQUIRES', 'EXCLUDES')
BEGIN SELECT RAISE(ABORT, 'CHECK Condition: invalid scope or operator'); END;

-- StatusEffect: closed value sets for the independent classification facets.
CREATE TRIGGER "trg_status_effect_enums_ins" BEFORE INSERT ON "StatusEffect"
WHEN NEW."polarity" NOT IN ('BUFF', 'DEBUFF', 'NEUTRAL', 'UNKNOWN')
  OR NEW."cleansability" NOT IN ('CLEANSABLE', 'UNCLEANSABLE', 'CONDITIONAL', 'UNKNOWN')
  OR NEW."kind" NOT IN ('STATUS', 'TERM')
BEGIN SELECT RAISE(ABORT, 'CHECK StatusEffect: invalid kind, polarity or cleansability'); END;

CREATE TRIGGER "trg_status_effect_enums_upd" BEFORE UPDATE OF "kind", "polarity", "cleansability" ON "StatusEffect"
WHEN NEW."polarity" NOT IN ('BUFF', 'DEBUFF', 'NEUTRAL', 'UNKNOWN')
  OR NEW."cleansability" NOT IN ('CLEANSABLE', 'UNCLEANSABLE', 'CONDITIONAL', 'UNKNOWN')
  OR NEW."kind" NOT IN ('STATUS', 'TERM')
BEGIN SELECT RAISE(ABORT, 'CHECK StatusEffect: invalid kind, polarity or cleansability'); END;

-- SourceRecord: evidence is about at most one entity.
CREATE TRIGGER "trg_source_record_target_ins" BEFORE INSERT ON "SourceRecord"
WHEN ((NEW."ninjaId" IS NOT NULL) + (NEW."abilityId" IS NOT NULL) + (NEW."talentOptionId" IS NOT NULL)
    + (NEW."statusEffectId" IS NOT NULL) + (NEW."effectId" IS NOT NULL) + (NEW."statisticId" IS NOT NULL)
    + (NEW."formationId" IS NOT NULL) + (NEW."roleId" IS NOT NULL) + (NEW."equipmentId" IS NOT NULL)
    + (NEW."equipmentSetId" IS NOT NULL) + (NEW."jewelryId" IS NOT NULL) + (NEW."jewelrySetId" IS NOT NULL)
    + (NEW."gemId" IS NOT NULL)) > 1
  OR NEW."reviewStatus" NOT IN ('CONFIRMED', 'PARTIALLY_CONFIRMED', 'NEEDS_REVIEW')
BEGIN SELECT RAISE(ABORT, 'CHECK SourceRecord: at most one target and a valid reviewStatus'); END;

CREATE TRIGGER "trg_source_record_target_upd" BEFORE UPDATE ON "SourceRecord"
WHEN ((NEW."ninjaId" IS NOT NULL) + (NEW."abilityId" IS NOT NULL) + (NEW."talentOptionId" IS NOT NULL)
    + (NEW."statusEffectId" IS NOT NULL) + (NEW."effectId" IS NOT NULL) + (NEW."statisticId" IS NOT NULL)
    + (NEW."formationId" IS NOT NULL) + (NEW."roleId" IS NOT NULL) + (NEW."equipmentId" IS NOT NULL)
    + (NEW."equipmentSetId" IS NOT NULL) + (NEW."jewelryId" IS NOT NULL) + (NEW."jewelrySetId" IS NOT NULL)
    + (NEW."gemId" IS NOT NULL)) > 1
  OR NEW."reviewStatus" NOT IN ('CONFIRMED', 'PARTIALLY_CONFIRMED', 'NEEDS_REVIEW')
BEGIN SELECT RAISE(ABORT, 'CHECK SourceRecord: at most one target and a valid reviewStatus'); END;

-- NinjaNature: the referenced catalogue value must be a nature.
CREATE TRIGGER "trg_ninja_nature_type_ins" BEFORE INSERT ON "NinjaNature"
WHEN (SELECT t."key" FROM "ConditionValue" v JOIN "ConditionType" t ON t."id" = v."conditionTypeId" WHERE v."id" = NEW."natureId") IS NOT 'nature'
BEGIN SELECT RAISE(ABORT, 'CHECK NinjaNature: natureId must reference a ConditionValue of type nature'); END;

CREATE TRIGGER "trg_ninja_nature_type_upd" BEFORE UPDATE OF "natureId" ON "NinjaNature"
WHEN (SELECT t."key" FROM "ConditionValue" v JOIN "ConditionType" t ON t."id" = v."conditionTypeId" WHERE v."id" = NEW."natureId") IS NOT 'nature'
BEGIN SELECT RAISE(ABORT, 'CHECK NinjaNature: natureId must reference a ConditionValue of type nature'); END;

-- UserTalentSelection: a user can never hold more picks in a group than the group allows
-- (ONE for a ONE_OF group). Rows are immutable: change a pick by delete + insert.
CREATE TRIGGER "trg_talent_selection_limit_ins" BEFORE INSERT ON "UserTalentSelection"
WHEN (
  SELECT COUNT(*) FROM "UserTalentSelection" s JOIN "TalentOption" o ON o."id" = s."optionId"
  WHERE s."userId" = NEW."userId"
    AND o."groupId" = (SELECT "groupId" FROM "TalentOption" WHERE "id" = NEW."optionId")
) >= (
  SELECT CASE WHEN g."selectionMode" = 'ALL'
              THEN (SELECT COUNT(*) FROM "TalentOption" WHERE "groupId" = g."id")
              ELSE g."maxSelections" END
  FROM "TalentGroup" g
  WHERE g."id" = (SELECT "groupId" FROM "TalentOption" WHERE "id" = NEW."optionId")
)
BEGIN SELECT RAISE(ABORT, 'CHECK UserTalentSelection: selection limit of the talent group exceeded'); END;

CREATE TRIGGER "trg_talent_selection_immutable_upd" BEFORE UPDATE OF "userId", "optionId" ON "UserTalentSelection"
BEGIN SELECT RAISE(ABORT, 'CHECK UserTalentSelection: rows are immutable; delete and insert instead'); END;

-- Set tiers: a piece threshold is a positive count.
CREATE TRIGGER "trg_equipment_set_bonus_pieces_ins" BEFORE INSERT ON "EquipmentSetBonus"
WHEN NEW."requiredPieces" < 1
BEGIN SELECT RAISE(ABORT, 'CHECK EquipmentSetBonus.requiredPieces: must be >= 1'); END;

CREATE TRIGGER "trg_equipment_set_bonus_pieces_upd" BEFORE UPDATE OF "requiredPieces" ON "EquipmentSetBonus"
WHEN NEW."requiredPieces" < 1
BEGIN SELECT RAISE(ABORT, 'CHECK EquipmentSetBonus.requiredPieces: must be >= 1'); END;

CREATE TRIGGER "trg_jewelry_set_bonus_pieces_ins" BEFORE INSERT ON "JewelrySetBonus"
WHEN (NEW."requiredPieces" IS NOT NULL AND NEW."requiredPieces" < 1)
  OR NEW."requirementKind" NOT IN ('PIECE_COUNT', 'SPECIFIC_ITEMS')
  OR (NEW."requirementKind" = 'PIECE_COUNT' AND NEW."requiredPieces" IS NULL)
BEGIN SELECT RAISE(ABORT, 'CHECK JewelrySetBonus: PIECE_COUNT needs requiredPieces >= 1'); END;

CREATE TRIGGER "trg_jewelry_set_bonus_pieces_upd" BEFORE UPDATE OF "requiredPieces", "requirementKind" ON "JewelrySetBonus"
WHEN (NEW."requiredPieces" IS NOT NULL AND NEW."requiredPieces" < 1)
  OR NEW."requirementKind" NOT IN ('PIECE_COUNT', 'SPECIFIC_ITEMS')
  OR (NEW."requirementKind" = 'PIECE_COUNT' AND NEW."requiredPieces" IS NULL)
BEGIN SELECT RAISE(ABORT, 'CHECK JewelrySetBonus: PIECE_COUNT needs requiredPieces >= 1'); END;
