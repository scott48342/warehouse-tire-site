import Link from "next/link";

type KmItem = {
  partNumber?: string;
  brand?: string;
  description?: string;
  cost?: number;
  imageUrl?: string;
  displayName?: string;
};

type TireAsset = {
  km_description?: string;
  display_name?: string;
  image_url?: string;
};

type WheelProsBrand = { description?: string; parent?: string; code?: string };

type WheelProsItem = {
  sku?: string;
  title?: string;
  brand?: WheelProsBrand | string;
  prices?: { msrp?: Array<{ currencyAmount?: string }> };
  images?: Array<{ imageUrlLarge?: string; imageUrlMedium?: string; imageUrlOriginal?: string }>;
};

type Wheel = {
  sku?: string;
  brand?: string;
  model?: string;
  imageUrl?: string;
  price?: number;
};

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function parseFromDescription(desc: string) {
  const d = String(desc || "").toUpperCase();
  const runFlat = /\b(RFT|EMT|ROF|RUN\s*-?FLAT)\b/.test(d);
  const xl = /\bXL\b/.test(d);

  let season: "All-season" | "Winter" | "Summer" | "All-terrain" | undefined;
  if (/\b(BLIZZAK|WS\d+|X-ICE|ICE|WINTER|SNOW)\b/.test(d)) season = "Winter";
  else if (/\b(A\/?S|AS\b|ALL\s*-?SEASON)\b/.test(d)) season = "All-season";
  else if (/\b(A\/T|AT\b|ALL\s*-?TERRAIN)\b/.test(d)) season = "All-terrain";
  else if (/\b(SUMMER|MAX\s*-?PERFORMANCE)\b/.test(d)) season = "Summer";

  return { runFlat, xl, season };
}

async function fetchKm(size: string) {
  const res = await fetch(`${getBaseUrl()}/api/km/tiresizesearch?tireSize=${encodeURIComponent(size)}&minQty=4`, {
    cache: "no-store",
  });
  if (!res.ok) return { items: [] as KmItem[] };
  const data = (await res.json()) as { items?: KmItem[] };
  return { items: Array.isArray(data.items) ? data.items : [] };
}

async function enrichTires(items: KmItem[]) {
  const assets = await Promise.all(
    items.slice(0, 24).map(async (t) => {
      const km = t.description ? String(t.description) : "";
      if (!km) return null;
      try {
        const res = await fetch(`${getBaseUrl()}/api/assets/tire?km=${encodeURIComponent(km)}`, { cache: "no-store" });
        if (!res.ok) return null;
        const data = (await res.json()) as { results?: TireAsset[] };
        const hit = Array.isArray(data?.results) ? data.results[0] : null;
        if (!hit) return null;
        return { km, asset: hit };
      } catch {
        return null;
      }
    })
  );

  const assetByKm = new Map<string, TireAsset>();
  for (const a of assets) {
    if (a?.km) assetByKm.set(a.km, a.asset);
  }

  return items.map((t) => {
    const km = t.description ? String(t.description) : "";
    const asset = km ? assetByKm.get(km) : undefined;
    return {
      ...t,
      displayName: asset?.display_name || undefined,
      imageUrl: asset?.image_url || undefined,
    };
  });
}

async function fetchWheelsSample() {
  const res = await fetch(
    `${getBaseUrl()}/api/wheelpros/wheels/search?page=1&pageSize=12&fields=images,price&priceType=msrp&currencyCode=USD`,
    { cache: "no-store" }
  );
  if (!res.ok) return [] as Wheel[];
  const data = (await res.json()) as { items?: unknown[]; results?: unknown[] };
  const raw: unknown[] = Array.isArray(data?.items) ? data.items : Array.isArray(data?.results) ? data.results : [];

  const mapped: Wheel[] = raw.map((u) => {
    const it = u as WheelProsItem;
    const brandObj = it?.brand && typeof it.brand === "object" ? (it.brand as WheelProsBrand) : null;
    const brand = brandObj?.description ?? brandObj?.parent ?? brandObj?.code ?? (typeof it?.brand === "string" ? it.brand : undefined);

    const msrp = it?.prices?.msrp;
    const first = Array.isArray(msrp) ? msrp[0] : undefined;
    const price = first?.currencyAmount != null ? Number(first.currencyAmount) : undefined;

    const img0 = Array.isArray(it?.images) ? it.images[0] : undefined;
    const imageUrl = img0?.imageUrlLarge || img0?.imageUrlMedium || img0?.imageUrlOriginal || undefined;

    return {
      sku: it?.sku,
      brand: brand ? String(brand) : undefined,
      model: it?.title ? String(it.title) : it?.sku,
      imageUrl,
      price: typeof price === "number" && Number.isFinite(price) ? price : undefined,
    };
  });

  // low to high
  return mapped
    .filter((w) => w.brand || w.model)
    .sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY))
    .slice(0, 6);
}

