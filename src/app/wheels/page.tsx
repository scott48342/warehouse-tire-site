import Link from "next/link";
import { BRAND } from "@/lib/brand";

type Wheel = {
  sku?: string;
  brand?: string;
  model?: string;
  finish?: string;
  imageUrl?: string;
  price?: number;
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
  const year = (Array.isArray(sp.year) ? sp.year[0] : sp.year) || "";
  const make = (Array.isArray(sp.make) ? sp.make[0] : sp.make) || "";
  const model = (Array.isArray(sp.model) ? sp.model[0] : sp.model) || "";
  const trim = (Array.isArray(sp.trim) ? sp.trim[0] : sp.trim) || "";
  const modification = (Array.isArray(sp.modification) ? sp.modification[0] : sp.modification) || "";

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

  const bp: string | undefined = fitment?.boltPattern || undefined;
  // centerbore on WheelPros can be finicky; don't hard-filter on it yet.
  const cb: string | undefined = undefined;

  const diaRange: [number | null, number | null] = Array.isArray(fitment?.wheelDiameterRangeIn)
    ? fitment.wheelDiameterRangeIn
    : [null, null];
  const widthRange: [number | null, number | null] = Array.isArray(fitment?.wheelWidthRangeIn)
    ? fitment.wheelWidthRangeIn
    : [null, null];
  const offRange: [number | null, number | null] = Array.isArray(fitment?.offsetRangeMm)
    ? fitment.offsetRangeMm
    : [null, null];

  // WheelPros expects a single diameter/width.
  // Use the max wheel diameter (more common for OEM packages) and omit width/offset initially,
  // then tighten once we confirm the catalog data lines up.
  const diameter = diaRange?.[1] != null ? String(diaRange[1]) : (diaRange?.[0] != null ? String(diaRange[0]) : undefined);
  const width = undefined;
  const minOffset = undefined;
  const maxOffset = undefined;

  // 2) Query WheelPros using fitment-derived filters
  const data = await fetchWheels({
    page: "1",
    pageSize: "24",
    fields: "inventory,price,images",
    priceType: "msrp",
    company: "1500",
    currencyCode: "USD",

    boltPattern: bp,
    centerbore: cb,
    diameter,
    width,
    minOffset,
    maxOffset,
    offsetType: minOffset || maxOffset ? "RANGE" : undefined,
  });

  const maybeData = data as { items?: unknown[]; results?: unknown[] };

  const rawItems: unknown[] =
    // common patterns: { items: [] } or { results: [] }
    (Array.isArray(maybeData?.items) ? maybeData.items : []) ||
    (Array.isArray(maybeData?.results) ? maybeData.results : []);

  const items: Wheel[] = rawItems.map((itUnknown) => {
    const it = itUnknown as WheelProsItem;

    const brandObj = it?.brand && typeof it.brand === "object" ? (it.brand as WheelProsBrand) : null;
    const brand = brandObj?.description ?? brandObj?.parent ?? brandObj?.code ?? (typeof it?.brand === "string" ? it.brand : undefined);
    const finish = it?.properties?.finish;
    const model = it?.properties?.model || it?.title;

    const msrp = it?.prices?.msrp;
    const firstPrice = Array.isArray(msrp) ? msrp[0] : undefined;
    const price = firstPrice?.currencyAmount != null ? Number(firstPrice.currencyAmount) : undefined;

    const img0 = Array.isArray(it?.images) ? it.images[0] : undefined;
    const imageUrl = img0?.imageUrlLarge || img0?.imageUrlMedium || img0?.imageUrlOriginal || undefined;

    return {
      sku: it?.sku,
      brand,
      model,
      finish,
      imageUrl,
      price: typeof price === "number" && Number.isFinite(price) ? price : undefined,
    };
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
            <select className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold">
              <option>Best Match</option>
              <option>Price Low to High</option>
              <option>Price High to Low</option>
              <option>Most Popular</option>
            </select>
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
              <article
                key={w.sku || idx}
                className="rounded-2xl border border-neutral-200 bg-white p-4"
              >
                <div className="text-xs font-semibold text-neutral-600">
                  {typeof w.brand === "string" ? w.brand : w.brand != null ? String(w.brand) : "Wheel"}
                </div>
                <h3 className="mt-0.5 text-sm font-extrabold text-neutral-900">
                  {typeof w.model === "string"
                    ? w.model
                    : w.model != null
                      ? String(w.model)
                      : w.sku || "Wheel"}
                </h3>
                {w.finish ? (
                  <div className="mt-1 text-xs text-neutral-600">
                    {typeof w.finish === "string" ? w.finish : String(w.finish)}
                  </div>
                ) : null}

                <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
                  {w.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={w.imageUrl}
                      alt={w.model || w.sku || "Wheel"}
                      className="h-40 w-full object-contain bg-white"
                      loading="lazy"
                    />
                  ) : (
                    <div className="p-3 text-xs text-neutral-700">No image</div>
                  )}
                </div>

                <div className="mt-4">
                  <div className="text-2xl font-extrabold text-neutral-900">
                    {typeof w.price === "number" ? `$${w.price.toFixed(2)}` : "Call for price"}
                  </div>
                  <div className="text-xs text-neutral-600">each</div>
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
                    <a
                      href={BRAND.links.sms}
                      className="font-extrabold text-neutral-900 hover:underline"
                    >
                      Text
                    </a>
                    <a
                      href={BRAND.links.whatsapp}
                      className="font-extrabold text-neutral-900 hover:underline"
                    >
                      WhatsApp
                    </a>
                  </div>
                </div>
              </article>
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
