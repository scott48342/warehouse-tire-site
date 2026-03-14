import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { WheelsStyleCard } from "@/components/WheelsStyleCard";
import { FilterGroup } from "./FilterGroup";
import { GarageWidget } from "@/components/GarageWidget";

type Wheel = {
  sku?: string;
  brand?: string;
  brandCode?: string;
  model?: string;
  finish?: string;
  diameter?: string;
  width?: string;
  offset?: string;
  imageUrl?: string;
  price?: number;
  styleKey?: string;
  finishThumbs?: { finish: string; sku: string; imageUrl?: string }[];
};

type WheelProsBrand = {
  code?: string;
  description?: string;
  parent?: string;
};

type WheelProsImage = {
  imageUrlOriginal?: string;
  imageUrlSmall?: string;
  imageUrlMedium?: string;
  imageUrlLarge?: string;
};

type WheelProsPrice = {
  currencyAmount?: string;
  currencyCode?: string;
};

type WheelProsItem = {
  sku?: string;
  title?: string;
  brand?: WheelProsBrand | string;
  properties?: {
    model?: string;
    finish?: string;
    diameter?: string;
    width?: string;
    offset?: string;
  };
  prices?: {
    msrp?: WheelProsPrice[];
  };
  images?: WheelProsImage[];
  techfeed?: {
    style?: string;
    finish?: string;
    images?: string[];
  };
};

function getBaseUrl() {
  // On Vercel, prefer the deployment URL.
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  // Local dev fallback
  return "http://localhost:3000";
}

async function fetchFitment(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }

  const res = await fetch(`${getBaseUrl()}/api/vehicles/search?${sp.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return { error: await res.text() };
  }

  return res.json();
}

async function fetchWheels(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }

  // NOTE: We intentionally call our own API route.
  const res = await fetch(
    `${getBaseUrl()}/api/wheelpros/wheels/search?${sp.toString()}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return { error: await res.text() };
  }

  return res.json();
}

