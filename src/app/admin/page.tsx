import Link from "next/link";
import { getT } from "@/i18n/server";
import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { Card, PageHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireAdminPage();
  const t = await getT();
  const [ninjas, ninjasDraft, equipment, jewelry, gems, equipmentSets, jewelrySets, statuses, users] = await Promise.all([
    db.ninja.count({ where: { status: "PUBLISHED" } }),
    db.ninja.count({ where: { status: { not: "PUBLISHED" } } }),
    db.equipment.count(),
    db.jewelry.count(),
    db.gem.count(),
    db.equipmentSet.count(),
    db.jewelrySet.count(),
    db.statusEffect.count(),
    db.user.count(),
  ]);
  const tiles = [
    { href: "/admin/ninjas", label: t("admin.nav.ninjas"), value: ninjas, note: ninjasDraft > 0 ? `+${ninjasDraft} ${t("admin.publication.DRAFT").toLowerCase()}` : null },
    { href: "/admin/equipment", label: t("admin.nav.equipment"), value: equipment },
    { href: "/admin/jewelry", label: t("admin.nav.jewelry"), value: jewelry },
    { href: "/admin/gems", label: t("admin.nav.gems"), value: gems },
    { href: "/admin/sets", label: t("admin.nav.sets"), value: equipmentSets + jewelrySets },
    { href: "/admin/effects", label: t("admin.nav.effects"), value: statuses },
    { href: "/admin/users", label: t("admin.nav.users"), value: users },
  ];
  return (
    <>
      <PageHeader title={t("admin.title")} description={t("admin.description")} />
      <p className="mb-6 max-w-2xl text-sm text-muted">{t("admin.crudNote")}</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((x) => (
          <li key={x.href}>
            <Link href={x.href} className="block">
              <Card className="h-full transition-colors hover:border-accent">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{x.label}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{x.value}</p>
                {x.note && <p className="mt-1 text-xs text-muted">{x.note}</p>}
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
