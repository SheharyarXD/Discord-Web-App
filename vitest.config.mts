import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // TEST_DB=postgres (npm run test:pg): the same tests run against a local PostgreSQL with the PostgreSQL client.
  resolve: { alias: { "@": path.resolve(__dirname, "src"), ...(process.env.TEST_DB === "postgres" ? { "@prisma/client": path.resolve(__dirname, ".local-pg/client") } : {}) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
  },
});
