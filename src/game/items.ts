import type { Prisma } from "@prisma/client";
import { MAX_PAGE_SIZE, type JewelryBonusKind, type ReviewStatus, type SetStructureStatus, type TierStacking } from "../domain/constants";
import type { EffectView } from "../domain/effects";
import { slugify } from "../domain/slug";
import { inTransaction, parseInput, UnknownReferenceError, type Db } from "./db";
import { effectsArgs, replaceEffects, toEffectView } from "./effects";
import { equipmentSetInput, jewelrySetInput, type EquipmentSetInput, type JewelrySetInput } from "./schemas";

interface SlotRow {
  key: string;
  name: string;
  nameEs?: string | null;
  sortOrder?: number;
}

export const itemVocabulary = {
  equipmentSlot: (db: Db, r: SlotRow) =>
    db.equipmentSlot.upsert({
      where: { key: r.key },
      update: { name: r.name, nameEs: r.nameEs ?? null },
      create: { key: r.key, name: r.name, nameEs: r.nameEs ?? null, sortOrder: r.sortOrder ?? 0 },
    }),
  jewelryType: (db: Db, r: SlotRow) =>
    db.jewelryType.upsert({
      where: { key: r.key },
      update: { name: r.name, nameEs: r.nameEs ?? null },
      create: { key: r.key, name: r.name, nameEs: r.nameEs ?? null, sortOrder: r.sortOrder ?? 0 },
    }),
};

// ───────────────────────── Equipment ─────────────────────────

/**
 * Creates or updates an equipment set with its tiers and pieces, atomically.
 * Tier effects live on the tier; a piece's own statistics live on the piece — they never mix.
 * Each tier is stored exactly as given: no totals across tiers are computed or stored.
 */
export async function upsertEquipmentSet(db: Db, input: EquipmentSetInput): Promise<{ id: string; slug: string; created: boolean }> {
  const data = parseInput(equipmentSetInput, input, "equipment set");
  const slug = data.slug ?? slugify(data.name);

  return inTransaction(db, async (tx) => {
    const scalars = {
      name: data.name,
      nameEs: data.nameEs ?? null,
      description: data.description ?? null,
      descriptionEs: data.descriptionEs ?? null,
      translationStatus: data.translationStatus,
      tierStacking: data.tierStacking,
      reviewStatus: data.reviewStatus,
    };
    const existing = await tx.equipmentSet.findUnique({ where: { slug }, select: { id: true } });
    const set = existing
      ? await tx.equipmentSet.update({ where: { slug }, data: scalars, select: { id: true } })
      : await tx.equipmentSet.create({ data: { slug, ...scalars }, select: { id: true } });

    const thresholds: number[] = [];
    for (const [sortOrder, b] of data.bonuses.entries()) {
      const values = { description: b.description ?? null, descriptionEs: b.descriptionEs ?? null, sortOrder };
      const bonus = await tx.equipmentSetBonus.upsert({
        where: { setId_requiredPieces: { setId: set.id, requiredPieces: b.requiredPieces } },
        update: values,
        create: { setId: set.id, requiredPieces: b.requiredPieces, ...values },
        select: { id: true },
      });
      thresholds.push(b.requiredPieces);
      await replaceEffects(tx, { equipmentSetBonusId: bonus.id }, b.effects);
    }
    await tx.equipmentSetBonus.deleteMany({ where: { setId: set.id, requiredPieces: { notIn: thresholds } } });

    for (const item of data.items) {
      let slotId: string | null = null;
      if (item.slotKey) {
        const slot = await tx.equipmentSlot.findUnique({ where: { key: item.slotKey }, select: { id: true } });
        if (!slot) throw new UnknownReferenceError("equipment slot", item.slotKey);
        slotId = slot.id;
      }
      const itemSlug = item.slug ?? slugify(item.name);
      const values = {
        name: item.name,
        nameEs: item.nameEs ?? null,
        description: item.description ?? null,
        descriptionEs: item.descriptionEs ?? null,
        translationStatus: item.translationStatus,
        status: item.status,
        reviewStatus: item.reviewStatus,
        slotId,
        setId: set.id,
      };
      const row = await tx.equipment.upsert({ where: { slug: itemSlug }, update: values, create: { slug: itemSlug, ...values }, select: { id: true } });
      await replaceEffects(tx, { equipmentId: row.id }, item.effects);
    }
    return { id: set.id, slug, created: !existing };
  });
}

const equipmentSetInclude = {
  bonuses: { orderBy: { requiredPieces: "asc" }, include: { effects: effectsArgs } },
  items: { orderBy: { name: "asc" }, include: { slot: true, effects: effectsArgs } },
} satisfies Prisma.EquipmentSetInclude;

export interface SetTierView {
  id: string;
  requiredPieces: number | null;
  description: string | null;
  effects: EffectView[];
}

