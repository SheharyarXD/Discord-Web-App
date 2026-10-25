-- PostgreSQL baseline: the full schema of schema.prisma as of Milestone 4, plus the integrity triggers.
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceAsset" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "capturedAt" TIMESTAMP(3),
    "capturedNote" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "fullyLegible" BOOLEAN,
    "duplicateOfId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceRecord" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Statistic" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Statistic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatisticAlias" (
    "id" TEXT NOT NULL,
    "statisticId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',

    CONSTRAINT "StatisticAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NinjaRole" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "mappedFormationId" TEXT,
    "mappingStatus" TEXT NOT NULL DEFAULT 'UNMAPPED',
    "mappingNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NinjaRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Formation" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "translationStatus" TEXT NOT NULL DEFAULT 'MISSING',
    "positionNote" TEXT,
    "primaryStatisticId" TEXT,
    "maxPerTeam" INTEGER,
    "equivalentToId" TEXT,
    "equivalenceStatus" TEXT NOT NULL DEFAULT 'NONE',
    "equivalenceNote" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Formation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NinjaRating" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NinjaRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NinjaType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "translationStatus" TEXT NOT NULL DEFAULT 'MISSING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NinjaType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbilityType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AbilityType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EffectTarget" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EffectTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConditionType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ConditionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConditionValue" (
    "id" TEXT NOT NULL,
    "conditionTypeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ConditionValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusEffect" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusEffect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusEffectAlias" (
    "id" TEXT NOT NULL,
    "statusEffectId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',

    CONSTRAINT "StatusEffectAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StatusCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusEffectCategory" (
    "statusEffectId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "StatusEffectCategory_pkey" PRIMARY KEY ("statusEffectId","categoryId")
);

-- CreateTable
CREATE TABLE "StatusEffectModifier" (
    "id" TEXT NOT NULL,
    "statusEffectId" TEXT NOT NULL,
    "statLabel" TEXT NOT NULL,
    "statisticId" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'INCREASE',
    "magnitude" DECIMAL(65,30),
    "valueType" TEXT NOT NULL DEFAULT 'PERCENT',
    "overridable" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StatusEffectModifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Effect" (
    "id" TEXT NOT NULL,
    "statisticId" TEXT,
    "value" DECIMAL(65,30),
    "valueType" TEXT NOT NULL DEFAULT 'FLAT',
    "statusEffectId" TEXT,
    "magnitudeOverride" DECIMAL(65,30),
    "targetId" TEXT,
    "targetText" TEXT,
    "durationTurns" INTEGER,
    "chancePercent" DECIMAL(65,30),
    "kind" TEXT NOT NULL DEFAULT 'STAT',
    "rateValue" DECIMAL(65,30),
    "rateKind" TEXT,
    "replacesValue" DECIMAL(65,30),
    "valueNote" TEXT,
    "targetCount" INTEGER,
    "targetSelector" TEXT,
    "excludesSelf" BOOLEAN NOT NULL DEFAULT false,
    "choiceGroup" INTEGER,
    "choiceLabel" TEXT,
    "sourceLine" INTEGER,
    "note" TEXT,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Effect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Condition" (
    "id" TEXT NOT NULL,
    "effectId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'ACTIVATION',
    "conditionTypeId" TEXT NOT NULL,
    "conditionValueId" TEXT,
    "ninjaId" TEXT,
    "formationId" TEXT,
    "roleId" TEXT,
    "operator" TEXT NOT NULL DEFAULT 'REQUIRES',
    "numericValue" DECIMAL(65,30),
    "note" TEXT,
    "sourceText" TEXT,
    "alternativeGroup" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Condition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ninja" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ninja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NinjaAlias" (
    "id" TEXT NOT NULL,
    "ninjaId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" TEXT NOT NULL DEFAULT 'REVIEWED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NinjaAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NinjaBaseStat" (
    "id" TEXT NOT NULL,
    "ninjaId" TEXT NOT NULL,
    "statisticId" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "baseValue" DECIMAL(65,30) NOT NULL,
    "growthRate" DECIMAL(65,30),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NinjaBaseStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NinjaNature" (
    "ninjaId" TEXT NOT NULL,
    "natureId" TEXT NOT NULL,

    CONSTRAINT "NinjaNature_pkey" PRIMARY KEY ("ninjaId","natureId")
);

-- CreateTable
CREATE TABLE "Ability" (
    "id" TEXT NOT NULL,
    "ninjaId" TEXT NOT NULL,
    "abilityTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "description" TEXT,
    "descriptionEs" TEXT,
    "translationStatus" TEXT NOT NULL DEFAULT 'MISSING',
    "triggerText" TEXT,
    "stage" INTEGER,
    "cardLabel" TEXT,
    "cardLabelCut" BOOLEAN NOT NULL DEFAULT false,
    "sourceHeading" TEXT,
    "parentAbilityId" TEXT,
    "talentOptionId" TEXT,
    "stackingRule" TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
    "supersedesId" TEXT,
    "ruleSourceText" TEXT,
    "conditionText" TEXT,
    "note" TEXT,
    "imageUrl" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentGroup" (
    "id" TEXT NOT NULL,
    "ninjaId" TEXT NOT NULL,
    "name" TEXT,
    "selectionMode" TEXT NOT NULL DEFAULT 'ONE_OF',
    "minSelections" INTEGER NOT NULL DEFAULT 1,
    "maxSelections" INTEGER NOT NULL DEFAULT 1,
    "reviewStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentOption" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "description" TEXT,
    "descriptionEs" TEXT,
    "translationStatus" TEXT NOT NULL DEFAULT 'MISSING',
    "imageUrl" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "cardLabel" TEXT,
    "cardLabelCut" BOOLEAN NOT NULL DEFAULT false,
    "sourceHeading" TEXT,
    "note" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TalentOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTalentSelection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTalentSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentSlot" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EquipmentSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentSet" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentSetBonus" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "requiredPieces" INTEGER NOT NULL,
    "description" TEXT,
    "descriptionEs" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EquipmentSetBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JewelryType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JewelryType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JewelrySet" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JewelrySet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JewelryGroup" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JewelryGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JewelrySetBonus" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "groupId" TEXT,
    "requirementKind" TEXT NOT NULL DEFAULT 'PIECE_COUNT',
    "requiredPieces" INTEGER,
    "description" TEXT,
    "descriptionEs" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JewelrySetBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JewelrySetBonusItem" (
    "bonusId" TEXT NOT NULL,
    "jewelryId" TEXT NOT NULL,

    CONSTRAINT "JewelrySetBonusItem_pkey" PRIMARY KEY ("bonusId","jewelryId")
);

-- CreateTable
CREATE TABLE "Jewelry" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Jewelry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GemType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GemType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gemTypeId" TEXT,
    "level" INTEGER,
    "description" TEXT,
    "imageUrl" TEXT,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

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
CREATE UNIQUE INDEX "Statistic_key_key" ON "Statistic"("key");

-- CreateIndex
CREATE INDEX "Statistic_category_idx" ON "Statistic"("category");

-- CreateIndex
CREATE INDEX "StatisticAlias_normalized_idx" ON "StatisticAlias"("normalized");

-- CreateIndex
CREATE UNIQUE INDEX "StatisticAlias_statisticId_normalized_key" ON "StatisticAlias"("statisticId", "normalized");

-- CreateIndex
CREATE UNIQUE INDEX "NinjaRole_key_key" ON "NinjaRole"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Formation_key_key" ON "Formation"("key");

-- CreateIndex
CREATE UNIQUE INDEX "NinjaRating_key_key" ON "NinjaRating"("key");

-- CreateIndex
CREATE UNIQUE INDEX "NinjaType_key_key" ON "NinjaType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AbilityType_key_key" ON "AbilityType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "EffectTarget_key_key" ON "EffectTarget"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ConditionType_key_key" ON "ConditionType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ConditionValue_conditionTypeId_key_key" ON "ConditionValue"("conditionTypeId", "key");

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
CREATE INDEX "Effect_abilityId_idx" ON "Effect"("abilityId");

-- CreateIndex
CREATE INDEX "Effect_talentOptionId_idx" ON "Effect"("talentOptionId");

-- CreateIndex
CREATE INDEX "Effect_equipmentId_idx" ON "Effect"("equipmentId");

-- CreateIndex
CREATE INDEX "Effect_equipmentSetBonusId_idx" ON "Effect"("equipmentSetBonusId");

-- CreateIndex
CREATE INDEX "Effect_jewelryId_idx" ON "Effect"("jewelryId");

-- CreateIndex
CREATE INDEX "Effect_jewelrySetBonusId_idx" ON "Effect"("jewelrySetBonusId");

-- CreateIndex
CREATE INDEX "Effect_gemId_idx" ON "Effect"("gemId");

-- CreateIndex
CREATE INDEX "Effect_statisticId_valueType_value_idx" ON "Effect"("statisticId", "valueType", "value");

-- CreateIndex
CREATE INDEX "Effect_statusEffectId_idx" ON "Effect"("statusEffectId");

-- CreateIndex
CREATE INDEX "Effect_kind_idx" ON "Effect"("kind");

-- CreateIndex
CREATE INDEX "Condition_effectId_idx" ON "Condition"("effectId");

-- CreateIndex
CREATE INDEX "Condition_conditionTypeId_conditionValueId_idx" ON "Condition"("conditionTypeId", "conditionValueId");

-- CreateIndex
CREATE INDEX "Condition_ninjaId_idx" ON "Condition"("ninjaId");

-- CreateIndex
CREATE INDEX "Condition_formationId_idx" ON "Condition"("formationId");

-- CreateIndex
CREATE INDEX "Condition_roleId_idx" ON "Condition"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Ninja_slug_key" ON "Ninja"("slug");

-- CreateIndex
CREATE INDEX "Ninja_roleId_idx" ON "Ninja"("roleId");

-- CreateIndex
CREATE INDEX "Ninja_status_idx" ON "Ninja"("status");

-- CreateIndex
CREATE INDEX "Ninja_formationId_idx" ON "Ninja"("formationId");

-- CreateIndex
CREATE INDEX "Ninja_ratingId_idx" ON "Ninja"("ratingId");

-- CreateIndex
CREATE INDEX "Ninja_ninjaTypeId_idx" ON "Ninja"("ninjaTypeId");

-- CreateIndex
CREATE INDEX "Ninja_clientCombatClass_idx" ON "Ninja"("clientCombatClass");

-- CreateIndex
CREATE INDEX "Ninja_releaseYear_releaseMonth_releaseOrder_idx" ON "Ninja"("releaseYear", "releaseMonth", "releaseOrder");

-- CreateIndex
CREATE INDEX "Ninja_name_idx" ON "Ninja"("name");

-- CreateIndex
CREATE INDEX "NinjaAlias_normalized_idx" ON "NinjaAlias"("normalized");

-- CreateIndex
CREATE UNIQUE INDEX "NinjaAlias_ninjaId_normalized_kind_key" ON "NinjaAlias"("ninjaId", "normalized", "kind");

-- CreateIndex
CREATE INDEX "NinjaBaseStat_statisticId_baseValue_idx" ON "NinjaBaseStat"("statisticId", "baseValue");

-- CreateIndex
CREATE INDEX "NinjaBaseStat_statisticId_growthRate_idx" ON "NinjaBaseStat"("statisticId", "growthRate");

-- CreateIndex
CREATE UNIQUE INDEX "NinjaBaseStat_ninjaId_statisticId_key" ON "NinjaBaseStat"("ninjaId", "statisticId");

-- CreateIndex
CREATE INDEX "NinjaNature_natureId_idx" ON "NinjaNature"("natureId");

-- CreateIndex
CREATE INDEX "Ability_ninjaId_idx" ON "Ability"("ninjaId");

-- CreateIndex
CREATE INDEX "Ability_abilityTypeId_idx" ON "Ability"("abilityTypeId");

-- CreateIndex
CREATE INDEX "Ability_parentAbilityId_idx" ON "Ability"("parentAbilityId");

-- CreateIndex
CREATE INDEX "Ability_talentOptionId_idx" ON "Ability"("talentOptionId");

-- CreateIndex
CREATE INDEX "TalentGroup_ninjaId_idx" ON "TalentGroup"("ninjaId");

-- CreateIndex
CREATE INDEX "TalentOption_groupId_idx" ON "TalentOption"("groupId");

-- CreateIndex
CREATE INDEX "UserTalentSelection_optionId_idx" ON "UserTalentSelection"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTalentSelection_userId_optionId_key" ON "UserTalentSelection"("userId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentSlot_key_key" ON "EquipmentSlot"("key");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentSet_slug_key" ON "EquipmentSet"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentSetBonus_setId_requiredPieces_key" ON "EquipmentSetBonus"("setId", "requiredPieces");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_slug_key" ON "Equipment"("slug");

-- CreateIndex
CREATE INDEX "Equipment_slotId_idx" ON "Equipment"("slotId");

-- CreateIndex
CREATE INDEX "Equipment_setId_idx" ON "Equipment"("setId");

-- CreateIndex
CREATE INDEX "Equipment_status_idx" ON "Equipment"("status");

-- CreateIndex
CREATE INDEX "Equipment_name_idx" ON "Equipment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "JewelryType_key_key" ON "JewelryType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "JewelrySet_slug_key" ON "JewelrySet"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "JewelryGroup_setId_key_key" ON "JewelryGroup"("setId", "key");

-- CreateIndex
CREATE INDEX "JewelrySetBonus_setId_idx" ON "JewelrySetBonus"("setId");

-- CreateIndex
CREATE INDEX "JewelrySetBonus_groupId_idx" ON "JewelrySetBonus"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Jewelry_slug_key" ON "Jewelry"("slug");

-- CreateIndex
CREATE INDEX "Jewelry_typeId_idx" ON "Jewelry"("typeId");

-- CreateIndex
CREATE INDEX "Jewelry_setId_idx" ON "Jewelry"("setId");

-- CreateIndex
CREATE INDEX "Jewelry_groupId_idx" ON "Jewelry"("groupId");

-- CreateIndex
CREATE INDEX "Jewelry_status_idx" ON "Jewelry"("status");

-- CreateIndex
CREATE INDEX "Jewelry_name_idx" ON "Jewelry"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GemType_key_key" ON "GemType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Gem_slug_key" ON "Gem"("slug");

-- CreateIndex
CREATE INDEX "Gem_gemTypeId_idx" ON "Gem"("gemTypeId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceAsset" ADD CONSTRAINT "SourceAsset_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "SourceAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "SourceAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "SourceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_ninjaId_fkey" FOREIGN KEY ("ninjaId") REFERENCES "Ninja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "Ability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_talentOptionId_fkey" FOREIGN KEY ("talentOptionId") REFERENCES "TalentOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_statusEffectId_fkey" FOREIGN KEY ("statusEffectId") REFERENCES "StatusEffect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_effectId_fkey" FOREIGN KEY ("effectId") REFERENCES "Effect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_statisticId_fkey" FOREIGN KEY ("statisticId") REFERENCES "Statistic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "NinjaRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_equipmentSetId_fkey" FOREIGN KEY ("equipmentSetId") REFERENCES "EquipmentSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_jewelryId_fkey" FOREIGN KEY ("jewelryId") REFERENCES "Jewelry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_jewelrySetId_fkey" FOREIGN KEY ("jewelrySetId") REFERENCES "JewelrySet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_gemId_fkey" FOREIGN KEY ("gemId") REFERENCES "Gem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatisticAlias" ADD CONSTRAINT "StatisticAlias_statisticId_fkey" FOREIGN KEY ("statisticId") REFERENCES "Statistic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NinjaRole" ADD CONSTRAINT "NinjaRole_mappedFormationId_fkey" FOREIGN KEY ("mappedFormationId") REFERENCES "Formation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Formation" ADD CONSTRAINT "Formation_primaryStatisticId_fkey" FOREIGN KEY ("primaryStatisticId") REFERENCES "Statistic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Formation" ADD CONSTRAINT "Formation_equivalentToId_fkey" FOREIGN KEY ("equivalentToId") REFERENCES "Formation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConditionValue" ADD CONSTRAINT "ConditionValue_conditionTypeId_fkey" FOREIGN KEY ("conditionTypeId") REFERENCES "ConditionType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEffectAlias" ADD CONSTRAINT "StatusEffectAlias_statusEffectId_fkey" FOREIGN KEY ("statusEffectId") REFERENCES "StatusEffect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEffectCategory" ADD CONSTRAINT "StatusEffectCategory_statusEffectId_fkey" FOREIGN KEY ("statusEffectId") REFERENCES "StatusEffect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEffectCategory" ADD CONSTRAINT "StatusEffectCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StatusCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEffectModifier" ADD CONSTRAINT "StatusEffectModifier_statusEffectId_fkey" FOREIGN KEY ("statusEffectId") REFERENCES "StatusEffect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEffectModifier" ADD CONSTRAINT "StatusEffectModifier_statisticId_fkey" FOREIGN KEY ("statisticId") REFERENCES "Statistic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Effect" ADD CONSTRAINT "Effect_statisticId_fkey" FOREIGN KEY ("statisticId") REFERENCES "Statistic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Effect" ADD CONSTRAINT "Effect_statusEffectId_fkey" FOREIGN KEY ("statusEffectId") REFERENCES "StatusEffect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Effect" ADD CONSTRAINT "Effect_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "EffectTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Effect" ADD CONSTRAINT "Effect_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "Ability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Effect" ADD CONSTRAINT "Effect_talentOptionId_fkey" FOREIGN KEY ("talentOptionId") REFERENCES "TalentOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Effect" ADD CONSTRAINT "Effect_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Effect" ADD CONSTRAINT "Effect_equipmentSetBonusId_fkey" FOREIGN KEY ("equipmentSetBonusId") REFERENCES "EquipmentSetBonus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Effect" ADD CONSTRAINT "Effect_jewelryId_fkey" FOREIGN KEY ("jewelryId") REFERENCES "Jewelry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Effect" ADD CONSTRAINT "Effect_jewelrySetBonusId_fkey" FOREIGN KEY ("jewelrySetBonusId") REFERENCES "JewelrySetBonus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Effect" ADD CONSTRAINT "Effect_gemId_fkey" FOREIGN KEY ("gemId") REFERENCES "Gem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_effectId_fkey" FOREIGN KEY ("effectId") REFERENCES "Effect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_conditionTypeId_fkey" FOREIGN KEY ("conditionTypeId") REFERENCES "ConditionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_conditionValueId_fkey" FOREIGN KEY ("conditionValueId") REFERENCES "ConditionValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_ninjaId_fkey" FOREIGN KEY ("ninjaId") REFERENCES "Ninja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "NinjaRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ninja" ADD CONSTRAINT "Ninja_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "NinjaRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ninja" ADD CONSTRAINT "Ninja_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ninja" ADD CONSTRAINT "Ninja_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "NinjaRating"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ninja" ADD CONSTRAINT "Ninja_ninjaTypeId_fkey" FOREIGN KEY ("ninjaTypeId") REFERENCES "NinjaType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NinjaAlias" ADD CONSTRAINT "NinjaAlias_ninjaId_fkey" FOREIGN KEY ("ninjaId") REFERENCES "Ninja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NinjaBaseStat" ADD CONSTRAINT "NinjaBaseStat_ninjaId_fkey" FOREIGN KEY ("ninjaId") REFERENCES "Ninja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NinjaBaseStat" ADD CONSTRAINT "NinjaBaseStat_statisticId_fkey" FOREIGN KEY ("statisticId") REFERENCES "Statistic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NinjaNature" ADD CONSTRAINT "NinjaNature_ninjaId_fkey" FOREIGN KEY ("ninjaId") REFERENCES "Ninja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NinjaNature" ADD CONSTRAINT "NinjaNature_natureId_fkey" FOREIGN KEY ("natureId") REFERENCES "ConditionValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ability" ADD CONSTRAINT "Ability_ninjaId_fkey" FOREIGN KEY ("ninjaId") REFERENCES "Ninja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ability" ADD CONSTRAINT "Ability_abilityTypeId_fkey" FOREIGN KEY ("abilityTypeId") REFERENCES "AbilityType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ability" ADD CONSTRAINT "Ability_parentAbilityId_fkey" FOREIGN KEY ("parentAbilityId") REFERENCES "Ability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ability" ADD CONSTRAINT "Ability_talentOptionId_fkey" FOREIGN KEY ("talentOptionId") REFERENCES "TalentOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ability" ADD CONSTRAINT "Ability_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "Ability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentGroup" ADD CONSTRAINT "TalentGroup_ninjaId_fkey" FOREIGN KEY ("ninjaId") REFERENCES "Ninja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentOption" ADD CONSTRAINT "TalentOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TalentGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTalentSelection" ADD CONSTRAINT "UserTalentSelection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTalentSelection" ADD CONSTRAINT "UserTalentSelection_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "TalentOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentSetBonus" ADD CONSTRAINT "EquipmentSetBonus_setId_fkey" FOREIGN KEY ("setId") REFERENCES "EquipmentSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "EquipmentSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_setId_fkey" FOREIGN KEY ("setId") REFERENCES "EquipmentSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JewelryGroup" ADD CONSTRAINT "JewelryGroup_setId_fkey" FOREIGN KEY ("setId") REFERENCES "JewelrySet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JewelrySetBonus" ADD CONSTRAINT "JewelrySetBonus_setId_fkey" FOREIGN KEY ("setId") REFERENCES "JewelrySet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JewelrySetBonus" ADD CONSTRAINT "JewelrySetBonus_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "JewelryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JewelrySetBonusItem" ADD CONSTRAINT "JewelrySetBonusItem_bonusId_fkey" FOREIGN KEY ("bonusId") REFERENCES "JewelrySetBonus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JewelrySetBonusItem" ADD CONSTRAINT "JewelrySetBonusItem_jewelryId_fkey" FOREIGN KEY ("jewelryId") REFERENCES "Jewelry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jewelry" ADD CONSTRAINT "Jewelry_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "JewelryType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jewelry" ADD CONSTRAINT "Jewelry_setId_fkey" FOREIGN KEY ("setId") REFERENCES "JewelrySet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jewelry" ADD CONSTRAINT "Jewelry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "JewelryGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gem" ADD CONSTRAINT "Gem_gemTypeId_fkey" FOREIGN KEY ("gemTypeId") REFERENCES "GemType"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Integrity rules for PostgreSQL (generated by scratch generator from prisma/constraints.sql, the SQLite reference).
-- Each rule is a BEFORE INSERT OR UPDATE trigger that raises check_violation (23514) with the same message as the SQLite trigger.

CREATE FUNCTION "fn_ninja_release"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."releaseMonth" IS NOT NULL AND (NEW."releaseMonth" < 1 OR NEW."releaseMonth" > 12 OR NEW."releaseYear" IS NULL) THEN
    RAISE EXCEPTION 'CHECK Ninja.releaseMonth: must be 1-12 and requires releaseYear' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "trg_ninja_release" BEFORE INSERT OR UPDATE OF "releaseMonth", "releaseYear" ON "Ninja" FOR EACH ROW EXECUTE FUNCTION "fn_ninja_release"();

CREATE FUNCTION "fn_ninja_combat_class"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."clientCombatClass" IS NOT NULL AND NEW."clientCombatClass" NOT IN ('TANK', 'DPS') THEN
    RAISE EXCEPTION 'CHECK Ninja.clientCombatClass: must be TANK, DPS or NULL' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "trg_ninja_combat_class" BEFORE INSERT OR UPDATE OF "clientCombatClass" ON "Ninja" FOR EACH ROW EXECUTE FUNCTION "fn_ninja_combat_class"();

CREATE FUNCTION "fn_effect_single_owner"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ((NEW."abilityId" IS NOT NULL)::int + (NEW."talentOptionId" IS NOT NULL)::int + (NEW."equipmentId" IS NOT NULL)::int + (NEW."equipmentSetBonusId" IS NOT NULL)::int + (NEW."jewelryId" IS NOT NULL)::int + (NEW."jewelrySetBonusId" IS NOT NULL)::int + (NEW."gemId" IS NOT NULL)::int) <> 1 THEN
    RAISE EXCEPTION 'CHECK Effect: exactly one owner column must be set' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "trg_effect_single_owner" BEFORE INSERT OR UPDATE OF "abilityId", "talentOptionId", "equipmentId", "equipmentSetBonusId", "jewelryId", "jewelrySetBonusId", "gemId" ON "Effect" FOR EACH ROW EXECUTE FUNCTION "fn_effect_single_owner"();

CREATE FUNCTION "fn_effect_values"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."chancePercent" IS NOT NULL AND (NEW."chancePercent" < 0 OR NEW."chancePercent" > 100)) OR (NEW."magnitudeOverride" IS NOT NULL AND NEW."statusEffectId" IS NULL) OR (NEW."durationTurns" IS NOT NULL AND NEW."durationTurns" < 0) THEN
    RAISE EXCEPTION 'CHECK Effect: chancePercent 0-100, durationTurns >= 0, magnitudeOverride requires statusEffectId' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "trg_effect_values" BEFORE INSERT OR UPDATE OF "chancePercent", "magnitudeOverride", "statusEffectId", "durationTurns" ON "Effect" FOR EACH ROW EXECUTE FUNCTION "fn_effect_values"();

CREATE FUNCTION "fn_condition_enums"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."scope" NOT IN ('ACTIVATION', 'TARGET') OR NEW."operator" NOT IN ('REQUIRES', 'EXCLUDES') THEN
    RAISE EXCEPTION 'CHECK Condition: invalid scope or operator' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "trg_condition_enums" BEFORE INSERT OR UPDATE OF "scope", "operator" ON "Condition" FOR EACH ROW EXECUTE FUNCTION "fn_condition_enums"();

CREATE FUNCTION "fn_status_effect_enums"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."polarity" NOT IN ('BUFF', 'DEBUFF', 'NEUTRAL', 'UNKNOWN') OR NEW."cleansability" NOT IN ('CLEANSABLE', 'UNCLEANSABLE', 'CONDITIONAL', 'UNKNOWN') OR NEW."kind" NOT IN ('STATUS', 'TERM') THEN
    RAISE EXCEPTION 'CHECK StatusEffect: invalid kind, polarity or cleansability' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "trg_status_effect_enums" BEFORE INSERT OR UPDATE OF "kind", "polarity", "cleansability" ON "StatusEffect" FOR EACH ROW EXECUTE FUNCTION "fn_status_effect_enums"();

CREATE FUNCTION "fn_source_record_target"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ((NEW."ninjaId" IS NOT NULL)::int + (NEW."abilityId" IS NOT NULL)::int + (NEW."talentOptionId" IS NOT NULL)::int + (NEW."statusEffectId" IS NOT NULL)::int + (NEW."effectId" IS NOT NULL)::int + (NEW."statisticId" IS NOT NULL)::int + (NEW."formationId" IS NOT NULL)::int + (NEW."roleId" IS NOT NULL)::int + (NEW."equipmentId" IS NOT NULL)::int + (NEW."equipmentSetId" IS NOT NULL)::int + (NEW."jewelryId" IS NOT NULL)::int + (NEW."jewelrySetId" IS NOT NULL)::int + (NEW."gemId" IS NOT NULL)::int) > 1 OR NEW."reviewStatus" NOT IN ('CONFIRMED', 'PARTIALLY_CONFIRMED', 'NEEDS_REVIEW') THEN
    RAISE EXCEPTION 'CHECK SourceRecord: at most one target and a valid reviewStatus' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "trg_source_record_target" BEFORE INSERT OR UPDATE ON "SourceRecord" FOR EACH ROW EXECUTE FUNCTION "fn_source_record_target"();

CREATE FUNCTION "fn_ninja_nature_type"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT t."key" FROM "ConditionValue" v JOIN "ConditionType" t ON t."id" = v."conditionTypeId" WHERE v."id" = NEW."natureId") IS DISTINCT FROM 'nature' THEN
    RAISE EXCEPTION 'CHECK NinjaNature: natureId must reference a ConditionValue of type nature' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "trg_ninja_nature_type" BEFORE INSERT OR UPDATE OF "natureId" ON "NinjaNature" FOR EACH ROW EXECUTE FUNCTION "fn_ninja_nature_type"();

CREATE FUNCTION "fn_equipment_set_bonus_pieces"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."requiredPieces" < 1 THEN
    RAISE EXCEPTION 'CHECK EquipmentSetBonus.requiredPieces: must be >= 1' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "trg_equipment_set_bonus_pieces" BEFORE INSERT OR UPDATE OF "requiredPieces" ON "EquipmentSetBonus" FOR EACH ROW EXECUTE FUNCTION "fn_equipment_set_bonus_pieces"();

CREATE FUNCTION "fn_jewelry_set_bonus_pieces"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."requiredPieces" IS NOT NULL AND NEW."requiredPieces" < 1) OR NEW."requirementKind" NOT IN ('PIECE_COUNT', 'SPECIFIC_ITEMS') OR (NEW."requirementKind" = 'PIECE_COUNT' AND NEW."requiredPieces" IS NULL) THEN
    RAISE EXCEPTION 'CHECK JewelrySetBonus: PIECE_COUNT needs requiredPieces >= 1' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "trg_jewelry_set_bonus_pieces" BEFORE INSERT OR UPDATE OF "requiredPieces", "requirementKind" ON "JewelrySetBonus" FOR EACH ROW EXECUTE FUNCTION "fn_jewelry_set_bonus_pieces"();

