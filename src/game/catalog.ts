import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { CONTENT_STATUSES, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, type ReviewStatus, type ValueType } from "../domain/constants";
import type { EffectView } from "../domain/effects";
import { normalizeTerm } from "../domain/localize";
import { slugify } from "../domain/slug";
import { inTransaction, parseInput, UnknownReferenceError, type Db } from "./db";
import { effectsArgs, replaceEffects, toEffectView } from "./effects";
import { getEquipmentSet, getJewelrySet, type EquipmentSetDetail, type JewelrySetDetail } from "./items";
import { listNinjas, type Page } from "./ninjas";
import { CI } from "../server/search-mode";
import {
  equipmentInput,
  gemInput,
  itemListParams,
  effectInput,
  jewelryInput,
  type EquipmentInput,
  type GemInput,
  type ItemKind,
  type ItemListParams,
  type JewelryInput,
} from "./schemas";

/**
 * Read and write side of single catalogue items (equipment, jewelry, gems): lists with search,
 * filters and statistic sorting, detail views, and the administrator's save / delete operations.
 */

// ───────────────────────── Lists ─────────────────────────

export interface ItemStat {
  statisticKey: string;
  statisticName: string;
  value: number | null;
  valueType: ValueType;
}

export interface ItemSummary {
  kind: ItemKind;
  slug: string;
  name: string;
  nameEs: string | null;
  categoryName: string | null;
  setSlug: string | null;
  setName: string | null;
  status: string;
  reviewStatus: ReviewStatus | null;
  stats: ItemStat[];
  /** Present when the list is sorted by a statistic: that statistic's value (the highest one if the piece lists it twice). */
  sortStat: { key: string; value: number | null } | null;
}

const statRows = { include: { statistic: true }, where: { statisticId: { not: null } }, orderBy: { sortOrder: "asc" } } as const;

const toStats = (effects: { statistic: { key: string; name: string } | null; value: Prisma.Decimal | null; valueType: string }[]): ItemStat[] =>
  effects
    .filter((e) => e.statistic)
    .map((e) => ({ statisticKey: e.statistic!.key, statisticName: e.statistic!.name, value: e.value === null ? null : Number(e.value.toString()), valueType: e.valueType as ValueType }));

const valueRange = (f: { min?: string | null; max?: string | null }) => ({
  ...(f.min != null ? { gte: f.min } : {}),
  ...(f.max != null ? { lte: f.max } : {}),
});

/** Where-clause shared by the three kinds. Values inside one filter are ORed, different filters are ANDed. */
function itemWhere(p: ReturnType<typeof itemListParams.parse>): Prisma.EquipmentWhereInput & Prisma.JewelryWhereInput & Prisma.GemWhereInput {
  const and: Prisma.EquipmentWhereInput[] = [];
  if (!p.includeUnpublished) and.push({ status: CONTENT_STATUSES.PUBLISHED });
  if (p.query) {
    const q = p.query;
    const slugQuery = slugify(q);
    const or: Record<string, unknown>[] = [{ name: { contains: q, ...CI } }];
    if (p.kind !== "gem") or.push({ nameEs: { contains: q, ...CI } }, { set: { OR: [{ name: { contains: q, ...CI } }, { nameEs: { contains: q, ...CI } }] } });
    if (slugQuery) or.push({ slug: { contains: slugQuery } });
    and.push({ OR: or } as Prisma.EquipmentWhereInput);
  }
  if (p.typeKeys?.length) {
    and.push((p.kind === "equipment" ? { slot: { key: { in: p.typeKeys } } } : p.kind === "jewelry" ? { type: { key: { in: p.typeKeys } } } : { gemType: { key: { in: p.typeKeys } } }) as Prisma.EquipmentWhereInput);
  }
  if (p.setSlugs?.length && p.kind !== "gem") and.push({ set: { slug: { in: p.setSlugs } } });
  for (const f of p.statFilters ?? []) and.push({ effects: { some: { statistic: { key: f.statisticKey }, value: valueRange(f) } } });
  if (p.statisticKeys?.length) and.push({ effects: { some: { statistic: { key: { in: p.statisticKeys } } } } });
  return { AND: and } as never;
}

