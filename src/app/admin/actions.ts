"use server";

import { ValidationError } from "@/game/db";
import { slugify } from "@/domain/slug";
import type { FormState } from "@/components/forms/form-state";
import { adminAction } from "@/server/admin/run";
import { decimalOrNull, flag, intOrNull, lines, statEffects, text, textOrNull } from "@/server/admin/parse";
import { db } from "@/server/db";

/**
 * Every administrator mutation. Each one goes through adminAction (administrator only, typed errors)
 * and then through the game API, which checks the permission again for every call.
 */

const orNull = (v: string) => (v === "" ? null : v);
const requireConfirmation = (fd: FormData, expected: string) => {
  if (text(fd, "confirm").toLowerCase() !== expected.toLowerCase()) throw new ValidationError("El texto de confirmación no coincide");
};

// ───────────────────────── Ninjas ─────────────────────────

export async function saveNinjaAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return adminAction(async ({ api }) => {
    const isNew = flag(fd, "isNew");
    const name = text(fd, "name");
    if (!name) throw new ValidationError("falta el nombre");
    const slug = isNew ? text(fd, "slug") || slugify(name) : text(fd, "slug");
    if (!slug) throw new ValidationError("no se puede crear un identificador con este nombre");
    if (isNew && (await db.ninja.findUnique({ where: { slug }, select: { id: true } }))) throw new ValidationError(`ya existe un ninja con el identificador «${slug}»`);

    const year = intOrNull(fd, "releaseYear", "año de lanzamiento");
    const month = intOrNull(fd, "releaseMonth", "mes de lanzamiento");
    if ((year === null) !== (month === null)) throw new ValidationError("lanzamiento: el año y el mes van juntos");

    const baseStats: { statisticKey: string; sourceLabel: string; baseValue: string; growthRate: string | null }[] = [];
    for (const key of fd.keys()) {
      if (!key.startsWith("base_")) continue;
      const statisticKey = key.slice(5);
      const baseValue = decimalOrNull(fd, key, `base ${statisticKey}`);
      if (baseValue === null) continue; // a statistic the card does not show stays absent, never zero
      baseStats.push({ statisticKey, sourceLabel: text(fd, `label_${statisticKey}`) || statisticKey, baseValue, growthRate: decimalOrNull(fd, `growth_${statisticKey}`, `growth ${statisticKey}`) });
    }

    const previous = isNew ? [] : ((await api.getNinja(slug))?.aliases ?? []);
    const status = new Map(previous.map((a) => [`${a.kind}:${a.alias.toLowerCase()}`, a.status]));
    const aliases = [
      ...lines(fd, "cardNames").map((alias) => ({ alias, kind: "CARD_NAME" as const })),
      ...lines(fd, "otherNames").map((alias) => ({ alias, kind: "SOURCE_NAME" as const })),
    ].map((a) => ({ ...a, status: status.get(`${a.kind}:${a.alias.toLowerCase()}`) ?? ("VERIFIED" as const) }));

    const combat = text(fd, "combatClass");
    await api.upsertNinja({
      name,
      slug,
      nameEs: textOrNull(fd, "nameEs"),
      description: textOrNull(fd, "description"),
      descriptionEs: textOrNull(fd, "descriptionEs"),
      ratingKey: orNull(text(fd, "ratingKey")),
      formationKey: orNull(text(fd, "formationKey")),
      typeKey: orNull(text(fd, "typeKey")),
      roleKey: orNull(text(fd, "roleKey")),
      clientCombatClass: combat === "TANK" || combat === "DPS" ? combat : null,
      release: year !== null && month !== null ? { year, month } : null,
      status: (text(fd, "status") || "DRAFT") as "DRAFT" | "PUBLISHED" | "ARCHIVED",
      reviewStatus: (text(fd, "reviewStatus") || "NEEDS_REVIEW") as "CONFIRMED" | "PARTIALLY_CONFIRMED" | "NEEDS_REVIEW",
      baseStats,
      aliases,
    });
    return isNew ? { redirectTo: `/admin/ninjas/${slug}?created=1` } : { message: "admin.saved" };
  }, ["/admin/ninjas", "/ninjas"]);
}

export async function deleteNinjaAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return adminAction(async ({ api }) => {
    const slug = text(fd, "slug");
    requireConfirmation(fd, slug);
    await api.deleteNinja(slug);
    return { redirectTo: "/admin/ninjas?deleted=1" };
  }, ["/admin/ninjas", "/ninjas"]);
}

export async function saveAbilityAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return adminAction(async ({ api }) => {
    const slug = text(fd, "ninjaSlug");
    const stage = intOrNull(fd, "stage", "etapa");
    await api.saveAbilityText({
      ninjaSlug: slug,
      kind: text(fd, "kind") as "skill",
      name: text(fd, "name"),
      nameEs: textOrNull(fd, "nameEs"),
      linesEn: lines(fd, "linesEn"),
      linesEs: lines(fd, "linesEs"),
      stage,
      existingId: textOrNull(fd, "existingId"),
      parentId: textOrNull(fd, "parentId"),
    });
    return { message: "admin.saved" };
  }, ["/admin/ninjas", "/ninjas"]);
}

