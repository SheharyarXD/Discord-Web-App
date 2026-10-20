import type { Prisma } from "@prisma/client";
import type {
  Cleansability,
  ConditionScope,
  EffectKind,
  EffectOwnerField,
  ModifierDirection,
  Polarity,
  RateKind,
  StatusKind,
  StructuredStatus,
  TranslationStatus,
  ValueType,
} from "../domain/constants";
import {
  resolveEffectUsage,
  splitConditions,
  type ConditionView,
  type EffectView,
  type StatusDefinitionView,
} from "../domain/effects";
import { toNumber, UnknownReferenceError } from "./db";
import type { ParsedEffectInput } from "./schemas";

// ───────────────────────── Read shapes ─────────────────────────

export const statusDefinitionInclude = {
  aliases: { orderBy: { alias: "asc" } },
  categories: { include: { category: true } },
  modifiers: { orderBy: { sortOrder: "asc" }, include: { statistic: true } },
} satisfies Prisma.StatusEffectInclude;

export const effectInclude = {
  statistic: true,
  target: true,
  statusEffect: { include: statusDefinitionInclude },
  conditions: {
    orderBy: [{ alternativeGroup: "asc" }, { sortOrder: "asc" }],
    include: {
      conditionType: true,
      conditionValue: true,
      ninja: { select: { slug: true, name: true } },
      formation: { select: { key: true, name: true, nameEs: true } },
      role: { select: { key: true, name: true } },
    },
  },
} satisfies Prisma.EffectInclude;

/** Standard nested-read arguments for an owner's effects. */
export const effectsArgs = { include: effectInclude, orderBy: { sortOrder: "asc" } } satisfies Prisma.EffectFindManyArgs;

type StatusRow = Prisma.StatusEffectGetPayload<{ include: typeof statusDefinitionInclude }>;
type EffectRow = Prisma.EffectGetPayload<{ include: typeof effectInclude }>;
type ConditionRow = EffectRow["conditions"][number];

export function toStatusDefinitionView(row: StatusRow): StatusDefinitionView {
  return {
    key: row.key,
    kind: row.kind as StatusKind,
    name: row.name,
    nameEs: row.nameEs,
    description: row.description,
    descriptionEs: row.descriptionEs,
    translationStatus: row.translationStatus as TranslationStatus,
    polarity: row.polarity as Polarity,
    cleansability: row.cleansability as Cleansability,
    cleansabilityNote: row.cleansabilityNote,
    overrideDocumented: row.overrideDocumented,
    timingNote: row.timingNote,
    note: row.note,
    categories: row.categories
      .map((c) => ({ key: c.category.key, name: c.category.name, nameEs: c.category.nameEs, sortOrder: c.category.sortOrder }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key))
      .map(({ key, name, nameEs }) => ({ key, name, nameEs })),
    aliases: row.aliases.map((a) => a.alias),
    modifiers: row.modifiers.map((m) => ({
      statLabel: m.statLabel,
      statisticKey: m.statistic?.key ?? null,
      statisticName: m.statistic?.name ?? null,
      direction: m.direction as ModifierDirection,
      magnitude: toNumber(m.magnitude),
      valueType: m.valueType as ValueType,
      overridable: m.overridable,
      note: m.note,
    })),
  };
}

function toConditionView(c: ConditionRow): ConditionView {
  // A direct subject (ninja / formation / role) takes the place of a catalogue value.
  const subject = c.ninja
    ? { key: c.ninja.slug, name: c.ninja.name }
    : c.formation
      ? { key: c.formation.key, name: c.formation.nameEs ?? c.formation.name }
      : c.role
        ? { key: c.role.key, name: c.role.name }
        : c.conditionValue
          ? { key: c.conditionValue.key, name: c.conditionValue.nameEs ?? c.conditionValue.name }
          : null;
  return {
    id: c.id,
    scope: c.scope as ConditionScope,
    typeKey: c.conditionType.key,
    typeName: c.conditionType.name,
    valueKey: subject?.key ?? null,
    valueName: subject?.name ?? null,
    operator: c.operator as ConditionView["operator"],
    numericValue: toNumber(c.numericValue),
    note: c.note,
    alternativeGroup: c.alternativeGroup,
  };
}

/**
 * Maps a database row to the UI-agnostic EffectView — the only place rows become views.
 * A dictionary status comes back already RESOLVED for this usage (override vs default), which
 * is exactly what a tooltip must show.
 */
export function toEffectView(row: EffectRow): EffectView {
  const { activation, target } = splitConditions(row.conditions.map(toConditionView));
  const magnitudeOverride = toNumber(row.magnitudeOverride);
  const chancePercent = toNumber(row.chancePercent);
  const definition = row.statusEffect ? toStatusDefinitionView(row.statusEffect) : null;
  return {
    id: row.id,
    statisticName: row.statistic?.name ?? null,
    statisticKey: row.statistic?.key ?? null,
    value: toNumber(row.value),
    valueType: row.valueType as ValueType,
    targetName: row.target?.name ?? null,
    durationTurns: row.durationTurns,
    chancePercent,
    description: row.description,
    conditions: activation,
    targetFilters: target,
    targetText: row.targetText,
    triggerText: row.triggerText,
    conditionText: row.conditionText,
    structuredStatus: row.structuredStatus as StructuredStatus,
    sourceText: row.sourceText,
    kind: row.kind as EffectKind,
    rateValue: toNumber(row.rateValue),
    rateKind: row.rateKind as RateKind | null,
    replacesValue: toNumber(row.replacesValue),
    valueNote: row.valueNote,
    targetCount: row.targetCount,
    targetSelector: row.targetSelector,
    excludesSelf: row.excludesSelf,
    choiceGroup: row.choiceGroup,
    choiceLabel: row.choiceLabel,
    sourceLine: row.sourceLine,
    note: row.note,
    descriptionEs: row.descriptionEs,
    translationStatus: row.translationStatus as TranslationStatus,
    status: definition && {
      definition,
      magnitudeOverride,
      resolved: resolveEffectUsage(definition, { magnitudeOverride, durationTurns: row.durationTurns, chancePercent }),
    },
  };
}