/** One page of items. Default order: name. Sorting by a statistic puts pieces without it last in either direction. */
export async function listItems(db: Db, params: ItemListParams): Promise<Page<ItemSummary>> {
  const p = parseInput(itemListParams, params, "item list parameters");
  const pageSize = Math.min(p.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const skip = (p.page - 1) * pageSize;
  const where = itemWhere(p);
  const sort = p.sort ?? { by: "name" as const, direction: "asc" as const, statisticKey: null };

  // The three tables share the columns used here; the casts keep one code path for all of them.
  type Row = {
    id: string;
    slug: string;
    name: string;
    nameEs?: string | null;
    status: string;
    reviewStatus?: string;
    slot?: { name: string; nameEs: string | null } | null;
    type?: { name: string; nameEs: string | null } | null;
    gemType?: { name: string } | null;
    level?: number | null;
    set?: { slug: string; name: string } | null;
    effects: { statistic: { key: string; name: string } | null; value: Prisma.Decimal | null; valueType: string }[];
  };
  const table = (p.kind === "equipment" ? db.equipment : p.kind === "jewelry" ? db.jewelry : db.gem) as unknown as {
    findMany: (a: unknown) => Promise<Row[]>;
    count: (a: unknown) => Promise<number>;
  };
  const include = {
    ...(p.kind === "equipment" ? { slot: true } : p.kind === "jewelry" ? { type: true } : { gemType: true }),
    ...(p.kind === "gem" ? {} : { set: { select: { slug: true, name: true } } }),
    effects: statRows,
  };
  const total = await table.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const summarize = (r: Row, sortStat: ItemSummary["sortStat"]): ItemSummary => ({
    kind: p.kind,
    slug: r.slug,
    name: r.name,
    nameEs: r.nameEs ?? null,
    categoryName: (r.slot?.name ?? r.type?.name ?? r.gemType?.name ?? null) as string | null,
    setSlug: r.set?.slug ?? null,
    setName: r.set?.name ?? null,
    status: r.status,
    reviewStatus: (r.reviewStatus as ReviewStatus | undefined) ?? null,
    stats: toStats(r.effects),
    sortStat,
  });

  if (sort.by === "stat") {
    const all = await table.findMany({ where, include: { effects: statRows } });
    const best = (r: Row) => {
      const values = r.effects.filter((e) => e.statistic?.key === sort.statisticKey && e.value !== null).map((e) => Number(e.value!.toString()));
      return values.length ? Math.max(...values) : null;
    };
    const dir = sort.direction === "asc" ? 1 : -1;
    const ordered = [...all].sort((a, b) => {
      const x = best(a);
      const y = best(b);
      if (x === null && y === null) return a.name.localeCompare(b.name);
      if (x === null) return 1;
      if (y === null) return -1;
      return x === y ? a.name.localeCompare(b.name) : (x - y) * dir;
    });
    const ids = ordered.slice(skip, skip + pageSize).map((r) => r.id);
    const rows = await table.findMany({ where: { id: { in: ids } }, include });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const items = ids.map((id) => {
      const r = byId.get(id)!;
      return summarize(r, { key: sort.statisticKey!, value: best(r) });
    });
    return { items, total, page: p.page, pageSize, pageCount };
  }
  const rows = await table.findMany({ where, include, orderBy: [{ name: sort.direction }, { id: "asc" }], skip, take: pageSize });
  return { items: rows.map((r) => summarize(r, null)), total, page: p.page, pageSize, pageCount };
}

/** What a filter form needs: the categories, sets and statistics that actually occur. */
export async function listItemFacets(db: Db, kind: ItemKind, includeUnpublished = false) {
  const published = includeUnpublished ? {} : { status: CONTENT_STATUSES.PUBLISHED };
  const ownedEffects = { effects: { some: { statisticId: { not: null } } }, ...published };
  const [categories, sets, statistics] = await Promise.all([
    kind === "equipment"
      ? db.equipmentSlot.findMany({ orderBy: { sortOrder: "asc" }, select: { key: true, name: true, nameEs: true } })
      : kind === "jewelry"
        ? db.jewelryType.findMany({ orderBy: { sortOrder: "asc" }, select: { key: true, name: true, nameEs: true } })
        : db.gemType.findMany({ orderBy: { sortOrder: "asc" }, select: { key: true, name: true } }),
    kind === "equipment"
      ? db.equipmentSet.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true, nameEs: true } })
      : kind === "jewelry"
        ? db.jewelrySet.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true, nameEs: true } })
        : Promise.resolve([] as { slug: string; name: string; nameEs: string | null }[]),
    db.statistic.findMany({
      where: { effects: { some: kind === "equipment" ? { equipment: ownedEffects } : kind === "jewelry" ? { jewelry: ownedEffects } : { gem: ownedEffects } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { key: true, name: true, nameEs: true },
    }),
  ]);
  return {
    categories: categories.map((c) => ({ key: c.key, name: (("nameEs" in c ? c.nameEs : null) ?? c.name) as string })),
    sets: sets.map((s) => ({ slug: s.slug, name: s.nameEs ?? s.name })),
    statistics: statistics.map((s) => ({ key: s.key, name: s.nameEs ?? s.name })),
  };
}

