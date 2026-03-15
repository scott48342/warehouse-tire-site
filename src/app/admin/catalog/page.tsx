import { getPool, listCatalogItems } from "@/lib/quoteCatalog";

export const runtime = "nodejs";

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const saved = (Array.isArray((sp as any).saved) ? (sp as any).saved[0] : (sp as any).saved) || "";
  const deleted = (Array.isArray((sp as any).deleted) ? (sp as any).deleted[0] : (sp as any).deleted) || "";
  const editId = (Array.isArray((sp as any).edit) ? (sp as any).edit[0] : (sp as any).edit) || "";

  let err: string | null = null;
  let items: Awaited<ReturnType<typeof listCatalogItems>> = [];
  let editItem: (Awaited<ReturnType<typeof listCatalogItems>>[number]) | null = null;
  try {
    const db = getPool();
    items = await listCatalogItems(db);
    editItem = editId ? items.find((it) => it.id === editId) || null : null;
  } catch (e: any) {
    err = e?.message || String(e);
  }

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-neutral-900">Quote catalog</h1>
            <p className="mt-1 text-sm text-neutral-700">Services and add-ons (unit price × qty).</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a className="h-9 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-extrabold" href="/admin/settings">
              Settings
            </a>
            <form action="/api/admin/logout" method="post">
              <button className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-extrabold text-neutral-900">
                Sign out
              </button>
            </form>
          </div>
        </div>

        {err ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{err}</div>
        ) : null}

        {saved ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Saved.</div>
        ) : null}

        {deleted ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Deleted.</div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-sm font-extrabold text-neutral-900">Add / update item</div>

          <form action="/api/admin/catalog/upsert" method="post" className="mt-3 grid gap-2">
            <input type="hidden" name="id" value={editItem?.id || ""} />
            <div className="grid gap-2 md:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Name
                <input name="name" required defaultValue={editItem?.name || ""} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="Mount & balance" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Default unit price (USD)
                <input name="unitPrice" required defaultValue={editItem ? String(editItem.unit_price_usd) : ""} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="25.00" />
              </label>
            </div>

            <div className="grid gap-2 md:grid-cols-4">
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Qty basis
                <select name="appliesTo" defaultValue={editItem?.applies_to || "tire"} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm">
                  <option value="tire">Per tire</option>
                  <option value="wheel">Per wheel</option>
                  <option value="vehicle">Per vehicle</option>
                  <option value="flat">Flat</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Category
                <input name="category" defaultValue={editItem?.category || ""} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="Services" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Sort order
                <input name="sortOrder" defaultValue={editItem ? String(editItem.sort_order) : ""} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="10" />
              </label>
              <div className="grid gap-1">
                <div className="text-xs font-semibold text-neutral-700">Flags</div>
                <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
                  <input type="checkbox" name="taxable" value="1" defaultChecked={!!editItem?.taxable} />
                  Taxable
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
                  <input type="checkbox" name="defaultChecked" value="1" defaultChecked={!!editItem?.default_checked} />
                  Default checked
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
                  <input type="checkbox" name="required" value="1" defaultChecked={!!editItem?.required} />
                  Required service
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
                  <input type="checkbox" name="active" value="1" defaultChecked={editItem ? !!editItem.active : true} />
                  Active
                </label>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Tire price (USD)
                <input name="unitPriceTire" defaultValue={editItem?.unit_price_tire_usd != null ? String(editItem.unit_price_tire_usd) : ""} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="(optional)" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Wheel price (USD)
                <input name="unitPriceWheel" defaultValue={editItem?.unit_price_wheel_usd != null ? String(editItem.unit_price_wheel_usd) : ""} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="(optional)" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Package price (USD)
                <input name="unitPricePackage" defaultValue={editItem?.unit_price_package_usd != null ? String(editItem.unit_price_package_usd) : ""} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="(optional)" />
              </label>
            </div>

            <div className="grid gap-1">
              <div className="text-xs font-semibold text-neutral-700">Include in quotes</div>
              <div className="flex flex-wrap gap-4 text-xs font-semibold text-neutral-700">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="appliesTire" value="1" defaultChecked={editItem ? !!editItem.applies_tire : true} />
                  Tires
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="appliesWheel" value="1" defaultChecked={editItem ? !!editItem.applies_wheel : true} />
                  Wheels
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="appliesPackage" value="1" defaultChecked={editItem ? !!editItem.applies_package : true} />
                  Package
                </label>
              </div>
            </div>

            <button className="mt-1 h-10 w-fit rounded-xl bg-neutral-900 px-4 text-sm font-extrabold text-white">
              Save item
            </button>
          </form>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="grid grid-cols-[1fr_110px_120px_90px_90px_90px_90px_160px] gap-0 border-b border-neutral-200 bg-neutral-50 p-3 text-xs font-extrabold text-neutral-700">
            <div>Item</div>
            <div>Qty basis</div>
            <div>Default price</div>
            <div>Taxable</div>
            <div>Default</div>
            <div>Req</div>
            <div>Active</div>
            <div>Actions</div>
          </div>

          {items.length ? (
            <div className="divide-y divide-neutral-200">
              {items.map((it) => (
                <div key={it.id} className="grid grid-cols-[1fr_110px_120px_90px_90px_90px_90px_160px] gap-0 p-3">
                  <div>
                    <div className="text-sm font-extrabold text-neutral-900">{it.name}</div>
                    <div className="text-[11px] text-neutral-600">{it.category || "—"} • sort {it.sort_order}</div>
                  </div>
                  <div className="text-xs font-semibold text-neutral-700">{it.applies_to}</div>
                  <div className="text-xs font-extrabold text-neutral-900">${it.unit_price_usd.toFixed(2)}</div>
                  <div className="text-xs font-semibold text-neutral-700">{it.taxable ? "Yes" : "No"}</div>
                  <div className="text-xs font-semibold text-neutral-700">{it.default_checked ? "Yes" : "No"}</div>
                  <div className="text-xs font-semibold text-neutral-700">{it.required ? "Yes" : "No"}</div>
                  <div className="text-xs font-semibold text-neutral-700">{it.active ? "Yes" : "No"}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      className="text-xs font-extrabold text-blue-700 hover:underline"
                      href={`/admin/catalog?edit=${encodeURIComponent(it.id)}`}
                    >
                      Edit
                    </a>
                    <form action="/api/admin/catalog/delete" method="post">
                      <input type="hidden" name="id" value={it.id} />
                      <button className="text-xs font-extrabold text-red-700 hover:underline">Delete</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-sm text-neutral-700">No items yet.</div>
          )}
        </div>
      </div>
    </main>
  );
}
