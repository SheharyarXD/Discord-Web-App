import type { GearListParams } from "@/game/gear";
import type { ItemKind, ItemListParams, NinjaListParams } from "@/game/schemas";

/** Raw Next.js search params. */
export type RawParams = Record<string, string | string[] | undefined>;

const all = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]).map((s) => s.trim()).filter(Boolean);
const one = (v: string | string[] | undefined): string | undefined => all(v)[0];
const num = (v: string | undefined): string | undefined => (v !== undefined && /^-?\d+(\.\d+)?$/.test(v.replace(",", ".")) ? v.replace(",", ".") : undefined);

/**
 * «stat1=force&min1=1000&max1=5000&stat2=hp&min2=...»: up to three statistic ranges. A row with a
 * statistic and neither end is ignored, and a malformed number is dropped rather than guessed.
 */
function statRanges(p: RawParams) {
  const out: { statisticKey: string; min?: string; max?: string }[] = [];
  for (const i of [1, 2, 3]) {
    const key = one(p[`stat${i}`]);
    const min = num(one(p[`min${i}`]));
    const max = num(one(p[`max${i}`]));
    if (key && (min !== undefined || max !== undefined)) out.push({ statisticKey: key, ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) });
  }
  return out;
}

/** «fx=aturdir&fx=velocidad»: up to six distinct effect terms, case-insensitively unique. */
export function effectTerms(p: RawParams): string[] {
  const seen = new Set<string>();
  return all(p.fx)
    .map((t) => t.slice(0, 80))
    .filter((t) => (seen.has(t.toLowerCase()) ? false : (seen.add(t.toLowerCase()), true)))
    .slice(0, 6);
}

/** «fxm=all»: the selected effects must ALL be present. Anything else means ANY (the default). */
/** «sort=fx:desc» with at least one selected effect: sorting by the value of that effect. */
function effectSortOf(p: RawParams) {
  const [by, direction] = (one(p.sort) ?? "").split(":");
  if (by !== "fx" || (direction !== "asc" && direction !== "desc") || effectTerms(p).length === 0) return undefined;
  const effectTerm = sortEffectOf(p);
  return { by: "effect" as const, direction: direction as "asc" | "desc", ...(effectTerm ? { effectTerm } : {}) };
}

export const effectModeOf = (p: RawParams): "any" | "all" => (one(p.fxm) === "all" ? "all" : "any");

/** The effect that controls value sorting («fxs=aturdir»): one of the selected effects; anything else means the first selected one. */
export const sortEffectOf = (p: RawParams): string | undefined => {
  const wanted = one(p.fxs);
  const terms = effectTerms(p);
  return wanted && terms.some((t) => t.toLowerCase() === wanted.toLowerCase()) ? wanted : undefined;
};

/** «stat:desc:force», «growth:asc:hp», «name:asc», «release:desc», «fx:desc» (value of the selected effect). Anything else means the default order. */
function sortOf(raw: string | undefined, kind: "ninja" | "item") {
  if (!raw) return undefined;
  const [by, direction, statisticKey] = raw.split(":");
  if (direction !== "asc" && direction !== "desc") return undefined;
  if (by === "name" || (kind === "ninja" && by === "release")) return { by, direction } as const;
  if ((by === "stat" || (kind === "ninja" && by === "growth")) && statisticKey) return { by, direction, statisticKey } as const;
  return undefined;
}

const intOr1 = (v: string | undefined) => {
  const n = Number.parseInt(v ?? "1", 10);
  return Number.isInteger(n) && n > 0 ? n : 1;
};

