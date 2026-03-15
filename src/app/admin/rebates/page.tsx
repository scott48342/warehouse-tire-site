import { getPool, listRebates } from "@/lib/rebates";

export const runtime = "nodejs";

function fmtTime(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export default async function RebatesAdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const refreshed = (Array.isArray((sp as any).refreshed) ? (sp as any).refreshed[0] : (sp as any).refreshed) || "";
  const count = (Array.isArray((sp as any).count) ? (sp as any).count[0] : (sp as any).count) || "";
  const saved = (Array.isArray((sp as any).saved) ? (sp as any).saved[0] : (sp as any).saved) || "";

  let rebates: Awaited<ReturnType<typeof listRebates>> = [];
  let dbError: string | null = null;

  try {
    const db = getPool();
    rebates = await listRebates(db);
  } catch (e: any) {
    dbError = e?.message || String(e);
  }

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-neutral-900">Rebates</h1>
            <p className="mt-1 text-sm text-neutral-700">
              Sync offers from Discount Tire (preferred), then enable the ones you want to show on the site.
            </p>
          </div>

          <form action="/api/admin/rebates/refresh" method="post" className="flex items-center gap-2">
            <button className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-extrabold text-white">
              Refresh promos
            </button>
          </form>
        </div>

        {dbError ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Rebates admin unavailable: {dbError}
          </div>
        ) : null}

        {refreshed ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Refreshed. Imported {count || "0"} offers.
          </div>
        ) : null}

        {saved ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Saved.
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-sm font-extrabold text-neutral-900">Add / Update brand rebate</div>
          <div className="mt-1 text-xs text-neutral-600">
            Brand-level only. One active manual rebate per brand.
          </div>

          <form action="/api/admin/rebates/upsert" method="post" className="mt-3 grid gap-2">
            <div className="grid gap-2 md:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Brand
                <input name="brand" required className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="Goodyear" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Ends (text)
                <input name="endsText" className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="March 1 – June 30" />
              </label>
            </div>

            <label className="grid gap-1 text-xs font-semibold text-neutral-700">
              Headline
              <input
                name="headline"
                required
                className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                placeholder="Get $80 back via prepaid card on select sets of tires"
              />
            </label>

            <div className="grid gap-2 md:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Learn more URL
                <input name="learnMoreUrl" className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="https://..." />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Form / Submit URL
                <input name="formUrl" className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="https://..." />
              </label>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
              <input type="checkbox" name="enabled" value="1" />
              Enabled
            </label>

            <div className="flex flex-wrap gap-2">
              <button className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-extrabold text-white">
                Save rebate
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="grid grid-cols-[110px_1fr_140px_140px] gap-0 border-b border-neutral-200 bg-neutral-50 p-3 text-xs font-extrabold text-neutral-700">
            <div>Enabled</div>
            <div>Offer</div>
            <div>Brand</div>
            <div>Updated</div>
          </div>

          {rebates.length ? (
            <div className="divide-y divide-neutral-200">
              {rebates.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[110px_1fr_140px_140px] gap-0 p-3"
                >
                  <div>
                    <form action="/api/admin/rebates/toggle" method="post">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="enabled" value={r.enabled ? "0" : "1"} />
                      <button
                        className={
                          "h-9 rounded-xl px-3 text-xs font-extrabold " +
                          (r.enabled
                            ? "bg-emerald-600 text-white"
                            : "border border-neutral-200 bg-white text-neutral-900")
                        }
                      >
                        {r.enabled ? "ON" : "OFF"}
                      </button>
                    </form>
                  </div>

                  <div>
                    <div className="text-sm font-extrabold text-neutral-900">{r.headline}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {r.learn_more_url ? (
                        <a className="text-neutral-900 underline" href={r.learn_more_url} target="_blank">
                          Learn more
                        </a>
                      ) : null}
                      {r.form_url ? (
                        <a className="text-neutral-900 underline" href={r.form_url} target="_blank">
                          Form
                        </a>
                      ) : null}
                      {r.ends_text ? <span className="text-neutral-600">{r.ends_text}</span> : null}
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-neutral-700">{r.brand || "—"}</div>
                  <div className="text-xs text-neutral-600">{fmtTime(r.updated_at)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-sm text-neutral-700">No rebates imported yet.</div>
          )}
        </div>

        <div className="mt-4 text-xs text-neutral-600">
          Note: This is an approval list. We only display rebates youve enabled.
        </div>
      </div>
    </main>
  );
}