CREATE FUNCTION "fn_ability_rules"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."stackingRule" NOT IN ('NOT_APPLICABLE', 'UNKNOWN', 'CUMULATIVE', 'REPLACES_PRIOR', 'CANCELS_PRIOR', 'UPGRADES_BASE') OR (NEW."parentAbilityId" IS NOT NULL AND NEW."talentOptionId" IS NOT NULL) OR (NEW."supersedesId" IS NOT NULL AND NEW."supersedesId" = NEW."id") OR (NEW."parentAbilityId" IS NOT NULL AND NEW."parentAbilityId" = NEW."id") THEN
    RAISE EXCEPTION 'CHECK Ability: invalid stackingRule, two parents, or self reference' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "trg_ability_rules" BEFORE INSERT OR UPDATE OF "stackingRule", "parentAbilityId", "talentOptionId", "supersedesId" ON "Ability" FOR EACH ROW EXECUTE FUNCTION "fn_ability_rules"();

CREATE FUNCTION "fn_effect_shape"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."kind" NOT IN ('ATTACK', 'STAT', 'STATUS', 'IMMUNITY', 'FURY', 'HEAL', 'DISPEL', 'TEXT') OR NEW."structuredStatus" NOT IN ('STRUCTURED', 'NEEDS_REVIEW', 'TEXT_ONLY') OR (NEW."rateKind" IS NOT NULL AND NEW."rateKind" NOT IN ('GROWTH', 'INTENSITY', 'APPLICATION')) OR (NEW."rateValue" IS NOT NULL AND NEW."rateKind" IS NULL) OR (NEW."targetCount" IS NOT NULL AND NEW."targetCount" < 1) OR (NEW."choiceLabel" IS NOT NULL AND NEW."choiceGroup" IS NULL) THEN
    RAISE EXCEPTION 'CHECK Effect: invalid kind/structuredStatus, rate without rateKind, targetCount < 1, or choiceLabel without choiceGroup' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "trg_effect_shape" BEFORE INSERT OR UPDATE OF "kind", "structuredStatus", "rateKind", "rateValue", "targetCount", "choiceGroup", "choiceLabel" ON "Effect" FOR EACH ROW EXECUTE FUNCTION "fn_effect_shape"();

