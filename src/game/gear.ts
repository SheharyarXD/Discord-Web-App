import { z } from "zod";
import { normalizeTerm } from "../domain/localize";
import type { ReviewStatus } from "../domain/constants";
import type { Db } from "./db";
import { parseInput } from "./db";
import { analyseEffects, compareRanks, type EffectEvidence, type EffectRank, type FullSetInfo } from "./effect-search";
import { statFilter } from "./schemas";
import type { Page } from "./ninjas";

/**
 * Catalogue of equipment and jewelry set VERSIONS. A named set (Sand Burial) has up to two categories, equipment and jewelry,
 * each with one or more versions (base, R1, R2, SSR5, or unlabeled variants A and B). Every version is its own row with its own
 * printed statistics and tiers: nothing is merged and no version is presented as equipped together with another.
 */

export const GEAR_KINDS = ["equipment", "jewelry"] as const;
export type GearKind = (typeof GEAR_KINDS)[number];
export const VERSION_FILTERS = ["base", "labelled", "variant"] as const;

export const gearListParams = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(24),
  kinds: z.array(z.enum(GEAR_KINDS)).optional(),
  /** Name, source title (MEKA), version label, ignoring case and accents. */
  query: z.string().trim().max(120).optional(),
  /** base = the only or base version; labelled = R1, R2, SSR5 (printed or client stated); variant = unlabeled variants A, B, C. */
  versions: z.array(z.enum(VERSION_FILTERS)).optional(),
  /**
   * Bonus tier (2, 4, 6 for equipment; 2, 8 for jewelry). Without an effect: sets that have a bonus at one of these piece counts.
   * With an effect: the piece count the user equips. Bonuses accumulate (confirmed), so the effect qualifies when it is printed at that
   * tier or at a LOWER one, and the total of all those tiers is what is shown and ranked; an effect printed only at a HIGHER tier never
   * qualifies (a 2-piece search never shows 4 or 6 piece effects). With several tiers selected the highest one counts.
   */
  tiers: z.array(z.number().int().min(1).max(20)).optional(),
  /**
   * Jewelry slot (one at a time): the category of the piece. «agility» searches only the Agility category: its 2-piece bonus and the
   * set-wide bonus. Implies jewelry. The slots are the existing categories of every jewelry version, not a new field.
   */
  slot: z.enum(["force", "chakra", "agility", "power"]).optional(),
  /** Printed main statistic ranges, for example Speed at least 70000. Every filter must hold. */
  statFilters: z.array(statFilter).max(4).optional(),
  effectTerms: z.array(z.string().trim().min(1).max(80)).max(6).optional(),
  /** any = at least one selected effect (default), all = every selected effect. */
  effectMode: z.enum(["any", "all"]).default("any"),
  /** by "effect": the value of one selected effect, `effectTerm` (as typed; the first selected effect when omitted). */
  sort: z.object({ by: z.enum(["name", "stat", "effect"]).default("name"), statisticKey: z.string().nullish(), effectTerm: z.string().trim().max(80).nullish(), direction: z.enum(["asc", "desc"]).default("asc") }).optional(),
});
export type GearListParams = z.input<typeof gearListParams>;

export interface GearSetSummary {
  id: string;
  kind: GearKind;
  slug: string;
  familySlug: string | null;
  name: string;
  /** Name with the version: "Sand Burial R1", "Sange (variant A)". */
  title: string;
  versionKey: string | null;
  versionLabel: string | null;
  versionBasis: string | null;
  reviewStatus: ReviewStatus;
  pieceCount: number;
  /** Piece counts of the tiers, as stored. */
  thresholds: number[];
  /** Printed main statistics, as stored (equipment: six slots; jewelry: four categories). */
  stats: { key: string; name: string; value: string }[];
  /** Matching effect wording per tier when an effect filter is active. */
  evidence: EffectEvidence[];
  /** The total of the effect that controls sorting with the selected piece count (or the complete set), and the printed bonuses it adds. */
  rank: EffectRank | null;
  /** Jewelry: the set-wide (8 piece) bonus of the same version, with the total of the complete set when the same additive effect is printed there. */
  fullSet: FullSetInfo | null;
}