export async function deleteAbilityAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return adminAction(async ({ api }) => {
    await api.deleteAbility(text(fd, "id"), text(fd, "what") === "talent" ? "talent" : "ability");
    return { message: "admin.deleted" };
  }, ["/admin/ninjas", "/ninjas"]);
}

// ───────────────────────── Items ─────────────────────────

const publication = (fd: FormData) => (text(fd, "status") || "DRAFT") as "DRAFT" | "PUBLISHED" | "ARCHIVED";
const review = (fd: FormData) => (text(fd, "reviewStatus") || "NEEDS_REVIEW") as "CONFIRMED" | "PARTIALLY_CONFIRMED" | "NEEDS_REVIEW";

async function saveItem(fd: FormData, kind: "equipment" | "jewelry" | "gem", base: string) {
  return adminAction(async ({ api }) => {
    const isNew = flag(fd, "isNew");
    const name = text(fd, "name");
    if (!name) throw new ValidationError("falta el nombre");
    const slug = isNew ? text(fd, "slug") || slugify(name) : text(fd, "slug");
    if (!slug) throw new ValidationError("no se puede crear un identificador con este nombre");
    const exists =
      kind === "equipment" ? await db.equipment.findUnique({ where: { slug }, select: { id: true } })
      : kind === "jewelry" ? await db.jewelry.findUnique({ where: { slug }, select: { id: true } })
      : await db.gem.findUnique({ where: { slug }, select: { id: true } });
    if (isNew && exists) throw new ValidationError(`ya existe un registro con el identificador «${slug}»`);
    const effects = statEffects(fd, "effects");
    const common = { name, slug, status: publication(fd), effects };
    if (kind === "gem") {
      await api.saveGem({ ...common, typeKey: orNull(text(fd, "typeKey")), level: intOrNull(fd, "level", "level"), description: textOrNull(fd, "description") }, { effectsMode: "simple" });
    } else {
      const shared = { ...common, nameEs: textOrNull(fd, "nameEs"), description: textOrNull(fd, "description"), descriptionEs: textOrNull(fd, "descriptionEs"), reviewStatus: review(fd), setSlug: orNull(text(fd, "setSlug")) };
      if (kind === "equipment") await api.saveEquipment({ ...shared, slotKey: orNull(text(fd, "typeKey")) }, { effectsMode: "simple" });
      else await api.saveJewelry({ ...shared, typeKey: orNull(text(fd, "typeKey")), groupKey: orNull(text(fd, "groupKey")) }, { effectsMode: "simple" });
    }
    return isNew ? { redirectTo: `${base}/${slug}?created=1` } : { message: "admin.saved" };
  }, [base, `/${kind === "gem" ? "gems" : kind}`]);
}
export const saveEquipmentAction = async (_prev: FormState, fd: FormData) => saveItem(fd, "equipment", "/admin/equipment");
export const saveJewelryAction = async (_prev: FormState, fd: FormData) => saveItem(fd, "jewelry", "/admin/jewelry");
export const saveGemAction = async (_prev: FormState, fd: FormData) => saveItem(fd, "gem", "/admin/gems");

async function deleteItem(fd: FormData, kind: "equipment" | "jewelry" | "gem", base: string) {
  return adminAction(async ({ api }) => {
    const slug = text(fd, "slug");
    requireConfirmation(fd, slug);
    if (kind === "equipment") await api.deleteEquipment(slug);
    else if (kind === "jewelry") await api.deleteJewelry(slug);
    else await api.deleteGem(slug);
    return { redirectTo: `${base}?deleted=1` };
  }, [base]);
}
export const deleteEquipmentAction = async (_prev: FormState, fd: FormData) => deleteItem(fd, "equipment", "/admin/equipment");
export const deleteJewelryAction = async (_prev: FormState, fd: FormData) => deleteItem(fd, "jewelry", "/admin/jewelry");
export const deleteGemAction = async (_prev: FormState, fd: FormData) => deleteItem(fd, "gem", "/admin/gems");

// ───────────────────────── Sets ─────────────────────────

