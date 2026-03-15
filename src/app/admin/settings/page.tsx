import { getPool, getTaxRate } from "@/lib/quoteCatalog";

export const runtime = "nodejs";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const saved = (Array.isArray((sp as any).saved) ? (sp as any).saved[0] : (sp as any).saved) || "";

  let taxRate = 0.06;
  let err: string | null = null;

  try {
    const db = getPool();
    taxRate = await getTaxRate(db);
  } catch (e: any) {
    err = e?.message || String(e);
  }

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-neutral-900">Settings</h1>
            <p className="mt-1 text-sm text-neutral-700">Quote and pricing configuration.</p>
          </div>
          <form action="/api/admin/logout" method="post">
            <button className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-extrabold text-neutral-900">
              Sign out
            </button>
          </form>
        </div>

        {err ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            {err}
          </div>
        ) : null}

        {saved ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Saved.
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-sm font-extrabold text-neutral-900">Tax rate</div>
          <div className="mt-1 text-xs text-neutral-600">Applies to taxable parts only (wheels, tires, etc.).</div>

          <form action="/api/admin/settings" method="post" className="mt-3 flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs font-semibold text-neutral-700">
              Rate (e.g. 0.06)
              <input
                name="taxRate"
                defaultValue={String(taxRate)}
                className="h-10 w-48 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
              />
            </label>

            <button className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-extrabold text-white">Save</button>
          </form>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-sm font-extrabold text-neutral-900">Admin links</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-extrabold" href="/admin/rebates">
              Rebates
            </a>
            <a className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-extrabold" href="/admin/tire-assets">
              Tire assets
            </a>
            <a className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-extrabold" href="/admin/catalog">
              Quote catalog
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
