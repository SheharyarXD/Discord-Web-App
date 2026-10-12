import type { Prisma } from "@prisma/client";
import type { StatusDefinitionView } from "../domain/effects";
import { normalizeTerm } from "../domain/localize";
import { slugify } from "../domain/slug";
import { inTransaction, parseInput, UnknownReferenceError, type Db } from "./db";
import { statusDefinitionInclude, toStatusDefinitionView } from "./effects";
import { statusEffectInput, type StatusEffectInput } from "./schemas";

const MAX_DICTIONARY_ROWS = 500;

export async function ensureStatusCategory(db: Db, c: { key: string; name: string; nameEs?: string | null; sortOrder?: number }) {
  return db.statusCategory.upsert({
    where: { key: c.key },
    update: { name: c.name, nameEs: c.nameEs ?? null, sortOrder: c.sortOrder ?? 0 },
    create: { key: c.key, name: c.name, nameEs: c.nameEs ?? null, sortOrder: c.sortOrder ?? 0 },
  });
}

/**
 * Creates or updates one dictionary entry with its aliases, category facets and default
 * components, atomically. Idempotent on `key` (defaults to the slug of the source name).
 * It never touches usages: changing a default here is a deliberate dictionary edit, while
 * per-ninja differences belong on the usage (`Effect.magnitudeOverride`).
 */
export async function upsertStatusEffect(db: Db, input: StatusEffectInput): Promise<{ id: string; key: string; created: boolean }> {
  const data = parseInput(statusEffectInput, input, "status effect");
  const key = data.key ?? slugify(data.name);

  return inTransaction(db, async (tx) => {
    const categoryIds: string[] = [];
    for (const categoryKey of data.categoryKeys) {
      const category = await tx.statusCategory.findUnique({ where: { key: categoryKey }, select: { id: true } });
      if (!category) throw new UnknownReferenceError("status category", categoryKey);
      categoryIds.push(category.id);
    }
    const modifiers: Prisma.StatusEffectModifierUncheckedCreateWithoutStatusEffectInput[] = [];
    for (const [sortOrder, m] of data.modifiers.entries()) {
      let statisticId: string | null = null;
      if (m.statisticKey) {
        const statistic = await tx.statistic.findUnique({ where: { key: m.statisticKey }, select: { id: true } });
        if (!statistic) throw new UnknownReferenceError("statistic", m.statisticKey);
        statisticId = statistic.id;
      }
      modifiers.push({
        statLabel: m.statLabel,
        statisticId,
        direction: m.direction,
        magnitude: m.magnitude ?? null,
        valueType: m.valueType,
        overridable: m.overridable,
        note: m.note ?? null,
        sortOrder,
      });
    }

    const scalars = {
      kind: data.kind,
      name: data.name,
      nameEs: data.nameEs ?? null,
      description: data.description ?? null,
      descriptionEs: data.descriptionEs ?? null,
      translationStatus: data.translationStatus,
      polarity: data.polarity,
      cleansability: data.cleansability,
      cleansabilityNote: data.cleansabilityNote ?? null,
      overrideDocumented: data.overrideDocumented,
      timingNote: data.timingNote ?? null,
      note: data.note ?? null,
      structuredStatus: data.structuredStatus,
      reviewStatus: data.reviewStatus,
      sortOrder: data.sortOrder,
    };
    const existing = await tx.statusEffect.findUnique({ where: { key }, select: { id: true } });
    const row = existing
      ? await tx.statusEffect.update({ where: { key }, data: scalars, select: { id: true } })
      : await tx.statusEffect.create({ data: { key, ...scalars }, select: { id: true } });

    await tx.statusEffectAlias.deleteMany({ where: { statusEffectId: row.id } });
    const aliases = new Map(data.aliases.map((alias) => [normalizeTerm(alias), alias]));
    await tx.statusEffectAlias.createMany({
      data: [...aliases].map(([normalized, alias]) => ({ statusEffectId: row.id, alias, normalized })),
    });
    await tx.statusEffectCategory.deleteMany({ where: { statusEffectId: row.id } });
    await tx.statusEffectCategory.createMany({
      data: [...new Set(categoryIds)].map((categoryId) => ({ statusEffectId: row.id, categoryId })),
    });
    await tx.statusEffectModifier.deleteMany({ where: { statusEffectId: row.id } });
    await tx.statusEffectModifier.createMany({ data: modifiers.map((m) => ({ ...m, statusEffectId: row.id })) });

    return { id: row.id, key, created: !existing };
  });
}

export interface StatusListFilter {
  kind?: string;
  polarity?: string;
  cleansability?: string;
  /** Entries having ALL of these category facets. */
  categoryKeys?: string[];
}

/** The dictionary, in a stable order. Bounded; facets filter independently of each other. */
export async function listStatusEffects(db: Db, filter: StatusListFilter = {}): Promise<StatusDefinitionView[]> {
  const rows = await db.statusEffect.findMany({
    where: {
      kind: filter.kind,
      polarity: filter.polarity,
      cleansability: filter.cleansability,
      AND: filter.categoryKeys?.map((key) => ({ categories: { some: { category: { key } } } })),
    },
    include: statusDefinitionInclude,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: MAX_DICTIONARY_ROWS,
  });
  return rows.map(toStatusDefinitionView);
}

export async function getStatusEffect(db: Db, key: string): Promise<StatusDefinitionView | null> {
  const row = await db.statusEffect.findUnique({ where: { key }, include: statusDefinitionInclude });
  return row && toStatusDefinitionView(row);
}

/**
 * Finds entries by name or alias. Returns EVERY match: a term such as "Shielding state" is
 * legitimately shared by two entries, and the caller must treat more than one hit as ambiguous.
 */
export async function findStatusEffectsByTerm(db: Db, term: string): Promise<StatusDefinitionView[]> {
  const rows = await db.statusEffect.findMany({
    where: { OR: [{ key: slugify(term) }, { aliases: { some: { normalized: normalizeTerm(term) } } }] },
    include: statusDefinitionInclude,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map(toStatusDefinitionView);
}
