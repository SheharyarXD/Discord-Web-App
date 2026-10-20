import type { Prisma } from "@prisma/client";
import {
  CONTENT_STATUSES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type AliasKind,
  type AliasStatus,
  type CombatClass,
  type EquivalenceStatus,
  type MappingStatus,
  type ReviewStatus,
  type SelectionMode,
  type StackingRule,
  type TranslationStatus,
} from "../domain/constants";
import type { EffectView } from "../domain/effects";
import { normalizeTerm } from "../domain/localize";
import { resolveFormation, ruleFormation, type FormationOrigin, type ReleasePeriod } from "../domain/ninja";
import { slugify } from "../domain/slug";
import { inTransaction, parseInput, UnknownReferenceError, type Db } from "./db";
import { effectsArgs, replaceEffects, toEffectView } from "./effects";
import { ninjaInput, ninjaListParams, type NinjaInput, type NinjaListParams } from "./schemas";

type ParsedNinja = ReturnType<typeof ninjaInput.parse>;
type ParsedAbility = NonNullable<ParsedNinja["abilities"]>[number];
type ParsedAwakening = NonNullable<ParsedAbility["awakenings"]>[number];

// ───────────────────────── Vocabulary helpers ─────────────────────────

interface VocabRow {
  key: string;
  name: string;
  nameEs?: string | null;
  sortOrder?: number;
}

/** Idempotent upserts for extensible vocabularies. Used by the loader and, later, by admin forms. */
export const vocabulary = {
  rating: (db: Db, r: VocabRow) =>
    db.ninjaRating.upsert({
      where: { key: r.key },
      update: { name: r.name, sortOrder: r.sortOrder ?? 0 },
      create: { key: r.key, name: r.name, sortOrder: r.sortOrder ?? 0 },
    }),
  ninjaType: (db: Db, r: VocabRow & { translationStatus?: TranslationStatus }) =>
    db.ninjaType.upsert({
      where: { key: r.key },
      update: { name: r.name, nameEs: r.nameEs ?? null, translationStatus: r.translationStatus ?? "MISSING" },
      create: { key: r.key, name: r.name, nameEs: r.nameEs ?? null, translationStatus: r.translationStatus ?? "MISSING", sortOrder: r.sortOrder ?? 0 },
    }),
  statistic: (
    db: Db,
    r: VocabRow & { defaultValueType?: string; category?: string | null; note?: string | null; reviewStatus?: ReviewStatus; translationStatus?: TranslationStatus },
  ) => {
    const data = {
      name: r.name,
      nameEs: r.nameEs ?? null,
      translationStatus: r.translationStatus ?? "MISSING",
      defaultValueType: r.defaultValueType ?? "FLAT",
      category: r.category ?? null,
      note: r.note ?? null,
      reviewStatus: r.reviewStatus ?? "CONFIRMED",
      sortOrder: r.sortOrder ?? 0,
    };
    return db.statistic.upsert({ where: { key: r.key }, update: data, create: { key: r.key, ...data } });
  },
  /** `primaryStatisticKey` encodes the client rule "Support → Chakra, Center/Vanguard → Force". */
  formation: async (
    db: Db,
    r: VocabRow & {
      positionNote?: string | null;
      primaryStatisticKey?: string | null;
      maxPerTeam?: number | null;
      translationStatus?: TranslationStatus;
      /** Another formation row this one may be the same as. Stays a proposal until APPROVED. */
      equivalentToKey?: string | null;
      equivalenceStatus?: EquivalenceStatus;
      equivalenceNote?: string | null;
    },
  ) => {
    let equivalentToId: string | null = null;
    if (r.equivalentToKey) {
      const other = await db.formation.findUnique({ where: { key: r.equivalentToKey }, select: { id: true } });
      if (!other) throw new UnknownReferenceError("formation", r.equivalentToKey);
      equivalentToId = other.id;
    }
    let primaryStatisticId: string | null = null;
    if (r.primaryStatisticKey) {
      const stat = await db.statistic.findUnique({ where: { key: r.primaryStatisticKey }, select: { id: true } });
      if (!stat) throw new UnknownReferenceError("statistic", r.primaryStatisticKey);
      primaryStatisticId = stat.id;
    }
    const data = {
      name: r.name,
      nameEs: r.nameEs ?? null,
      translationStatus: r.translationStatus ?? "MISSING",
      positionNote: r.positionNote ?? null,
      primaryStatisticId,
      maxPerTeam: r.maxPerTeam ?? null,
      equivalentToId,
      equivalenceStatus: equivalentToId ? (r.equivalenceStatus ?? "PROPOSED") : "NONE",
      equivalenceNote: r.equivalenceNote ?? null,
      sortOrder: r.sortOrder ?? 0,
    };
    return db.formation.upsert({ where: { key: r.key }, update: data, create: { key: r.key, ...data } });
  },
  /** A source category. Its formation mapping stays a reviewable proposal until APPROVED. */
  role: async (
    db: Db,
    r: VocabRow & { description?: string | null; mappedFormationKey?: string | null; mappingStatus?: MappingStatus; mappingNote?: string | null },
  ) => {
    let mappedFormationId: string | null = null;
    if (r.mappedFormationKey) {
      const formation = await db.formation.findUnique({ where: { key: r.mappedFormationKey }, select: { id: true } });
      if (!formation) throw new UnknownReferenceError("formation", r.mappedFormationKey);
      mappedFormationId = formation.id;
    }
    const data = {
      name: r.name,
      nameEs: r.nameEs ?? null,
      description: r.description ?? null,
      mappedFormationId,
      mappingStatus: r.mappingStatus ?? (mappedFormationId ? "PROPOSED" : "UNMAPPED"),
      mappingNote: r.mappingNote ?? null,
      sortOrder: r.sortOrder ?? 0,
    };
    return db.ninjaRole.upsert({ where: { key: r.key }, update: data, create: { key: r.key, ...data } });
  },
  /** A nature = a ConditionValue of type "nature" (shared with nature requirements). */
  nature: async (db: Db, r: VocabRow) => {
    const type = await db.conditionType.findUnique({ where: { key: "nature" }, select: { id: true } });
    if (!type) throw new UnknownReferenceError("condition type", "nature");
    return db.conditionValue.upsert({
      where: { conditionTypeId_key: { conditionTypeId: type.id, key: r.key } },
      update: { name: r.name, nameEs: r.nameEs ?? null },
      create: { conditionTypeId: type.id, key: r.key, name: r.name, nameEs: r.nameEs ?? null, sortOrder: r.sortOrder ?? 0 },
    });
  },
};

