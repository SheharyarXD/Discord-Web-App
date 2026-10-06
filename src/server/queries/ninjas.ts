import "server-only";
import { db } from "@/server/db";
import { effectInclude, toEffectView } from "./effects";
import type { SelectionMode } from "@/domain/constants";

export async function listNinjas() {
  return db.ninja.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { name: "asc" },
    include: { role: true },
  });
}

const effectsArgs = { include: effectInclude, orderBy: { sortOrder: "asc" } } as const;

export async function getNinjaBySlug(slug: string) {
  const ninja = await db.ninja.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      role: true,
      abilities: {
        orderBy: { sortOrder: "asc" },
        include: { abilityType: true, effects: effectsArgs },
      },
      talentGroups: {
        orderBy: { sortOrder: "asc" },
        include: { options: { orderBy: { sortOrder: "asc" }, include: { effects: effectsArgs } } },
      },
    },
  });
  if (!ninja) return null;
  return {
    ...ninja,
    abilities: ninja.abilities.map((a) => ({ ...a, effects: a.effects.map(toEffectView) })),
    talentGroups: ninja.talentGroups.map((g) => ({
      ...g,
      selectionMode: g.selectionMode as SelectionMode,
      options: g.options.map((o) => ({ ...o, effects: o.effects.map(toEffectView) })),
    })),
  };
}
