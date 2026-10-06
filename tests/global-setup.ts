import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(__dirname, ".tmp");
export const TEST_DB_URL = `file:${path.join(dir, "test.db").replace(/\\/g, "/")}`;

/** Creates a fresh SQLite database by running the real migrations — this verifies them too. */
export default function setup() {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  process.env.DATABASE_URL = TEST_DB_URL;
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: TEST_DB_URL } });
  return () => rmSync(dir, { recursive: true, force: true });
}