CREATE FUNCTION "fn_formation_equivalence"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."equivalenceStatus" NOT IN ('NONE', 'PROPOSED', 'APPROVED') OR (NEW."equivalentToId" IS NOT NULL AND NEW."equivalentToId" = NEW."id") OR (NEW."equivalenceStatus" <> 'NONE' AND NEW."equivalentToId" IS NULL) THEN
    RAISE EXCEPTION 'CHECK Formation: invalid equivalence' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "trg_formation_equivalence" BEFORE INSERT OR UPDATE OF "equivalenceStatus", "equivalentToId" ON "Formation" FOR EACH ROW EXECUTE FUNCTION "fn_formation_equivalence"();

CREATE FUNCTION "fn_ninja_alias_enums"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" NOT IN ('VERIFIED', 'REVIEWED') OR NEW."kind" NOT IN ('CARD_NAME', 'SOURCE_NAME') THEN
    RAISE EXCEPTION 'CHECK NinjaAlias: invalid status or kind' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "trg_ninja_alias_enums" BEFORE INSERT OR UPDATE OF "status", "kind" ON "NinjaAlias" FOR EACH ROW EXECUTE FUNCTION "fn_ninja_alias_enums"();

CREATE FUNCTION "fn_talent_selection_limit"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  gid text;
  used integer;
  allowed integer;
BEGIN
  SELECT "groupId" INTO gid FROM "TalentOption" WHERE "id" = NEW."optionId";
  SELECT COUNT(*) INTO used FROM "UserTalentSelection" s JOIN "TalentOption" o ON o."id" = s."optionId" WHERE s."userId" = NEW."userId" AND o."groupId" = gid;
  SELECT CASE WHEN g."selectionMode" = 'ALL' THEN (SELECT COUNT(*) FROM "TalentOption" WHERE "groupId" = g."id") ELSE g."maxSelections" END INTO allowed FROM "TalentGroup" g WHERE g."id" = gid;
  IF used >= allowed THEN
    RAISE EXCEPTION 'CHECK UserTalentSelection: selection limit of the talent group exceeded' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "trg_talent_selection_limit_ins" BEFORE INSERT ON "UserTalentSelection" FOR EACH ROW EXECUTE FUNCTION "fn_talent_selection_limit"();

CREATE FUNCTION "fn_talent_selection_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'CHECK UserTalentSelection: rows are immutable; delete and insert instead' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER "trg_talent_selection_immutable_upd" BEFORE UPDATE OF "userId", "optionId" ON "UserTalentSelection" FOR EACH ROW EXECUTE FUNCTION "fn_talent_selection_immutable"();
