import type { ConditionView } from "@/domain/effects";
import type { Translate } from "@/i18n";

/**
 * One requirement/restriction. Meaning is carried by an icon AND an explicit text label
 * ("Requiere: Naturaleza Fuego"), never by color alone.
 */
export function ConditionBadge({ condition, t }: { condition: ConditionView; t: Translate }) {
  const excludes = condition.operator === "EXCLUDES";
  const detail = [
    condition.typeName,
    condition.valueName,
    condition.numericValue !== null ? String(condition.numericValue) : null,
    condition.note,
  ]
    .filter(Boolean)
    .join(" · ");
  const label = excludes ? t("effects.excludes") : t("effects.requires");

  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium " +
        (excludes ? "border-danger/50 text-danger" : "border-warn/50 text-warn")
      }
    >
      <span aria-hidden>{excludes ? "⊘" : "🔒"}</span>
      <span>
        <span className="font-semibold">{label}:</span> {detail}
      </span>
    </span>
  );
}
