"use server";

import { revalidatePath } from "next/cache";
import { ValidationError } from "@/game/db";
import { ForbiddenError } from "@/server/auth/permissions";
import { getGameApi } from "@/server/game-api";

const SLUG = /^[a-z0-9-]{1,200}$/;

/**
 * Stores the current user's own talent pick (or clears it when no option is posted).
 * The user id comes from the session on the server — never from the form.
 */
export async function selectTalentAction(formData: FormData): Promise<void> {
  const groupId = String(formData.get("groupId") ?? "");
  const optionId = formData.get("optionId");
  const slug = String(formData.get("slug") ?? "");
  try {
    const api = await getGameApi();
    await api.selectTalent(groupId, typeof optionId === "string" && optionId ? [optionId] : []);
  } catch (e) {
    if (!(e instanceof ForbiddenError) && !(e instanceof ValidationError)) throw e;
  }
  if (SLUG.test(slug)) revalidatePath(`/ninjas/${slug}`);
}
