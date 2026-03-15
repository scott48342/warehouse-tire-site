import Link from "next/link";
import { GarageWidget } from "@/components/GarageWidget";
import { BRAND } from "@/lib/brand";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { FavoritesButton } from "@/components/FavoritesButton";

type Tire = {
  partNumber?: string;
  mfgPartNumber?: string;
  brand?: string;
  description?: string;
  cost?: number;
  quantity?: { primary?: number; alternate?: number; national?: number };
  imageUrl?: string;
  displayName?: string;
};

type TireAsset = {
  km_description?: string;
  display_name?: string;
  image_url?: string;
};

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function fetchFitment(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }

  const res = await fetch(`${getBaseUrl()}/api/vehicles/search?${sp.toString()}`, { cache: "no-store" });
  if (!res.ok) return { error: await res.text() };
  return res.json();
}

async function fetchKmTires(tireSize: string) {
  const res = await fetch(`${getBaseUrl()}/api/km/tiresizesearch?tireSize=${encodeURIComponent(tireSize)}&minQty=4`, {
    cache: "no-store",
  });
  if (!res.ok) return { error: await res.text() };
  return res.json();
}

async function fetchWpTires(tireSize: string) {
  const res = await fetch(`${getBaseUrl()}/api/wp/tires/search?size=${encodeURIComponent(tireSize)}&minQty=4`, {
    cache: "no-store",
  });
  if (!res.ok) return { error: await res.text() };
  return res.json();
}

