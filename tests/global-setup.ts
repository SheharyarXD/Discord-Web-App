import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(__dirname, ".tmp");
export const TEST_DB_URL = `file:${path.join(dir, "test.db").replace(/\\/g, "/")}`;

/** TEST_DB=postgres: a throw-away local PostgreSQL, migrated with the real PostgreSQL migrations. */
async function setupPostgres() {
  // @ts-expect-error plain JavaScript helper
  const { startPg } = await import("../scripts/pg-embedded.mjs");
  const server = await startPg({ port: 15434, dir: path.resolve(__dirname, "../.local-pg/test-data"), fresh: true });
  await server.createDb("furia_test");
  const url = server.url("furia_test");
  process.env.TEST_PG_URL = url;
  process.env.DATABASE_URL = url;
  execSync("npx prisma migrate deploy --schema prisma/postgres/schema.prisma", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url } });
  return async () => {
    await server.stop();
  };
}

/** Creates a fresh SQLite database by running the real migrations — this verifies them too. */
export default function setup() {
  if (process.env.TEST_DB === "postgres") return setupPostgres();
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  process.env.DATABASE_URL = TEST_DB_URL;
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: TEST_DB_URL } });
  return () => rmSync(dir, { recursive: true, force: true });
}
