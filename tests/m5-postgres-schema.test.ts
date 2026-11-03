import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain JavaScript helper
import { postgresSchema } from "../prisma/make-postgres-schema.mjs";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

describe("PostgreSQL production schema", () => {
  it("the committed schema is exactly what the generator derives from prisma/schema.prisma", () => {
    expect(read("prisma/postgres/schema.prisma")).toBe(postgresSchema());
  });

  it("uses PostgreSQL with a pooled runtime URL and a direct migration URL, and no secret", () => {
    const schema = read("prisma/postgres/schema.prisma");
    expect(schema).toMatch(/provider\s+= "postgresql"/);
    expect(schema).toMatch(/url\s+= env\("DATABASE_URL"\)/);
    expect(schema).toMatch(/directUrl = env\("DIRECT_URL"\)/);
    expect(schema).not.toMatch(/postgres(ql)?:\/\//);
  });

  it("the PostgreSQL migrations (baseline plus the additive ones) create every model and carry exactly the 16 integrity triggers", () => {
    const dir = path.join(ROOT, "prisma/postgres/migrations");
    const folders = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    expect(folders[0]).toBe("20261026000000_postgres_baseline");
    const sql = folders.map((f) => read(`prisma/postgres/migrations/${f}/migration.sql`)).join(String.fromCharCode(10));
    // A migration is plain SQL: a generator warning pasted into the file would fail the deployment.
    for (const f of folders) expect(read(`prisma/postgres/migrations/${f}/migration.sql`).trimStart().startsWith("--"), f).toBe(true);
    const models = [...read("prisma/schema.prisma").matchAll(/^model (\w+) \{/gm)].map((m) => m[1]!);
    for (const model of models) expect(sql, model).toContain(`CREATE TABLE "${model}"`);
    expect((sql.match(/CREATE TRIGGER/g) ?? []).length).toBe(16);
  });
});
