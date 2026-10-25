import { execSync, spawnSync } from "node:child_process";

/** Runs the test suite against a local PostgreSQL (npm run test:pg [-- vitest args]). */
const dummy = "postgresql://x:x@127.0.0.1:1/x";
execSync("node prisma/make-postgres-schema.mjs --local", { stdio: "inherit" });
execSync("npx prisma generate --schema .local-pg/schema.prisma", { stdio: "inherit", env: { ...process.env, DATABASE_URL: dummy, DIRECT_URL: dummy } });
const r = spawnSync("npx", ["vitest", "run", ...process.argv.slice(2)], { stdio: "inherit", shell: true, env: { ...process.env, TEST_DB: "postgres" } });
process.exit(r.status ?? 1);