// ───────────────────────── Write ─────────────────────────

async function refId(
  kind: string,
  key: string | null | undefined,
  find: (key: string) => Promise<{ id: string } | null>,
): Promise<string | null | undefined> {
  if (key === undefined) return undefined; // not provided → leave as is
  if (key === null) return null; // explicit clear
  const row = await find(key);
  if (!row) throw new UnknownReferenceError(kind, key);
  return row.id;
}

/**
 * Creates or updates one ninja and the children that were provided, atomically.
 *
 *  - Identity is the slug of the exact source name, so each named variant is its own record and
 *    re-submitting the same record updates it instead of duplicating it.
 *  - `undefined` leaves a field untouched, `null` clears it. Nothing is required beyond the name:
 *    a ninja known only from the release list is a valid sparse record.
 *  - A child list that is provided is the full list for that ninja (unless `prune: false`);
 *    omitted lists are untouched.
 *  - Any failure rolls the whole ninja back — no orphaned abilities or effects.
 */
export async function upsertNinja(
  db: Db,
  input: NinjaInput,
  /** `prune: false` only adds/updates the listed children and never deletes others (used by re-runnable imports). */
  options: { prune?: boolean } = {},
): Promise<{ id: string; slug: string; created: boolean }> {
  const prune = options.prune ?? true;
  const data = parseInput(ninjaInput, input, "ninja");
  const slug = data.slug ?? slugify(data.name);
  if (!slug) throw new UnknownReferenceError("slug for ninja name", data.name);

  return inTransaction(db, async (tx) => {
    const scalars: Prisma.NinjaUncheckedUpdateInput = {
      name: data.name,
      nameEs: data.nameEs,
      description: data.description,
      descriptionEs: data.descriptionEs,
      translationStatus: data.translationStatus,
      imageUrl: data.imageUrl,
      clientCombatClass: data.clientCombatClass,
      releaseOrder: data.releaseOrder,
      status: data.status,
      reviewStatus: data.reviewStatus,
      roleId: await refId("role", data.roleKey, (key) => tx.ninjaRole.findUnique({ where: { key }, select: { id: true } })),
      formationId: await refId("formation", data.formationKey, (key) => tx.formation.findUnique({ where: { key }, select: { id: true } })),
      ratingId: await refId("rating", data.ratingKey, (key) => tx.ninjaRating.findUnique({ where: { key }, select: { id: true } })),
      ninjaTypeId: await refId("ninja type", data.typeKey, (key) => tx.ninjaType.findUnique({ where: { key }, select: { id: true } })),
    };
    if (data.release !== undefined) {
      scalars.releaseYear = data.release?.year ?? null;
      scalars.releaseMonth = data.release?.month ?? null;
    }

    const existing = await tx.ninja.findUnique({ where: { slug }, select: { id: true } });
    const ninja = existing
      ? await tx.ninja.update({ where: { slug }, data: scalars, select: { id: true } })
      : await tx.ninja.create({ data: { ...(scalars as Prisma.NinjaUncheckedCreateInput), slug, name: data.name }, select: { id: true } });
    const ninjaId = ninja.id;

    if (data.natureKeys) {
      await tx.ninjaNature.deleteMany({ where: { ninjaId } });
      for (const key of new Set(data.natureKeys)) {
        const nature = await tx.conditionValue.findFirst({ where: { key, conditionType: { key: "nature" } }, select: { id: true } });
        if (!nature) throw new UnknownReferenceError("nature", key);
        await tx.ninjaNature.create({ data: { ninjaId, natureId: nature.id } });
      }
    }

    if (data.baseStats) {
      const keep: string[] = [];
      for (const [sortOrder, s] of data.baseStats.entries()) {
        const statistic = await tx.statistic.findUnique({ where: { key: s.statisticKey }, select: { id: true } });
        if (!statistic) throw new UnknownReferenceError("statistic", s.statisticKey);
        const values = { sourceLabel: s.sourceLabel, baseValue: s.baseValue, growthRate: s.growthRate ?? null, sortOrder };
        await tx.ninjaBaseStat.upsert({
          where: { ninjaId_statisticId: { ninjaId, statisticId: statistic.id } },
          update: values,
          create: { ninjaId, statisticId: statistic.id, ...values },
        });
        keep.push(statistic.id);
      }
      if (prune) await tx.ninjaBaseStat.deleteMany({ where: { ninjaId, statisticId: { notIn: keep } } });
    }

    if (data.aliases) {
      const keep: string[] = [];
      for (const a of data.aliases) {
        const normalized = normalizeTerm(a.alias);
        const values = { alias: a.alias, locale: a.locale, status: a.status, note: a.note ?? null };
        const row = await tx.ninjaAlias.upsert({
          where: { ninjaId_normalized_kind: { ninjaId, normalized, kind: a.kind } },
          update: values,
          create: { ninjaId, normalized, kind: a.kind, ...values },
          select: { id: true },
        });
        keep.push(row.id);
      }
      if (prune) await tx.ninjaAlias.deleteMany({ where: { ninjaId, id: { notIn: keep } } });
    }

    // Abilities of this ninja as they are now, to update in place instead of duplicating.
    const stored = await tx.ability.findMany({
      where: { ninjaId },
      select: { id: true, abilityTypeId: true, name: true, stage: true, parentAbilityId: true, talentOptionId: true },
    });
    const kept = new Set<string>();
    const typeId = async (key: string) => {
      const type = await tx.abilityType.findUnique({ where: { key }, select: { id: true } });
      if (!type) throw new UnknownReferenceError("ability type", key);
      return type.id;
    };
    type Parent = { parentAbilityId: string | null; talentOptionId: string | null };
    const NO_PARENT: Parent = { parentAbilityId: null, talentOptionId: null };

    const saveAbility = async (a: ParsedAbility | ParsedAwakening, parent: Parent, sortOrder: number, rule?: { stackingRule: string; ruleSourceText: string | null }) => {
      const abilityTypeId = await typeId(a.typeKey);
      const stage = a.stage ?? null;
      const values = {
        abilityTypeId,
        name: a.name,
        nameEs: a.nameEs ?? null,
        description: a.description ?? null,
        descriptionEs: a.descriptionEs ?? null,
        translationStatus: a.translationStatus,
        triggerText: a.triggerText ?? null,
        stage,
        cardLabel: a.cardLabel ?? null,
        cardLabelCut: a.cardLabelCut,
        sourceHeading: a.sourceHeading ?? null,
        conditionText: a.conditionText ?? null,
        note: a.note ?? null,
        reviewStatus: a.reviewStatus,
        stackingRule: rule?.stackingRule ?? "NOT_APPLICABLE",
        ruleSourceText: rule?.ruleSourceText ?? null,
        sortOrder,
        ...parent,
      };
      const match = stored.find(
        (c) => c.abilityTypeId === abilityTypeId && c.name === a.name && c.stage === stage && c.parentAbilityId === parent.parentAbilityId && c.talentOptionId === parent.talentOptionId && !kept.has(c.id),
      );
      const row = match
        ? await tx.ability.update({ where: { id: match.id }, data: values, select: { id: true } })
        : await tx.ability.create({ data: { ninjaId, ...values }, select: { id: true } });
      kept.add(row.id);
      if (a.effects) await replaceEffects(tx, { abilityId: row.id }, a.effects);
      return row.id;
    };

    /** Saves the awakening stages of one talent or skill, then links "replaces / cancels" pairs. */
    const saveAwakenings = async (list: ParsedAwakening[], parent: Parent) => {
      const byStage = new Map<number, string>();
      const saved: { id: string; supersedesStage: number | null }[] = [];
      for (const [order, w] of list.entries()) {
        const id = await saveAbility(w, parent, order, { stackingRule: w.stackingRule, ruleSourceText: w.ruleSourceText ?? null });
        if (w.stage != null) byStage.set(w.stage, id);
        saved.push({ id, supersedesStage: w.supersedesStage ?? null });
      }
      for (const w of saved) {
        const supersedesId = w.supersedesStage === null ? null : (byStage.get(w.supersedesStage) ?? null);
        if (w.supersedesStage !== null && !supersedesId) throw new UnknownReferenceError("awakening stage to supersede", String(w.supersedesStage));
        await tx.ability.update({ where: { id: w.id }, data: { supersedesId } });
      }
    };

    if (data.abilities) {
      for (const [sortOrder, a] of data.abilities.entries()) {
        const id = await saveAbility(a, NO_PARENT, sortOrder);
        if (a.awakenings) await saveAwakenings(a.awakenings, { parentAbilityId: id, talentOptionId: null });
      }
      // Base abilities and skill awakenings that are no longer listed. Talent awakenings are handled below.
      if (prune) await tx.ability.deleteMany({ where: { ninjaId, talentOptionId: null, id: { notIn: [...kept] } } });
    }

    if (data.talentGroups) {
      const current = await tx.talentGroup.findMany({
        where: { ninjaId },
        orderBy: { sortOrder: "asc" },
        select: { id: true, options: { select: { id: true, name: true } } },
      });
      const keepGroups: string[] = [];
      for (const [sortOrder, g] of data.talentGroups.entries()) {
        const values = {
          name: g.name ?? null,
          selectionMode: g.selectionMode,
          minSelections: g.minSelections,
          maxSelections: g.maxSelections,
          reviewStatus: g.reviewStatus,
          note: g.note ?? null,
          sortOrder,
        };
        // Groups are matched by position; options by name, so a viewer's stored pick survives a re-import.
        const match = current[sortOrder];
        const group = match
          ? await tx.talentGroup.update({ where: { id: match.id }, data: values, select: { id: true } })
          : await tx.talentGroup.create({ data: { ninjaId, ...values }, select: { id: true } });
        keepGroups.push(group.id);

        const keepOptions: string[] = [];
        for (const [optionOrder, o] of g.options.entries()) {
          const optionValues = {
            name: o.name,
            nameEs: o.nameEs ?? null,
            description: o.description ?? null,
            descriptionEs: o.descriptionEs ?? null,
            translationStatus: o.translationStatus,
            cardLabel: o.cardLabel ?? null,
            cardLabelCut: o.cardLabelCut,
            sourceHeading: o.sourceHeading ?? null,
            note: o.note ?? null,
            reviewStatus: o.reviewStatus,
            sortOrder: optionOrder,
          };
          const existingOption = match?.options.find((x) => x.name === o.name && !keepOptions.includes(x.id));
          const option = existingOption
            ? await tx.talentOption.update({ where: { id: existingOption.id }, data: optionValues, select: { id: true } })
            : await tx.talentOption.create({ data: { groupId: group.id, ...optionValues }, select: { id: true } });
          keepOptions.push(option.id);
          if (o.effects) await replaceEffects(tx, { talentOptionId: option.id }, o.effects);
          if (o.awakenings) {
            await saveAwakenings(o.awakenings, { parentAbilityId: null, talentOptionId: option.id });
            if (prune) await tx.ability.deleteMany({ where: { talentOptionId: option.id, id: { notIn: [...kept] } } });
          }
        }
        if (prune) await tx.talentOption.deleteMany({ where: { groupId: group.id, id: { notIn: keepOptions } } });
      }
      if (prune) await tx.talentGroup.deleteMany({ where: { ninjaId, id: { notIn: keepGroups } } });
    }

    return { id: ninjaId, slug, created: !existing };
  });
}

