import type { MessageKey } from "@/i18n";

export interface NavItem {
  href: string;
  labelKey: MessageKey;
}

export const MAIN_NAV: NavItem[] = [
  { href: "/", labelKey: "nav.home" },
  { href: "/ninjas", labelKey: "nav.ninjas" },
  { href: "/equipment", labelKey: "nav.equipment" },
  { href: "/jewelry", labelKey: "nav.jewelry" },
  { href: "/gems", labelKey: "nav.gems" },
  { href: "/sets", labelKey: "nav.sets" },
  { href: "/search", labelKey: "nav.search" },
];
