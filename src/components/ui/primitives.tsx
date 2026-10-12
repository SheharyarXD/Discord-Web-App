import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:p-5", className)}>
      {children}
    </div>
  );
}

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
const buttonVariants = {
  primary: "bg-accent text-accent-fg hover:bg-accent-strong",
  ghost: "border border-border text-fg hover:bg-surface-2",
} as const;

export function buttonClass(variant: keyof typeof buttonVariants = "primary", extra?: string) {
  return cx(buttonBase, buttonVariants[variant], extra);
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants }) {
  return <button {...props} className={buttonClass(variant, className)} />;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ title, hint, icon = "◌" }: { title: string; hint?: string; icon?: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-border px-6 py-12 text-center"
    >
      <span aria-hidden className="mb-3 text-3xl text-muted">
        {icon}
      </span>
      <p className="font-semibold">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-lg bg-surface-2", className)} />;
}

const tagTones = {
  default: "border-border text-fg",
  muted: "border-border text-muted",
  ok: "border-ok/50 text-ok",
  danger: "border-danger/50 text-danger",
  warn: "border-warn/50 text-warn",
  info: "border-info/50 text-info",
} as const;

/** Small labelled tag. The label carries the meaning; the tone only reinforces it. */
export function Tag({ children, tone = "default", title }: { children: ReactNode; tone?: keyof typeof tagTones; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", tagTones[tone])}>
      {children}
    </span>
  );
}

/** Previous / next links for a bounded list. */
export function Pagination({
  page,
  pageCount,
  hrefFor,
  labels,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  labels: { previous: string; next: string; status: string; nav: string };
}) {
  if (pageCount <= 1) return null;
  const link = "inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-surface-2";
  const off = "inline-flex min-h-11 items-center rounded-lg border border-border/50 px-4 text-sm font-semibold text-muted/60";
  return (
    <nav aria-label={labels.nav} className="mt-6 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={link}>
          ← {labels.previous}
        </Link>
      ) : (
        <span aria-disabled className={off}>
          ← {labels.previous}
        </span>
      )}
      <span className="text-sm text-muted">{labels.status}</span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} rel="next" className={link}>
          {labels.next} →
        </Link>
      ) : (
        <span aria-disabled className={off}>
          {labels.next} →
        </span>
      )}
    </nav>
  );
}