export async function saveSetAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return adminAction(async ({ api }) => {
    const kind = text(fd, "kind") === "jewelry" ? "jewelry" : "equipment";
    const isNew = flag(fd, "isNew");
    const name = text(fd, "name");
    if (!name) throw new ValidationError("falta el nombre");
    const slug = isNew ? text(fd, "slug") || slugify(name) : text(fd, "slug");
    if (!slug) throw new ValidationError("no se puede crear un identificador con este nombre");
    const basics = {
      name,
      nameEs: textOrNull(fd, "nameEs"),
      description: textOrNull(fd, "description"),
      descriptionEs: textOrNull(fd, "descriptionEs"),
      tierStacking: (text(fd, "tierStacking") || "UNKNOWN") as "UNKNOWN" | "CUMULATIVE" | "REPLACES",
      reviewStatus: review(fd),
    };
    if (isNew) {
      const exists = kind === "equipment" ? await db.equipmentSet.findUnique({ where: { slug }, select: { id: true } }) : await db.jewelrySet.findUnique({ where: { slug }, select: { id: true } });
      if (exists) throw new ValidationError(`ya existe un conjunto con el identificador «${slug}»`);
      if (kind === "equipment") await api.upsertEquipmentSet({ ...basics, slug });
      else await api.upsertJewelrySet({ ...basics, slug, structureStatus: (text(fd, "structureStatus") || "UNCONFIRMED") as "UNCONFIRMED" | "CONFIRMED" });
      return { redirectTo: `/admin/sets/${kind}/${slug}?created=1` };
    }
    if (kind === "equipment") await api.updateEquipmentSetBasics(slug, basics);
    else await api.updateJewelrySetBasics(slug, { ...basics, structureStatus: (text(fd, "structureStatus") || "UNCONFIRMED") as "UNCONFIRMED" | "CONFIRMED" });
    return { message: "admin.saved" };
  }, ["/admin/sets", "/sets"]);
}

export async function deleteSetAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return adminAction(async ({ api }) => {
    const slug = text(fd, "slug");
    requireConfirmation(fd, slug);
    if (text(fd, "kind") === "jewelry") await api.deleteJewelrySet(slug);
    else await api.deleteEquipmentSet(slug);
    return { redirectTo: "/admin/sets?deleted=1" };
  }, ["/admin/sets", "/sets"]);
}

export async function saveTierAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return adminAction(async ({ api }) => {
    const kind = text(fd, "kind") === "jewelry" ? "jewelry" : "equipment";
    const pieces = intOrNull(fd, "requiredPieces", "pieces");
    if (pieces === null) throw new ValidationError("falta el número de piezas");
    await api.saveSetTier(kind, text(fd, "slug"), { requiredPieces: pieces, description: textOrNull(fd, "description"), effects: statEffects(fd, "tier") });
    return { message: "admin.saved" };
  }, ["/admin/sets", "/sets"]);
}

export async function deleteTierAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return adminAction(async ({ api }) => {
    await api.deleteSetTier(text(fd, "kind") === "jewelry" ? "jewelry" : "equipment", text(fd, "id"));
    return { message: "admin.deleted" };
  }, ["/admin/sets", "/sets"]);
}

// ───────────────────────── Effects glossary ─────────────────────────

export async function saveStatusAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return adminAction(async ({ api }) => {
    await api.updateStatusBasics(text(fd, "key"), {
      name: text(fd, "name"),
      nameEs: textOrNull(fd, "nameEs"),
      description: textOrNull(fd, "description"),
      descriptionEs: textOrNull(fd, "descriptionEs"),
      polarity: (text(fd, "polarity") || "UNKNOWN") as "UNKNOWN",
      cleansability: (text(fd, "cleansability") || "UNKNOWN") as "UNKNOWN",
      note: textOrNull(fd, "note"),
    });
    return { message: "admin.saved" };
  }, ["/admin/effects", "/effects"]);
}

export async function deleteStatusAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return adminAction(async ({ api }) => {
    const key = text(fd, "key");
    requireConfirmation(fd, key);
    await api.deleteStatus(key);
    return { redirectTo: "/admin/effects?deleted=1" };
  }, ["/admin/effects", "/effects"]);
}

// ───────────────────────── Users ─────────────────────────

export async function createUserAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return adminAction(async ({ api }) => {
    await api.createUser({ email: text(fd, "email"), name: textOrNull(fd, "name"), role: text(fd, "role") === "ADMIN" ? "ADMIN" : "USER", password: String(fd.get("password") ?? "") });
    return { message: "admin.created" };
  }, ["/admin/users"]);
}

export async function updateUserAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return adminAction(async ({ api }) => {
    const role = text(fd, "role");
    const active = text(fd, "isActive");
    await api.updateUser(text(fd, "id"), {
      ...(role === "ADMIN" || role === "USER" ? { role } : {}),
      ...(active === "true" ? { isActive: true } : active === "false" ? { isActive: false } : {}),
    });
    return { message: "admin.saved" };
  }, ["/admin/users"]);
}

export async function resetPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return adminAction(async ({ api }) => {
    await api.resetPassword(text(fd, "id"), String(fd.get("password") ?? ""));
    return { message: "admin.users.resetDone" };
  }, ["/admin/users"]);
}

export async function deleteUserAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return adminAction(async ({ api }) => {
    requireConfirmation(fd, text(fd, "email"));
    await api.deleteUser(text(fd, "id"));
    return { message: "admin.deleted" };
  }, ["/admin/users"]);
}