// ───────────────────────── Read: list ─────────────────────────

/**
 * Newest first, deterministic: unknown release periods last, then name and id as tie-breakers.
 * Mirrors compareNewestFirst in src/domain/ninja.ts.
 */
export const NEWEST_FIRST_ORDER_BY = [
  { releaseYear: { sort: "desc", nulls: "last" } },
  { releaseMonth: { sort: "desc", nulls: "last" } },
  { releaseOrder: { sort: "desc", nulls: "last" } },
  { name: "asc" },
  { id: "asc" },
] satisfies Prisma.NinjaOrderByWithRelationInput[];

const listInclude = {
  role: { include: { mappedFormation: { include: { equivalentTo: true } } } },
  formation: { include: { equivalentTo: true } },
  rating: true,
  ninjaType: true,
} satisfies Prisma.NinjaInclude;

type ListRow = Prisma.NinjaGetPayload<{ include: typeof listInclude }>;

const releaseOf = (n: { releaseYear: number | null; releaseMonth: number | null }): ReleasePeriod | null =>
  n.releaseYear !== null && n.releaseMonth !== null ? { year: n.releaseYear, month: n.releaseMonth } : null;

function summarize(n: ListRow) {
  const resolved = resolveFormation({ formation: n.formation, role: n.role });
  return {
    id: n.id,
    slug: n.slug,
    name: n.name,
    nameEs: n.nameEs,
    imageUrl: n.imageUrl,
    release: releaseOf(n),
    releaseOrder: n.releaseOrder,
    rating: n.rating && { key: n.rating.key, name: n.rating.name },
    type: n.ninjaType && { key: n.ninjaType.key, name: n.ninjaType.name, nameEs: n.ninjaType.nameEs },
    role: n.role && { key: n.role.key, name: n.role.name },
    formation: resolved && {
      key: resolved.formation.key,
      name: resolved.formation.name,
      nameEs: resolved.formation.nameEs,
      origin: resolved.origin,
      /** The position this label is the same as, once the client approved it (Assaulter = Center). */
      sameAs:
        resolved.formation.equivalentTo && resolved.formation.equivalenceStatus === "APPROVED"
          ? { key: resolved.formation.equivalentTo.key, name: resolved.formation.equivalentTo.name, nameEs: resolved.formation.equivalentTo.nameEs }
          : null,
    },
    clientCombatClass: n.clientCombatClass as CombatClass | null,
    reviewStatus: n.reviewStatus as ReviewStatus,
  };
}
type NinjaSummaryBase = ReturnType<typeof summarize>;
export type NinjaSummary = NinjaSummaryBase & { sortStat: { key: string; value: string | null; growth: string | null } | null };

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const periodAtLeast = (p: ReleasePeriod): Prisma.NinjaWhereInput => ({
  OR: [{ releaseYear: { gt: p.year } }, { releaseYear: p.year, releaseMonth: { gte: p.month } }],
});
const periodAtMost = (p: ReleasePeriod): Prisma.NinjaWhereInput => ({
  OR: [{ releaseYear: { lt: p.year } }, { releaseYear: p.year, releaseMonth: { lte: p.month } }],
});

