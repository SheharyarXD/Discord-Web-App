import "server-only";
import { db } from "@/server/db";

export async function getContentCounts() {
  const [ninjas, equipment, jewelry, gems, equipmentSets, jewelrySets] = await Promise.all([
    db.ninja.count({ where: { status: "PUBLISHED" } }),
    db.equipment.count({ where: { status: "PUBLISHED" } }),
    db.jewelry.count({ where: { status: "PUBLISHED" } }),
    db.gem.count({ where: { status: "PUBLISHED" } }),
    db.equipmentSet.count(),
    db.jewelrySet.count(),
  ]);
  return { ninjas, equipment, jewelry, gems, sets: equipmentSets + jewelrySets };
}
