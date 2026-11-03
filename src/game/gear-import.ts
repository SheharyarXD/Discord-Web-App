import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { slugify } from "../domain/slug";
import type { Db } from "./db";
import { itemVocabulary, upsertEquipmentSet, upsertJewelrySet } from "./items";
import {
  CATEGORY_KEY,
  effectsOfBonus,
  familySlug,
  mainStat,
  parseTranscription,
  SLOT_KEY,
  setSlug,
  versionOf,
  versionTitle,
  type ParsedSet,
  type ParsedSheet,
  type Version,
} from "./gear-parse";
import { recordEvidence, registerAsset } from "./provenance";
import type { EquipmentSetInput, JewelrySetInput } from "./schemas";

/**
 * Plans and performs the equipment and jewelry import. The plan is pure (no database); the import is idempotent:
 * every set, piece and tier has a deterministic slug or key, so running it twice changes nothing the second time.
 */

export interface LedgerImage {
  set: number;
  setName: string;
  role: string;
  path: string;
  originalUploadFilename: string;
  sha256: string;
  bytes: number;
}
export interface ImageLedger {
  counts: { named_sets: number; sets_with_images: number; sets_without_source: number; source_images: number };
  images: LedgerImage[];
}

export interface PlannedVersion {
  kind: "equipment" | "jewelry";
  slug: string;
  title: string;
  version: Version;
  sheet: ParsedSheet;
  equipment?: EquipmentSetInput;
  jewelry?: JewelrySetInput;
  clauses: { structured: number; textOnly: number };
  reviews: string[];
}
export interface PlannedFamily {
  index: number;
  slug: string;
  name: string;
  sourceTitle: string | null;
  nameOnly: boolean;
  costs: ParsedSet["costs"];
  notes: string[];
  reviews: string[];
  versions: PlannedVersion[];
}

export const TRANSCRIPTION_DIR = path.resolve(process.cwd(), "data/gear-source/transcription");
export const LEDGER_FILE = path.resolve(process.cwd(), "data/gear-source/image-ledger.json");

export function readTranscriptions(dir = TRANSCRIPTION_DIR): ParsedSet[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .sort()
    .flatMap((f) => parseTranscription(readFileSync(path.join(dir, f), "utf8"), f))
    .sort((a, b) => a.index - b.index);
}
export const readLedger = (file = LEDGER_FILE): ImageLedger => JSON.parse(readFileSync(file, "utf8"));

const SLOT_NAMES = Object.keys(SLOT_KEY);

function equipmentInput(family: PlannedFamily, v: Version, sheet: ParsedSheet, title: string, slug: string): EquipmentSetInput {
  return {
    name: family.name,
    slug,
    tierStacking: "UNKNOWN",
    reviewStatus: "NEEDS_REVIEW",
    bonuses: sheet.bonuses.map((b) => ({ requiredPieces: b.pieces, description: b.text.replace(/\s+\/\/\s+/g, "\n"), effects: effectsOfBonus(b.text) })),
    items: sheet.slots.map((s) => {
      const slotKey = SLOT_KEY[s.label];
      if (!slotKey) throw new Error(`${family.name}: unknown slot "${s.label}" (expected one of ${SLOT_NAMES.join(", ")})`);
      return { name: `${title}: ${s.label}`, slug: `${slug}-${slotKey}`, slotKey, status: "PUBLISHED", reviewStatus: "NEEDS_REVIEW", effects: [mainStat(slotKey, s.value)] };
    }),
  } as EquipmentSetInput;
}