/**
 * Formation filters treat an APPROVED equivalence as one position: filtering «Center» also finds the
 * cards that print «Assaulter», and the other way round. A merely PROPOSED equivalence changes nothing.
 */
async function expandFormationKeys(db: Db, keys: string[]): Promise<string[]> {
  const rows = await db.formation.findMany({ select: { key: true, equivalenceStatus: true, equivalentTo: { select: { key: true } } } });
  const out = new Set(keys);
  for (const f of rows) {
    if (f.equivalenceStatus !== "APPROVED" || !f.equivalentTo) continue;
    if (out.has(f.key)) out.add(f.equivalentTo.key);
    if (out.has(f.equivalentTo.key)) out.add(f.key);
  }
  return [...out];
}

const range = (f: { min?: string | null; max?: string | null }) => ({
  ...(f.min != null ? { gte: f.min } : {}),
  ...(f.max != null ? { lte: f.max } : {}),
});

/** The where-clause of a ninja list. Values inside one filter are ORed, different filters are ANDed. */
async function ninjaWhere(db: Db, p: ReturnType<typeof ninjaListParams.parse>): Promise<Prisma.NinjaWhereInput> {
  const and: Prisma.NinjaWhereInput[] = [];
  if (!p.includeUnpublished) and.push({ status: CONTENT_STATUSES.PUBLISHED });
  if (p.ratingKeys?.length) and.push({ rating: { key: { in: p.ratingKeys } } });
  if (p.roleKeys?.length) and.push({ role: { key: { in: p.roleKeys } } });
  if (p.typeKeys?.length) and.push({ ninjaType: { key: { in: p.typeKeys } } });
  if (p.formationKeys?.length) {
    const keys = await expandFormationKeys(db, p.formationKeys);
    // Direct evidence, or an APPROVED source-category mapping, never a merely proposed one.
    and.push({
      OR: [
        { formation: { key: { in: keys } } },
        { formationId: null, role: { mappingStatus: "APPROVED", mappedFormation: { key: { in: keys } } } },
      ],
    });
  }
  if (p.combatClasses?.length) {
    const classes = p.combatClasses.filter((c) => c !== "UNASSIGNED");
    and.push({
      OR: [
        ...(classes.length ? [{ clientCombatClass: { in: classes } }] : []),
        ...(p.combatClasses.includes("UNASSIGNED") ? [{ clientCombatClass: null }] : []),
      ],
    });
  }
  if (p.nameContains) and.push({ OR: [{ name: { contains: p.nameContains } }, { nameEs: { contains: p.nameContains } }] });
  if (p.query) {
    const slugQuery = slugify(p.query);
    and.push({
      OR: [
        { name: { contains: p.query } },
        { nameEs: { contains: p.query } },
        ...(slugQuery ? [{ slug: { contains: slugQuery } }] : []),
        { aliases: { some: { normalized: { contains: normalizeTerm(p.query) } } } },
      ],
    });
  }
  for (const f of p.statFilters ?? []) {
    and.push({ baseStats: { some: { statistic: { key: f.statisticKey }, baseValue: range(f) } } });
  }
  if (p.effectStatisticKeys?.length) {
    const onStat = { effects: { some: { statistic: { key: { in: p.effectStatisticKeys } } } } };
    and.push({
      OR: [
        { abilities: { some: onStat } },
        { talentGroups: { some: { options: { some: { OR: [onStat, { awakenings: { some: onStat } }] } } } } },
      ],
    });
  }
  if (p.releasedFrom) and.push(periodAtLeast(p.releasedFrom));
  if (p.releasedTo) and.push(periodAtMost(p.releasedTo));
  return { AND: and };
}