const title = (name: string, label: string | null, basis: string | null) => (!label ? name : basis === "SEQUENCE" ? `${name} (variant ${label})` : `${name} ${label}`);

export async function listGearSets(db: Db, params: GearListParams = {}): Promise<Page<GearSetSummary>> {
  const p = parseInput(gearListParams, params, "gear list parameters");
  // A slot is a property of jewelry: choosing one means jewelry only.
  const kinds: GearKind[] = p.slot ? ["jewelry"] : p.kinds?.length ? p.kinds : [...GEAR_KINDS];
  // The same restrictions are put in the database queries, so a set that cannot qualify is never read. Without an effect a tier means
  // "has a bonus at that piece count"; with an effect it means "N pieces equipped": a bonus at N or lower can qualify (they accumulate).
  const equipped = p.tiers?.length ? Math.max(...p.tiers) : undefined;
  const piecesWhere = p.effectTerms?.length ? { lte: equipped } : { in: p.tiers };
  const tierWhere = p.tiers?.length ? { bonuses: { some: { requiredPieces: piecesWhere } } } : {};
  const jewelryWhere = {
    ...(p.slot ? { groups: { some: { key: p.slot } } } : {}),
    ...(p.tiers?.length ? { bonuses: { some: { requiredPieces: piecesWhere, ...(p.slot ? { OR: [{ groupId: null }, { group: { key: p.slot } }] } : {}) } } } : {}),
  };

  const mainStats = { items: { select: { effects: { where: { note: "PRINTED_MAIN_STAT" }, select: { value: true, statistic: { select: { key: true, name: true } } } } } } };
  const rows: GearSetSummary[] = [];
  if (kinds.includes("equipment")) {
    const sets = await db.equipmentSet.findMany({
      where: { familyId: { not: null }, ...tierWhere },
      include: { family: { select: { slug: true, name: true, sourceTitle: true } }, bonuses: { select: { requiredPieces: true } }, ...mainStats },
    });
    for (const s of sets) rows.push(summary("equipment", s, s.items, s.bonuses.map((b) => b.requiredPieces)));
  }
  if (kinds.includes("jewelry")) {
    const sets = await db.jewelrySet.findMany({
      where: { familyId: { not: null }, ...jewelryWhere },
      include: { family: { select: { slug: true, name: true, sourceTitle: true } }, bonuses: { select: { requiredPieces: true } }, ...mainStats },
    });
    for (const s of sets) rows.push(summary("jewelry", s, s.items, s.bonuses.map((b) => b.requiredPieces)));
  }

  let found = rows;
  let effectActive = false;
  const evidence = new Map<string, EffectEvidence[]>();
  let ranks = new Map<string, EffectRank>();
  let fullSets = new Map<string, FullSetInfo>();
  if (p.effectTerms?.length) {
    const hit = await analyseEffects(db, kinds, p.effectTerms, p.effectMode, p.sort?.by === "effect" ? p.sort.effectTerm : null, { scope: { pieces: equipped, slot: p.slot }, fullSetTier: 8 });
    if (hit) {
      effectActive = true;
      fullSets = hit.fullSet;
      ranks = hit.ranks;
      for (const kind of kinds) {
        const ids = new Set(hit.perOwner[kind].ids);
        for (const [id, ev] of hit.perOwner[kind].evidence) evidence.set(id, ev);
        found = found.filter((r) => r.kind !== kind || ids.has(r.id));
      }
    }
  }
  const needle = p.query ? normalizeTerm(p.query) : "";
  const sourceTitles = new Map((await db.gearFamily.findMany({ select: { slug: true, sourceTitle: true } })).map((f) => [f.slug, f.sourceTitle]));
  found = found.filter((r) => {
    if (needle) {
      const hay = normalizeTerm(`${r.title} ${r.name} ${r.versionLabel ?? ""} ${sourceTitles.get(r.familySlug ?? "") ?? ""} ${r.slug}`);
      if (!needle.split(" ").every((w) => hay.includes(w))) return false;
    }
    if (p.versions?.length) {
      const kind = r.versionBasis === "SEQUENCE" ? "variant" : r.versionLabel ? "labelled" : "base";
      if (!p.versions.includes(kind)) return false;
    }
    // With an effect the analysis already applied the piece count (N or lower); without one the set must have a bonus at that count.
    if (p.tiers?.length && !effectActive && !p.tiers.some((t) => r.thresholds.includes(t))) return false;
    for (const f of p.statFilters ?? []) {
      const s = r.stats.find((x) => x.key === f.statisticKey);
      if (!s) return false;
      const v = Number(s.value);
      if (f.min != null && v < Number(f.min)) return false;
      if (f.max != null && v > Number(f.max)) return false;
    }
    return true;
  });
  for (const r of found) {
    r.evidence = evidence.get(r.id) ?? [];
    r.rank = ranks.get(`${r.kind}:${r.id}`) ?? null;
    r.fullSet = fullSets.get(`${r.kind}:${r.id}`) ?? null;
  }

  const sort = p.sort ?? { by: "name" as const, direction: "asc" as const, statisticKey: null };
  const dir = sort.direction === "asc" ? 1 : -1;
  const statOf = (r: GearSetSummary) => {
    const v = r.stats.find((s) => s.key === sort.statisticKey)?.value;
    return v === undefined ? null : Number(v);
  };
  found.sort((a, b) => {
    if (sort.by === "effect" && a.rank && b.rank) {
      const c = compareRanks(a.rank, b.rank, sort.direction);
      if (c !== 0) return c;
      // Equal on every printed value: alphabetical, then a fixed identity order.
      return a.name.localeCompare(b.name) || a.kind.localeCompare(b.kind) || (a.versionKey ?? "").localeCompare(b.versionKey ?? "") || a.slug.localeCompare(b.slug);
    }
    if (sort.by === "stat" && sort.statisticKey) {
      const x = statOf(a);
      const y = statOf(b);
      if (x === null && y !== null) return 1;
      if (y === null && x !== null) return -1;
      if (x !== null && y !== null && x !== y) return (x - y) * dir;
    } else {
      const c = a.name.localeCompare(b.name) * dir;
      if (c !== 0) return c;
    }
    // Stable, total order: name, then equipment before jewelry, then version.
    return a.name.localeCompare(b.name) || a.kind.localeCompare(b.kind) || (a.versionKey ?? "").localeCompare(b.versionKey ?? "") || a.slug.localeCompare(b.slug);
  });

  const total = found.length;
  const pageCount = Math.max(1, Math.ceil(total / p.pageSize));
  const skip = (p.page - 1) * p.pageSize;
  return { items: found.slice(skip, skip + p.pageSize), total, page: p.page, pageSize: p.pageSize, pageCount };
}