// ───────────────────────── Detail ─────────────────────────

export interface ItemDetail {
  kind: ItemKind;
  id: string;
  slug: string;
  name: string;
  nameEs: string | null;
  description: string | null;
  descriptionEs: string | null;
  categoryKey: string | null;
  categoryName: string | null;
  level: number | null;
  status: string;
  reviewStatus: ReviewStatus | null;
  /** The piece's own effects. Set tiers are in `set` and are never added in here. */
  effects: EffectView[];
  set: { kind: "equipment"; detail: EquipmentSetDetail } | { kind: "jewelry"; detail: JewelrySetDetail } | null;
  sources: { assetPath: string; section: string | null; sourceText: string | null; reviewStatus: ReviewStatus; ambiguityNote: string | null }[];
}

const sourcesArgs = { orderBy: { key: "asc" }, include: { asset: { select: { path: true } } } } as const;
const toSources = (rows: { asset: { path: string }; section: string | null; sourceText: string | null; reviewStatus: string; ambiguityNote: string | null }[]) =>
  rows.map((r) => ({ assetPath: r.asset.path, section: r.section, sourceText: r.sourceText, reviewStatus: r.reviewStatus as ReviewStatus, ambiguityNote: r.ambiguityNote }));

export async function getItemDetail(db: Db, kind: ItemKind, slug: string, options: { includeUnpublished?: boolean } = {}): Promise<ItemDetail | null> {
  const published = options.includeUnpublished ? {} : { status: CONTENT_STATUSES.PUBLISHED };
  if (kind === "equipment") {
    const e = await db.equipment.findFirst({ where: { slug, ...published }, include: { slot: true, set: { select: { slug: true } }, effects: effectsArgs, sourceRecords: sourcesArgs } });
    if (!e) return null;
    return {
      kind, id: e.id, slug: e.slug, name: e.name, nameEs: e.nameEs, description: e.description, descriptionEs: e.descriptionEs,
      categoryKey: e.slot?.key ?? null, categoryName: e.slot?.nameEs ?? e.slot?.name ?? null, level: null, status: e.status, reviewStatus: e.reviewStatus as ReviewStatus,
      effects: e.effects.map(toEffectView),
      set: e.set ? { kind: "equipment", detail: (await getEquipmentSet(db, e.set.slug))! } : null,
      sources: toSources(e.sourceRecords),
    };
  }
  if (kind === "jewelry") {
    const j = await db.jewelry.findFirst({ where: { slug, ...published }, include: { type: true, set: { select: { slug: true } }, effects: effectsArgs, sourceRecords: sourcesArgs } });
    if (!j) return null;
    return {
      kind, id: j.id, slug: j.slug, name: j.name, nameEs: j.nameEs, description: j.description, descriptionEs: j.descriptionEs,
      categoryKey: j.type?.key ?? null, categoryName: j.type?.nameEs ?? j.type?.name ?? null, level: null, status: j.status, reviewStatus: j.reviewStatus as ReviewStatus,
      effects: j.effects.map(toEffectView),
      set: j.set ? { kind: "jewelry", detail: (await getJewelrySet(db, j.set.slug))! } : null,
      sources: toSources(j.sourceRecords),
    };
  }
  const g = await db.gem.findFirst({ where: { slug, ...published }, include: { gemType: true, effects: effectsArgs, sourceRecords: sourcesArgs } });
  if (!g) return null;
  return {
    kind, id: g.id, slug: g.slug, name: g.name, nameEs: null, description: g.description, descriptionEs: null,
    categoryKey: g.gemType?.key ?? null, categoryName: g.gemType?.name ?? null, level: g.level, status: g.status, reviewStatus: null,
    effects: g.effects.map(toEffectView), set: null, sources: toSources(g.sourceRecords),
  };
}

