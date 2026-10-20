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