export interface ItemView {
  id: string;
  slug: string;
  name: string;
  nameEs: string | null;
  categoryName: string | null;
  groupKey: string | null;
  reviewStatus: ReviewStatus;
  /** The piece's own effects, separate from any set tier. */
  effects: EffectView[];
}

export interface EquipmentSetDetail {
  id: string;
  slug: string;
  name: string;
  nameEs: string | null;
  description: string | null;
  tierStacking: TierStacking;
  reviewStatus: ReviewStatus;
  tiers: (SetTierView & { requiredPieces: number })[];
  items: ItemView[];
}

export async function getEquipmentSet(db: Db, slug: string): Promise<EquipmentSetDetail | null> {
  const s = await db.equipmentSet.findUnique({ where: { slug }, include: equipmentSetInclude });
  if (!s) return null;
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    nameEs: s.nameEs,
    description: s.description,
    tierStacking: s.tierStacking as TierStacking,
    reviewStatus: s.reviewStatus as ReviewStatus,
    tiers: s.bonuses.map((b) => ({ id: b.id, requiredPieces: b.requiredPieces, description: b.description, effects: b.effects.map(toEffectView) })),
    items: s.items.map((i) => ({
      id: i.id,
      slug: i.slug,
      name: i.name,
      nameEs: i.nameEs,
      categoryName: i.slot?.name ?? null,
      groupKey: null,
      reviewStatus: i.reviewStatus as ReviewStatus,
      effects: i.effects.map(toEffectView),
    })),
  };
}

// ───────────────────────── Jewelry ─────────────────────────

/**
 * Creates or updates a jewelry set: optional sub-groups, pieces, and bonuses that may require
 * N pieces of a sub-group (e.g. a pair's 2-piece effect), N pieces of the whole set (e.g. an
 * 8-piece tier) or specific named pieces. Nothing assumes equipment-style 2/4/6 thresholds.
 */
export async function upsertJewelrySet(db: Db, input: JewelrySetInput): Promise<{ id: string; slug: string; created: boolean }> {
  const data = parseInput(jewelrySetInput, input, "jewelry set");
  const slug = data.slug ?? slugify(data.name);

  return inTransaction(db, async (tx) => {
    const scalars = {
      name: data.name,
      nameEs: data.nameEs ?? null,
      description: data.description ?? null,
      descriptionEs: data.descriptionEs ?? null,
      translationStatus: data.translationStatus,
      structureStatus: data.structureStatus,
      tierStacking: data.tierStacking,
      reviewStatus: data.reviewStatus,
    };
    const existing = await tx.jewelrySet.findUnique({ where: { slug }, select: { id: true } });
    const set = existing
      ? await tx.jewelrySet.update({ where: { slug }, data: scalars, select: { id: true } })
      : await tx.jewelrySet.create({ data: { slug, ...scalars }, select: { id: true } });

    const groupIds = new Map<string, string>();
    for (const [sortOrder, g] of data.groups.entries()) {
      const values = { name: g.name, nameEs: g.nameEs ?? null, sortOrder };
      const group = await tx.jewelryGroup.upsert({
        where: { setId_key: { setId: set.id, key: g.key } },
        update: values,
        create: { setId: set.id, key: g.key, ...values },
        select: { id: true },
      });
      groupIds.set(g.key, group.id);
    }
    const groupId = (key: string | null | undefined) => {
      if (!key) return null;
      const id = groupIds.get(key);
      if (!id) throw new UnknownReferenceError("jewelry group", key);
      return id;
    };

    const itemIds = new Map<string, string>();
    for (const item of data.items) {
      let typeId: string | null = null;
      if (item.typeKey) {
        const type = await tx.jewelryType.findUnique({ where: { key: item.typeKey }, select: { id: true } });
        if (!type) throw new UnknownReferenceError("jewelry type", item.typeKey);
        typeId = type.id;
      }
      const itemSlug = item.slug ?? slugify(item.name);
      const values = {
        name: item.name,
        nameEs: item.nameEs ?? null,
        description: item.description ?? null,
        descriptionEs: item.descriptionEs ?? null,
        translationStatus: item.translationStatus,
        status: item.status,
        reviewStatus: item.reviewStatus,
        typeId,
        setId: set.id,
        groupId: groupId(item.groupKey),
      };
      const row = await tx.jewelry.upsert({ where: { slug: itemSlug }, update: values, create: { slug: itemSlug, ...values }, select: { id: true } });
      itemIds.set(item.name, row.id);
      await replaceEffects(tx, { jewelryId: row.id }, item.effects);
    }

    // Bonuses have no natural key, so the provided list replaces the stored one.
    await tx.jewelrySetBonus.deleteMany({ where: { setId: set.id } });
    for (const [sortOrder, b] of data.bonuses.entries()) {
      const required = b.requiredItemNames.map((name) => {
        const id = itemIds.get(name);
        if (!id) throw new UnknownReferenceError("jewelry piece in this set", name);
        return { jewelryId: id };
      });
      const bonus = await tx.jewelrySetBonus.create({
        data: {
          setId: set.id,
          groupId: groupId(b.groupKey),
          requirementKind: b.requirementKind,
          requiredPieces: b.requiredPieces ?? null,
          description: b.description ?? null,
          descriptionEs: b.descriptionEs ?? null,
          sortOrder,
          requiredItems: { create: required },
        },
        select: { id: true },
      });
      await replaceEffects(tx, { jewelrySetBonusId: bonus.id }, b.effects);
    }
    // Groups that are no longer listed go last, once nothing references them.
    await tx.jewelryGroup.deleteMany({ where: { setId: set.id, key: { notIn: [...groupIds.keys()] } } });
    return { id: set.id, slug, created: !existing };
  });
}

