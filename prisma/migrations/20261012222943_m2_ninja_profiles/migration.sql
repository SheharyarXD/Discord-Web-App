-- Tables carrying triggers are rebuilt below (SQLite create-copy-drop-rename), which would drop
-- their triggers and can fail on triggers that reference a table being replaced. Every trigger is
-- therefore dropped first and the full set from prisma/constraints.sql is re-created at the end.
DROP TRIGGER IF EXISTS "trg_ninja_release_ins";
DROP TRIGGER IF EXISTS "trg_ninja_release_upd";
DROP TRIGGER IF EXISTS "trg_ninja_combat_class_ins";
DROP TRIGGER IF EXISTS "trg_ninja_combat_class_upd";
DROP TRIGGER IF EXISTS "trg_effect_single_owner_ins";
DROP TRIGGER IF EXISTS "trg_effect_single_owner_upd";
DROP TRIGGER IF EXISTS "trg_effect_values_ins";
DROP TRIGGER IF EXISTS "trg_effect_values_upd";
DROP TRIGGER IF EXISTS "trg_condition_enums_ins";
DROP TRIGGER IF EXISTS "trg_condition_enums_upd";
DROP TRIGGER IF EXISTS "trg_status_effect_enums_ins";
DROP TRIGGER IF EXISTS "trg_status_effect_enums_upd";
DROP TRIGGER IF EXISTS "trg_source_record_target_ins";
DROP TRIGGER IF EXISTS "trg_source_record_target_upd";
DROP TRIGGER IF EXISTS "trg_ninja_nature_type_ins";
DROP TRIGGER IF EXISTS "trg_ninja_nature_type_upd";
DROP TRIGGER IF EXISTS "trg_talent_selection_limit_ins";
DROP TRIGGER IF EXISTS "trg_talent_selection_immutable_upd";
DROP TRIGGER IF EXISTS "trg_equipment_set_bonus_pieces_ins";
DROP TRIGGER IF EXISTS "trg_equipment_set_bonus_pieces_upd";
DROP TRIGGER IF EXISTS "trg_jewelry_set_bonus_pieces_ins";
DROP TRIGGER IF EXISTS "trg_jewelry_set_bonus_pieces_upd";
DROP TRIGGER IF EXISTS "trg_ability_rules_ins";
DROP TRIGGER IF EXISTS "trg_ability_rules_upd";
DROP TRIGGER IF EXISTS "trg_effect_shape_ins";
DROP TRIGGER IF EXISTS "trg_effect_shape_upd";
DROP TRIGGER IF EXISTS "trg_formation_equivalence_ins";
DROP TRIGGER IF EXISTS "trg_formation_equivalence_upd";
DROP TRIGGER IF EXISTS "trg_ninja_alias_enums_ins";
DROP TRIGGER IF EXISTS "trg_ninja_alias_enums_upd";

