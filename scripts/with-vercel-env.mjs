import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

/**
 * Runs a command with the variables of one Vercel environment, without printing or keeping them:
 *   node scripts/with-vercel-env.mjs preview -- npx prisma migrate deploy --schema prisma/postgres/schema.prisma
 * The variables are pulled to a temporary file that is deleted at once. TARGET_DATABASE_URL is set to DIRECT_URL for the data migration script.
 */
const [environment, dash, ...command] = process.argv.slice(2);
if (!environment || dash !== "--" || !command.length) throw new Error("usage: with-vercel-env.mjs <production|preview|development> -- <command...>");
const file = `.env.${environment}.run.tmp`;
const pull = spawnSync("vercel", ["env", "pull", file, "--environment", environment, "--yes", "--scope", "furia-ninja"], { encoding: "utf8", shell: true });
if (pull.status !== 0) throw new Error("vercel env pull failed");
const env = { ...process.env };
for (const line of readFileSync(file, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m) env[m[1]] = m[2];
}
rmSync(file, { force: true });
// Sensitive variables cannot be pulled; the integration provides the same direct URL as DATABASE_URL_UNPOOLED.
if (!/^postgres/.test(env.DIRECT_URL ?? "")) env.DIRECT_URL = env.DATABASE_URL_UNPOOLED;
env.TARGET_DATABASE_URL = env.DIRECT_URL;
const r = spawnSync(command[0], command.slice(1), { stdio: "inherit", env, shell: true });
process.exit(r.status ?? 1);