function summary(
  kind: GearKind,
  s: { id: string; slug: string; name: string; versionKey: string | null; versionLabel: string | null; versionBasis: string | null; reviewStatus: string; family: { slug: string; name: string } | null },
  items: { effects: { value: { toString(): string } | null; statistic: { key: string; name: string } | null }[] }[],
  thresholds: (number | null)[],
): GearSetSummary {
  const stats = items.flatMap((i) => i.effects).filter((e) => e.statistic && e.value !== null).map((e) => ({ key: e.statistic!.key, name: e.statistic!.name, value: e.value!.toString() }));
  const name = s.family?.name ?? s.name;
  return {
    id: s.id,
    kind,
    slug: s.slug,
    familySlug: s.family?.slug ?? null,
    name,
    title: title(name, s.versionLabel, s.versionBasis),
    versionKey: s.versionKey,
    versionLabel: s.versionLabel,
    versionBasis: s.versionBasis,
    reviewStatus: s.reviewStatus as ReviewStatus,
    pieceCount: items.length,
    thresholds: [...new Set(thresholds.filter((t): t is number => t !== null))].sort((a, b) => a - b),
    stats,
    evidence: [],
    rank: null,
    fullSet: null,
  };
}

/** Statistics the printed-stat filters offer, per kind. */
export const JEWELRY_SLOTS = ["force", "chakra", "agility", "power"] as const;

