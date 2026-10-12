import type { TranslationStatus } from "@/domain/constants";
import { localize } from "@/domain/localize";
import type { Translate } from "@/i18n";

/**
 * Game text in the interface language. When no Spanish version exists the original wording is
 * shown and marked as such — untranslated content is never presented as translated.
 */
export function Localized({
  source,
  spanish,
  status,
  t,
}: {
  source: string | null;
  spanish: string | null;
  status: TranslationStatus;
  t: Translate;
}) {
  const text = localize(source, spanish, status);
  if (!text.text) return null;
  return (
    <>
      {text.text}
      {text.isSourceFallback && (
        <span className="ml-2 whitespace-nowrap text-xs text-muted" title={t("translation.sourceText")}>
          · {t("translation.sourceTextShort")}
        </span>
      )}
      {text.isDraft && <span className="ml-2 whitespace-nowrap text-xs text-warn">· {t("translation.draft")}</span>}
    </>
  );
}
