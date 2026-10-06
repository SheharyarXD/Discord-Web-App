-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Statistic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultValueType" TEXT NOT NULL DEFAULT 'FLAT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NinjaRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AbilityType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "EffectTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "ConditionType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "ConditionValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conditionTypeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ConditionValue_conditionTypeId_fkey" FOREIGN KEY ("conditionTypeId") REFERENCES "ConditionType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Effect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statisticId" TEXT,
    "value" REAL,
    "valueType" TEXT NOT NULL DEFAULT 'FLAT',
    "targetId" TEXT,
    "durationTurns" INTEGER,
    "chancePercent" REAL,
    "description" TEXT,
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
    CONSTRAINT "Effect_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "EffectTarget" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Effect_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "Ability" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Effect_talentOptionId_fkey" FOREIGN KEY ("talentOptionId") REFERENCES "TalentOption" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Effect_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Effect_equipmentSetBonusId_fkey" FOREIGN KEY ("equipmentSetBonusId") REFERENCES "EquipmentSetBonus" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Effect_jewelryId_fkey" FOREIGN KEY ("jewelryId") REFERENCES "Jewelry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Effect_jewelrySetBonusId_fkey" FOREIGN KEY ("jewelrySetBonusId") REFERENCES "JewelrySetBonus" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Effect_gemId_fkey" FOREIGN KEY ("gemId") REFERENCES "Gem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Condition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "effectId" TEXT NOT NULL,
    "conditionTypeId" TEXT NOT NULL,
    "conditionValueId" TEXT,
    "operator" TEXT NOT NULL DEFAULT 'REQUIRES',
    "numericValue" REAL,
    "note" TEXT,
    "alternativeGroup" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Condition_effectId_fkey" FOREIGN KEY ("effectId") REFERENCES "Effect" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Condition_conditionTypeId_fkey" FOREIGN KEY ("conditionTypeId") REFERENCES "ConditionType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Condition_conditionValueId_fkey" FOREIGN KEY ("conditionValueId") REFERENCES "ConditionValue" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ninja" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "roleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ninja_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "NinjaRole" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ninjaId" TEXT NOT NULL,
    "abilityTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ability_ninjaId_fkey" FOREIGN KEY ("ninjaId") REFERENCES "Ninja" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ability_abilityTypeId_fkey" FOREIGN KEY ("abilityTypeId") REFERENCES "AbilityType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TalentGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ninjaId" TEXT NOT NULL,
    "name" TEXT,
    "selectionMode" TEXT NOT NULL DEFAULT 'ONE_OF',
    "minSelections" INTEGER NOT NULL DEFAULT 1,
    "maxSelections" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TalentGroup_ninjaId_fkey" FOREIGN KEY ("ninjaId") REFERENCES "Ninja" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TalentOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TalentOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TalentGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "EquipmentSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EquipmentSetBonus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setId" TEXT NOT NULL,
    "requiredPieces" INTEGER NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "EquipmentSetBonus_setId_fkey" FOREIGN KEY ("setId") REFERENCES "EquipmentSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slotId" TEXT,
    "setId" TEXT,
    "imageUrl" TEXT,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Equipment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "EquipmentSlot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Equipment_setId_fkey" FOREIGN KEY ("setId") REFERENCES "EquipmentSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JewelryType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "JewelrySet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "JewelrySetBonus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setId" TEXT NOT NULL,
    "requirementKind" TEXT NOT NULL DEFAULT 'PIECE_COUNT',
    "requiredPieces" INTEGER,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "JewelrySetBonus_setId_fkey" FOREIGN KEY ("setId") REFERENCES "JewelrySet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JewelrySetBonusItem" (
    "bonusId" TEXT NOT NULL,
    "jewelryId" TEXT NOT NULL,

    PRIMARY KEY ("bonusId", "jewelryId"),
    CONSTRAINT "JewelrySetBonusItem_bonusId_fkey" FOREIGN KEY ("bonusId") REFERENCES "JewelrySetBonus" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JewelrySetBonusItem_jewelryId_fkey" FOREIGN KEY ("jewelryId") REFERENCES "Jewelry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Jewelry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "typeId" TEXT,
    "setId" TEXT,
    "imageUrl" TEXT,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Jewelry_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "JewelryType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Jewelry_setId_fkey" FOREIGN KEY ("setId") REFERENCES "JewelrySet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GemType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Gem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gemTypeId" TEXT,
    "level" INTEGER,
    "description" TEXT,
    "imageUrl" TEXT,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Gem_gemTypeId_fkey" FOREIGN KEY ("gemTypeId") REFERENCES "GemType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
CREATE UNIQUE INDEX "Statistic_key_key" ON "Statistic"("key");

-- CreateIndex
CREATE UNIQUE INDEX "NinjaRole_key_key" ON "NinjaRole"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AbilityType_key_key" ON "AbilityType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "EffectTarget_key_key" ON "EffectTarget"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ConditionType_key_key" ON "ConditionType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ConditionValue_conditionTypeId_key_key" ON "ConditionValue"("conditionTypeId", "key");

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
CREATE INDEX "Effect_statisticId_idx" ON "Effect"("statisticId");

-- CreateIndex
CREATE INDEX "Condition_effectId_idx" ON "Condition"("effectId");

-- CreateIndex
CREATE UNIQUE INDEX "Ninja_slug_key" ON "Ninja"("slug");

-- CreateIndex
CREATE INDEX "Ninja_roleId_idx" ON "Ninja"("roleId");

-- CreateIndex
CREATE INDEX "Ninja_status_idx" ON "Ninja"("status");

-- CreateIndex
CREATE INDEX "Ability_ninjaId_idx" ON "Ability"("ninjaId");

-- CreateIndex
CREATE INDEX "Ability_abilityTypeId_idx" ON "Ability"("abilityTypeId");

-- CreateIndex
CREATE INDEX "TalentGroup_ninjaId_idx" ON "TalentGroup"("ninjaId");

-- CreateIndex
CREATE INDEX "TalentOption_groupId_idx" ON "TalentOption"("groupId");

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
CREATE UNIQUE INDEX "JewelryType_key_key" ON "JewelryType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "JewelrySet_slug_key" ON "JewelrySet"("slug");

-- CreateIndex
CREATE INDEX "JewelrySetBonus_setId_idx" ON "JewelrySetBonus"("setId");

-- CreateIndex
CREATE UNIQUE INDEX "Jewelry_slug_key" ON "Jewelry"("slug");

-- CreateIndex
CREATE INDEX "Jewelry_typeId_idx" ON "Jewelry"("typeId");

-- CreateIndex
CREATE INDEX "Jewelry_setId_idx" ON "Jewelry"("setId");

-- CreateIndex
CREATE UNIQUE INDEX "GemType_key_key" ON "GemType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Gem_slug_key" ON "Gem"("slug");

-- CreateIndex
CREATE INDEX "Gem_gemTypeId_idx" ON "Gem"("gemTypeId");
