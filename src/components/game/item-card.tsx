import Link from "next/link";
import type { ReactNode } from "react";

/** Generic card for ninjas / equipment / jewelry / gems. Image is optional and never required. */
export function ItemCard({
  href,
  title,
  subtitle,
  imageUrl,
  footer,
}: {
  href: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  footer?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3 transition-colors hover:border-accent sm:flex-col"
    >
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2 sm:aspect-square sm:size-auto">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote hosts are not known yet
          <img src={imageUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <span aria-hidden className="text-2xl text-muted">
            ◈
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold group-hover:text-accent">{title}</p>
        {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
        {footer && <div className="mt-2">{footer}</div>}
      </div>
    </Link>
  );
}