const jewelrySetInclude = {
  groups: { orderBy: { sortOrder: "asc" } },
  bonuses: {
    orderBy: { sortOrder: "asc" },
    include: { group: true, requiredItems: { include: { jewelry: { select: { name: true } } } }, effects: effectsArgs },
  },
  items: { orderBy: { name: "asc" }, include: { type: true, group: true, effects: effectsArgs } },
} satisfies Prisma.JewelrySetInclude;

export interface JewelrySetDetail {
  id: string;
  slug: string;
  name: string;
  nameEs: string | null;
  description: string | null;
  structureStatus: SetStructureStatus;
  tierStacking: TierStacking;
  reviewStatus: ReviewStatus;
  groups: { key: string; name: string }[];
  bonuses: (SetTierView & { requirementKind: JewelryBonusKind; groupKey: string | null; groupName: string | null; requiredItemNames: string[] })[];
  items: ItemView[];
}

export async function getJewelrySet(db: Db, slug: string): Promise<JewelrySetDetail | null> {
  const s = await db.jewelrySet.findUnique({ where: { slug }, include: jewelrySetInclude });
  if (!s) return null;
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    nameEs: s.nameEs,
    description: s.description,
    structureStatus: s.structureStatus as SetStructureStatus,
    tierStacking: s.tierStacking as TierStacking,
    reviewStatus: s.reviewStatus as ReviewStatus,
    groups: s.groups.map((g) => ({ key: g.key, name: g.name })),
    bonuses: s.bonuses.map((b) => ({
      id: b.id,
      requirementKind: b.requirementKind as JewelryBonusKind,
      requiredPieces: b.requiredPieces,
      groupKey: b.group?.key ?? null,
      groupName: b.group?.name ?? null,
      requiredItemNames: b.requiredItems.map((r) => r.jewelry.name),
      description: b.description,
      effects: b.effects.map(toEffectView),
    })),
    items: s.items.map((i) => ({
      id: i.id,
      slug: i.slug,
      name: i.name,
      nameEs: i.nameEs,
      categoryName: i.type?.name ?? null,
      groupKey: i.group?.key ?? null,
      reviewStatus: i.reviewStatus as ReviewStatus,
      effects: i.effects.map(toEffectView),
    })),
  };
}

// ───────────────────────── Lists ─────────────────────────

export interface SetSummary {
  slug: string;
  name: string;
  nameEs: string | null;
  kind: "equipment" | "jewelry";
  pieceCount: number;
  thresholds: number[];
}

/** Both kinds of set, bounded. Thresholds are listed as stored — nothing is summed. */
export async function listSets(db: Db): Promise<SetSummary[]> {
  const [equipment, jewelry] = await Promise.all([
    db.equipmentSet.findMany({
      orderBy: { name: "asc" },
      take: MAX_PAGE_SIZE,
      include: { _count: { select: { items: true } }, bonuses: { select: { requiredPieces: true }, orderBy: { requiredPieces: "asc" } } },
    }),
    db.jewelrySet.findMany({
      orderBy: { name: "asc" },
      take: MAX_PAGE_SIZE,
      include: { _count: { select: { items: true } }, bonuses: { select: { requiredPieces: true }, orderBy: { sortOrder: "asc" } } },
    }),
  ]);
  const thresholds = (bonuses: { requiredPieces: number | null }[]) =>
    [...new Set(bonuses.map((b) => b.requiredPieces).filter((n): n is number => n !== null))].sort((a, b) => a - b);
  return [
    ...equipment.map((s) => ({ slug: s.slug, name: s.name, nameEs: s.nameEs, kind: "equipment" as const, pieceCount: s._count.items, thresholds: thresholds(s.bonuses) })),
    ...jewelry.map((s) => ({ slug: s.slug, name: s.name, nameEs: s.nameEs, kind: "jewelry" as const, pieceCount: s._count.items, thresholds: thresholds(s.bonuses) })),
  ];
}