// ───────────────────────── Search across everything ─────────────────────────

export interface SearchResults {
  query: string;
  ninjas: { slug: string; name: string; nameEs: string | null; matchedAlias: string | null }[];
  equipment: { slug: string; name: string; nameEs: string | null }[];
  jewelry: { slug: string; name: string; nameEs: string | null }[];
  gems: { slug: string; name: string }[];
  sets: { kind: "equipment" | "jewelry"; slug: string; name: string; nameEs: string | null }[];
  statuses: { key: string; name: string; nameEs: string | null }[];
}

/** One search box over ninjas (names and aliases), items, sets and the effect glossary. Bounded per group. */
export async function searchAll(db: Db, query: string, options: { includeGems?: boolean; includeUnpublished?: boolean; limit?: number } = {}): Promise<SearchResults> {
  const q = query.trim();
  const limit = Math.min(options.limit ?? 12, 30);
  const empty: SearchResults = { query: q, ninjas: [], equipment: [], jewelry: [], gems: [], sets: [], statuses: [] };
  if (!q) return empty;
  const norm = normalizeTerm(q);
  const slugQuery = slugify(q);
  const published = options.includeUnpublished ? {} : { status: CONTENT_STATUSES.PUBLISHED };
  const byName = (extra: object[] = []) => ({ OR: [{ name: { contains: q, ...CI } }, { nameEs: { contains: q, ...CI } }, ...(slugQuery ? [{ slug: { contains: slugQuery } }] : []), ...extra] });

  const [ninjas, equipment, jewelry, gems, eqSets, jwSets, statuses] = await Promise.all([
    listNinjas(db, { query: q, pageSize: limit, includeUnpublished: options.includeUnpublished }),
    db.equipment.findMany({ where: { ...published, ...byName() }, take: limit, orderBy: { name: "asc" }, select: { slug: true, name: true, nameEs: true } }),
    db.jewelry.findMany({ where: { ...published, ...byName() }, take: limit, orderBy: { name: "asc" }, select: { slug: true, name: true, nameEs: true } }),
    options.includeGems ? db.gem.findMany({ where: { ...published, OR: [{ name: { contains: q, ...CI } }, ...(slugQuery ? [{ slug: { contains: slugQuery } }] : [])] }, take: limit, orderBy: { name: "asc" }, select: { slug: true, name: true } }) : Promise.resolve([]),
    db.equipmentSet.findMany({ where: byName(), take: limit, orderBy: { name: "asc" }, select: { slug: true, name: true, nameEs: true } }),
    db.jewelrySet.findMany({ where: byName(), take: limit, orderBy: { name: "asc" }, select: { slug: true, name: true, nameEs: true } }),
    db.statusEffect.findMany({
      where: { OR: [{ name: { contains: q, ...CI } }, { nameEs: { contains: q, ...CI } }, { aliases: { some: { normalized: { contains: norm } } } }] },
      take: limit, orderBy: { name: "asc" }, select: { key: true, name: true, nameEs: true },
    }),
  ]);
  // Which alias made a ninja match, so a search for «Might Gai» can say it found Might Guy.
  const aliases = ninjas.items.length
    ? await db.ninjaAlias.findMany({ where: { ninja: { slug: { in: ninjas.items.map((n) => n.slug) } }, normalized: { contains: norm } }, select: { alias: true, ninja: { select: { slug: true } } } })
    : [];
  const aliasOf = new Map(aliases.map((a) => [a.ninja.slug, a.alias]));
  return {
    query: q,
    ninjas: ninjas.items.map((n) => ({
      slug: n.slug, name: n.name, nameEs: n.nameEs,
      matchedAlias: n.name.toLowerCase().includes(q.toLowerCase()) ? null : (aliasOf.get(n.slug) ?? null),
    })),
    equipment, jewelry, gems,
    sets: [...eqSets.map((s) => ({ kind: "equipment" as const, ...s })), ...jwSets.map((s) => ({ kind: "jewelry" as const, ...s }))].slice(0, limit),
    statuses,
  };
}

