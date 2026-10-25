import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

/**
 * Adds the application's own variables to the Vercel project, per environment, without ever printing a value:
 *   DIRECT_URL      = the unpooled Neon URL of that environment (used by migrations)
 *   SESSION_DAYS    = 14
 *   FEATURE_GEMS    = false
 * Usage: node scripts/vercel-set-env.mjs furia-ninja   (needs `vercel link` and a signed-in CLI)
 */
const scope = process.argv[2] ?? "furia-ninja";
const vercel = (args, input) => spawnSync("vercel", [...args, "--scope", scope], { input, encoding: "utf8", shell: true });

for (const env of ["production", "preview"]) {
  const file = `.env.${env}.pulled.tmp`;
  vercel(["env", "pull", file, "--environment", env, "--yes"]);
  const text = readFileSync(file, "utf8");
  rmSync(file, { force: true });
  const get = (key) => text.match(new RegExp(`^${key}="?([^"\\n]*)"?`, "m"))?.[1];
  const direct = get("DATABASE_URL_UNPOOLED");
  const pooled = get("DATABASE_URL");
  if (!direct || !pooled || !/^postgres/.test(direct)) throw new Error(`${env}: Neon variables not found`);
  const set = (name, value, sensitive) => {
    vercel(["env", "rm", name, env, "--yes"]);
    const r = vercel(["env", "add", name, env, ...(sensitive ? ["--sensitive"] : [])], value);
    console.log(`${env}: ${name} ${r.status === 0 ? "set" : "FAILED " + (r.stderr || "").split("\n")[0]}`);
  };
  set("DIRECT_URL", direct, true);
  set("SESSION_DAYS", "14", false);
  set("FEATURE_GEMS", "false", false);
}
