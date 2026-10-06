"use client";

import { useT } from "@/i18n/client";
import { Button } from "@/components/ui/primitives";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-bold">{t("common.error")}</h1>
        <Button className="mt-6" onClick={reset}>
          {t("common.retry")}
        </Button>
      </div>
    </main>
  );
}