/**
 * One page of ninjas. Always bounded (pageSize ≤ MAX_PAGE_SIZE). Default order: newest release first.
 * Sorting by a statistic puts ninjas that do not have it last, in either direction.
 */
export async function listNinjas(db: Db, params: NinjaListParams = {}): Promise<Page<NinjaSummary>> {
  const p = parseInput(ninjaListParams, params, "ninja list parameters");
  const pageSize = Math.min(p.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const where = await ninjaWhere(db, p);
  const skip = (p.page - 1) * pageSize;
  const total = await db.ninja.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const sort = p.sort;

  if (sort && (sort.by === "stat" || sort.by === "growth")) {
    const field = sort.by === "stat" ? "baseValue" : "growthRate";
    const all = await db.ninja.findMany({
      where,
      select: { id: true, name: true, baseStats: { where: { statistic: { key: sort.statisticKey! } }, select: { baseValue: true, growthRate: true } } },
    });
    const value = (n: (typeof all)[number]) => {
      const row = n.baseStats[0];
      const v = row?.[field];
      return v == null ? null : Number(v.toString());
    };
    const dir = sort.direction === "asc" ? 1 : -1;
    const ordered = [...all].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      if (x === null && y === null) return a.name.localeCompare(b.name);
      if (x === null) return 1;
      if (y === null) return -1;
      return x === y ? a.name.localeCompare(b.name) : (x - y) * dir;
    });
    const ids = ordered.slice(skip, skip + pageSize).map((n) => n.id);
    const rows = await db.ninja.findMany({ where: { id: { in: ids } }, include: listInclude });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const stats = new Map(all.map((n) => [n.id, n.baseStats[0] ?? null]));
    const items = ids.map((id) => ({
      ...summarize(byId.get(id)!),
      sortStat: { key: sort.statisticKey!, value: stats.get(id)?.baseValue?.toString() ?? null, growth: stats.get(id)?.growthRate?.toString() ?? null },
    }));
    return { items, total, page: p.page, pageSize, pageCount };
  }

  const orderBy: Prisma.NinjaOrderByWithRelationInput[] =
    sort?.by === "name"
      ? [{ name: sort.direction }, { id: "asc" }]
      : sort?.by === "release" && sort.direction === "asc"
        ? [{ releaseYear: { sort: "asc", nulls: "last" } }, { releaseMonth: { sort: "asc", nulls: "last" } }, { releaseOrder: { sort: "asc", nulls: "last" } }, { name: "asc" }, { id: "asc" }]
        : NEWEST_FIRST_ORDER_BY;
  const rows = await db.ninja.findMany({ where, include: listInclude, orderBy, skip, take: pageSize });
  return { items: rows.map((r) => ({ ...summarize(r), sortStat: null })), total, page: p.page, pageSize, pageCount };
}