// ───────────────────────── Administration: save and delete ─────────────────────────

async function lookup(find: () => Promise<{ id: string } | null>, kind: string, key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  const row = await find();
  if (!row) throw new UnknownReferenceError(kind, key);
  return row.id;
}

export async function saveEquipment(db: Db, input: EquipmentInput, options: { effectsMode?: "all" | "simple" } = {}): Promise<{ id: string; slug: string; created: boolean }> {
  const d = parseInput(equipmentInput, input, "equipment");
  const slug = d.slug ?? slugify(d.name);
  if (!slug) throw new UnknownReferenceError("slug for equipment name", d.name);
  return inTransaction(db, async (tx) => {
    const values = {
      name: d.name, nameEs: d.nameEs ?? null, description: d.description ?? null, descriptionEs: d.descriptionEs ?? null,
      translationStatus: d.translationStatus, status: d.status, reviewStatus: d.reviewStatus,
      slotId: await lookup(() => tx.equipmentSlot.findUnique({ where: { key: d.slotKey ?? "" }, select: { id: true } }), "equipment slot", d.slotKey),
      setId: await lookup(() => tx.equipmentSet.findUnique({ where: { slug: d.setSlug ?? "" }, select: { id: true } }), "equipment set", d.setSlug),
    };
    const existing = await tx.equipment.findUnique({ where: { slug }, select: { id: true } });
    const row = existing
      ? await tx.equipment.update({ where: { slug }, data: values, select: { id: true } })
      : await tx.equipment.create({ data: { slug, ...values }, select: { id: true } });
    await replaceEffects(tx, { equipmentId: row.id }, d.effects, options.effectsMode);
    return { id: row.id, slug, created: !existing };
  });
}

export async function saveJewelry(db: Db, input: JewelryInput, options: { effectsMode?: "all" | "simple" } = {}): Promise<{ id: string; slug: string; created: boolean }> {
  const d = parseInput(jewelryInput, input, "jewelry");
  const slug = d.slug ?? slugify(d.name);
  if (!slug) throw new UnknownReferenceError("slug for jewelry name", d.name);
  return inTransaction(db, async (tx) => {
    const setId = await lookup(() => tx.jewelrySet.findUnique({ where: { slug: d.setSlug ?? "" }, select: { id: true } }), "jewelry set", d.setSlug);
    const groupId = d.groupKey
      ? await lookup(() => (setId ? tx.jewelryGroup.findUnique({ where: { setId_key: { setId, key: d.groupKey! } }, select: { id: true } }) : Promise.resolve(null)), "jewelry group of that set", d.groupKey)
      : null;
    const values = {
      name: d.name, nameEs: d.nameEs ?? null, description: d.description ?? null, descriptionEs: d.descriptionEs ?? null,
      translationStatus: d.translationStatus, status: d.status, reviewStatus: d.reviewStatus,
      typeId: await lookup(() => tx.jewelryType.findUnique({ where: { key: d.typeKey ?? "" }, select: { id: true } }), "jewelry type", d.typeKey),
      setId, groupId,
    };
    const existing = await tx.jewelry.findUnique({ where: { slug }, select: { id: true } });
    const row = existing
      ? await tx.jewelry.update({ where: { slug }, data: values, select: { id: true } })
      : await tx.jewelry.create({ data: { slug, ...values }, select: { id: true } });
    await replaceEffects(tx, { jewelryId: row.id }, d.effects, options.effectsMode);
    return { id: row.id, slug, created: !existing };
  });
}