export default async function WheelsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const sortRaw = Array.isArray(sp.sort) ? sp.sort[0] : sp.sort;
  const sort = (sortRaw ?? "price_asc").trim();
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number(pageRaw || "1") || 1);

  const year = (Array.isArray(sp.year) ? sp.year[0] : sp.year) || "";
  const make = (Array.isArray(sp.make) ? sp.make[0] : sp.make) || "";
  const model = (Array.isArray(sp.model) ? sp.model[0] : sp.model) || "";
  const trim = (Array.isArray(sp.trim) ? sp.trim[0] : sp.trim) || "";
  const modification = (Array.isArray(sp.modification) ? sp.modification[0] : sp.modification) || "";

  // Optional user-supplied wheel filters.
  const diameterParam = (Array.isArray(sp.diameter) ? sp.diameter[0] : sp.diameter) || "";
  const widthParam = (Array.isArray(sp.width) ? sp.width[0] : sp.width) || "";
  const boltPatternParam = (Array.isArray(sp.boltPattern) ? sp.boltPattern[0] : sp.boltPattern) || "";
  const brandCd = (Array.isArray(sp.brand_cd) ? sp.brand_cd[0] : sp.brand_cd) || "";
  const finish = (Array.isArray(sp.finish) ? sp.finish[0] : sp.finish) || "";

  if (year && make && model && !modification) {
    return (
      <main className="bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Wheels</h1>
          <p className="mt-2 text-sm text-neutral-700">
            Select your vehicle <span className="font-semibold">trim / option</span> to show wheels that fit.
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

  // 1) Resolve fitment (bolt pattern, width/offset ranges, etc.)
  const fitment = year && make && model
    ? await fetchFitment({
        year,
        make,
        model,
        modification: modification || undefined,
      })
    : null;

  const bp: string | undefined = boltPatternParam || fitment?.boltPattern || undefined;

  // Centerbore: WheelPros properties/filters are inconsistent; don't hard-filter on it upstream.
  const cb: string | undefined = undefined;

  const diaRange: [number | null, number | null] = Array.isArray(fitment?.wheelDiameterRangeIn)
    ? fitment.wheelDiameterRangeIn
    : [null, null];
  const widthRange: [number | null, number | null] = Array.isArray(fitment?.wheelWidthRangeIn)
    ? fitment.wheelWidthRangeIn
    : [null, null];
  const offRange: [number | null, number | null] = Array.isArray(fitment?.offsetRangeMm)
    ? (fitment.offsetRangeMm as any)
    : [null, null];

  // Option 2: OEM + tolerance (improves results while staying sane).
  const OFFSET_TOLERANCE_MM = 5;
  const minOffN0 = offRange?.[0] != null ? Number(offRange[0]) : NaN;
  const maxOffN0 = offRange?.[1] != null ? Number(offRange[1]) : NaN;
  const minOffN = Number.isFinite(minOffN0) ? minOffN0 - OFFSET_TOLERANCE_MM : NaN;
  const maxOffN = Number.isFinite(maxOffN0) ? maxOffN0 + OFFSET_TOLERANCE_MM : NaN;

  const minOff = Number.isFinite(minOffN) ? String(minOffN) : undefined;
  const maxOff = Number.isFinite(maxOffN) ? String(maxOffN) : undefined;

  // WheelPros expects a single diameter/width.
  const diameterNum = diaRange?.[1] != null ? Number(diaRange[1]) : (diaRange?.[0] != null ? Number(diaRange[0]) : NaN);
  // If user picked a diameter filter, pass it through exactly as given (facet values are canonical).
  const diameter = diameterParam
    ? diameterParam
    : (Number.isFinite(diameterNum) ? diameterNum.toFixed(1) : undefined);

  // Same idea for width: pass facet value through exactly.
  const width = widthParam || undefined;
  const minOffset = minOff;
  const maxOffset = maxOff;

  // 2) Query WheelPros using fitment-derived filters.
  // IMPORTANT: Don't auto-restrict diameter/width unless the user explicitly chose them.
  // Doing so can collapse results (e.g., WheelPros shows many fitments/sizes).
  const upstreamPageSize = 120;
  const data = await fetchWheels({
    page: String(page),
    // Fetch enough SKUs that grouping by style doesn't collapse to only a couple cards,
    // but keep it reasonable for performance.
    pageSize: String(upstreamPageSize),
    fields: "inventory,price,images",
    priceType: "msrp",
    // NOTE: WheelPros docs say company is required for pricing, but in practice passing
    // company can zero results for some accounts/environments. Omit for now.
    currencyCode: "USD",

    boltPattern: bp,
    centerbore: cb,
    diameter: diameterParam ? diameter : undefined,
    width: widthParam ? width : undefined,

    // Facet filters (WheelPros taxonomy)
    brand_cd: brandCd || undefined,
    abbreviated_finish_desc: finish || undefined,

    minOffset,
    maxOffset,
    offsetType: minOffset || maxOffset ? "RANGE" : undefined,
  });

  const maybeData = data as {
    items?: unknown[];
    results?: unknown[];
    totalCount?: number;
    facets?: any;
  };

  // common patterns: { items: [] } or { results: [] }
  const rawItems: unknown[] = Array.isArray(maybeData?.items)
    ? maybeData.items
    : (Array.isArray(maybeData?.results) ? maybeData.results : []);

  const itemsUnsorted: Wheel[] = rawItems.map((itUnknown) => {
    const it = itUnknown as WheelProsItem;

    const brandObj = it?.brand && typeof it.brand === "object" ? (it.brand as WheelProsBrand) : null;
    const brandCode = brandObj?.code || undefined;
    const brand = brandObj?.description ?? brandObj?.parent ?? brandObj?.code ?? (typeof it?.brand === "string" ? it.brand : undefined);
    const finish = it?.techfeed?.finish || it?.properties?.finish;
    const model = it?.properties?.model || it?.title;
    const diameter = it?.properties?.diameter ? String(it.properties.diameter) : undefined;
    const width = it?.properties?.width ? String(it.properties.width) : undefined;
    const offset = it?.properties?.offset ? String(it.properties.offset) : undefined;

    const msrp = it?.prices?.msrp;
    const firstPrice = Array.isArray(msrp) ? msrp[0] : undefined;
    const price = firstPrice?.currencyAmount != null ? Number(firstPrice.currencyAmount) : undefined;

    const img0 = Array.isArray(it?.images) ? it.images[0] : undefined;
    const imageUrl = img0?.imageUrlLarge || img0?.imageUrlMedium || img0?.imageUrlOriginal || undefined;

    const styleKey = it?.techfeed?.style || undefined;

    return {
      sku: it?.sku,
      brand,
      brandCode,
      model,
      finish,
      diameter,
      width,
      offset,
      imageUrl,
      price: typeof price === "number" && Number.isFinite(price) ? price : undefined,
      styleKey,
    };
  });

  // Group wheels by styleKey so multiple finishes show as one block.
  const grouped: Wheel[] = (() => {
    const map = new Map<string, Wheel[]>();
    const singles: Wheel[] = [];

    for (const w of itemsUnsorted) {
      const k = w.styleKey || "";
      if (!k) {
        singles.push(w);
        continue;
      }
      const arr = map.get(k) || [];
      arr.push(w);
      map.set(k, arr);
    }

    const out: Wheel[] = [];

    for (const [k, arr] of map.entries()) {
      // representative: first with image, else first.
      const rep = arr.find((x) => x.imageUrl) || arr[0];
      const thumbs: { finish: string; sku: string; imageUrl?: string; price?: number }[] = [];
      const seen = new Set<string>();
      for (const x of arr) {
        const fin = String(x.finish || "").trim();
        if (!fin || seen.has(fin)) continue;
        seen.add(fin);
        thumbs.push({ finish: fin, sku: x.sku || "", imageUrl: x.imageUrl, price: x.price });
      }
      out.push({
        ...rep,
        styleKey: k,
        finishThumbs: thumbs.filter((t) => t.sku),
      });
    }

    return [...out, ...singles];
  })();

  const items: Wheel[] = [...grouped].sort((a, b) => {
    const aPrice = typeof a.price === "number" ? a.price : Number.POSITIVE_INFINITY;
    const bPrice = typeof b.price === "number" ? b.price : Number.POSITIVE_INFINITY;

    switch (sort) {
      case "price_desc":
        return bPrice - aPrice;
      case "brand_asc":
        return String(a.brand || "").localeCompare(String(b.brand || ""));
      case "price_asc":
      default:
        return aPrice - bPrice;
    }
  });

  // Prefer hiding styles with no images, but don't collapse to an unusably small list.
  const itemsWithImages = items.filter(
    (w) => Boolean(w.imageUrl) || Boolean(w.finishThumbs?.some((t) => Boolean(t.imageUrl)))
  );
  const itemsFinal0 = itemsWithImages.length >= Math.min(12, items.length) ? itemsWithImages : items;

  // Client-side filters (WheelPros wrapper does not reliably support facet filtering).
  const itemsFilteredBasic = itemsFinal0.filter((w) => {
    if (brandCd && String(w.brandCode || "") !== String(brandCd)) return false;

    if (finish) {
      const f = String(w.finish || "").toLowerCase();
      if (!f.includes(String(finish).toLowerCase())) return false;
    }

    if (diameterParam) {
      const d = String(w.diameter || "").trim();
      if (d && d !== String(diameterParam).trim()) return false;
    }

    if (widthParam) {
      const ww = String(w.width || "").trim();
      if (ww && ww !== String(widthParam).trim()) return false;
    }

    return true;
  });

  // Fitment offset filter (important for passenger cars like Altima: +50ish).
  const minOffN2 = typeof minOffset === "string" ? Number(minOffset) : NaN;
  const maxOffN2 = typeof maxOffset === "string" ? Number(maxOffset) : NaN;

  const itemsFilteredOffset = Number.isFinite(minOffN2) && Number.isFinite(maxOffN2)
    ? itemsFilteredBasic.filter((w) => {
        const raw = String(w.offset || "").trim();
        if (!raw) return false; // if we know the vehicle offset range, require wheel offset
        const n = Number(raw);
        if (!Number.isFinite(n)) return false;
        return n >= minOffN2 && n <= maxOffN2;
      })
    : itemsFilteredBasic;

  const itemsFinal = itemsFilteredOffset;

  // Paginate styles client-side (we group SKUs into styles).
  const stylesPerPage = 24;
  const totalPages = Math.max(1, Math.ceil(itemsFinal.length / stylesPerPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * stylesPerPage;
  const itemsPage: Wheel[] = itemsFinal.slice(start, start + stylesPerPage);

  // Still show raw SKU count for reference.
  const totalCount = typeof maybeData?.totalCount === "number" ? maybeData.totalCount : itemsUnsorted.length;

  const facets = (maybeData as any)?.facets || {};
  const buckets = (k: string): Array<{ value: string; count?: number }> => {
    const f = facets?.[k];
    const arr = Array.isArray(f?.buckets) ? f.buckets : [];
    return arr
      .map((b: any) => ({ value: String(b?.value ?? "").trim(), count: b?.count != null ? Number(b.count) : undefined }))
      .filter((b: any) => b.value);
  };

  // Brand options: prefer actual brand names from the results we have.
  const brandOptions = (() => {
    const map = new Map<string, string>();
    for (const w of itemsUnsorted) {
      const code = String(w.brandCode || "").trim();
      const desc = String(w.brand || "").trim();
      if (!code) continue;
      if (desc) map.set(code, desc);
    }
    return Array.from(map.entries())
      .map(([code, desc]) => ({ code, desc }))
      .sort((a, b) => a.desc.localeCompare(b.desc));
  })();
  const finishBuckets = buckets("abbreviated_finish_desc");
  const diameterBuckets = buckets("wheel_diameter");
  const widthBuckets = buckets("width");
  const boltPatternBuckets = buckets("bolt_pattern_metric");

  const qBase = `/wheels?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}${trim ? `&trim=${encodeURIComponent(trim)}` : ""}${modification ? `&modification=${encodeURIComponent(modification)}` : ""}${sort ? `&sort=${encodeURIComponent(sort)}` : ""}`;

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
              Wheels
            </h1>
            <p className="mt-1 text-sm text-neutral-700">
              {year && make && model
                ? `Showing wheels for ${year} ${make} ${model}${trim ? ` ${trim}` : ""}.`
                : "Select your vehicle in the header to filter wheels."}
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
                <GarageWidget type="wheels" />
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-neutral-600">Sort</label>
            <AutoSubmitSelect
              name="sort"
              defaultValue={sort}
              className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
              options={[
                { value: "price_asc", label: "Price Low to High" },
                { value: "price_desc", label: "Price High to Low" },
                { value: "brand_asc", label: "Brand A–Z" },
              ]}
            />
          </div>
        </div>

        {data?.error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Wheel search error: {String(data.error).slice(0, 500)}
            <div className="mt-2 text-xs text-red-800">
              (We may need to adjust the Wheel Pros query parameter names.)
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-6 md:grid-cols-[280px_1fr]">
          <aside className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 md:block">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold">Filters</h2>
              <a href={qBase} className="text-xs font-semibold text-neutral-600 hover:underline">
                Clear all
              </a>
            </div>

            <form action="/wheels" method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="page" value={"1"} />

              {/* keep other filters */}
              <input type="hidden" name="finish" value={finish} />
              <input type="hidden" name="diameter" value={diameterParam} />
              <input type="hidden" name="width" value={widthParam} />
              <input type="hidden" name="boltPattern" value={boltPatternParam} />

              <FilterGroup title="Brand">
                <select
                  name="brand_cd"
                  defaultValue={brandCd}
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
                >
                  <option value="">All brands</option>
                  {brandOptions.slice(0, 120).map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.desc}
                    </option>
                  ))}
                </select>

                <button className="mt-2 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50">
                  Apply brand
                </button>
              </FilterGroup>
            </form>

            <form action="/wheels" method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="page" value={"1"} />

              <input type="hidden" name="brand_cd" value={brandCd} />
              <input type="hidden" name="diameter" value={diameterParam} />
              <input type="hidden" name="width" value={widthParam} />
              <input type="hidden" name="boltPattern" value={boltPatternParam} />

              <FilterGroup title="Finish">
                <select
                  name="finish"
                  defaultValue={finish}
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
                >
                  <option value="">All finishes</option>
                  {finishBuckets.slice(0, 80).map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.value}{b.count != null ? ` (${b.count})` : ""}
                    </option>
                  ))}
                </select>

                <button className="mt-2 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50">
                  Apply finish
                </button>
              </FilterGroup>
            </form>

            <form action="/wheels" method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="page" value={"1"} />

              <input type="hidden" name="brand_cd" value={brandCd} />
              <input type="hidden" name="finish" value={finish} />
              <input type="hidden" name="width" value={widthParam} />
              <input type="hidden" name="boltPattern" value={boltPatternParam} />

              <FilterGroup title="Diameter">
                <select
                  name="diameter"
                  defaultValue={diameterParam}
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
                >
                  <option value="">All diameters</option>
                  {diameterBuckets.slice(0, 80).map((b) => {
                    const label = String(b.value).replace(/\.0$/, "");
                    return (
                      <option key={b.value} value={b.value}>
                        {label}{b.count != null ? ` (${b.count})` : ""}
                      </option>
                    );
                  })}
                </select>

                <button className="mt-2 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50">
                  Apply diameter
                </button>
              </FilterGroup>
            </form>

            <form action="/wheels" method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="page" value={"1"} />

              <input type="hidden" name="brand_cd" value={brandCd} />
              <input type="hidden" name="finish" value={finish} />
              <input type="hidden" name="diameter" value={diameterParam} />
              <input type="hidden" name="boltPattern" value={boltPatternParam} />

              <FilterGroup title="Width">
                <select
                  name="width"
                  defaultValue={widthParam}
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
                >
                  <option value="">All widths</option>
                  {widthBuckets.slice(0, 80).map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.value}{b.count != null ? ` (${b.count})` : ""}
                    </option>
                  ))}
                </select>

                <button className="mt-2 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50">
                  Apply width
                </button>
              </FilterGroup>
            </form>

            <form action="/wheels" method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="page" value={"1"} />

              <input type="hidden" name="brand_cd" value={brandCd} />
              <input type="hidden" name="finish" value={finish} />
              <input type="hidden" name="diameter" value={diameterParam} />
              <input type="hidden" name="width" value={widthParam} />

              <FilterGroup title="Bolt pattern">
                <select
                  name="boltPattern"
                  defaultValue={boltPatternParam}
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
                >
                  <option value="">Vehicle bolt pattern</option>
                  {boltPatternBuckets.slice(0, 80).map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.value}{b.count != null ? ` (${b.count})` : ""}
                    </option>
                  ))}
                </select>

                <button className="mt-2 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50">
                  Apply bolt pattern
                </button>
              </FilterGroup>
            </form>
          </aside>

          <section>
            <div className="text-xs font-semibold text-neutral-600">
              Showing {itemsPage.length} styles (page {safePage} of {totalPages})
            </div>

            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {itemsPage.length ? (
                itemsPage.map((w, idx) => (
                  <WheelsStyleCard
                    key={w.sku || `${w.styleKey || "wheel"}-${idx}`}
                    brand={typeof w.brand === "string" ? w.brand : w.brand != null ? String(w.brand) : (w.brandCode || "Wheel")}
                    title={typeof w.model === "string" ? w.model : w.model != null ? String(w.model) : w.sku || "Wheel"}
                    baseSku={String(w.sku || "")}
                    baseFinish={w.finish ? String(w.finish) : undefined}
                    baseImageUrl={w.imageUrl}
                    price={w.price}
                    sizeLabel={
                      diameterParam || widthParam
                        ? {
                            diameter: diameterParam || w.diameter,
                            width: widthParam || w.width,
                          }
                        : w.diameter || w.width
                          ? { diameter: w.diameter, width: w.width }
                          : undefined
                    }
                    finishThumbs={w.finishThumbs}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
                  No wheel results. Try clearing filters.
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold text-neutral-600">
                Total SKUs: {totalCount}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {safePage > 1 ? (
                  <a
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-extrabold text-neutral-900 hover:bg-neutral-50"
                    href={`${qBase}${brandCd ? `&brand_cd=${encodeURIComponent(brandCd)}` : ""}${finish ? `&finish=${encodeURIComponent(finish)}` : ""}${diameterParam ? `&diameter=${encodeURIComponent(diameterParam)}` : ""}${widthParam ? `&width=${encodeURIComponent(widthParam)}` : ""}${boltPatternParam ? `&boltPattern=${encodeURIComponent(boltPatternParam)}` : ""}&page=${safePage - 1}`}
                  >
                    Prev
                  </a>
                ) : null}

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .map((p, i, arr) => {
                    const prev = arr[i - 1];
                    const gap = prev != null && p - prev > 1;
                    const href = `${qBase}${brandCd ? `&brand_cd=${encodeURIComponent(brandCd)}` : ""}${finish ? `&finish=${encodeURIComponent(finish)}` : ""}${diameterParam ? `&diameter=${encodeURIComponent(diameterParam)}` : ""}${widthParam ? `&width=${encodeURIComponent(widthParam)}` : ""}${boltPatternParam ? `&boltPattern=${encodeURIComponent(boltPatternParam)}` : ""}&page=${p}`;
                    return (
                      <span key={p} className="flex items-center gap-2">
                        {gap ? <span className="px-1 text-xs text-neutral-500">…</span> : null}
                        <a
                          href={href}
                          className={
                            p === safePage
                              ? "rounded-xl bg-neutral-900 px-3 py-2 text-xs font-extrabold text-white"
                              : "rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-extrabold text-neutral-900 hover:bg-neutral-50"
                          }
                        >
                          {p}
                        </a>
                      </span>
                    );
                  })}

                {safePage < totalPages ? (
                  <a
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-extrabold text-neutral-900 hover:bg-neutral-50"
                    href={`${qBase}${brandCd ? `&brand_cd=${encodeURIComponent(brandCd)}` : ""}${finish ? `&finish=${encodeURIComponent(finish)}` : ""}${diameterParam ? `&diameter=${encodeURIComponent(diameterParam)}` : ""}${widthParam ? `&width=${encodeURIComponent(widthParam)}` : ""}${boltPatternParam ? `&boltPattern=${encodeURIComponent(boltPatternParam)}` : ""}&page=${safePage + 1}`}
                  >
                    Next
                  </a>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
