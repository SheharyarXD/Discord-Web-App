import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

/**
 * A local PostgreSQL server for development and for verifying the PostgreSQL migration. Never used in production.
 *   node scripts/pg-embedded.mjs start   keeps a server running on port 15432 (data in .local-pg/data, git-ignored)
 * Other scripts import `startPg()` to get a throw-away server.
 */
export async function startPg({ port = 15432, dir = path.resolve(".local-pg/data"), fresh = false } = {}) {
  if (fresh) rmSync(dir, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "local-only", port, persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"] });
  if (!existsSync(path.join(dir, "PG_VERSION"))) {
    mkdirSync(dir, { recursive: true });
    await pg.initialise();
  }
  await pg.start();
  return {
    pg,
    url: (db) => `postgresql://postgres:local-only@127.0.0.1:${port}/${db}`,
    createDb: async (name) => { try { await pg.createDatabase(name); } catch { /* exists */ } },
    stop: () => pg.stop(),
  };
}

if (process.argv[2] === "start") {
  const s = await startPg();
  await s.createDb("furia_dev");
  console.log("PostgreSQL ready:", s.url("furia_dev").replace(/:[^:@]+@/, ":***@"));
  process.on("SIGINT", async () => { await s.stop(); process.exit(0); });
  setInterval(() => {}, 1 << 30);
}