export default async function TiresPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  // ZIP temporarily removed from UI; keep a placeholder to avoid touching too many links.
  const zip = "";
  const sortRaw = Array.isArray(sp.sort) ? sp.sort[0] : sp.sort;
  const sort = (sortRaw ?? "price_asc").trim();

  // Filters (querystring-driven)
  const brandsRaw = sp.brand;
  const brands = Array.isArray(brandsRaw)
    ? brandsRaw.map(String).map((s) => s.trim()).filter(Boolean)
    : brandsRaw
      ? [String(brandsRaw).trim()].filter(Boolean)
      : [];

  const priceMinRaw = Array.isArray(sp.priceMin) ? sp.priceMin[0] : sp.priceMin;
  const priceMaxRaw = Array.isArray(sp.priceMax) ? sp.priceMax[0] : sp.priceMax;
  const priceMin = priceMinRaw ? Number(String(priceMinRaw)) : null;
  const priceMax = priceMaxRaw ? Number(String(priceMaxRaw)) : null;

  const seasonsRaw = sp.season;
  const seasons = Array.isArray(seasonsRaw)
    ? seasonsRaw.map(String).map((s) => s.trim()).filter(Boolean)
    : seasonsRaw
      ? [String(seasonsRaw).trim()].filter(Boolean)
      : [];

  const speedsRaw = sp.speed;
  const speeds = Array.isArray(speedsRaw)
    ? speedsRaw.map(String).map((s) => s.trim()).filter(Boolean)
    : speedsRaw
      ? [String(speedsRaw).trim()].filter(Boolean)
      : [];

  const runFlat = (Array.isArray(sp.runFlat) ? sp.runFlat[0] : sp.runFlat) === "1";
  const snowRated = (Array.isArray(sp.snowRated) ? sp.snowRated[0] : sp.snowRated) === "1";
  const allWeather = (Array.isArray(sp.allWeather) ? sp.allWeather[0] : sp.allWeather) === "1";
  const xlOnly = (Array.isArray(sp.xl) ? sp.xl[0] : sp.xl) === "1";

  const year = (Array.isArray(sp.year) ? sp.year[0] : sp.year) || "";
  const make = (Array.isArray(sp.make) ? sp.make[0] : sp.make) || "";
  const model = (Array.isArray(sp.model) ? sp.model[0] : sp.model) || "";
  const trim = (Array.isArray(sp.trim) ? sp.trim[0] : sp.trim) || "";
  const modification = (Array.isArray(sp.modification) ? sp.modification[0] : sp.modification) || "";

  if (year && make && model && !modification) {
    return (
      <main className="bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Tires</h1>
          <p className="mt-2 text-sm text-neutral-700">
            Select your vehicle <span className="font-semibold">trim / option</span> to show tires that fit.
          </p>
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
            Current selection: <span className="font-semibold">{year} {make} {model}</span>
            <div className="mt-2 text-xs text-neutral-500">
              Tip: Open the vehicle picker and choose a trim (it will auto-search).
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Option B (aggregate OEM sizes): we still fetch "strict" sizes for the selected modification,
  // but we *display* the union of sizes across all modifications for the model.
  const fitmentStrict = year && make && model
    ? await fetchFitment({ year, make, model, modification: modification || undefined })
    : null;

  const fitmentAgg = year && make && model
    ? await fetchFitment({ year, make, model })
    : null;

  const tireSizesStrict: string[] = Array.isArray(fitmentStrict?.tireSizes)
    ? fitmentStrict.tireSizes.map(String)
    : [];

  const tireSizesAgg: string[] = Array.isArray(fitmentAgg?.tireSizes)
    ? fitmentAgg.tireSizes.map(String)
    : [];

  const tireSizes = Array.from(new Set([...tireSizesStrict, ...tireSizesAgg]));

  const selectedSizeRaw = (Array.isArray(sp.size) ? sp.size[0] : sp.size) || "";
  const selectedSize = selectedSizeRaw
    ? String(selectedSizeRaw)
    : (tireSizesStrict[0] || tireSizes[0] || "");

  const km = selectedSize ? await fetchKmTires(selectedSize) : null;
  const wp = selectedSize ? await fetchWpTires(selectedSize) : null;

  const itemsKm: Tire[] = Array.isArray(km?.items) ? km.items : [];
  const itemsWp: Tire[] = Array.isArray(wp?.items) ? wp.items : [];

  // Blend silently; dedupe by SKU/part number.
  const seenSku = new Set<string>();
  const itemsRaw: Tire[] = [];
  for (const t of [...itemsKm, ...itemsWp]) {
    const sku = String(t.mfgPartNumber || t.partNumber || "").trim();
    const k = sku || JSON.stringify(t);
    if (seenSku.has(k)) continue;
    seenSku.add(k);
    itemsRaw.push(t);
  }

  // Attach cached displayName/imageUrl from package engine (best-effort)
  const assets = await Promise.all(
    itemsRaw.slice(0, 60).map(async (t) => {
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

  const itemsEnriched: Tire[] = itemsRaw.map((t) => {
    const km = t.description ? String(t.description) : "";
    const asset = km ? assetByKm.get(km) : undefined;
    return {
      ...t,
      // Prefer cached asset display name/image, but don't wipe existing values
      displayName: asset?.display_name || t.displayName || undefined,
      imageUrl: asset?.image_url || t.imageUrl || undefined,
    };
  });

  function parseFromDescription(desc: string) {
    const d = String(desc || "").toUpperCase();

    // Run flat markers commonly present in KM descriptions
    const isRunFlat = /\b(RFT|EMT|ROF|RUN\s*-?FLAT)\b/.test(d);

    // XL marker
    const isXL = /\bXL\b/.test(d);

    // Speed rating (very rough): look for patterns like " 95V" or "99Y" near end
    // We intentionally allow a trailing space and ignore load index.
    const speedMatch = d.match(/\b\d{2,3}([A-Z])\b(?!.*\b\d{2,3}[A-Z]\b)/);
    const speed = speedMatch ? speedMatch[1] : undefined;

    // Season (heuristic)
    let season: "All-season" | "Winter" | "Summer" | "All-terrain" | undefined;
    if (/\b(BLIZZAK|WS\d+|X-ICE|ICE|WINTER|SNOW)\b/.test(d)) season = "Winter";
    else if (/\b(A\/?S|AS\b|ALL\s*-?SEASON)\b/.test(d)) season = "All-season";
    else if (/\b(A\/T|AT\b|ALL\s*-?TERRAIN)\b/.test(d)) season = "All-terrain";
    else if (/\b(SUMMER|MAX\s*-?PERFORMANCE)\b/.test(d)) season = "Summer";

    const isAllWeather = /\bALL\s*-?WEATHER\b/.test(d);
    const isSnowRated = /\b(3PMSF|\b3\s*PEAK\b|M\+S|M\s*\+\s*S)\b/.test(d);

    return { isRunFlat, isXL, speed, season, isAllWeather, isSnowRated };
  }

  // Brand facet list (from current result set)
  const brandCounts = new Map<string, number>();
  for (const t of itemsEnriched) {
    const b = String(t.brand || "").trim();
    if (!b) continue;
    brandCounts.set(b, (brandCounts.get(b) || 0) + 1);
  }

  const brandsByCount = Array.from(brandCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const topBrands = brandsByCount.slice(0, 6).map(([b]) => b);

  const restBrands = brandsByCount
    .slice(6)
    .map(([b]) => b)
    .sort((a, b) => a.localeCompare(b));

  // Derived facets from description
  const seasonCounts = new Map<string, number>();
  const speedCounts = new Map<string, number>();
  let runFlatCount = 0;
  let snowRatedCount = 0;
  let allWeatherCount = 0;
  let xlCount = 0;

  for (const t of itemsEnriched) {
    const parsed = parseFromDescription(String(t.description || ""));
    if (parsed.season) seasonCounts.set(parsed.season, (seasonCounts.get(parsed.season) || 0) + 1);
    if (parsed.speed) speedCounts.set(parsed.speed, (speedCounts.get(parsed.speed) || 0) + 1);
    if (parsed.isRunFlat) runFlatCount++;
    if (parsed.isSnowRated) snowRatedCount++;
    if (parsed.isAllWeather) allWeatherCount++;
    if (parsed.isXL) xlCount++;
  }

  const seasonsAvailable = Array.from(seasonCounts.entries()).sort((a, b) => b[1] - a[1]).map(([s]) => s);
  const speedsAvailable = Array.from(speedCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s]) => s);

  const itemsFiltered: Tire[] = itemsEnriched.filter((t) => {
    const parsed = parseFromDescription(String(t.description || ""));

    // Brand filter
    if (brands.length) {
      const b = String(t.brand || "").toLowerCase();
      const ok = brands.some((x) => b === String(x).toLowerCase());
      if (!ok) return false;
    }

    // Season filter (heuristic)
    if (seasons.length) {
      const s = parsed.season || "";
      if (!seasons.includes(s)) return false;
    }

    // Speed rating filter (heuristic)
    if (speeds.length) {
      const spd = parsed.speed || "";
      if (!speeds.includes(spd)) return false;
    }

    if (runFlat && !parsed.isRunFlat) return false;
    if (snowRated && !parsed.isSnowRated) return false;
    if (allWeather && !parsed.isAllWeather) return false;
    if (xlOnly && !parsed.isXL) return false;

    // Price filter (based on displayed price = cost + 50)
    const p = typeof t.cost === "number" ? t.cost + 50 : null;
    if (typeof priceMin === "number" && Number.isFinite(priceMin)) {
      if (p == null || p < priceMin) return false;
    }
    if (typeof priceMax === "number" && Number.isFinite(priceMax)) {
      if (p == null || p > priceMax) return false;
    }

    return true;
  });

  const items: Tire[] = [...itemsFiltered].sort((a, b) => {
    const aPrice = typeof a.cost === "number" ? a.cost + 50 : Number.POSITIVE_INFINITY;
    const bPrice = typeof b.cost === "number" ? b.cost + 50 : Number.POSITIVE_INFINITY;
    const aBrand = (a.brand || "").toLowerCase();
    const bBrand = (b.brand || "").toLowerCase();
    const aStock = (a.quantity?.primary ?? 0) + (a.quantity?.alternate ?? 0) + (a.quantity?.national ?? 0);
    const bStock = (b.quantity?.primary ?? 0) + (b.quantity?.alternate ?? 0) + (b.quantity?.national ?? 0);

    switch (sort) {
      case "price_asc":
        return aPrice - bPrice;
      case "price_desc":
        return bPrice - aPrice;
      case "brand_asc":
        return aBrand.localeCompare(bBrand);
      case "stock_desc":
        return bStock - aStock;
      default:
        return 0;
    }
  });

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
              Tires
            </h1>
            <p className="mt-1 text-sm text-neutral-700">
              {year && make && model
                ? `Showing tires for ${year} ${make} ${model}${trim ? ` ${trim}` : ""}.`
                : "Select your vehicle in the header to filter tires."}
            </p>

            {year && make && model ? (
              <>
                <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800">
                  <span className="text-neutral-500">Vehicle:</span>
                  <span className="font-extrabold text-neutral-900">
                    {year} {make} {model}
                    {trim ? ` ${trim}` : ""}
                  </span>
                </div>
                <GarageWidget type="tires" />
              </>
            ) : null}
            {/* OEM sizes are rendered as buttons above the search controls */}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {tireSizes.length ? (
              <div className="flex w-full flex-wrap justify-end gap-2">
                {tireSizes.map((s) => {
                  const active = s === selectedSize;
                  const isStrict = tireSizesStrict.includes(s);
                  const href = `/tires?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}${trim ? `&trim=${encodeURIComponent(trim)}` : ""}${modification ? `&modification=${encodeURIComponent(modification)}` : ""}&size=${encodeURIComponent(s)}${zip ? `&zip=${encodeURIComponent(zip)}` : ""}${sort ? `&sort=${encodeURIComponent(sort)}` : ""}`;
                  return (
                    <Link
                      key={s}
                      href={href}
                      className={
                        active
                          ? "rounded-full bg-neutral-900 px-3 py-1 text-xs font-extrabold text-white"
                          : isStrict
                            ? "rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-extrabold text-neutral-900"
                            : "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-900"
                      }
                      title={
                        isStrict
                          ? "OEM size for selected modification"
                          : "OEM size on other modifications (aggregate)"
                      }
                    >
                      {s}
                    </Link>
                  );
                })}
              </div>
            ) : null}

            <form className="flex flex-wrap items-center gap-2" action="/tires" method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="size" value={selectedSize} />

              {/* ZIP filter temporarily removed */}

              <label className="ml-2 text-xs font-semibold text-neutral-600">Sort</label>
              <AutoSubmitSelect
                name="sort"
                defaultValue={sort}
                className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
                options={[
                  { value: "price_asc", label: "Price Low to High" },
                  { value: "best", label: "Best Match" },
                  { value: "price_desc", label: "Price High to Low" },
                  { value: "brand_asc", label: "Brand A–Z" },
                  { value: "stock_desc", label: "Most Stock" },
                ]}
              />
            </form>
          </div>
        </div>

        <div className="mt-5 grid gap-6 md:grid-cols-[280px_1fr]">
          <aside className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 md:block">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold">Filters</h2>
              <Link
                href={`/tires?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}${trim ? `&trim=${encodeURIComponent(trim)}` : ""}${modification ? `&modification=${encodeURIComponent(modification)}` : ""}${selectedSize ? `&size=${encodeURIComponent(selectedSize)}` : ""}${zip ? `&zip=${encodeURIComponent(zip)}` : ""}${sort ? `&sort=${encodeURIComponent(sort)}` : ""}`}
                className="text-xs font-semibold text-neutral-600 hover:underline"
              >
                Clear all
              </Link>
            </div>

            <FilterGroup title="Vehicle / Size">
              <div className="text-xs text-neutral-600">
                Select an OEM size chip above to change results.
              </div>
            </FilterGroup>

            <form action="/tires" method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="size" value={selectedSize} />
                            <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="priceMin" value={priceMinRaw ? String(priceMinRaw) : ""} />
              <input type="hidden" name="priceMax" value={priceMaxRaw ? String(priceMaxRaw) : ""} />

              <FilterGroup title="Brand">
                {topBrands.length ? (
                  <div className="grid gap-2">
                    {topBrands.map((b) => (
                      <div key={b} className="flex items-center justify-between gap-2">
                        <Check
                          label={b}
                          name="brand"
                          value={b}
                          defaultChecked={brands.includes(b)}
                        />
                        <span className="text-xs font-semibold text-neutral-500">
                          {brandCounts.get(b) || 0}
                        </span>
                      </div>
                    ))}

                    {restBrands.length ? (
                      <details className="rounded-xl border border-neutral-200 bg-white p-2">
                        <summary className="cursor-pointer select-none text-xs font-extrabold text-neutral-900">
                          More brands ({restBrands.length})
                        </summary>
                        <div className="mt-2 grid gap-2">
                          {restBrands.map((b) => (
                            <div key={b} className="flex items-center justify-between gap-2">
                              <Check
                                label={b}
                                name="brand"
                                value={b}
                                defaultChecked={brands.includes(b)}
                              />
                              <span className="text-xs font-semibold text-neutral-500">
                                {brandCounts.get(b) || 0}
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-xs text-neutral-600">No brand data yet.</div>
                )}

                <button className="mt-2 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50">
                  Apply brand
                </button>
              </FilterGroup>
            </form>

            <form action="/tires" method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="size" value={selectedSize} />
                            <input type="hidden" name="sort" value={sort} />
              {/* keep brands */}
              {brands.map((b) => (
                <input key={b} type="hidden" name="brand" value={b} />
              ))}

              <FilterGroup title="Price">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="priceMin"
                    defaultValue={priceMinRaw ? String(priceMinRaw) : ""}
                    placeholder="$ min"
                    className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                  />
                  <input
                    name="priceMax"
                    defaultValue={priceMaxRaw ? String(priceMaxRaw) : ""}
                    placeholder="$ max"
                    className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                  />
                </div>

                <button className="mt-2 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50">
                  Apply price
                </button>
              </FilterGroup>
            </form>

            <form action="/tires" method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="size" value={selectedSize} />
                            <input type="hidden" name="sort" value={sort} />
              {/* keep brands */}
              {brands.map((b) => (
                <input key={b} type="hidden" name="brand" value={b} />
              ))}
              <input type="hidden" name="priceMin" value={priceMinRaw ? String(priceMinRaw) : ""} />
              <input type="hidden" name="priceMax" value={priceMaxRaw ? String(priceMaxRaw) : ""} />
              {/* keep other filters */}
              {speeds.map((s) => (
                <input key={s} type="hidden" name="speed" value={s} />
              ))}
              <input type="hidden" name="runFlat" value={runFlat ? "1" : ""} />
              <input type="hidden" name="snowRated" value={snowRated ? "1" : ""} />
              <input type="hidden" name="allWeather" value={allWeather ? "1" : ""} />
              <input type="hidden" name="xl" value={xlOnly ? "1" : ""} />

              <FilterGroup title="Season">
                {seasonsAvailable.length ? (
                  seasonsAvailable.map((s) => (
                    <div key={s} className="flex items-center justify-between gap-2">
                      <Check label={s} name="season" value={s} defaultChecked={seasons.includes(s)} />
                      <span className="text-xs font-semibold text-neutral-500">
                        {seasonCounts.get(s) || 0}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-neutral-600">No season data yet.</div>
                )}

                <button className="mt-2 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50">
                  Apply season
                </button>
              </FilterGroup>
            </form>

            <FilterGroup title="Mileage Warranty">
              <div className="text-xs text-neutral-600">
                Coming soon (K&M feed doesn’t provide warranty fields yet).
              </div>
            </FilterGroup>

            <form action="/tires" method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="size" value={selectedSize} />
                            <input type="hidden" name="sort" value={sort} />
              {/* keep brands */}
              {brands.map((b) => (
                <input key={b} type="hidden" name="brand" value={b} />
              ))}
              <input type="hidden" name="priceMin" value={priceMinRaw ? String(priceMinRaw) : ""} />
              <input type="hidden" name="priceMax" value={priceMaxRaw ? String(priceMaxRaw) : ""} />
              {/* keep other filters */}
              {seasons.map((s) => (
                <input key={s} type="hidden" name="season" value={s} />
              ))}
              <input type="hidden" name="runFlat" value={runFlat ? "1" : ""} />
              <input type="hidden" name="snowRated" value={snowRated ? "1" : ""} />
              <input type="hidden" name="allWeather" value={allWeather ? "1" : ""} />
              <input type="hidden" name="xl" value={xlOnly ? "1" : ""} />

              <FilterGroup title="Speed Rating">
                {speedsAvailable.length ? (
                  speedsAvailable.slice(0, 12).map((s) => (
                    <div key={s} className="flex items-center justify-between gap-2">
                      <Check label={s} name="speed" value={s} defaultChecked={speeds.includes(s)} />
                      <span className="text-xs font-semibold text-neutral-500">
                        {speedCounts.get(s) || 0}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-neutral-600">No speed rating data yet.</div>
                )}

                <button className="mt-2 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50">
                  Apply speed rating
                </button>
              </FilterGroup>
            </form>

            <form action="/tires" method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="size" value={selectedSize} />
                            <input type="hidden" name="sort" value={sort} />
              {/* keep brands */}
              {brands.map((b) => (
                <input key={b} type="hidden" name="brand" value={b} />
              ))}
              <input type="hidden" name="priceMin" value={priceMinRaw ? String(priceMinRaw) : ""} />
              <input type="hidden" name="priceMax" value={priceMaxRaw ? String(priceMaxRaw) : ""} />
              {/* keep other filters */}
              {seasons.map((s) => (
                <input key={s} type="hidden" name="season" value={s} />
              ))}
              {speeds.map((s) => (
                <input key={s} type="hidden" name="speed" value={s} />
              ))}
              <input type="hidden" name="snowRated" value={snowRated ? "1" : ""} />
              <input type="hidden" name="allWeather" value={allWeather ? "1" : ""} />

              <FilterGroup title="Load / Extra Load">
                <div className="flex items-center justify-between gap-2">
                  <Check label="XL only" name="xl" value="1" defaultChecked={xlOnly} />
                  <span className="text-xs font-semibold text-neutral-500">{xlCount}</span>
                </div>

                <button className="mt-2 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50">
                  Apply load
                </button>
              </FilterGroup>
            </form>

            <form action="/tires" method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="size" value={selectedSize} />
                            <input type="hidden" name="sort" value={sort} />
              {/* keep brands */}
              {brands.map((b) => (
                <input key={b} type="hidden" name="brand" value={b} />
              ))}
              <input type="hidden" name="priceMin" value={priceMinRaw ? String(priceMinRaw) : ""} />
              <input type="hidden" name="priceMax" value={priceMaxRaw ? String(priceMaxRaw) : ""} />
              {/* keep other filters */}
              {seasons.map((s) => (
                <input key={s} type="hidden" name="season" value={s} />
              ))}
              {speeds.map((s) => (
                <input key={s} type="hidden" name="speed" value={s} />
              ))}
              <input type="hidden" name="snowRated" value={snowRated ? "1" : ""} />
              <input type="hidden" name="allWeather" value={allWeather ? "1" : ""} />
              <input type="hidden" name="xl" value={xlOnly ? "1" : ""} />

              <FilterGroup title="Run Flat">
                <div className="flex items-center justify-between gap-2">
                  <Check label="Run-flat" name="runFlat" value="1" defaultChecked={runFlat} />
                  <span className="text-xs font-semibold text-neutral-500">{runFlatCount}</span>
                </div>

                <button className="mt-2 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50">
                  Apply run-flat
                </button>
              </FilterGroup>
            </form>

            <form action="/tires" method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="size" value={selectedSize} />
                            <input type="hidden" name="sort" value={sort} />
              {/* keep brands */}
              {brands.map((b) => (
                <input key={b} type="hidden" name="brand" value={b} />
              ))}
              <input type="hidden" name="priceMin" value={priceMinRaw ? String(priceMinRaw) : ""} />
              <input type="hidden" name="priceMax" value={priceMaxRaw ? String(priceMaxRaw) : ""} />
              {/* keep other filters */}
              {seasons.map((s) => (
                <input key={s} type="hidden" name="season" value={s} />
              ))}
              {speeds.map((s) => (
                <input key={s} type="hidden" name="speed" value={s} />
              ))}
              <input type="hidden" name="runFlat" value={runFlat ? "1" : ""} />
              <input type="hidden" name="xl" value={xlOnly ? "1" : ""} />

              <FilterGroup title="Snow Rated / All Weather">
                <div className="flex items-center justify-between gap-2">
                  <Check label="Snow rated (3PMSF/M+S)" name="snowRated" value="1" defaultChecked={snowRated} />
                  <span className="text-xs font-semibold text-neutral-500">{snowRatedCount}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Check label="All Weather" name="allWeather" value="1" defaultChecked={allWeather} />
                  <span className="text-xs font-semibold text-neutral-500">{allWeatherCount}</span>
                </div>

                <button className="mt-2 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50">
                  Apply
                </button>
              </FilterGroup>
            </form>

            <FilterGroup title="UTQG Rating">
              <div className="text-xs text-neutral-600">
                Coming soon (K&M feed doesn’t expose UTQG fields yet; we’ll add this when we add a richer supplier).
              </div>
            </FilterGroup>

            <FilterGroup title="Rebates / Specials">
              <div className="text-xs text-neutral-600">
                Coming soon (needs supplier merchandising fields).
              </div>
            </FilterGroup>

            <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs text-neutral-800">
              <div className="font-extrabold">Tip</div>
              <div className="mt-1">
                Best conversions come from showing local availability and an easy
                schedule flow.
              </div>
            </div>
          </aside>

          <section className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              {selectedSize ? <Chip active>{selectedSize}</Chip> : null}
              <Chip>{zip ? `In stock near ${zip}` : "In stock near you"}</Chip>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {km?.error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                  Tire search error: {String(km.error).slice(0, 500)}
                </div>
              ) : null}

              {wp?.error ? (
                <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                  Tire search error (WheelPros feed): {String(wp.error).slice(0, 500)}
                </div>
              ) : null}

              {items.length ? (
                items.map((t, idx) => (
                  <article
                    key={t.partNumber || t.mfgPartNumber || idx}
                    className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-semibold text-neutral-600">
                        {t.brand || "Tire"}
                      </div>
                      {t.mfgPartNumber ? (
                        <FavoritesButton
                          type="tire"
                          sku={t.mfgPartNumber}
                          label={`${t.brand || "Tire"} ${t.displayName || t.description || t.mfgPartNumber}`}
                          href={`/tires?${new URLSearchParams({ year, make, model, trim, modification, size: selectedSize, sort }).toString()}`}
                          imageUrl={t.imageUrl}
                        />
                      ) : null}
                    </div>
                    <h3 className="mt-0.5 text-sm font-extrabold text-neutral-900">
                      {t.displayName || t.description || t.partNumber || "Tire"}
                    </h3>

                    <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
                      {t.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.imageUrl}
                          alt={t.displayName || t.description || t.partNumber || "Tire"}
                          className="h-36 w-full object-contain bg-white"
                          loading="lazy"
                        />
                      ) : (
                        <div className="p-3 text-xs text-neutral-700">No image</div>
                      )}
                    </div>

                    <div className="mt-4">
                      <div className="text-3xl font-extrabold text-neutral-900">
                        {typeof t.cost === "number" ? `$${(t.cost + 50).toFixed(2)}` : "Call for price"}
                      </div>
                      <div className="text-xs text-neutral-600">each</div>
                    </div>

                    <div className="mt-3 text-xs text-neutral-700">
                      Qty: {t.quantity?.primary ?? 0} primary • {t.quantity?.alternate ?? 0} alt • {t.quantity?.national ?? 0} nat
                    </div>

                    <div className="mt-4 grid gap-2">
                      <Link
                        href="/schedule"
                        className="rounded-xl bg-neutral-900 px-3 py-2 text-center text-xs font-extrabold text-white"
                      >
                        Schedule Install
                      </Link>

                      <div className="flex items-center justify-between gap-3 text-xs">
                        <a
                          href={BRAND.links.tel}
                          className="font-extrabold text-neutral-900 hover:underline"
                        >
                          Call
                        </a>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
                  {year && make && model ? (
                    tireSizes.length
                      ? "No tire results yet."
                      : "No OEM tire size returned for this vehicle/trim yet."
                  ) : (
                    "Select a vehicle in the header to see tires."
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
              Next: wire supplier feed + real filters + “in stock near you” logic.
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Chip({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={
        active
          ? "inline-flex items-center rounded-full bg-neutral-900 px-3 py-1 text-xs font-extrabold text-white"
          : "inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-800"
      }
    >
      {children}
    </span>
  );
}

// Badge removed (placeholder UI no longer uses it)

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <div className="text-xs font-extrabold text-neutral-900">{title}</div>
      <div className="mt-2 grid gap-2">{children}</div>
    </div>
  );
}

function Check({
  label,
  name,
  value,
  defaultChecked,
}: {
  label: string;
  name?: string;
  value?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-800">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-neutral-300"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