// ───────────────────────── Writes ─────────────────────────

export type EffectOwner = { [K in EffectOwnerField]: { [P in K]: string } }[EffectOwnerField];

/** Per-call cache of vocabulary lookups, so a batch of effects resolves each key once. */
function lookups(tx: Prisma.TransactionClient) {
  const cache = new Map<string, Promise<string>>();
  const memo = (kind: string, key: string, find: () => Promise<{ id: string } | null>) => {
    const k = `${kind}:${key}`;
    let hit = cache.get(k);
    if (!hit) {
      hit = find().then((row) => {
        if (!row) throw new UnknownReferenceError(kind, key);
        return row.id;
      });
      cache.set(k, hit);
    }
    return hit;
  };
  return {
    statistic: (key: string) => memo("statistic", key, () => tx.statistic.findUnique({ where: { key }, select: { id: true } })),
    status: (key: string) => memo("status effect", key, () => tx.statusEffect.findUnique({ where: { key }, select: { id: true } })),
    target: (key: string) => memo("effect target", key, () => tx.effectTarget.findUnique({ where: { key }, select: { id: true } })),
    conditionType: (key: string) => memo("condition type", key, () => tx.conditionType.findUnique({ where: { key }, select: { id: true } })),
    conditionValue: (typeId: string, typeKey: string, key: string) =>
      memo(`${typeKey} value`, key, () =>
        tx.conditionValue.findUnique({ where: { conditionTypeId_key: { conditionTypeId: typeId, key } }, select: { id: true } }),
      ),
    ninja: (slug: string) => memo("ninja", slug, () => tx.ninja.findUnique({ where: { slug }, select: { id: true } })),
    formation: (key: string) => memo("formation", key, () => tx.formation.findUnique({ where: { key }, select: { id: true } })),
    role: (key: string) => memo("role", key, () => tx.ninjaRole.findUnique({ where: { key }, select: { id: true } })),
  };
}

/**
 * Replaces the effect usages of ONE owner with `inputs` (must run inside a transaction).
 * Every referenced key must already exist: nothing is invented on the fly.
 */
export async function replaceEffects(
  tx: Prisma.TransactionClient,
  owner: EffectOwner,
  inputs: ParsedEffectInput[],
  /**
   * "all": the owner's effects become exactly `inputs`.
   * "simple": only plain statistic rows (no status, no conditions) are replaced; special effects of the owner
   * are left alone. Used by the administrator's item forms, which can only express plain statistics.
   */
  mode: "all" | "simple" = "all",
): Promise<void> {
  const find = lookups(tx);
  await tx.effect.deleteMany({ where: mode === "all" ? owner : { ...owner, kind: "STAT", statisticId: { not: null }, statusEffectId: null, conditions: { none: {} } } });
  for (const [sortOrder, e] of inputs.entries()) {
    const conditions: Prisma.ConditionUncheckedCreateWithoutEffectInput[] = [];
    for (const [i, c] of e.conditions.entries()) {
      const conditionTypeId = await find.conditionType(c.typeKey);
      conditions.push({
        scope: c.scope,
        conditionTypeId,
        conditionValueId: c.valueKey ? await find.conditionValue(conditionTypeId, c.typeKey, c.valueKey) : null,
        ninjaId: c.ninjaSlug ? await find.ninja(c.ninjaSlug) : null,
        formationId: c.formationKey ? await find.formation(c.formationKey) : null,
        roleId: c.roleKey ? await find.role(c.roleKey) : null,
        operator: c.operator,
        numericValue: c.numericValue ?? null,
        note: c.note ?? null,
        sourceText: c.sourceText ?? null,
        alternativeGroup: c.alternativeGroup,
        sortOrder: i,
      });
    }
    await tx.effect.create({
      data: {
        ...owner,
        statisticId: e.statisticKey ? await find.statistic(e.statisticKey) : null,
        value: e.value ?? null,
        valueType: e.valueType,
        statusEffectId: e.statusKey ? await find.status(e.statusKey) : null,
        magnitudeOverride: e.magnitudeOverride ?? null,
        targetId: e.targetKey ? await find.target(e.targetKey) : null,
        targetText: e.targetText ?? null,
        durationTurns: e.durationTurns ?? null,
        chancePercent: e.chancePercent ?? null,
        triggerText: e.triggerText ?? null,
        conditionText: e.conditionText ?? null,
        structuredStatus: e.structuredStatus,
        sourceText: e.sourceText ?? null,
        description: e.description ?? null,
        descriptionEs: e.descriptionEs ?? null,
        translationStatus: e.translationStatus,
        kind: e.kind,
        rateValue: e.rateValue ?? null,
        rateKind: e.rateKind ?? null,
        replacesValue: e.replacesValue ?? null,
        valueNote: e.valueNote ?? null,
        targetCount: e.targetCount ?? null,
        targetSelector: e.targetSelector ?? null,
        excludesSelf: e.excludesSelf,
        choiceGroup: e.choiceGroup ?? null,
        choiceLabel: e.choiceLabel ?? null,
        sourceLine: e.sourceLine ?? null,
        note: e.note ?? null,
        sortOrder,
        conditions: { create: conditions },
      },
    });
  }
}
