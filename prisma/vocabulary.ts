import type { PrismaClient } from "@prisma/client";

/**
 * STRUCTURAL vocabulary only — the kinds of things the model can express.
 * It contains no game content (no statistics, natures, roles, ninjas or items);
 * those are entered by the admin from the client's reference material.
 */
export const ABILITY_TYPES = ["skill", "passive", "awakening", "attack", "normal_skill", "special_skill", "talent_awakening", "skill_awakening", "status_note"] as const;
export const CONDITION_TYPES = ["nature", "role", "element", "target", "trigger", "status", "restriction", "formation", "ninja", "gender", "battle_mode", "trait"] as const;
export const EFFECT_TARGETS = ["self", "ally", "enemy"] as const;

const titleCase = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);

/** Display names are Spanish placeholders the admin can rename. */
const NAMES_ES: Record<string, string> = {
  skill: "Habilidad", passive: "Pasiva", awakening: "Despertar", attack: "Ataque",
  nature: "Naturaleza", role: "Rol", element: "Elemento", target: "Objetivo",
  trigger: "Activador", status: "Estado", restriction: "Restricción",
  self: "Propio", ally: "Aliado", enemy: "Enemigo",
  formation: "Formación", ninja: "Ninja", gender: "Género",
  normal_skill: "Habilidad normal", special_skill: "Habilidad especial",
  talent_awakening: "Despertar de talento", skill_awakening: "Despertar de habilidad",
  battle_mode: "Modo de combate", trait: "Rasgo", status_note: "Definición de estado",
};

export async function seedVocabulary(db: PrismaClient): Promise<void> {
  const name = (key: string) => NAMES_ES[key] ?? titleCase(key);
  for (const [i, key] of ABILITY_TYPES.entries()) {
    await db.abilityType.upsert({ where: { key }, update: {}, create: { key, name: name(key), sortOrder: i } });
  }
  for (const [i, key] of CONDITION_TYPES.entries()) {
    await db.conditionType.upsert({ where: { key }, update: {}, create: { key, name: name(key), sortOrder: i } });
  }
  for (const [i, key] of EFFECT_TARGETS.entries()) {
    await db.effectTarget.upsert({ where: { key }, update: {}, create: { key, name: name(key), sortOrder: i } });
  }
}
