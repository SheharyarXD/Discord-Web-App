import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

/**
 * Logical backup and restore of the PostgreSQL database (no pg_dump needed). Plain JSON, gzip compressed, with a checksum per table.
 *
 *   node scripts/pg-backup-restore.mjs backup  <file.json.gz>   reads DATABASE_URL (or DIRECT_URL); read-only
 *   node scripts/pg-backup-restore.mjs restore <file.json.gz>   writes into an EMPTY database in one transaction, then compares checksums
 *   node scripts/pg-backup-restore.mjs verify  <file.json.gz>   compares a database with a backup; writes nothing
 *
 * Production example (variables are pulled and discarded, nothing is printed):
 *   node scripts/with-vercel-env.mjs production -- node scripts/pg-backup-restore.mjs backup prisma/backups/production-YYYYMMDD.json.gz
 * Backups contain account password hashes: keep them in the git-ignored prisma/backups folder or in private storage.
 * Needs the PostgreSQL client: node prisma/make-postgres-schema.mjs --local && npx prisma generate --schema .local-pg/schema.prisma
 */
const [command, file] = process.argv.slice(2);
if (!["backup", "restore", "verify"].includes(command) || !file) throw new Error("usage: pg-backup-restore.mjs <backup|restore|verify> <file.json.gz>");
if (!existsSync(".local-pg/client/index.js")) throw new Error("PostgreSQL client missing: run node prisma/make-postgres-schema.mjs --local && npx prisma generate --schema .local-pg/schema.prisma");
const require = createRequire(import.meta.url);
const { PrismaClient, Prisma } = require(path.resolve(".local-pg/client"));
const url = process.env.TARGET_DATABASE_URL ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url || !/^postgres(ql)?:\/\//.test(url)) throw new Error("a PostgreSQL URL is required (DIRECT_URL, DATABASE_URL or TARGET_DATABASE_URL)");
const db = new PrismaClient({ datasourceUrl: url });

const models = Prisma.dmmf.datamodel.models;
const byName = new Map(models.map((m) => [m.name, m]));
const delegate = (m) => m.name.charAt(0).toLowerCase() + m.name.slice(1);
const deps = new Map(models.map((m) => [m.name, new Set()]));
const selfFields = new Map(models.map((m) => [m.name, []]));
for (const m of models) {
  for (const f of m.fields) {
    if (f.kind !== "object" || !f.relationFromFields?.length) continue;
    if (f.type === m.name) selfFields.get(m.name).push(...f.relationFromFields);
    else deps.get(m.name).add(f.type);
  }
}
const order = [];
for (const left = new Set(models.map((m) => m.name)); left.size; ) {
  const ready = [...left].filter((n) => [...deps.get(n)].every((d) => !left.has(d))).sort();
  if (!ready.length) throw new Error("circular dependency");
  for (const n of ready) { order.push(n); left.delete(n); }
}
const norm = (v) => (v === null || v === undefined ? null : v instanceof Date ? v.toISOString() : typeof v === "object" && typeof v.toFixed === "function" ? new Prisma.Decimal(v).toString() : v);
const checksum = (rows, m) => {
  const cols = m.fields.filter((f) => f.kind === "scalar").map((f) => f.name).sort();
  return createHash("sha256").update(rows.map((r) => JSON.stringify(cols.map((c) => norm(r[c])))).sort().join("\n")).digest("hex");
};
const readAll = async () => Object.fromEntries(await Promise.all(order.map(async (n) => [n, await db[delegate(byName.get(n))].findMany()])));
const serialisable = (rows, m) => rows.map((r) => Object.fromEntries(m.fields.filter((f) => f.kind === "scalar").map((f) => [f.name, norm(r[f.name])])));
function revive(rows, m) {
  const dates = m.fields.filter((f) => f.type === "DateTime").map((f) => f.name);
  return rows.map((r) => ({ ...r, ...Object.fromEntries(dates.map((d) => [d, r[d] === null ? null : new Date(r[d])])) }));
}
function parentsFirst(rows, fields) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const done = new Set(), out = [];
  const visit = (r) => { if (done.has(r.id)) return; done.add(r.id); for (const f of fields) if (r[f] != null && byId.has(r[f])) visit(byId.get(r[f])); out.push(r); };
  rows.forEach(visit);
  return out;
}
const label = (() => { try { return new URL(url).host.replace(/^[^.]*\./, "*."); } catch { return "?"; } })();

try {
  if (command === "backup") {
    const data = await readAll();
    const tables = Object.fromEntries(order.map((n) => [n, { rows: data[n].length, sha256: checksum(data[n], byName.get(n)), data: serialisable(data[n], byName.get(n)) }]));
    const body = JSON.stringify({ format: "furia-ninja-logical-backup-1", createdAt: new Date().toISOString(), tables });
    writeFileSync(file, gzipSync(Buffer.from(body)));
    console.log(`backup of ${label}: ${order.length} tables, ${order.reduce((n, t) => n + tables[t].rows, 0)} rows -> ${file} (${(body.length / 1024).toFixed(0)} KB uncompressed, sha256 ${createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 16)}...)`);
  } else {
    const backup = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
    if (backup.format !== "furia-ninja-logical-backup-1") throw new Error("unknown backup format");
    if (command === "restore") {
      for (const n of order) if ((await db[delegate(byName.get(n))].count()) > 0) throw new Error(`the target is not empty (${n}); refusing to restore`);
      await db.$transaction(
        async (tx) => {
          for (const n of order) {
            const m = byName.get(n);
            const rows = revive(backup.tables[n]?.data ?? [], m);
            const ordered = selfFields.get(n).length ? parentsFirst(rows, selfFields.get(n)) : rows;
            for (let i = 0; i < ordered.length; i += 500) await tx[delegate(m)].createMany({ data: ordered.slice(i, i + 500) });
          }
        },
        { timeout: 900000, maxWait: 60000 },
      );
      console.log(`restored into ${label}`);
    }
    const data = await readAll();
    let bad = 0;
    for (const n of order) {
      const ok = data[n].length === backup.tables[n].rows && checksum(data[n], byName.get(n)) === backup.tables[n].sha256;
      if (!ok) { bad++; console.log(`MISMATCH ${n}`); }
    }
    console.log(bad ? `${bad} table(s) differ from the backup` : `all ${order.length} tables match the backup (counts and content checksums)`);
    process.exitCode = bad ? 1 : 0;
  }
} finally {
  await db.$disconnect();
}
