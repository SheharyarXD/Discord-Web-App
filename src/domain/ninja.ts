import { MAPPING_STATUSES, MAX_MONTH, MIN_MONTH, type MappingStatus } from "./constants";

// ───────────────────────── Release period ─────────────────────────

export interface ReleasePeriod {
  year: number;
  month: number;
}

export function isValidReleasePeriod(p: ReleasePeriod): boolean {
  return Number.isInteger(p.year) && Number.isInteger(p.month) && p.month >= MIN_MONTH && p.month <= MAX_MONTH && p.year > 0;
}

/** "2026-03". Month granularity only — a day is never produced. */
export function releasePeriodKey(p: ReleasePeriod): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

/** "marzo de 2026" for the given locale. Built without Date so no day/timezone can leak in. */
export function formatReleasePeriod(p: ReleasePeriod, locale = "es"): string {
  const month = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(Date.UTC(2000, p.month - 1, 1));
  return locale.startsWith("es") ? `${month} de ${p.year}` : `${month} ${p.year}`;
}

export interface ReleaseSortable {
  id: string;
  name: string;
  releaseYear: number | null;
  releaseMonth: number | null;
  releaseOrder: number | null;
}

/** Larger-first comparison where null always sorts last. */
function descNullsLast(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

/**
 * Newest-first, fully deterministic: year, month, source-list position, then name and id.
 * Ninjas without a known release period come last, in a stable order.
 * Mirrors NEWEST_FIRST_ORDER_BY used by the database query.
 */
export function compareNewestFirst(a: ReleaseSortable, b: ReleaseSortable): number {
  return (
    descNullsLast(a.releaseYear, b.releaseYear) ||
    descNullsLast(a.releaseMonth, b.releaseMonth) ||
    descNullsLast(a.releaseOrder, b.releaseOrder) ||
    a.name.localeCompare(b.name, "en") ||
    a.id.localeCompare(b.id, "en")
  );
}

// ───────────────────────── Formation vs source category ─────────────────────────

export interface FormationRef {
  key: string;
  name: string;
}

export interface RoleMappingRef<F extends FormationRef = FormationRef> {
  mappingStatus: MappingStatus | string;
  mappedFormation: F | null;
}

export type FormationOrigin = "DIRECT" | "APPROVED_MAPPING";

/**
 * A ninja's formation comes from direct evidence (`formation`) or, failing that, from its
 * source category ONLY when that category's mapping has been APPROVED. A merely PROPOSED
 * mapping ("assaulters" → "center") resolves to nothing.
 */
export function resolveFormation<F extends FormationRef>(input: {
  formation: F | null;
  role: RoleMappingRef<F> | null;
}): { formation: F; origin: FormationOrigin } | null {
  if (input.formation) return { formation: input.formation, origin: "DIRECT" };
  const role = input.role;
  if (role && role.mappingStatus === MAPPING_STATUSES.APPROVED && role.mappedFormation) {
    return { formation: role.mappedFormation, origin: "APPROVED_MAPPING" };
  }
  return null;
}
