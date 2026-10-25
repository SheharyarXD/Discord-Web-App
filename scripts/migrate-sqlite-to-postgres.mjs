import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { PrismaClient as SqliteClient, Prisma } from "@prisma/client";

/**
 * Copies every row of the SQLite database into an EMPTY PostgreSQL database, in foreign-key order, inside ONE transaction
 * (all or nothing, so a failed run leaves nothing behind and can simply be run again), then compares every table.
 *
 *   TARGET_DATABASE_URL=<direct postgres url> node scripts/migrate-sqlite-to-postgres.mjs [--source prisma/dev.db] [--csv file.csv] [--dry-run | --verify-only]
 *
 * Needs the PostgreSQL client: npm run db:pg:schema, then  npx prisma generate --schema .local-pg/schema.prisma  (after  node prisma/make-postgres-schema.mjs --local).
 * Refuses to run when the target already holds data. Never prints a connection string.
 */
const require = createRequire(import.meta.url);
const arg = (name, fallback) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback);
const source = path.resolve(arg("--source", "prisma/dev.db"));
const csvPath = arg("--csv", null);
const dryRun = process.argv.includes("--dry-run");
const verifyOnly = process.argv.includes("--verify-only"); // writes nothing; compares an already migrated target with the source
const target = process.env.TARGET_DATABASE_URL;
if (!target || !/^postgres(ql)?:\/\//.test(target)) throw new Error("TARGET_DATABASE_URL (a PostgreSQL direct connection URL) is required");
if (!existsSync(source)) throw new Error(`SQLite source not found: ${source}`);
if (!existsSync(".local-pg/client/index.js")) throw new Error("PostgreSQL client missing: run node prisma/make-postgres-schema.mjs --local && npx prisma generate --schema .local-pg/schema.prisma");

const { PrismaClient: PgClient } = require(path.resolve(".local-pg/client"));
const lite = new SqliteClient({ datasourceUrl: `file:${source.replace(/\\/g, "/")}` });
const pg = new PgClient({ datasourceUrl: target });
const host = (() => { try { return new URL(target).host.replace(/^[^.]*\./, "*."); } catch { return "?"; } })();

const models = Prisma.dmmf.datamodel.models;
const delegate = (m) => m.name.charAt(0).toLowerCase() + m.name.slice(1);

// Foreign-key order. A self reference is loaded in a second pass (the column is null in the first).
const deps = new Map(models.map((m) => [m.name, new Set()]));
const selfFields = new Map(models.map((m) => [m.name, []]));
for (const m of models) {
  for (const f of m.fields) {
    if (f.kind === "object" && f.relationFromFields?.length) {
      if (f.type === m.name) selfFields.get(m.name).push(...f.relationFromFields);
      else deps.get(m.name).add(f.type);
    }
  }
}
const order = [];
const left = new Set(models.map((m) => m.name));
while (left.size) {
  const ready = [...left].filter((n) => [...deps.get(n)].every((d) => !left.has(d)));
  if (!ready.length) throw new Error(`circular dependency between: ${[...left].join(", ")}`);
  for (const n of ready.sort()) { order.push(n); left.delete(n); }
}

function parentsFirst(rows, fields) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const done = new Set();
  const out = [];
  const visit = (r, trail = new Set()) => {
    if (done.has(r.id)) return;
    if (trail.has(r.id)) throw new Error(`circular reference in ${r.id}`);
    trail.add(r.id);
    for (const f of fields) if (r[f] != null && byId.has(r[f])) visit(byId.get(r[f]), trail);
    done.add(r.id);
    out.push(r);
  };
  rows.forEach((r) => visit(r));
  return out;
}

const norm = (v) => (v === null || v === undefined ? null : v instanceof Date ? v.toISOString() : typeof v === "object" && typeof v.toFixed === "function" ? new Prisma.Decimal(v).toString() : v);
const checksum = (rows, model) => {
  const cols = model.fields.filter((f) => f.kind === "scalar").map((f) => f.name).sort();
  const lines = rows.map((r) => JSON.stringify(cols.map((c) => norm(r[c])))).sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex");
};
const byName = new Map(models.map((m) => [m.name, m]));
const all = (client, m) => client[delegate(m)].findMany();

console.log(`source ${path.basename(source)} -> PostgreSQL ${host}${dryRun ? " (dry run: nothing is written)" : ""}`);
const nonEmpty = [];
for (const m of models) if ((await pg[delegate(m)].count()) > 0) nonEmpty.push(m.name);
if (nonEmpty.length && !verifyOnly) throw new Error(`the target is not empty (${nonEmpty.slice(0, 5).join(", ")}...). Refusing to write.`);

const data = new Map();
for (const name of order) data.set(name, await all(lite, byName.get(name)));
const total = [...data.values()].reduce((n, r) => n + r.length, 0);
console.log(`read ${total} rows from ${order.length} tables`);

if (!dryRun && !verifyOnly) {
  await pg.$transaction(
    async (tx) => {
      for (const name of order) {
        const m = byName.get(name);
        const rows = data.get(name);
        if (!rows.length) continue;
        const selfs = selfFields.get(name);
        // A table that points at itself (Ability, Formation) is loaded with referenced rows first, so no foreign key and no trigger is ever bypassed.
        const ordered = selfs.length ? parentsFirst(rows, selfs) : rows;
        for (let i = 0; i < ordered.length; i += 500) await tx[delegate(m)].createMany({ data: ordered.slice(i, i + 500) });
      }
    },
    { timeout: 900000, maxWait: 60000 },
  );
  console.log("committed");
}

const report = [["table", "sqlite_rows", "postgres_rows", "sqlite_sha256", "postgres_sha256", "match"]];
let mismatches = 0;
for (const name of order) {
  const m = byName.get(name);
  const a = data.get(name);
  const b = dryRun ? a : await all(pg, m);
  const ca = checksum(a, m), cb = checksum(b, m);
  const ok = a.length === b.length && ca === cb;
  if (!ok) mismatches++;
  report.push([name, a.length, b.length, ca, cb, ok ? "MATCH" : "MISMATCH"]);
}
console.log(report.slice(1).filter((r) => r[1] || r[2]).map((r) => `${r[0].padEnd(24)} ${String(r[1]).padStart(6)} -> ${String(r[2]).padStart(6)}  ${r[5]}`).join("\n"));
console.log(mismatches ? `${mismatches} table(s) DIFFER` : `all ${order.length} tables match (counts and content checksums)`);
if (csvPath) writeFileSync(csvPath, report.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n") + "\n");
await lite.$disconnect();
await pg.$disconnect();
process.exitCode = mismatches ? 1 : 0;
