import Link from "next/link";
import { headers } from "next/headers";
import { BRAND } from "@/lib/brand";
import { RecommendedFitmentCard } from "@/components/RecommendedFitmentCard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getBaseUrl() {
  // Prefer explicit base URL if set.
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  // Otherwise derive from the incoming request (works on Railway/Render/Fly/etc.).
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host");
  if (host) return `${proto}://${host}`;

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

type Facets = {
  brands: { value: string; count: number }[];
  rims: { value: number; count: number }[];
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
  sp.set("terrain", "all-season");
  sp.set("limit", "60");
  if (brand) sp.set("brand", brand);
  if (rim) sp.set("rim", rim);
  if (sort) sp.set("sort", sort);

  try {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/api/wp/tires/browse?${sp.toString()}`, { cache: "no-store" });
    if (!res.ok) return { items: [] as Item[] };
    return (await res.json()) as { items: Item[] };
  } catch {
    return { items: [] as Item[] };
  }
}

async function fetchFacets({
  brand,
  rim,
}: {
  brand?: string;
  rim?: string;
}): Promise<Facets> {
  const sp = new URLSearchParams();
  sp.set("terrain", "all-season");
  if (brand) sp.set("brand", brand);
  if (rim) sp.set("rim", rim);

  try {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/api/wp/tires/facets?${sp.toString()}`, { cache: "no-store" });
    if (!res.ok) return { brands: [], rims: [] };
    const j = (await res.json()) as Partial<Facets>;
    return {
      brands: Array.isArray(j.brands) ? (j.brands as any) : [],
      rims: Array.isArray(j.rims) ? (j.rims as any) : [],
    };
  } catch {
    return { brands: [], rims: [] };
  }
}

export default async function AllSeasonTiresPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await Promise.resolve(searchParams ?? {})) as Record<string, string | string[] | undefined>;

  const year = (Array.isArray(sp.year) ? sp.year[0] : sp.year) || "";
  const make = (Array.isArray(sp.make) ? sp.make[0] : sp.make) || "";
  const model = (Array.isArray(sp.model) ? sp.model[0] : sp.model) || "";
  const trim = (Array.isArray(sp.trim) ? sp.trim[0] : sp.trim) || "";
  const modification = (Array.isArray(sp.modification) ? sp.modification[0] : sp.modification) || "";

  const brand = (Array.isArray(sp.brand) ? sp.brand[0] : sp.brand) || "";
  const rim = (Array.isArray(sp.rim) ? sp.rim[0] : sp.rim) || "";
  const sort = (Array.isArray(sp.sort) ? sp.sort[0] : sp.sort) || "price_asc";

  const [data, facets] = await Promise.all([
    fetchItems({ brand: brand || undefined, rim: rim || undefined, sort }),
    fetchFacets({ brand: brand || undefined, rim: rim || undefined }),
  ]);
  const items = Array.isArray(data?.items) ? data.items : [];
  const brands = Array.isArray(facets?.brands) ? facets.brands : [];
  const rims = Array.isArray(facets?.rims) ? facets.rims : [];

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-neutral-600">Tires</div>
            <h1 className="text-2xl font-extrabold text-neutral-900">All-season tires</h1>
            <div className="mt-1 text-sm text-neutral-700">Browse all-season tires across brands. Select a product to view details and build a quote.</div>
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

        <div className="mt-6 grid gap-6 md:grid-cols-[280px_1fr]">
          <aside className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 md:block">
            {year && make && model ? (
              <div className="mb-4">
                <RecommendedFitmentCard fitment={{ year, make, model, trim, modification }} />
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold">Filters</h2>
              <Link
                href={`/tires/c/all-season?${new URLSearchParams({ year, make, model, trim, modification }).toString()}`}
                className="text-xs font-semibold text-neutral-600 hover:underline"
              >
                Clear all
              </Link>
            </div>

            <form className="mt-3 grid gap-3" action="/tires/c/all-season" method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />

              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Brand
                <select name="brand" defaultValue={brand} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm">
                  <option value="">All brands</option>
                  {brands.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.value} ({b.count})
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Rim (in)
                <select name="rim" defaultValue={rim} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm">
                  <option value="">All</option>
                  {rims.map((r) => (
                    <option key={String(r.value)} value={String(r.value)}>
                      {String(r.value).replace(/\.0$/, "")}\" ({r.count})
                    </option>
                  ))}
                </select>
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
            </form>
          </aside>

          <div>
            <div className="mt-0 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.length ? (
            items.map((t) => (
              <Link
                key={t.sku}
                href={`/tires/${encodeURIComponent(t.sku)}?${new URLSearchParams({ year, make, model, trim, modification }).toString()}`}
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
              No all-season tires found. Try clearing brand/rim filters.
            </div>
          )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