function jewelryInput(family: PlannedFamily, v: Version, sheet: ParsedSheet, title: string, slug: string): JewelrySetInput {
  const cats = sheet.categories;
  for (const c of cats) if (!CATEGORY_KEY[c.label]) throw new Error(`${family.name}: unknown jewelry category "${c.label}"`);
  // The shared 8-piece effect is printed in every category cell; the four cells must agree.
  const fulls = [...new Set(cats.map((c) => c.fullSetText).filter((t): t is string => !!t))];
  if (fulls.length > 1) throw new Error(`${family.name} ${v.key}: the four 8-piece texts differ`);
  const full = fulls[0] ?? null;
  return {
    name: family.name,
    slug,
    structureStatus: "CONFIRMED",
    tierStacking: "UNKNOWN",
    reviewStatus: "NEEDS_REVIEW",
    groups: cats.map((c) => ({ key: CATEGORY_KEY[c.label]!, name: c.label })),
    items: cats.map((c) => ({ name: `${title}: ${c.label}`, slug: `${slug}-${CATEGORY_KEY[c.label]}`, typeKey: CATEGORY_KEY[c.label]!, groupKey: CATEGORY_KEY[c.label]!, status: "PUBLISHED", reviewStatus: "NEEDS_REVIEW", effects: [mainStat(CATEGORY_KEY[c.label]!, c.value)] })),
    bonuses: [
      ...cats.map((c) => ({ groupKey: CATEGORY_KEY[c.label]!, requirementKind: "PIECE_COUNT" as const, requiredPieces: 2, requiredItemNames: [], description: c.twoPieceText.replace(/\s+\/\/\s+/g, "\n"), effects: effectsOfBonus(c.twoPieceText) })),
      ...(full ? [{ groupKey: null, requirementKind: "PIECE_COUNT" as const, requiredPieces: 8, requiredItemNames: [], description: full.replace(/\s+\/\/\s+/g, "\n"), effects: effectsOfBonus(full) }] : []),
    ],
  } as JewelrySetInput;
}

export function planGear(sets: ParsedSet[]): PlannedFamily[] {
  return sets.map((s) => {
    const family: PlannedFamily = {
      index: s.index,
      slug: familySlug(s.name),
      name: s.name,
      sourceTitle: s.name === "Mekansm" ? "MEKA" : null,
      nameOnly: s.nameOnly,
      costs: s.costs,
      notes: s.notes,
      reviews: s.reviews,
      versions: [],
    };
    for (const sheet of s.sheets) {
      const v = versionOf(sheet.versionToken);
      const kind = sheet.kind === "GEAR" ? "equipment" : "jewelry";
      const slug = setSlug(family.slug, v);
      const title = versionTitle(family.name, v);
      const planned: PlannedVersion = { kind, slug, title, version: v, sheet, clauses: { structured: 0, textOnly: 0 }, reviews: sheet.reviews };
      if (kind === "equipment") planned.equipment = equipmentInput(family, v, sheet, title, slug);
      else planned.jewelry = jewelryInput(family, v, sheet, title, slug);
      const effects = [...(planned.equipment?.bonuses ?? []).flatMap((b) => b.effects ?? []), ...(planned.jewelry?.bonuses ?? []).flatMap((b) => b.effects ?? [])];
      for (const e of effects) {
        if (e.structuredStatus === "TEXT_ONLY") planned.clauses.textOnly++;
        else planned.clauses.structured++;
      }
      family.versions.push(planned);
    }
    // Two versions of one kind must not share a slug; a family whose only sheet of a kind is unlabeled keeps the bare slug.
    const seen = new Set<string>();
    for (const v of family.versions) {
      const id = `${v.kind}:${v.slug}`;
      if (seen.has(id)) throw new Error(`duplicate version identity ${id}`);
      seen.add(id);
    }
    return family;
  });
}

// ───────────────────────── Reference data the import needs ─────────────────────────

const NEW_STATISTICS: [key: string, name: string, type: "FLAT" | "PERCENT"][] = [
  ["physical-attack", "Physical Attack", "FLAT"],
  ["damage-taken-reduction", "damage taken reduction", "PERCENT"],
  ["bonus-damage-after-attack", "bonus damage after attack", "PERCENT"],
];