export function parseNinjaParams(p: RawParams, options: { includeUnpublished?: boolean } = {}): NinjaListParams {
  const classes = all(p.class).filter((c) => c === "TANK" || c === "DPS" || c === "UNASSIGNED") as ("TANK" | "DPS" | "UNASSIGNED")[];
  const sort = sortOf(one(p.sort), "ninja");
  const effectSort = effectSortOf(p);
  return {
    page: intOr1(one(p.page)),
    ...(one(p.q) ? { query: one(p.q) } : {}),
    ...(all(p.rating).length ? { ratingKeys: all(p.rating) } : {}),
    ...(all(p.formation).length ? { formationKeys: all(p.formation) } : {}),
    ...(all(p.type).length ? { typeKeys: all(p.type) } : {}),
    ...(all(p.role).length ? { roleKeys: all(p.role) } : {}),
    ...(classes.length ? { combatClasses: classes } : {}),
    ...(statRanges(p).length ? { statFilters: statRanges(p) } : {}),
    ...(all(p.effect).length ? { effectStatisticKeys: all(p.effect) } : {}),
    ...(effectTerms(p).length ? { effectTerms: effectTerms(p) } : {}),
    ...(effectModeOf(p) === "all" ? { effectMode: "all" as const } : {}),
    ...(sort ? { sort: sort as NonNullable<NinjaListParams["sort"]> } : {}),
    ...(effectSort ? { sort: effectSort } : {}),
    ...(options.includeUnpublished ? { includeUnpublished: true } : {}),
  };
}

/** The set catalogue: «kind=equipment&version=labelled&tier=4&stat1=speed&min1=70000&fx=aturdir&fxm=all». */
export function parseGearParams(p: RawParams): GearListParams {
  const kinds = all(p.kind).filter((k): k is "equipment" | "jewelry" => k === "equipment" || k === "jewelry");
  const versions = all(p.version).filter((v): v is "base" | "labelled" | "variant" => v === "base" || v === "labelled" || v === "variant");
  const tiers = all(p.tier).map((t) => Number.parseInt(t, 10)).filter((t) => Number.isInteger(t) && t > 0 && t < 21);
  const sortRaw = one(p.sort);
  const [by, direction, statisticKey] = (sortRaw ?? "").split(":");
  const dir = direction === "asc" || direction === "desc" ? direction : undefined;
  const gearSort: GearListParams["sort"] = effectSortOf(p) ?? (by === "name" && dir ? { by: "name" as const, direction: dir } : by === "stat" && statisticKey && dir ? { by: "stat" as const, direction: dir, statisticKey } : undefined);
  return {
    page: intOr1(one(p.page)),
    ...(one(p.q) ? { query: one(p.q) } : {}),
    ...(kinds.length ? { kinds } : {}),
    ...(versions.length ? { versions } : {}),
    ...(tiers.length ? { tiers } : {}),
    ...(statRanges(p).length ? { statFilters: statRanges(p) } : {}),
    ...(effectTerms(p).length ? { effectTerms: effectTerms(p) } : {}),
    ...(effectModeOf(p) === "all" ? { effectMode: "all" as const } : {}),
    ...(gearSort ? { sort: gearSort } : {}),
  };
}

export function parseItemParams(kind: ItemKind, p: RawParams, options: { includeUnpublished?: boolean } = {}): ItemListParams {
  const sort = sortOf(one(p.sort), "item");
  return {
    kind,
    page: intOr1(one(p.page)),
    ...(one(p.q) ? { query: one(p.q) } : {}),
    ...(all(p.type).length ? { typeKeys: all(p.type) } : {}),
    ...(all(p.set).length ? { setSlugs: all(p.set) } : {}),
    ...(statRanges(p).length ? { statFilters: statRanges(p) } : {}),
    ...(sort ? { sort: sort as NonNullable<ItemListParams["sort"]> } : {}),
    ...(options.includeUnpublished ? { includeUnpublished: true } : {}),
  };
}

/** A link to the same page with some parameters changed. Repeated keys are kept, empty values dropped. */
export function hrefWith(base: string, p: RawParams, change: Record<string, string | string[] | undefined>): string {
  const merged: RawParams = { ...p, ...change };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) for (const item of all(v)) qs.append(k, item);
  const text = qs.toString();
  return text ? `${base}?${text}` : base;
}

export const rawAll = all;
export const rawOne = one;