// ───────────────────────── Read: detail ─────────────────────────

const formationInclude = { primaryStatistic: true, equivalentTo: { include: { primaryStatistic: true } } } satisfies Prisma.FormationInclude;
const abilityInclude = { abilityType: true, effects: effectsArgs } satisfies Prisma.AbilityInclude;
const awakeningsArgs = { orderBy: [{ stage: "asc" }, { sortOrder: "asc" }], include: abilityInclude } satisfies Prisma.AbilityFindManyArgs;

const detailInclude = {
  role: { include: { mappedFormation: { include: formationInclude } } },
  formation: { include: formationInclude },
  rating: true,
  ninjaType: true,
  natures: { include: { nature: true } },
  aliases: { orderBy: { alias: "asc" } },
  baseStats: { orderBy: { sortOrder: "asc" }, include: { statistic: true } },
  // Base abilities only; each carries its own awakening stages.
  abilities: {
    where: { parentAbilityId: null, talentOptionId: null },
    orderBy: { sortOrder: "asc" },
    include: { ...abilityInclude, awakenings: awakeningsArgs },
  },
  talentGroups: {
    orderBy: { sortOrder: "asc" },
    include: { options: { orderBy: { sortOrder: "asc" }, include: { effects: effectsArgs, awakenings: awakeningsArgs } } },
  },
  sourceRecords: { orderBy: { key: "asc" }, include: { asset: { select: { path: true, category: true } } } },
} satisfies Prisma.NinjaInclude;