async function ensureReference(db: Db): Promise<void> {
  for (const [key, name, defaultValueType] of NEW_STATISTICS) {
    // Existing rows are never touched.
    await db.statistic.upsert({ where: { key }, update: {}, create: { key, name, category: "combat", defaultValueType, reviewStatus: "NEEDS_REVIEW", sortOrder: 200 } });
  }
  for (const [i, label] of SLOT_NAMES.entries()) await itemVocabulary.equipmentSlot(db, { key: SLOT_KEY[label]!, name: label, sortOrder: i });
  for (const [i, label] of Object.keys(CATEGORY_KEY).entries()) await itemVocabulary.jewelryType(db, { key: CATEGORY_KEY[label]!, name: label, sortOrder: i });
}

export interface ImportResult {
  families: number;
  equipmentSets: number;
  jewelrySets: number;
  pieces: number;
  bonuses: number;
  effects: number;
  assets: number;
  evidence: number;
}

/** Writes the plan. Only adds or updates rows keyed by the plan's own slugs; nothing else in the database is touched. */
export async function importGear(db: Db, plan: PlannedFamily[], ledger: ImageLedger): Promise<ImportResult> {
  await ensureReference(db);
  const hashes = new Map(ledger.images.map((i) => [i.path, i]));
  const result: ImportResult = { families: 0, equipmentSets: 0, jewelrySets: 0, pieces: 0, bonuses: 0, effects: 0, assets: 0, evidence: 0 };
  for (const f of plan) {
    const metadata = JSON.parse(JSON.stringify(f.costs.length ? { upgradeCosts: f.costs, notes: f.notes, reviews: f.reviews } : { notes: f.notes, reviews: f.reviews }));
    const family = await db.gearFamily.upsert({
      where: { slug: f.slug },
      update: { name: f.name, sourceTitle: f.sourceTitle, sourceStatus: f.nameOnly ? "NAME_ONLY" : "SOURCED", metadata },
      create: { slug: f.slug, name: f.name, sourceTitle: f.sourceTitle, sourceStatus: f.nameOnly ? "NAME_ONLY" : "SOURCED", reviewStatus: "NEEDS_REVIEW", metadata },
      select: { id: true },
    });
    result.families++;
    // Upgrade-cost sheets are resource schedules, not combat bonuses: they are kept as source evidence and in the family metadata.
    for (const cost of [...new Set(f.costs.map((c) => c.path))]) {
      const image = hashes.get(cost);
      await registerAsset(db, { path: `gear-source/${cost}`, category: "SCREENSHOT", description: `Owner-supplied upgrade-cost sheet of ${f.name}${image ? `; sha256 ${image.sha256}; ${image.bytes} bytes; uploaded as ${image.originalUploadFilename}` : ""}`, reviewed: false, fullyLegible: true } as never);
      await recordEvidence(db, { key: `gear:costs:${f.slug}:${cost}`, assetPath: `gear-source/${cost}`, section: "upgrade costs", field: "resource cost per stage (not a combat bonus)", reviewStatus: "NEEDS_REVIEW", sourceText: f.costs.filter((c) => c.path === cost).map((c) => `${c.stage}: ${c.materials}`).join("; ") } as never);
      result.assets++;
    }
    for (const v of f.versions) {
      const link = { familyId: family.id, versionKey: v.version.key, versionLabel: v.version.label, versionBasis: v.version.basis };
      const image = hashes.get(v.sheet.path);
      const assetPath = `gear-source/${v.sheet.path}`;
      await registerAsset(db, {
        path: assetPath,
        category: "SCREENSHOT",
        description: `Owner-supplied ${v.kind === "equipment" ? "equipment" : "jewelry"} sheet of ${f.name}${image ? `; sha256 ${image.sha256}; ${image.bytes} bytes; uploaded as ${image.originalUploadFilename}` : ""}`,
        reviewed: false,
        fullyLegible: true,
        notes: v.sheet.notes.join(" | ") || undefined,
      } as never);
      result.assets++;
      const sheetReview = [...f.reviews, ...v.reviews].join(" | ") || undefined;
      if (v.equipment) {
        const r = await upsertEquipmentSet(db, v.equipment);
        await db.equipmentSet.update({ where: { slug: v.slug }, data: link });
        await recordEvidence(db, { key: `gear:equipment:${v.slug}:${v.sheet.path}`, assetPath, section: "equipment sheet", field: "pieces, tiers and effects", reviewStatus: "NEEDS_REVIEW", ambiguityNote: sheetReview } as never, { equipmentSetId: r.id });
        result.equipmentSets++;
        result.pieces += v.equipment.items?.length ?? 0;
        result.bonuses += v.equipment.bonuses?.length ?? 0;
      } else if (v.jewelry) {
        const r = await upsertJewelrySet(db, v.jewelry);
        await db.jewelrySet.update({ where: { slug: v.slug }, data: link });
        await recordEvidence(db, { key: `gear:jewelry:${v.slug}:${v.sheet.path}`, assetPath, section: "jewelry sheet", field: "categories, 2-piece and 8-piece effects", reviewStatus: "NEEDS_REVIEW", ambiguityNote: sheetReview } as never, { jewelrySetId: r.id });
        result.jewelrySets++;
        result.pieces += v.jewelry.items?.length ?? 0;
        result.bonuses += v.jewelry.bonuses?.length ?? 0;
      }
      result.evidence++;
      result.effects += v.clauses.structured + v.clauses.textOnly;
    }
  }
  return result;
}

