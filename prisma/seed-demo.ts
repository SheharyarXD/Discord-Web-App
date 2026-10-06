import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedVocabulary } from "./vocabulary";

/**
 * DEVELOPMENT-ONLY placeholder data to exercise the UI. Everything is prefixed "[DEMO]"
 * and is NOT game data. Run `npm run db:seed:demo -- --clean` to remove it.
 */
const db = new PrismaClient();
const PREFIX = "[DEMO]";
const SLUGS = ["demo-ninja-one-talent", "demo-ninja-two-talents"];

async function clean() {
  await db.ninja.deleteMany({ where: { slug: { in: SLUGS } } });
  await db.ninjaRole.deleteMany({ where: { key: "demo-role" } });
  await db.statistic.deleteMany({ where: { key: { startsWith: "demo-stat" } } });
  await db.conditionValue.deleteMany({ where: { key: "demo-nature" } });
}

async function main() {
  await clean();
  if (process.argv.includes("--clean")) return console.log("✔ Demo data removed");

  await seedVocabulary(db);
  const role = await db.ninjaRole.create({ data: { key: "demo-role", name: `${PREFIX} Rol` } });
  const stat = await db.statistic.create({ data: { key: "demo-stat-a", name: `${PREFIX} Estadística A`, defaultValueType: "PERCENT" } });
  const natureType = await db.conditionType.findUniqueOrThrow({ where: { key: "nature" } });
  const nature = await db.conditionValue.create({ data: { key: "demo-nature", name: `${PREFIX} Naturaleza`, conditionTypeId: natureType.id } });
  const skill = await db.abilityType.findUniqueOrThrow({ where: { key: "skill" } });

  await db.ninja.create({
    data: {
      slug: SLUGS[0]!, name: `${PREFIX} Ninja con un talento`, status: "PUBLISHED", roleId: role.id,
      description: "Datos de marcador de posición. No es información del juego.",
      abilities: { create: [{ name: `${PREFIX} Habilidad`, abilityTypeId: skill.id,
        effects: { create: [{ statisticId: stat.id, value: 30, valueType: "PERCENT",
          conditions: { create: [{ conditionTypeId: natureType.id, conditionValueId: nature.id }] } }] } }] },
      talentGroups: { create: [{ options: { create: [{ name: `${PREFIX} Talento único`, isDefault: true }] } }] },
    },
  });
  await db.ninja.create({
    data: {
      slug: SLUGS[1]!, name: `${PREFIX} Ninja con dos talentos`, status: "PUBLISHED", roleId: role.id,
      description: "Datos de marcador de posición. No es información del juego.",
      talentGroups: { create: [{ selectionMode: "ONE_OF", options: { create: [
        { name: `${PREFIX} Talento A`, isDefault: true, sortOrder: 0 },
        { name: `${PREFIX} Talento B`, sortOrder: 1 },
      ] } }] },
    },
  });
  console.log("✔ Demo data created (all names prefixed [DEMO])");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
