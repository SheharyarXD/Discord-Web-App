import type { FeatureFlags, FeatureKey } from "@/config/features";
import type { MessageKey } from "@/i18n";

export interface NavItem {
  href: string;
  labelKey: MessageKey;
  /** Shown only while this feature is switched on. */
  feature?: FeatureKey;
  /** Shown only to administrators. */
  adminOnly?: boolean;
}

export const MAIN_NAV: NavItem[] = [
  { href: "/", labelKey: "nav.home" },
  { href: "/ninjas", labelKey: "nav.ninjas" },
  { href: "/equipment", labelKey: "nav.equipment" },
  { href: "/jewelry", labelKey: "nav.jewelry" },
  { href: "/gems", labelKey: "nav.gems", feature: "gems" },
  { href: "/sets", labelKey: "nav.sets" },
  { href: "/effects", labelKey: "nav.effects" },
  { href: "/search", labelKey: "nav.search" },
  { href: "/admin", labelKey: "nav.admin", adminOnly: true },
  { href: "/preview", labelKey: "nav.preview", adminOnly: true },
];

/** The navigation entries a viewer gets. Decided on the server and passed down. */
export function visibleNav(features: FeatureFlags, isAdmin: boolean): NavItem[] {
  return MAIN_NAV.filter((item) => (!item.feature || features[item.feature]) && (!item.adminOnly || isAdmin));
}
