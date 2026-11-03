import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { gunzipSync } from "node:zlib";

/**
 * Proves the equipment import only ADDED rows: every row that was in a pre-release backup is still in the database, unchanged.
 *   node scripts/with-vercel-env.mjs production -- env PG_CLIENT_DIR=.local-pg-old/client node scripts/gear-preexisting-check.mjs <backup.json.gz>
 * Read-only. Uses the client generated from the schema the backup was taken with.
 */
const file = process.argv[2];
const require = createRequire(import.meta.url);
const { PrismaClient, Prisma } = require(path.resolve(process.env.PG_CLIENT_DIR ?? ".local-pg/client"));
const url = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL;
const db = new PrismaClient({ datasourceUrl: url });
const backup = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
const tables = backup.tables ?? backup.data ?? backup;
const norm = (v) => (v === null || v === undefined ? null : v instanceof Date ? v.toISOString() : typeof v === "object" && typeof v.toFixed === "function" ? new Prisma.Decimal(v).toString() : v);

async function main() {
  const models = Prisma.dmmf.datamodel.models;
  const report = [];
  for (const m of models) {
    const rows = tables[m.name]?.data;
    if (!Array.isArray(rows)) continue;
    const delegate = m.name.charAt(0).toLowerCase() + m.name.slice(1);
    const now = await db[delegate].findMany();
    const byId = new Map(now.map((r) => [r.id ?? JSON.stringify(r), r]));
    const cols = m.fields.filter((f) => f.kind === "scalar").map((f) => f.name);
    let missing = 0;
    let changed = 0;
    for (const old of rows) {
      const cur = byId.get(old.id ?? JSON.stringify(old));
      if (!cur) {
        missing++;
        continue;
      }
      // updatedAt is bumped by an upsert that changes nothing else only when a column changed, so compare every column.
      if (cols.some((c) => JSON.stringify(norm(cur[c])) !== JSON.stringify(norm(old[c])))) changed++;
    }
    if (missing || changed || now.length !== rows.length) report.push({ table: m.name, before: rows.length, now: now.length, missing, changed });
  }
  console.log(JSON.stringify(report, null, 1));
  const bad = report.filter((r) => r.missing || r.changed);
  console.log(bad.length ? `PRE-EXISTING ROWS CHANGED OR MISSING in ${bad.map((b) => b.table).join(", ")}` : "every row of the backup is present and unchanged; the tables above only gained rows");
  await db.$disconnect();
}
main();