export default async function Home() {
  const tireSizeA = "225/65R17";
  const tireSizeB = "275/60R20";

  const [a, b, wheels] = await Promise.all([
    fetchKm(tireSizeA),
    fetchKm(tireSizeB),
    fetchWheelsSample(),
  ]);

  const tiresA = await enrichTires(
    [...a.items]
      .sort((x, y) => ((x.cost ?? 1e9) + 50) - ((y.cost ?? 1e9) + 50))
      .slice(0, 6)
  );
  const tiresB = await enrichTires(
    [...b.items]
      .sort((x, y) => ((x.cost ?? 1e9) + 50) - ((y.cost ?? 1e9) + 50))
      .slice(0, 6)
  );

  return (
    <main className="bg-neutral-50">
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-6 rounded-3xl border border-neutral-200 bg-white p-6 md:grid-cols-2 md:p-10">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-neutral-900">
              Real inventory • schedule install • retail-ready
            </p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-neutral-900 md:text-5xl">
              Tires & wheels that fit.
              <span className="block text-[var(--brand-red)]">Installed fast.</span>
            </h1>
            <p className="mt-4 max-w-prose text-base text-neutral-700">
              Browse real supplier listings and book your installation.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/schedule"
                className="inline-flex items-center justify-center rounded-xl bg-[var(--brand-red)] px-5 py-3 text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)]"
              >
                Schedule Install
              </Link>
              <Link
                href="/tires"
                className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
              >
                Shop Tires
              </Link>
              <Link
                href="/wheels"
                className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
              >
                Shop Wheels
              </Link>
            </div>

            <div className="mt-6 grid gap-3 text-sm text-neutral-700 sm:grid-cols-2">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs font-semibold text-neutral-600">Popular sizes</div>
                <div className="mt-1 font-semibold">{tireSizeA} • {tireSizeB}</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs font-semibold text-neutral-600">Filters</div>
                <div className="mt-1 font-semibold">Run-flat • Winter • Speed rating</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-neutral-900 p-6 text-white">
            <div className="text-xs font-semibold text-white/70">Today’s picks</div>
            <h2 className="mt-3 text-2xl font-extrabold">Tires + wheels in stock</h2>
            <p className="mt-2 text-sm text-white/80">A quick snapshot of what’s available right now.</p>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="text-xs font-semibold text-white/70">Tires • {tireSizeA}</div>
                <div className="mt-1 text-sm font-extrabold">Lowest price picks</div>
                <div className="mt-3 grid gap-2">
                  {tiresA.slice(0, 2).map((t, idx) => {
                    const p = typeof t.cost === "number" ? t.cost + 50 : null;
                    const tags = parseFromDescription(String(t.description || ""));
                    return (
                      <div key={t.partNumber || idx} className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white">
                            {t.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={t.imageUrl}
                                alt={t.displayName || t.description || t.partNumber || "Tire"}
                                className="h-12 w-12 object-contain"
                                loading="lazy"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-extrabold">{t.displayName || t.description || t.partNumber}</div>
                            <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] font-semibold text-white/70">
                              {tags.season ? <span className="rounded-full bg-white/10 px-2 py-0.5">{tags.season}</span> : null}
                              {tags.runFlat ? <span className="rounded-full bg-white/10 px-2 py-0.5">Run-flat</span> : null}
                              {tags.xl ? <span className="rounded-full bg-white/10 px-2 py-0.5">XL</span> : null}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-sm font-extrabold">{p != null ? `$${p.toFixed(2)}` : "Call"}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3">
                  <Link href={`/tires?size=${encodeURIComponent(tireSizeA)}&sort=price_asc`} className="text-sm font-extrabold text-white hover:underline">
                    View all {tireSizeA}
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <div className="text-xs font-semibold text-white/70">Wheels</div>
                <div className="mt-1 text-sm font-extrabold">Lowest price picks</div>
                <div className="mt-3 grid gap-2">
                  {wheels.slice(0, 2).map((w, idx) => (
                    <div key={w.sku || idx} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold">{w.brand || "Wheel"}</div>
                        <div className="truncate text-[11px] font-semibold text-white/70">{w.model || w.sku}</div>
                      </div>
                      <div className="shrink-0 text-sm font-extrabold">{typeof w.price === "number" ? `$${w.price.toFixed(2)}` : "Call"}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <Link href="/wheels?sort=price_asc" className="text-sm font-extrabold text-white hover:underline">
                    View wheels
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-sm font-extrabold text-neutral-900">Shop popular sizes</div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/tires?size=${encodeURIComponent(tireSizeA)}&sort=price_asc`}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-extrabold text-neutral-900 hover:bg-neutral-50"
            >
              {tireSizeA}
            </Link>
            <Link
              href={`/tires?size=${encodeURIComponent(tireSizeB)}&sort=price_asc`}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-extrabold text-neutral-900 hover:bg-neutral-50"
            >
              {tireSizeB}
            </Link>
            <Link
              href="/wheels?sort=price_asc"
              className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-extrabold text-white hover:bg-neutral-800"
            >
              Wheels (low to high)
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6">
            <div className="text-xs font-semibold text-neutral-600">Shop Tires</div>
            <div className="mt-1 text-xl font-extrabold">Popular sizes + categories</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link href={`/tires?size=${encodeURIComponent(tireSizeA)}&sort=price_asc`} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 hover:bg-neutral-100">
                <div className="text-sm font-extrabold">{tireSizeA}</div>
                <div className="mt-1 text-xs text-neutral-600">Shop low to high</div>
              </Link>
              <Link href={`/tires?size=${encodeURIComponent(tireSizeB)}&sort=price_asc`} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 hover:bg-neutral-100">
                <div className="text-sm font-extrabold">{tireSizeB}</div>
                <div className="mt-1 text-xs text-neutral-600">Shop low to high</div>
              </Link>
              <Link href={`/tires?size=${encodeURIComponent(tireSizeA)}&runFlat=1&sort=price_asc`} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 hover:bg-neutral-100">
                <div className="text-sm font-extrabold">Run-flat</div>
                <div className="mt-1 text-xs text-neutral-600">Heuristic filter</div>
              </Link>
              <Link href={`/tires?size=${encodeURIComponent(tireSizeA)}&season=Winter&sort=price_asc`} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 hover:bg-neutral-100">
                <div className="text-sm font-extrabold">Winter</div>
                <div className="mt-1 text-xs text-neutral-600">Heuristic filter</div>
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-6">
            <div className="text-xs font-semibold text-neutral-600">Shop Wheels</div>
            <div className="mt-1 text-xl font-extrabold">Start with vehicle or size</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link href="/wheels" className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 hover:bg-neutral-100">
                <div className="text-sm font-extrabold">Shop by vehicle</div>
                <div className="mt-1 text-xs text-neutral-600">Best match</div>
              </Link>
              <Link href="/wheels" className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 hover:bg-neutral-100">
                <div className="text-sm font-extrabold">Shop by size</div>
                <div className="mt-1 text-xs text-neutral-600">Diameter • width • bolt pattern</div>
              </Link>
              <Link href="/wheels?sort=price_asc" className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 hover:bg-neutral-100">
                <div className="text-sm font-extrabold">Lowest price wheels</div>
                <div className="mt-1 text-xs text-neutral-600">Sort low to high</div>
              </Link>
              <Link href="/schedule" className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 hover:bg-neutral-100">
                <div className="text-sm font-extrabold">Schedule install</div>
                <div className="mt-1 text-xs text-neutral-600">Book now</div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="text-xs font-semibold text-neutral-600">Featured tires</div>
            <div className="mt-1 text-lg font-extrabold">{tireSizeA} (low to high)</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {tiresA.slice(0, 4).map((t, idx) => {
                const p = typeof t.cost === "number" ? t.cost + 50 : null;
                return (
                  <Link
                    key={t.partNumber || idx}
                    href={`/tires?size=${encodeURIComponent(tireSizeA)}&sort=price_asc`}
                    className="rounded-2xl border border-neutral-200 bg-white p-4 hover:bg-neutral-50"
                  >
                    <div className="text-xs font-semibold text-neutral-600">{t.brand || "Tire"}</div>
                    <div className="mt-0.5 text-sm font-extrabold text-neutral-900 line-clamp-2">
                      {t.displayName || t.description || t.partNumber}
                    </div>
                    <div className="mt-2 text-lg font-extrabold text-neutral-900">
                      {p != null ? `$${p.toFixed(2)}` : "Call"}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="text-xs font-semibold text-neutral-600">Featured tires</div>
            <div className="mt-1 text-lg font-extrabold">{tireSizeB} (low to high)</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {tiresB.slice(0, 4).map((t, idx) => {
                const p = typeof t.cost === "number" ? t.cost + 50 : null;
                return (
                  <Link
                    key={t.partNumber || idx}
                    href={`/tires?size=${encodeURIComponent(tireSizeB)}&sort=price_asc`}
                    className="rounded-2xl border border-neutral-200 bg-white p-4 hover:bg-neutral-50"
                  >
                    <div className="text-xs font-semibold text-neutral-600">{t.brand || "Tire"}</div>
                    <div className="mt-0.5 text-sm font-extrabold text-neutral-900 line-clamp-2">
                      {t.displayName || t.description || t.partNumber}
                    </div>
                    <div className="mt-2 text-lg font-extrabold text-neutral-900">
                      {p != null ? `$${p.toFixed(2)}` : "Call"}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