-- CreateTable
CREATE TABLE "NinjaAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ninjaId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" TEXT NOT NULL DEFAULT 'REVIEWED',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NinjaAlias_ninjaId_fkey" FOREIGN KEY ("ninjaId") REFERENCES "Ninja" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ability_ninjaId_fkey" FOREIGN KEY ("ninjaId") REFERENCES "Ninja" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ability_abilityTypeId_fkey" FOREIGN KEY ("abilityTypeId") REFERENCES "AbilityType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ability_parentAbilityId_fkey" FOREIGN KEY ("parentAbilityId") REFERENCES "Ability" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ability_talentOptionId_fkey" FOREIGN KEY ("talentOptionId") REFERENCES "TalentOption" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ability_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "Ability" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Ability" ("abilityTypeId", "createdAt", "description", "descriptionEs", "id", "imageUrl", "name", "nameEs", "ninjaId", "reviewStatus", "sortOrder", "stage", "translationStatus", "triggerText", "updatedAt") SELECT "abilityTypeId", "createdAt", "description", "descriptionEs", "id", "imageUrl", "name", "nameEs", "ninjaId", "reviewStatus", "sortOrder", "stage", "translationStatus", "triggerText", "updatedAt" FROM "Ability";
DROP TABLE "Ability";
ALTER TABLE "new_Ability" RENAME TO "Ability";
CREATE INDEX "Ability_ninjaId_idx" ON "Ability"("ninjaId");
CREATE INDEX "Ability_abilityTypeId_idx" ON "Ability"("abilityTypeId");
CREATE INDEX "Ability_parentAbilityId_idx" ON "Ability"("parentAbilityId");
CREATE INDEX "Ability_talentOptionId_idx" ON "Ability"("talentOptionId");
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
    "kind" TEXT NOT NULL DEFAULT 'STAT',
    "rateValue" DECIMAL,
    "rateKind" TEXT,
    "replacesValue" DECIMAL,
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
INSERT INTO "new_Effect" ("abilityId", "chancePercent", "conditionText", "createdAt", "description", "descriptionEs", "durationTurns", "equipmentId", "equipmentSetBonusId", "gemId", "id", "jewelryId", "jewelrySetBonusId", "magnitudeOverride", "sortOrder", "sourceText", "statisticId", "statusEffectId", "structuredStatus", "talentOptionId", "targetId", "targetText", "translationStatus", "triggerText", "updatedAt", "value", "valueType") SELECT "abilityId", "chancePercent", "conditionText", "createdAt", "description", "descriptionEs", "durationTurns", "equipmentId", "equipmentSetBonusId", "gemId", "id", "jewelryId", "jewelrySetBonusId", "magnitudeOverride", "sortOrder", "sourceText", "statisticId", "statusEffectId", "structuredStatus", "talentOptionId", "targetId", "targetText", "translationStatus", "triggerText", "updatedAt", "value", "valueType" FROM "Effect";
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
CREATE INDEX "Effect_kind_idx" ON "Effect"("kind");
CREATE TABLE "new_Formation" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Formation_primaryStatisticId_fkey" FOREIGN KEY ("primaryStatisticId") REFERENCES "Statistic" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Formation_equivalentToId_fkey" FOREIGN KEY ("equivalentToId") REFERENCES "Formation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Formation" ("createdAt", "id", "key", "maxPerTeam", "name", "nameEs", "positionNote", "primaryStatisticId", "sortOrder", "translationStatus", "updatedAt") SELECT "createdAt", "id", "key", "maxPerTeam", "name", "nameEs", "positionNote", "primaryStatisticId", "sortOrder", "translationStatus", "updatedAt" FROM "Formation";
DROP TABLE "Formation";
ALTER TABLE "new_Formation" RENAME TO "Formation";
CREATE UNIQUE INDEX "Formation_key_key" ON "Formation"("key");
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
    "cardLabel" TEXT,
    "cardLabelCut" BOOLEAN NOT NULL DEFAULT false,
    "sourceHeading" TEXT,
    "note" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TalentOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TalentGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TalentOption" ("description", "descriptionEs", "groupId", "id", "imageUrl", "isDefault", "name", "nameEs", "sortOrder", "translationStatus") SELECT "description", "descriptionEs", "groupId", "id", "imageUrl", "isDefault", "name", "nameEs", "sortOrder", "translationStatus" FROM "TalentOption";
