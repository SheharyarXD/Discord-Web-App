import "server-only";
import type { Prisma } from "@prisma/client";
import type { ConditionView, EffectView } from "@/domain/effects";
import type { ValueType } from "@/domain/constants";

export const effectInclude = {
  statistic: true,
  target: true,
  conditions: {
    orderBy: [{ alternativeGroup: "asc" }, { sortOrder: "asc" }],
    include: { conditionType: true, conditionValue: true },
  },
} satisfies Prisma.EffectInclude;

type EffectRow = Prisma.EffectGetPayload<{ include: typeof effectInclude }>;

/** Maps a database row to the UI-agnostic EffectView. The only place rows become views. */
export function toEffectView(row: EffectRow): EffectView {
  return {
    id: row.id,
    statisticName: row.statistic?.name ?? null,
    value: row.value,
    valueType: row.valueType as ValueType,
    targetName: row.target?.name ?? null,
    durationTurns: row.durationTurns,
    chancePercent: row.chancePercent,
    description: row.description,
    conditions: row.conditions.map(
      (c): ConditionView => ({
        id: c.id,
        typeKey: c.conditionType.key,
        typeName: c.conditionType.name,
        valueName: c.conditionValue?.name ?? null,
        operator: c.operator as ConditionView["operator"],
        numericValue: c.numericValue,
        note: c.note,
        alternativeGroup: c.alternativeGroup,
      }),
    ),
  };
}