export async function gearFacets(db: Db) {
  const [slots, types] = await Promise.all([db.equipmentSlot.findMany({ orderBy: { sortOrder: "asc" }, select: { key: true, name: true } }), db.jewelryType.findMany({ orderBy: { sortOrder: "asc" }, select: { key: true, name: true } })]);
  const stats = new Map<string, string>();
  for (const s of [...slots, ...types]) stats.set(s.key, s.name);
  return { statistics: [...stats].map(([key, name]) => ({ key, name })), tiers: [2, 4, 6, 8] };
}

export interface GearVersionInfo {
  title: string;
  versionKey: string | null;
  versionLabel: string | null;
  versionBasis: string | null;
  family: { slug: string; name: string; sourceTitle: string | null; sourceStatus: string; upgradeCosts: { stage: string; applies: string; materials: string }[]; reviews: string[] } | null;
  /** The other versions and the other category of the same named set. */
  siblings: { kind: GearKind; slug: string; title: string; versionLabel: string | null; versionBasis: string | null }[];
  /** The source sheets this version was transcribed from. */
  sources: { path: string; reviewStatus: string; note: string | null }[];
}

export async function getGearVersionInfo(db: Db, kind: GearKind, slug: string): Promise<GearVersionInfo | null> {
  const set =
    kind === "equipment"
      ? await db.equipmentSet.findUnique({ where: { slug }, select: { id: true, name: true, versionKey: true, versionLabel: true, versionBasis: true, familyId: true, family: true } })
      : await db.jewelrySet.findUnique({ where: { slug }, select: { id: true, name: true, versionKey: true, versionLabel: true, versionBasis: true, familyId: true, family: true } });
  if (!set) return null;
  const [eq, jw, records] = await Promise.all([
    set.familyId ? db.equipmentSet.findMany({ where: { familyId: set.familyId }, select: { slug: true, name: true, versionLabel: true, versionBasis: true, versionKey: true } }) : [],
    set.familyId ? db.jewelrySet.findMany({ where: { familyId: set.familyId }, select: { slug: true, name: true, versionLabel: true, versionBasis: true, versionKey: true } }) : [],
    db.sourceRecord.findMany({ where: kind === "equipment" ? { equipmentSetId: set.id } : { jewelrySetId: set.id }, select: { reviewStatus: true, ambiguityNote: true, asset: { select: { path: true } } } }),
  ]);
  const name = set.family?.name ?? set.name;
  const meta = (set.family?.metadata ?? {}) as { upgradeCosts?: { stage: string; applies: string; materials: string }[]; reviews?: string[] };
  const siblings = [...eq.map((r) => ({ kind: "equipment" as const, ...r })), ...jw.map((r) => ({ kind: "jewelry" as const, ...r }))]
    .filter((r) => !(r.kind === kind && r.slug === slug))
    .map((r) => ({ kind: r.kind, slug: r.slug, title: title(name, r.versionLabel, r.versionBasis), versionLabel: r.versionLabel, versionBasis: r.versionBasis }));
  return {
    title: title(name, set.versionLabel, set.versionBasis),
    versionKey: set.versionKey,
    versionLabel: set.versionLabel,
    versionBasis: set.versionBasis,
    family: set.family ? { slug: set.family.slug, name: set.family.name, sourceTitle: set.family.sourceTitle, sourceStatus: set.family.sourceStatus, upgradeCosts: meta.upgradeCosts ?? [], reviews: meta.reviews ?? [] } : null,
    siblings,
    sources: records.map((r) => ({ path: r.asset.path, reviewStatus: r.reviewStatus, note: r.ambiguityNote })),
  };
}