DROP TABLE "TalentOption";
ALTER TABLE "new_TalentOption" RENAME TO "TalentOption";
CREATE INDEX "TalentOption_groupId_idx" ON "TalentOption"("groupId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "NinjaAlias_normalized_idx" ON "NinjaAlias"("normalized");

-- CreateIndex
CREATE UNIQUE INDEX "NinjaAlias_ninjaId_normalized_kind_key" ON "NinjaAlias"("ninjaId", "normalized", "kind");

-- ─────────────────────────────────────────────────────────────────────────────
-- Integrity triggers (Milestone 2)
--
-- Prisma cannot express CHECK-style rules for SQLite, so they are enforced by triggers.
-- This file is the reference copy; the same statements are part of the
-- latest migration that touches triggers. IMPORTANT: when a later migration REDEFINES one of these
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

-- ───────────────────────── added with m2_ninja_profiles ─────────────────────────

-- Ability: closed set of stacking rules; an awakening hangs off a skill OR a talent, never both;
-- an ability cannot supersede itself.
CREATE TRIGGER "trg_ability_rules_ins" BEFORE INSERT ON "Ability"
WHEN NEW."stackingRule" NOT IN ('NOT_APPLICABLE', 'UNKNOWN', 'CUMULATIVE', 'REPLACES_PRIOR', 'CANCELS_PRIOR', 'UPGRADES_BASE')
  OR (NEW."parentAbilityId" IS NOT NULL AND NEW."talentOptionId" IS NOT NULL)
  OR (NEW."supersedesId" IS NOT NULL AND NEW."supersedesId" = NEW."id")
  OR (NEW."parentAbilityId" IS NOT NULL AND NEW."parentAbilityId" = NEW."id")
BEGIN SELECT RAISE(ABORT, 'CHECK Ability: invalid stackingRule, two parents, or self reference'); END;

CREATE TRIGGER "trg_ability_rules_upd" BEFORE UPDATE OF "stackingRule", "parentAbilityId", "talentOptionId", "supersedesId" ON "Ability"
WHEN NEW."stackingRule" NOT IN ('NOT_APPLICABLE', 'UNKNOWN', 'CUMULATIVE', 'REPLACES_PRIOR', 'CANCELS_PRIOR', 'UPGRADES_BASE')
  OR (NEW."parentAbilityId" IS NOT NULL AND NEW."talentOptionId" IS NOT NULL)
  OR (NEW."supersedesId" IS NOT NULL AND NEW."supersedesId" = NEW."id")
  OR (NEW."parentAbilityId" IS NOT NULL AND NEW."parentAbilityId" = NEW."id")
BEGIN SELECT RAISE(ABORT, 'CHECK Ability: invalid stackingRule, two parents, or self reference'); END;

-- Effect: a rate always says what kind of rate it is, so it can never be read as a chance by accident.
CREATE TRIGGER "trg_effect_shape_ins" BEFORE INSERT ON "Effect"
WHEN NEW."kind" NOT IN ('ATTACK', 'STAT', 'STATUS', 'IMMUNITY', 'FURY', 'HEAL', 'DISPEL', 'TEXT')
  OR NEW."structuredStatus" NOT IN ('STRUCTURED', 'NEEDS_REVIEW', 'TEXT_ONLY')
  OR (NEW."rateKind" IS NOT NULL AND NEW."rateKind" NOT IN ('GROWTH', 'INTENSITY', 'APPLICATION'))
  OR (NEW."rateValue" IS NOT NULL AND NEW."rateKind" IS NULL)
  OR (NEW."targetCount" IS NOT NULL AND NEW."targetCount" < 1)
  OR (NEW."choiceLabel" IS NOT NULL AND NEW."choiceGroup" IS NULL)
BEGIN SELECT RAISE(ABORT, 'CHECK Effect: invalid kind/structuredStatus, rate without rateKind, targetCount < 1, or choiceLabel without choiceGroup'); END;

CREATE TRIGGER "trg_effect_shape_upd" BEFORE UPDATE OF "kind", "structuredStatus", "rateKind", "rateValue", "targetCount", "choiceGroup", "choiceLabel" ON "Effect"
WHEN NEW."kind" NOT IN ('ATTACK', 'STAT', 'STATUS', 'IMMUNITY', 'FURY', 'HEAL', 'DISPEL', 'TEXT')
  OR NEW."structuredStatus" NOT IN ('STRUCTURED', 'NEEDS_REVIEW', 'TEXT_ONLY')
  OR (NEW."rateKind" IS NOT NULL AND NEW."rateKind" NOT IN ('GROWTH', 'INTENSITY', 'APPLICATION'))
  OR (NEW."rateValue" IS NOT NULL AND NEW."rateKind" IS NULL)
  OR (NEW."targetCount" IS NOT NULL AND NEW."targetCount" < 1)
  OR (NEW."choiceLabel" IS NOT NULL AND NEW."choiceGroup" IS NULL)
BEGIN SELECT RAISE(ABORT, 'CHECK Effect: invalid kind/structuredStatus, rate without rateKind, targetCount < 1, or choiceLabel without choiceGroup'); END;

-- Formation: an equivalence is a reviewable proposal until approved, and never points at itself.
CREATE TRIGGER "trg_formation_equivalence_ins" BEFORE INSERT ON "Formation"
WHEN NEW."equivalenceStatus" NOT IN ('NONE', 'PROPOSED', 'APPROVED')
  OR (NEW."equivalentToId" IS NOT NULL AND NEW."equivalentToId" = NEW."id")
  OR (NEW."equivalenceStatus" <> 'NONE' AND NEW."equivalentToId" IS NULL)
BEGIN SELECT RAISE(ABORT, 'CHECK Formation: invalid equivalence'); END;

CREATE TRIGGER "trg_formation_equivalence_upd" BEFORE UPDATE OF "equivalenceStatus", "equivalentToId" ON "Formation"
WHEN NEW."equivalenceStatus" NOT IN ('NONE', 'PROPOSED', 'APPROVED')
  OR (NEW."equivalentToId" IS NOT NULL AND NEW."equivalentToId" = NEW."id")
  OR (NEW."equivalenceStatus" <> 'NONE' AND NEW."equivalentToId" IS NULL)
BEGIN SELECT RAISE(ABORT, 'CHECK Formation: invalid equivalence'); END;

-- NinjaAlias: closed value sets.
CREATE TRIGGER "trg_ninja_alias_enums_ins" BEFORE INSERT ON "NinjaAlias"
WHEN NEW."status" NOT IN ('VERIFIED', 'REVIEWED') OR NEW."kind" NOT IN ('CARD_NAME', 'SOURCE_NAME')
BEGIN SELECT RAISE(ABORT, 'CHECK NinjaAlias: invalid status or kind'); END;

CREATE TRIGGER "trg_ninja_alias_enums_upd" BEFORE UPDATE OF "status", "kind" ON "NinjaAlias"
WHEN NEW."status" NOT IN ('VERIFIED', 'REVIEWED') OR NEW."kind" NOT IN ('CARD_NAME', 'SOURCE_NAME')
BEGIN SELECT RAISE(ABORT, 'CHECK NinjaAlias: invalid status or kind'); END;
