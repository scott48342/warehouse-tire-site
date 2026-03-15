import { BRAND } from "@/lib/brand";

export const runtime = "nodejs";

export default async function AdminHomePage() {
  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-neutral-900">Admin</h1>
            <p className="mt-1 text-sm text-neutral-700">
              Warehouse Tire internal tools.
            </p>
          </div>
          <form action="/api/admin/logout" method="post">
            <button className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-extrabold text-neutral-900">
              Sign out
            </button>
          </form>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card title="Settings" desc="Tax rate and quote configuration." href="/admin/settings" />
          <Card title="Quote catalog" desc="Services/add-ons, unit pricing, taxable flags." href="/admin/catalog" />
          <Card title="Rebates" desc="Brand-level rebates you choose to show." href="/admin/rebates" />
          <Card title="Tire assets" desc="Manage tire images/names cache." href="/admin/tire-assets" />
          <Card title="Quotes" desc="(Coming soon) View saved customer quotes." href="#" disabled />
        </div>

        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
          <div className="font-extrabold text-neutral-900">Contact defaults</div>
          <div className="mt-1">{BRAND.name} • {BRAND.phone.callDisplay} • {BRAND.email}</div>
        </div>
      </div>
    </main>
  );
}

function Card({
  title,
  desc,
  href,
  disabled,
}: {
  title: string;
  desc: string;
  href: string;
  disabled?: boolean;
}) {
  return (
    <a
      href={disabled ? undefined : href}
      className={
        "rounded-2xl border border-neutral-200 bg-white p-4 " +
        (disabled ? "opacity-60" : "hover:border-neutral-300")
      }
      aria-disabled={disabled ? true : undefined}
    >
      <div className="text-sm font-extrabold text-neutral-900">{title}</div>
      <div className="mt-1 text-xs text-neutral-600">{desc}</div>
    </a>
  );
}