// ───────────────────────── Audit ─────────────────────────

export function auditGear(plan: PlannedFamily[], ledger: ImageLedger) {
  const imageUse = new Map<string, string>();
  for (const f of plan) for (const v of f.versions) imageUse.set(v.sheet.path, `${v.kind}:${v.slug}`);
  const rows = ledger.images.map((i) => ({
    ...i,
    importedAs: imageUse.get(i.path) ?? (i.path.includes("cost") ? "family upgrade-cost schedule (not a combat bonus)" : null),
  }));
  const unassigned = rows.filter((r) => !r.importedAs).map((r) => r.path);
  const eq = plan.flatMap((f) => f.versions.filter((v) => v.kind === "equipment"));
  const je = plan.flatMap((f) => f.versions.filter((v) => v.kind === "jewelry"));
  return {
    counts: {
      namedSets: plan.length,
      sourcedSets: plan.filter((f) => !f.nameOnly).length,
      nameOnlySets: plan.filter((f) => f.nameOnly).map((f) => f.name),
      sourceImages: ledger.images.length,
      imagesAssigned: rows.length - unassigned.length,
      equipmentVersions: eq.length,
      jewelryVersions: je.length,
      setsWithJewelry: new Set(je.map((v) => plan.find((f) => f.versions.includes(v))!.slug)).size,
      gearOnlySets: plan.filter((f) => !f.nameOnly && !f.versions.some((v) => v.kind === "jewelry")).map((f) => f.name),
      equipmentPieces: eq.reduce((n, v) => n + (v.equipment?.items?.length ?? 0), 0),
      jewelryCategories: je.reduce((n, v) => n + (v.jewelry?.items?.length ?? 0), 0),
      effectRows: { structured: [...eq, ...je].reduce((n, v) => n + v.clauses.structured, 0), textOnly: [...eq, ...je].reduce((n, v) => n + v.clauses.textOnly, 0) },
    },
    unassignedImages: unassigned,
    reviewItems: plan.flatMap((f) => [...f.reviews.map((r) => ({ set: f.name, version: null as string | null, note: r })), ...f.versions.flatMap((v) => v.reviews.map((r) => ({ set: f.name, version: `${v.kind}:${v.version.key}`, note: r })))]),
    versions: plan.flatMap((f) => f.versions.map((v) => ({ set: f.name, kind: v.kind, slug: v.slug, title: v.title, versionKey: v.version.key, versionLabel: v.version.label, versionBasis: v.version.basis, image: v.sheet.path, pieces: v.equipment?.items?.length ?? v.jewelry?.items?.length ?? 0, tiers: v.equipment?.bonuses?.map((b) => b.requiredPieces) ?? v.jewelry?.bonuses?.map((b) => `${b.groupKey ?? "set"}:${b.requiredPieces}`) ?? [], clauses: v.clauses }))),
    images: rows,
  };
}

export { slugify };