type AbilityRow = Prisma.AbilityGetPayload<{ include: typeof abilityInclude }>;

export interface AbilityDetail {
  id: string;
  type: { key: string; name: string };
  name: string;
  nameEs: string | null;
  /** Name printed on the card, when it differs from (or is all that is known of) the name. */
  cardLabel: string | null;
  cardLabelCut: boolean;
  sourceHeading: string | null;
  description: string | null;
  descriptionEs: string | null;
  translationStatus: TranslationStatus;
  triggerText: string | null;
  conditionText: string | null;
  note: string | null;
  stage: number | null;
  reviewStatus: ReviewStatus;
  effects: EffectView[];
}

/** An awakening stage, with how it relates to earlier stages. */
export interface AwakeningDetail extends AbilityDetail {
  stackingRule: StackingRule;
  supersedesId: string | null;
  ruleSourceText: string | null;
}

function toAbilityDetail(a: AbilityRow): AbilityDetail {
  return {
    id: a.id,
    type: { key: a.abilityType.key, name: a.abilityType.name },
    name: a.name,
    nameEs: a.nameEs,
    cardLabel: a.cardLabel,
    cardLabelCut: a.cardLabelCut,
    sourceHeading: a.sourceHeading,
    description: a.description,
    descriptionEs: a.descriptionEs,
    translationStatus: a.translationStatus as TranslationStatus,
    triggerText: a.triggerText,
    conditionText: a.conditionText,
    note: a.note,
    stage: a.stage,
    reviewStatus: a.reviewStatus as ReviewStatus,
    effects: a.effects.map(toEffectView),
  };
}
const toAwakeningDetail = (a: AbilityRow): AwakeningDetail => ({
  ...toAbilityDetail(a),
  stackingRule: a.stackingRule as StackingRule,
  supersedesId: a.supersedesId,
  ruleSourceText: a.ruleSourceText,
});

export interface NinjaDetail {
  id: string;
  slug: string;
  name: string;
  nameEs: string | null;
  description: string | null;
  descriptionEs: string | null;
  translationStatus: TranslationStatus;
  imageUrl: string | null;
  status: string;
  reviewStatus: ReviewStatus;
  release: ReleasePeriod | null;
  releaseOrder: number | null;
  rating: { key: string; name: string } | null;
  type: { key: string; name: string; nameEs: string | null } | null;
  /** Source category, with the state of its (reviewable) formation mapping. */
  role: { key: string; name: string; mappingStatus: MappingStatus; proposedFormationName: string | null } | null;
  formation: {
    key: string;
    name: string;
    nameEs: string | null;
    origin: FormationOrigin;
    /** Another position this label may be the same as. Acted on only when APPROVED. */
    equivalence: { status: EquivalenceStatus; toName: string; toNameEs: string | null; note: string | null } | null;
  } | null;
  /** Derived from the formation (client rule). Null whenever the formation's rule is not established. */
  primaryStat: { key: string; name: string } | null;
  aliases: { alias: string; kind: AliasKind; status: AliasStatus; locale: string; note: string | null }[];
  clientCombatClass: CombatClass | null;
  natures: { key: string; name: string }[];
  /** Decimal strings, exactly as stored. */
  baseStats: { statisticKey: string; statisticName: string; sourceLabel: string; baseValue: string; growthRate: string | null; isPrimary: boolean }[];
  abilities: (AbilityDetail & { awakenings: AwakeningDetail[] })[];
  talentGroups: {
    id: string;
    name: string | null;
    selectionMode: SelectionMode;
    minSelections: number;
    maxSelections: number;
    reviewStatus: ReviewStatus;
    note: string | null;
    options: {
      id: string;
      name: string;
      nameEs: string | null;
      cardLabel: string | null;
      cardLabelCut: boolean;
      sourceHeading: string | null;
      description: string | null;
      descriptionEs: string | null;
      translationStatus: TranslationStatus;
      note: string | null;
      reviewStatus: ReviewStatus;
      isDefault: boolean;
      effects: EffectView[];
      awakenings: AwakeningDetail[];
    }[];
    /** The VIEWER's own picks. Empty unless that user chose; never a canonical default. */
    selectedOptionIds: string[];
  }[];
  sources: { assetPath: string; section: string | null; field: string | null; sourceText: string | null; reviewStatus: ReviewStatus; ambiguityNote: string | null }[];
}

