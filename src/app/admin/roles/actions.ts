"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { ForbiddenError, requirePermission } from "@/server/auth/guards";
import { slugify } from "@/domain/slug";
import type { FormState } from "@/components/forms/form-state";

const roleSchema = z.object({
  name: z.string().trim().min(1).max(80),
  key: z.string().trim().max(60).optional(),
});

/**
 * Reference implementation of the admin-mutation pattern used by Milestone 3:
 *   1. authorize on the server  2. validate with zod  3. write via Prisma  4. return a typed state.
 */
export async function createRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await requirePermission("content:write");
  } catch (e) {
    if (e instanceof ForbiddenError) return { status: "error", message: "admin.forbidden" };
    throw e;
  }

  const parsed = roleSchema.safeParse({ name: formData.get("name"), key: formData.get("key") || undefined });
  if (!parsed.success) {
    const fieldErrors: NonNullable<FormState["fieldErrors"]> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = "admin.validation";
    return { status: "error", message: "admin.validation", fieldErrors };
  }

  const key = slugify(parsed.data.key || parsed.data.name);
  if (!key) return { status: "error", message: "admin.validation", fieldErrors: { key: "admin.validation" } };

  try {
    await db.ninjaRole.create({ data: { key, name: parsed.data.name } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { status: "error", message: "admin.roleExists", fieldErrors: { key: "admin.roleExists" } };
    }
    throw e;
  }
  revalidatePath("/admin/roles");
  return { status: "success", message: "admin.roleCreated" };
}
