import type { ReviewStatus } from "@/domain/constants";
import type { Translate } from "@/i18n";
import { Tag } from "@/components/ui/primitives";

const TONE = { CONFIRMED: "ok", PARTIALLY_CONFIRMED: "warn", NEEDS_REVIEW: "warn" } as const;

/** How far a record has been checked against its source. */
export function ReviewBadge({ status, t }: { status: ReviewStatus; t: Translate }) {
  return (
    <Tag tone={TONE[status]}>
      <span aria-hidden>{status === "CONFIRMED" ? "✓ " : "⚠ "}</span>
      {t(`review.${status}`)}
    </Tag>
  );
}