export async function saveGem(db: Db, input: GemInput, options: { effectsMode?: "all" | "simple" } = {}): Promise<{ id: string; slug: string; created: boolean }> {
  const d = parseInput(gemInput, input, "gem");
  const slug = d.slug ?? slugify(d.name);
  if (!slug) throw new UnknownReferenceError("slug for gem name", d.name);
  return inTransaction(db, async (tx) => {
    const values = {
      name: d.name, description: d.description ?? null, level: d.level ?? null, status: d.status,
      gemTypeId: await lookup(() => tx.gemType.findUnique({ where: { key: d.typeKey ?? "" }, select: { id: true } }), "gem type", d.typeKey),
    };
    const existing = await tx.gem.findUnique({ where: { slug }, select: { id: true } });
    const row = existing
      ? await tx.gem.update({ where: { slug }, data: values, select: { id: true } })
      : await tx.gem.create({ data: { slug, ...values }, select: { id: true } });
    await replaceEffects(tx, { gemId: row.id }, d.effects, options.effectsMode);
    return { id: row.id, slug, created: !existing };
  });
}

/** Removes one record and everything it owns (effects, conditions, evidence links). Returns false when it did not exist. */
export const deletions = {
  ninja: async (db: Db, slug: string) => (await db.ninja.deleteMany({ where: { slug } })).count > 0,
  equipment: async (db: Db, slug: string) => (await db.equipment.deleteMany({ where: { slug } })).count > 0,
  jewelry: async (db: Db, slug: string) => (await db.jewelry.deleteMany({ where: { slug } })).count > 0,
  gem: async (db: Db, slug: string) => (await db.gem.deleteMany({ where: { slug } })).count > 0,
  /** Pieces of a deleted set stay as pieces without a set. */
  equipmentSet: async (db: Db, slug: string) => (await db.equipmentSet.deleteMany({ where: { slug } })).count > 0,
  jewelrySet: async (db: Db, slug: string) => (await db.jewelrySet.deleteMany({ where: { slug } })).count > 0,
};

// ───────────────────────── Filter options for the ninja list ─────────────────────────

/**
 * The choices a ninja filter form offers. Formations are merged by APPROVED equivalence: «Assaulter»
 * and «Center» are one position, shown once under the client's name with the card label noted.
 */
