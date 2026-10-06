import { formatEffectValue } from "@/domain/effects";
import type { ValueType } from "@/domain/constants";

/** Statistic name + formatted value ("Attack +30%"). Presentational; no mechanics inside. */
export function StatBadge({ name, value, valueType }: { name: string; value: number | null; valueType: ValueType }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-md bg-surface-2 px-2.5 py-1 text-sm">
      <span className="text-muted">{name}</span>
      <span className="font-semibold tabular-nums text-fg">{formatEffectValue(value, valueType)}</span>
    </span>
  );
}
