/**
 * SQLite's LIKE ignores case for ASCII; PostgreSQL's does not. On PostgreSQL the name searches ask for
 * `mode: "insensitive"`. The cast keeps one source valid for both generated Prisma clients.
 */
export const CI = (process.env.DATABASE_URL?.startsWith("postgres") ? { mode: "insensitive" } : {}) as { mode?: never };
