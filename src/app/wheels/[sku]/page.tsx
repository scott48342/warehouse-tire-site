import Link from "next/link";

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
    width?: string;
    diameter?: string;
    offset?: string;
    boltPattern?: string;
    centerbore?: string;
  };
  prices?: {
    msrp?: WheelProsPrice[];
  };
  images?: WheelProsImage[];
};

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function fetchWheelBySku(sku: string) {
  // Best-effort: WheelPros search may support sku as a filter.
  const res = await fetch(
    `${getBaseUrl()}/api/wheelpros/wheels/search?fields=inventory,price,images&priceType=msrp&currencyCode=USD&page=1&pageSize=1&sku=${encodeURIComponent(sku)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return { error: await res.text() };
  return res.json();
}

export default async function WheelDetailPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  const data = await fetchWheelBySku(sku);

  const maybeData = data as { items?: unknown[]; results?: unknown[]; error?: unknown };
  const rawItems: unknown[] = Array.isArray(maybeData?.items)
    ? maybeData.items
    : (Array.isArray(maybeData?.results) ? maybeData.results : []);

  const it = (rawItems[0] as WheelProsItem | undefined) || undefined;

  if (maybeData?.error || !it) {
    return (
      <main className="bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Wheel not found (SKU: {sku}).
            <div className="mt-2 text-xs text-red-800">
              {maybeData?.error ? String(maybeData.error).slice(0, 500) : ""}
            </div>
          </div>
          <div className="mt-4">
            <Link href="/wheels" className="text-sm font-extrabold text-neutral-900 hover:underline">
              ← Back to wheels
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const brandObj = it?.brand && typeof it.brand === "object" ? (it.brand as WheelProsBrand) : null;
  const brand = brandObj?.description ?? brandObj?.parent ?? brandObj?.code ?? (typeof it?.brand === "string" ? it.brand : undefined);

  const msrp = it?.prices?.msrp;
  const firstPrice = Array.isArray(msrp) ? msrp[0] : undefined;
  const price = firstPrice?.currencyAmount != null ? Number(firstPrice.currencyAmount) : undefined;

  const img0 = Array.isArray(it?.images) ? it.images[0] : undefined;
  const imageUrl = img0?.imageUrlLarge || img0?.imageUrlMedium || img0?.imageUrlOriginal || undefined;

  const diameter = it?.properties?.diameter;
  const width = it?.properties?.width;
  const offset = it?.properties?.offset;
  const finish = it?.properties?.finish;

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <Link href="/wheels" className="text-sm font-extrabold text-neutral-900 hover:underline">
            ← Back to wheels
          </Link>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-neutral-200 bg-white p-4">
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={it?.title || sku}
                  className="h-[360px] w-full object-contain"
                  loading="lazy"
                />
              ) : (
                <div className="p-6 text-sm text-neutral-700">No image</div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-6">
            <div className="text-xs font-semibold text-neutral-600">{brand || "Wheel"}</div>
            <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">{it?.title || sku}</h1>

            <div className="mt-4">
              <div className="text-3xl font-extrabold text-neutral-900">
                {typeof price === "number" && Number.isFinite(price) ? `$${price.toFixed(2)}` : "Call for price"}
              </div>
              <div className="text-xs text-neutral-600">each</div>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs font-extrabold text-neutral-900">Options (coming next)</div>
                <div className="mt-2 grid gap-2 text-sm text-neutral-800">
                  <div>
                    <span className="font-semibold text-neutral-600">Diameter:</span> {diameter || "—"}
                  </div>
                  <div>
                    <span className="font-semibold text-neutral-600">Width:</span> {width || "—"}
                  </div>
                  <div>
                    <span className="font-semibold text-neutral-600">Offset:</span> {offset || "—"}
                  </div>
                  <div>
                    <span className="font-semibold text-neutral-600">Finish:</span> {finish || "—"}
                  </div>
                </div>
                <div className="mt-2 text-xs text-neutral-600">
                  Next step: populate dropdowns for size/offset/finish by querying WheelPros for all variants of this model.
                </div>
              </div>

              <div className="grid gap-2">
                <Link
                  href="/schedule"
                  className="h-11 rounded-xl bg-[var(--brand-red)] px-4 py-3 text-center text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)]"
                >
                  Schedule Install
                </Link>
              </div>
            </div>

            <div className="mt-4 text-xs text-neutral-600">SKU: {sku}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
