"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useT } from "@/i18n/client";
import { cx } from "@/components/ui/primitives";
import { MAIN_NAV, type NavItem } from "./nav-items";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop: inline links. Below `lg`: a disclosure button that reveals the same links. */
export function MainNav({ showAdmin }: { showAdmin: boolean }) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items: NavItem[] = showAdmin ? [...MAIN_NAV, { href: "/admin", labelKey: "nav.admin" }, { href: "/preview", labelKey: "nav.preview" }] : MAIN_NAV;

  const links = items.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={() => setOpen(false)}
      aria-current={isActive(pathname, item.href) ? "page" : undefined}
      className={cx(
        "flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors",
        isActive(pathname, item.href) ? "bg-surface-2 text-accent" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {t(item.labelKey)}
    </Link>
  ));

  return (
    <>
      <nav aria-label={t("nav.primary")} className="hidden items-center gap-1 lg:flex">
        {links}
      </nav>
      <button
        type="button"
        className="grid size-11 place-items-center rounded-lg border border-border lg:hidden"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? t("nav.closeMenu") : t("nav.menu")}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden className="text-lg">
          {open ? "✕" : "☰"}
        </span>
      </button>
      {open && (
        <nav
          id="mobile-nav"
          aria-label={t("nav.primary")}
          className="absolute inset-x-0 top-full z-30 flex flex-col gap-1 border-b border-border bg-surface p-3 lg:hidden"
        >
          {links}
        </nav>
      )}
    </>
  );
}
