import type { Prisma, PrismaClient } from "@prisma/client";
import type { z } from "zod";

/** A Prisma client or an open transaction. Services accept either. */
export type Db = PrismaClient | Prisma.TransactionClient;

/** Input rejected before touching the database. `issues` are "path: message" strings. */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: string[] = [],
  ) {
    super(issues.length ? `${message}: ${issues.join("; ")}` : message);
    this.name = "ValidationError";
  }
}

/** A referenced vocabulary row (statistic, status, type...) does not exist. Nothing is auto-created. */
export class UnknownReferenceError extends ValidationError {
  constructor(kind: string, key: string) {
    super(`Unknown ${kind} "${key}"`);
    this.name = "UnknownReferenceError";
  }
}

export function parseInput<S extends z.ZodType>(schema: S, input: unknown, what: string): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      `Invalid ${what}`,
      result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    );
  }
  return result.data;
}

/** Runs `fn` atomically. Re-uses the transaction when already inside one. */
export function inTransaction<T>(db: Db, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return "$transaction" in db ? db.$transaction(fn) : fn(db);
}

export const toNumber = (d: Prisma.Decimal | null | undefined): number | null => (d == null ? null : d.toNumber());
