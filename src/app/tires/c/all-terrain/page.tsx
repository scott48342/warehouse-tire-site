import Link from "next/link";
import { BRAND } from "@/lib/brand";

export const runtime = "nodejs";

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function money(n: number | null) {
  if (n == null) return "Call";
  const x = Number(n);
  return Number.isFinite(x) ? `$${x.toFixed(2)}` : "Call";
}

type Item = {
  sku: string;
  brand: string | null;
  name: string;
  tireSize: string | null;
  terrain: string | null;
  loadIndex: string | null;
  speedRating: string | null;
  rimDiameterIn: number | null;
  imageUrl: string | null;
  priceEach: number | null;
  qoh: number;
};

async function fetchItems({
  brand,
  rim,
  sort,
}: {
  brand?: string;
  rim?: string;
  sort?: string;
}) {
  const sp = new URLSearchParams();
  sp.set("terrain", "all-terrain");
  sp.set("limit", "60");
  if (brand) sp.set("brand", brand);
  if (rim) sp.set("rim", rim);
  if (sort) sp.set("sort", sort);

  const res = await fetch(`${getBaseUrl()}/api/wp/tires/browse?${sp.toString()}`, { cache: "no-store" });
  if (!res.ok) return { items: [] as Item[] };
  return (await res.json()) as { items: Item[] };
}

export default async function AllTerrainTiresPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const sp = searchParams ?? {};
  const brand = (Array.isArray(sp.brand) ? sp.brand[0] : sp.brand) || "";
  const rim = (Array.isArray(sp.rim) ? sp.rim[0] : sp.rim) || "";
  const sort = (Array.isArray(sp.sort) ? sp.sort[0] : sp.sort) || "price_asc";

  const data = await fetchItems({ brand: brand || undefined, rim: rim || undefined, sort });
  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-neutral-600">Tires</div>
            <h1 className="text-2xl font-extrabold text-neutral-900">All-terrain tires</h1>
            <div className="mt-1 text-sm text-neutral-700">Browse A/T tires across brands. Select a product to view details and build a quote.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/tires" className="h-9 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-extrabold">
              All tires
            </Link>
            <a href={BRAND.links.tel} className="h-9 rounded-xl bg-neutral-900 px-3 py-2 text-xs font-extrabold text-white">
              Call
            </a>
          </div>
        </div>

        <form className="mt-6 flex flex-wrap items-end gap-2" action="/tires/c/all-terrain" method="get">
          <label className="grid gap-1 text-xs font-semibold text-neutral-700">
            Brand
            <input name="brand" defaultValue={brand} className="h-10 w-[220px] rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="(optional)" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-neutral-700">
            Rim (in)
            <input name="rim" defaultValue={rim} className="h-10 w-[120px] rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="20" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-neutral-700">
            Sort
            <select name="sort" defaultValue={sort} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm">
              <option value="price_asc">Price Low to High</option>
              <option value="price_desc">Price High to Low</option>
              <option value="stock_desc">Most Stock</option>
            </select>
          </label>
          <button className="h-10 rounded-xl bg-[var(--brand-red)] px-4 text-sm font-extrabold text-white">
            Apply
          </button>
          <Link href="/tires/c/all-terrain" className="h-10 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-extrabold">
            Clear
          </Link>
        </form>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.length ? (
            items.map((t) => (
              <Link
                key={t.sku}
                href={`/tires/${encodeURIComponent(t.sku)}`}
                className="group rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-neutral-600">{t.brand || "Tire"}</div>
                    <div className="mt-1 line-clamp-2 text-sm font-extrabold text-neutral-900 group-hover:underline">
                      {t.name}
                    </div>
                    <div className="mt-1 text-[11px] text-neutral-600">
                      {t.tireSize ? t.tireSize : ""}
                      {t.loadIndex ? ` • Load ${t.loadIndex}` : ""}
                      {t.speedRating ? ` • Speed ${t.speedRating}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-extrabold text-neutral-900">{money(t.priceEach)}</div>
                    <div className="text-[11px] text-neutral-600">each</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-[96px_1fr] gap-3">
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.imageUrl || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="}
                      alt={t.name}
                      className="h-[72px] w-full rounded-lg object-contain"
                    />
                  </div>
                  <div className="text-xs text-neutral-700">
                    <div><span className="font-semibold">Terrain:</span> {t.terrain || "All Terrain"}</div>
                    <div className="mt-1"><span className="font-semibold">Rim:</span> {t.rimDiameterIn != null ? `${t.rimDiameterIn}\"` : "—"}</div>
                    <div className="mt-1"><span className="font-semibold">Stock:</span> {t.qoh}</div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700 sm:col-span-2 lg:col-span-3">
              No all-terrain tires found. Try clearing brand/rim filters.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
