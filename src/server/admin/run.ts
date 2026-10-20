import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { ValidationError, UnknownReferenceError } from "@/game/db";
import { UserRuleError } from "@/game/users";
import type { GameApi } from "@/game/api";
import type { FormState } from "@/components/forms/form-state";
import type { MessageKey } from "@/i18n";
import { ForbiddenError, requirePermission } from "@/server/auth/guards";
import type { SessionUser } from "@/server/auth/session";
import { getGameApi } from "@/server/game-api";

export interface AdminResult {
  /** Where to go after a successful save (a new record's edit page, the list after a delete). */
  redirectTo?: string;
  message?: MessageKey;
}

const USER_RULE_MESSAGE: Record<UserRuleError["code"], MessageKey> = {
  SELF: "admin.users.self",
  LAST_ADMIN: "admin.users.lastAdmin",
  NOT_FOUND: "admin.notFound",
  EMAIL_TAKEN: "admin.users.emailTaken",
};

/**
 * The one way an administrator server action runs:
 *   1. the caller must be an administrator (re-checked on the server, whatever the page showed);
 *   2. the work goes through the game API, which checks the permission of every call again;
 *   3. every known failure becomes a typed message for the form, never a stack trace.
 */
export async function adminAction(work: (ctx: { api: GameApi; user: SessionUser }) => Promise<AdminResult | void>, revalidate: string[] = []): Promise<FormState> {
  let result: AdminResult | void;
  try {
    const user = await requirePermission("admin:access");
    result = await work({ api: await getGameApi(), user });
  } catch (e) {
    if (e instanceof ForbiddenError) return { status: "error", message: "admin.forbidden" };
    if (e instanceof UserRuleError) return { status: "error", message: USER_RULE_MESSAGE[e.code] };
    if (e instanceof UnknownReferenceError) return { status: "error", message: "admin.unknownRef", detail: e.message };
    if (e instanceof ValidationError) return { status: "error", message: "admin.validation", detail: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return { status: "error", message: "admin.exists" };
      if (e.code === "P2003" || e.code === "P2014") return { status: "error", message: "admin.inUse" };
    }
    throw e;
  }
  for (const path of revalidate) revalidatePath(path);
  if (result?.redirectTo) redirect(result.redirectTo);
  return { status: "success", message: result?.message ?? "admin.saved" };
}
