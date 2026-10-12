import type { SelectionMode } from "../domain/constants";
import { selectionLimit } from "../domain/talents";
import { inTransaction, ValidationError, type Db } from "./db";

/**
 * Stores ONE USER's pick(s) inside a talent group, replacing that user's previous pick there.
 * An empty list clears it. This is build state belonging to the user — it never changes the
 * ninja's canonical record and is invisible to other users.
 *
 * A ONE_OF group accepts at most one option; the database trigger enforces the same limit.
 */
export async function setTalentSelection(db: Db, userId: string, groupId: string, optionIds: string[]): Promise<string[]> {
  return inTransaction(db, async (tx) => {
    const group = await tx.talentGroup.findUnique({
      where: { id: groupId },
      select: { selectionMode: true, maxSelections: true, options: { select: { id: true } } },
    });
    if (!group) throw new ValidationError("Unknown talent group");

    const wanted = [...new Set(optionIds)];
    const valid = new Set(group.options.map((o) => o.id));
    if (wanted.some((id) => !valid.has(id))) throw new ValidationError("Option does not belong to this talent group");
    const max = selectionLimit({ ...group, selectionMode: group.selectionMode as SelectionMode });
    if (wanted.length > max) throw new ValidationError(`This talent group allows at most ${max} selection(s)`);

    await tx.userTalentSelection.deleteMany({ where: { userId, option: { groupId } } });
    for (const optionId of wanted) await tx.userTalentSelection.create({ data: { userId, optionId } });
    return wanted;
  });
}

/** A user's picks, as option ids, optionally limited to one ninja. */
export async function getTalentSelections(db: Db, userId: string, ninjaId?: string): Promise<string[]> {
  const rows = await db.userTalentSelection.findMany({
    where: { userId, ...(ninjaId ? { option: { group: { ninjaId } } } : {}) },
    select: { optionId: true },
  });
  return rows.map((r) => r.optionId);
}
