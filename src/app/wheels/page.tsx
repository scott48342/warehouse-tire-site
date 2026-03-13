import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { WheelsStyleCard } from "@/components/WheelsStyleCard";

type Wheel = {
  sku?: string;
  brand?: string;
  model?: string;
  finish?: string;
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
  const year = (Array.isArray(sp.year) ? sp.year[0] : sp.year) || "";
  const make = (Array.isArray(sp.make) ? sp.make[0] : sp.make) || "";
  const model = (Array.isArray(sp.model) ? sp.model[0] : sp.model) || "";
  const trim = (Array.isArray(sp.trim) ? sp.trim[0] : sp.trim) || "";
  const modification = (Array.isArray(sp.modification) ? sp.modification[0] : sp.modification) || "";

  // Optional user-supplied wheel filters (prefer these over auto-restricting).
  const diameterParam = (Array.isArray(sp.diameter) ? sp.diameter[0] : sp.diameter) || "";
  const widthParam = (Array.isArray(sp.width) ? sp.width[0] : sp.width) || "";
  const boltPatternParam = (Array.isArray(sp.boltPattern) ? sp.boltPattern[0] : sp.boltPattern) || "";

  // Wheel Pros search params are vendor-specific.
  // We’ll start by passing these through; if WP expects different keys,
  // we’ll adapt once we confirm their schema.
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
  // centerbore on WheelPros can be finicky; don't hard-filter on it yet.
  const cb: string | undefined = undefined;

  const diaRange: [number | null, number | null] = Array.isArray(fitment?.wheelDiameterRangeIn)
    ? fitment.wheelDiameterRangeIn
    : [null, null];
  // Width/offset ranges available in fitment, but we are not filtering on them yet.

  // WheelPros expects a single diameter/width.
  // Use the max wheel diameter (more common for OEM packages) and omit width/offset initially,
  // then tighten once we confirm the catalog data lines up.
  const diameterNum = diaRange?.[1] != null ? Number(diaRange[1]) : (diaRange?.[0] != null ? Number(diaRange[0]) : NaN);
  const diameter = diameterParam
    ? Number.isFinite(Number(diameterParam))
      ? Number(diameterParam).toFixed(1)
      : diameterParam
    : (Number.isFinite(diameterNum) ? diameterNum.toFixed(1) : undefined);

  const width = widthParam || undefined;
  const minOffset = undefined;
  const maxOffset = undefined;

  // 2) Query WheelPros using fitment-derived filters.
  // IMPORTANT: Don't auto-restrict diameter/width unless the user explicitly chose them.
  // Doing so can collapse results (e.g., WheelPros shows many fitments/sizes).
  const data = await fetchWheels({
    page: "1",
    pageSize: "24",
    fields: "inventory,price,images",
    priceType: "msrp",
    // NOTE: WheelPros docs say company is required for pricing, but in practice passing
    // company can zero results for some accounts/environments. Omit for now.
    currencyCode: "USD",

    boltPattern: bp,
    centerbore: cb,
    diameter: diameterParam ? diameter : undefined,
    width: widthParam ? width : undefined,
    minOffset,
    maxOffset,
    offsetType: minOffset || maxOffset ? "RANGE" : undefined,
  });

  const maybeData = data as { items?: unknown[]; results?: unknown[] };

  // common patterns: { items: [] } or { results: [] }
  const rawItems: unknown[] = Array.isArray(maybeData?.items)
    ? maybeData.items
    : (Array.isArray(maybeData?.results) ? maybeData.results : []);

  const itemsUnsorted: Wheel[] = rawItems.map((itUnknown) => {
    const it = itUnknown as WheelProsItem;

    const brandObj = it?.brand && typeof it.brand === "object" ? (it.brand as WheelProsBrand) : null;
    const brand = brandObj?.description ?? brandObj?.parent ?? brandObj?.code ?? (typeof it?.brand === "string" ? it.brand : undefined);
    const finish = it?.techfeed?.finish || it?.properties?.finish;
    const model = it?.properties?.model || it?.title;

    const msrp = it?.prices?.msrp;
    const firstPrice = Array.isArray(msrp) ? msrp[0] : undefined;
    const price = firstPrice?.currencyAmount != null ? Number(firstPrice.currencyAmount) : undefined;

    const img0 = Array.isArray(it?.images) ? it.images[0] : undefined;
    const imageUrl = img0?.imageUrlLarge || img0?.imageUrlMedium || img0?.imageUrlOriginal || undefined;

    const styleKey = it?.techfeed?.style || undefined;

    return {
      sku: it?.sku,
      brand,
      model,
      finish,
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

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.length ? (
            items.map((w, idx) => (
              <WheelsStyleCard
                key={w.sku || `${w.styleKey || "wheel"}-${idx}`}
                brand={typeof w.brand === "string" ? w.brand : w.brand != null ? String(w.brand) : "Wheel"}
                title={typeof w.model === "string" ? w.model : w.model != null ? String(w.model) : w.sku || "Wheel"}
                baseSku={String(w.sku || "")}
                baseFinish={w.finish ? String(w.finish) : undefined}
                baseImageUrl={w.imageUrl}
                price={w.price}
                finishThumbs={w.finishThumbs}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
              No wheel results yet. Select a vehicle (with trim) in the header and
              try again.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