/** Full read model of one ninja. Absent data stays absent: no placeholder abilities, natures or talents. */
export async function getNinjaDetail(
  db: Db,
  slug: string,
  options: { viewerId?: string; includeUnpublished?: boolean } = {},
): Promise<NinjaDetail | null> {
  const n = await db.ninja.findFirst({
    where: { slug, ...(options.includeUnpublished ? {} : { status: CONTENT_STATUSES.PUBLISHED }) },
    include: detailInclude,
  });
  if (!n) return null;

  const picks = options.viewerId
    ? await db.userTalentSelection.findMany({
        where: { userId: options.viewerId, option: { group: { ninjaId: n.id } } },
        select: { optionId: true },
      })
    : [];
  const picked = new Set(picks.map((s) => s.optionId));

  const resolved = resolveFormation({ formation: n.formation, role: n.role });
  // A card label only takes another position's rule once their equivalence is approved.
  const primary = resolved ? ruleFormation<{ primaryStatistic: { key: string; name: string } | null }>(resolved.formation).primaryStatistic : null;
  const primaryStat = primary && { key: primary.key, name: primary.name };

  return {
    id: n.id,
    slug: n.slug,
    name: n.name,
    nameEs: n.nameEs,
    description: n.description,
    descriptionEs: n.descriptionEs,
    translationStatus: n.translationStatus as TranslationStatus,
    imageUrl: n.imageUrl,
    status: n.status,
    reviewStatus: n.reviewStatus as ReviewStatus,
    release: releaseOf(n),
    releaseOrder: n.releaseOrder,
    rating: n.rating && { key: n.rating.key, name: n.rating.name },
    type: n.ninjaType && { key: n.ninjaType.key, name: n.ninjaType.name, nameEs: n.ninjaType.nameEs },
    role: n.role && {
      key: n.role.key,
      name: n.role.name,
      mappingStatus: n.role.mappingStatus as MappingStatus,
      proposedFormationName: n.role.mappedFormation?.name ?? null,
    },
    formation: resolved && {
      key: resolved.formation.key,
      name: resolved.formation.name,
      nameEs: resolved.formation.nameEs,
      origin: resolved.origin,
      equivalence:
        resolved.formation.equivalentTo && resolved.formation.equivalenceStatus !== "NONE"
          ? {
              status: resolved.formation.equivalenceStatus as EquivalenceStatus,
              toName: resolved.formation.equivalentTo.name,
              toNameEs: resolved.formation.equivalentTo.nameEs,
              note: resolved.formation.equivalenceNote,
            }
          : null,
    },
    primaryStat,
    aliases: n.aliases.map((a) => ({ alias: a.alias, kind: a.kind as AliasKind, status: a.status as AliasStatus, locale: a.locale, note: a.note })),
    clientCombatClass: n.clientCombatClass as CombatClass | null,
    natures: n.natures.map((x) => ({ key: x.nature.key, name: x.nature.nameEs ?? x.nature.name })),
    baseStats: n.baseStats.map((s) => ({
      statisticKey: s.statistic.key,
      statisticName: s.statistic.name,
      sourceLabel: s.sourceLabel,
      baseValue: s.baseValue.toString(),
      growthRate: s.growthRate?.toString() ?? null,
      isPrimary: primaryStat?.key === s.statistic.key,
    })),
    abilities: n.abilities.map((a) => ({ ...toAbilityDetail(a), awakenings: a.awakenings.map(toAwakeningDetail) })),
    talentGroups: n.talentGroups.map((g) => ({
      id: g.id,
      name: g.name,
      selectionMode: g.selectionMode as SelectionMode,
      minSelections: g.minSelections,
      maxSelections: g.maxSelections,
      reviewStatus: g.reviewStatus as ReviewStatus,
      note: g.note,
      options: g.options.map((o) => ({
        id: o.id,
        name: o.name,
        nameEs: o.nameEs,
        cardLabel: o.cardLabel,
        cardLabelCut: o.cardLabelCut,
        sourceHeading: o.sourceHeading,
        description: o.description,
        descriptionEs: o.descriptionEs,
        translationStatus: o.translationStatus as TranslationStatus,
        note: o.note,
        reviewStatus: o.reviewStatus as ReviewStatus,
        isDefault: o.isDefault,
        effects: o.effects.map(toEffectView),
        awakenings: o.awakenings.map(toAwakeningDetail),
      })),
      selectedOptionIds: g.options.filter((o) => picked.has(o.id)).map((o) => o.id),
    })),
    sources: n.sourceRecords.map((r) => ({
      assetPath: r.asset.path,
      section: r.section,
      field: r.field,
      sourceText: r.sourceText,
      reviewStatus: r.reviewStatus as ReviewStatus,
      ambiguityNote: r.ambiguityNote,
    })),
  };
}