export async function listNinjaFacets(db: Db) {
  const [ratings, formations, types, roles, statistics] = await Promise.all([
    db.ninjaRating.findMany({ orderBy: { sortOrder: "asc" }, select: { key: true, name: true } }),
    db.formation.findMany({ orderBy: { sortOrder: "asc" }, select: { key: true, name: true, nameEs: true, equivalenceStatus: true, equivalentTo: { select: { key: true } } } }),
    db.ninjaType.findMany({ orderBy: { sortOrder: "asc" }, select: { key: true, name: true, nameEs: true } }),
    db.ninjaRole.findMany({ orderBy: { sortOrder: "asc" }, select: { key: true, name: true, nameEs: true } }),
    db.statistic.findMany({ where: { baseStats: { some: {} } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { key: true, name: true, nameEs: true } }),
  ]);
  const hidden = new Set(formations.filter((f) => f.equivalenceStatus === "APPROVED" && f.equivalentTo).map((f) => f.key));
  const cardLabel = new Map(formations.filter((f) => f.equivalenceStatus === "APPROVED" && f.equivalentTo).map((f) => [f.equivalentTo!.key, f.name]));
  return {
    ratings,
    /** Every formation row, card labels included (administrator forms assign the label printed on the card). */
    allFormations: formations.map((f) => ({ key: f.key, name: f.nameEs ? `${f.nameEs} (${f.name})` : f.name })),
    formations: formations.filter((f) => !hidden.has(f.key)).map((f) => ({ key: f.key, name: f.nameEs ?? f.name, cardLabel: cardLabel.get(f.key) ?? null })),
    types: types.map((t) => ({ key: t.key, name: t.nameEs ?? t.name })),
    roles: roles.map((r) => ({ key: r.key, name: r.nameEs ?? r.name })),
    /** Statistics a ninja has as a base value: what the min/max filters and the sort can use. */
    statistics: statistics.map((s) => ({ key: s.key, name: s.nameEs ?? s.name })),
  };
}

// ───────────────────────── Administration: sets and effect glossary ─────────────────────────

const setBasics = z.object({
  name: z.string().trim().min(1).max(300),
  nameEs: z.string().trim().max(300).nullish(),
  description: z.string().trim().max(8000).nullish(),
  descriptionEs: z.string().trim().max(8000).nullish(),
  tierStacking: z.enum(["UNKNOWN", "CUMULATIVE", "REPLACES"]).default("UNKNOWN"),
  reviewStatus: z.enum(["CONFIRMED", "PARTIALLY_CONFIRMED", "NEEDS_REVIEW"]).default("NEEDS_REVIEW"),
});
export type SetBasicsInput = z.input<typeof setBasics>;

/**
 * Changes only the descriptive fields of a jewelry set. Its pieces, sub-groups and bonuses are left exactly as
 * they are, which a full upsert of the set would not do.
 */
export async function updateJewelrySetBasics(db: Db, slug: string, input: SetBasicsInput & { structureStatus?: "UNCONFIRMED" | "CONFIRMED" }): Promise<void> {
  const d = parseInput(setBasics.extend({ structureStatus: z.enum(["UNCONFIRMED", "CONFIRMED"]).default("UNCONFIRMED") }), input, "jewelry set");
  const result = await db.jewelrySet.updateMany({
    where: { slug },
    data: { name: d.name, nameEs: d.nameEs ?? null, description: d.description ?? null, descriptionEs: d.descriptionEs ?? null, tierStacking: d.tierStacking, reviewStatus: d.reviewStatus, structureStatus: d.structureStatus },
  });
  if (result.count === 0) throw new UnknownReferenceError("jewelry set", slug);
}

/** Same for an equipment set: names, description and stacking status; the pieces and tiers are not touched. */
export async function updateEquipmentSetBasics(db: Db, slug: string, input: SetBasicsInput): Promise<void> {
  const d = parseInput(setBasics, input, "equipment set");
  const result = await db.equipmentSet.updateMany({
    where: { slug },
    data: { name: d.name, nameEs: d.nameEs ?? null, description: d.description ?? null, descriptionEs: d.descriptionEs ?? null, tierStacking: d.tierStacking, reviewStatus: d.reviewStatus },
  });
  if (result.count === 0) throw new UnknownReferenceError("equipment set", slug);
}

const tierInput = z.object({ requiredPieces: z.number().int().min(1).max(99), description: z.string().trim().max(2000).nullish(), effects: z.array(effectInput).default([]) });
export type TierInput = z.input<typeof tierInput>;

/** Adds or replaces the tier that needs N pieces of the whole set. Other tiers are untouched. */
export async function saveSetTier(db: Db, kind: "equipment" | "jewelry", slug: string, input: TierInput): Promise<{ id: string }> {
  const d = parseInput(tierInput, input, "set tier");
  return inTransaction(db, async (tx) => {
    if (kind === "equipment") {
      const set = await tx.equipmentSet.findUnique({ where: { slug }, select: { id: true } });
      if (!set) throw new UnknownReferenceError("equipment set", slug);
      const bonus = await tx.equipmentSetBonus.upsert({
        where: { setId_requiredPieces: { setId: set.id, requiredPieces: d.requiredPieces } },
        update: { description: d.description ?? null },
        create: { setId: set.id, requiredPieces: d.requiredPieces, description: d.description ?? null },
        select: { id: true },
      });
      await replaceEffects(tx, { equipmentSetBonusId: bonus.id }, d.effects);
      return { id: bonus.id };
    }
    const set = await tx.jewelrySet.findUnique({ where: { slug }, select: { id: true } });
    if (!set) throw new UnknownReferenceError("jewelry set", slug);
    const existing = await tx.jewelrySetBonus.findFirst({ where: { setId: set.id, groupId: null, requirementKind: "PIECE_COUNT", requiredPieces: d.requiredPieces }, select: { id: true } });
    const bonus = existing
      ? await tx.jewelrySetBonus.update({ where: { id: existing.id }, data: { description: d.description ?? null }, select: { id: true } })
      : await tx.jewelrySetBonus.create({
          data: { setId: set.id, requirementKind: "PIECE_COUNT", requiredPieces: d.requiredPieces, description: d.description ?? null, sortOrder: await tx.jewelrySetBonus.count({ where: { setId: set.id } }) },
          select: { id: true },
        });
    await replaceEffects(tx, { jewelrySetBonusId: bonus.id }, d.effects);
    return { id: bonus.id };
  });
}

export async function deleteSetTier(db: Db, kind: "equipment" | "jewelry", id: string): Promise<boolean> {
  return kind === "equipment" ? (await db.equipmentSetBonus.deleteMany({ where: { id } })).count > 0 : (await db.jewelrySetBonus.deleteMany({ where: { id } })).count > 0;
}

const statusBasics = z.object({
  name: z.string().trim().min(1).max(200),
  nameEs: z.string().trim().max(200).nullish(),
  description: z.string().trim().max(4000).nullish(),
  descriptionEs: z.string().trim().max(4000).nullish(),
  polarity: z.enum(["BUFF", "DEBUFF", "NEUTRAL", "UNKNOWN"]).default("UNKNOWN"),
  cleansability: z.enum(["CLEANSABLE", "UNCLEANSABLE", "CONDITIONAL", "UNKNOWN"]).default("UNKNOWN"),
  note: z.string().trim().max(4000).nullish(),
});
export type StatusBasicsInput = z.input<typeof statusBasics>;

/** Edits a status or term of the glossary without touching its default numbers, categories or aliases. */
export async function updateStatusBasics(db: Db, key: string, input: StatusBasicsInput): Promise<void> {
  const d = parseInput(statusBasics, input, "status");
  const result = await db.statusEffect.updateMany({
    where: { key },
    data: {
      name: d.name, nameEs: d.nameEs ?? null, description: d.description ?? null, descriptionEs: d.descriptionEs ?? null,
      translationStatus: d.descriptionEs || d.nameEs ? "DRAFT" : "MISSING", polarity: d.polarity, cleansability: d.cleansability, note: d.note ?? null,
    },
  });
  if (result.count === 0) throw new UnknownReferenceError("status", key);
}

/** A status that usages still refer to cannot be removed: the database refuses and the caller says so. */
export async function deleteStatus(db: Db, key: string): Promise<boolean> {
  return (await db.statusEffect.deleteMany({ where: { key } })).count > 0;
}

/** Statistics by category, e.g. «base» for the four values a ninja card prints. */
export async function listStatistics(db: Db, category?: string) {
  const rows = await db.statistic.findMany({ where: category ? { category } : {}, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { key: true, name: true, nameEs: true } });
  return rows.map((r) => ({ key: r.key, name: r.nameEs ?? r.name }));
}

/** Everything the item forms offer in their drop-downs. */
export async function listItemChoices(db: Db) {
  const [slots, jewelryTypes, gemTypes, equipmentSets, jewelrySets, statistics] = await Promise.all([
    db.equipmentSlot.findMany({ orderBy: { sortOrder: "asc" }, select: { key: true, name: true, nameEs: true } }),
    db.jewelryType.findMany({ orderBy: { sortOrder: "asc" }, select: { key: true, name: true, nameEs: true } }),
    db.gemType.findMany({ orderBy: { sortOrder: "asc" }, select: { key: true, name: true } }),
    db.equipmentSet.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true, nameEs: true } }),
    db.jewelrySet.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true, nameEs: true, groups: { select: { key: true, name: true } } } }),
    listStatistics(db),
  ]);
  return {
    slots: slots.map((x) => ({ value: x.key, label: x.nameEs ?? x.name })),
    jewelryTypes: jewelryTypes.map((x) => ({ value: x.key, label: x.nameEs ?? x.name })),
    gemTypes: gemTypes.map((x) => ({ value: x.key, label: x.name })),
    equipmentSets: equipmentSets.map((x) => ({ value: x.slug, label: x.nameEs ?? x.name })),
    jewelrySets: jewelrySets.map((x) => ({ value: x.slug, label: x.nameEs ?? x.name, groups: x.groups.map((g) => ({ value: g.key, label: g.name })) })),
    statistics: statistics.map((x) => ({ value: x.key, label: x.name })),
  };
}
