"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { StatusUsageView } from "@/domain/effects";
import { useT } from "@/i18n/client";
import { StatusDefinitionBody } from "./status-definition";

/**
 * A status name that explains itself: the definition opens on mouse hover, on keyboard focus
 * and on tap, and closes on Escape, blur or a tap elsewhere. The panel shows the numbers
 * resolved for THIS usage. Place it inside a `relative` container; the panel spans that
 * container's width, so it cannot overflow a narrow screen.
 */
export function StatusTerm({ usage }: { usage: StatusUsageView }) {
  const t = useT();
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const name = usage.definition.nameEs ?? usage.definition.name;

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <span ref={root} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        aria-label={t("effects.showDefinition", { name })}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="min-h-6 cursor-help rounded font-semibold text-accent underline decoration-dotted underline-offset-4"
      >
        {name}
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute inset-x-0 top-full z-20 mt-1 block rounded-lg border border-border bg-surface-2 p-3 text-left font-normal shadow-xl shadow-black/40"
        >
          <span className="mb-2 block text-sm font-semibold">{usage.definition.name}</span>
          <StatusDefinitionBody definition={usage.definition} resolved={usage.resolved} t={t} />
        </span>
      )}
    </span>
  );
}
