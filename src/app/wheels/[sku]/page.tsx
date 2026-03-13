import Link from "next/link";
import { WheelVariantSelector, type WheelVariant } from "@/components/WheelVariantSelector";

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
    boltPatternMetric?: string;
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
  // Best-effort: WheelPros search supports sku as a filter in our wrapper.
  const res = await fetch(
    `${getBaseUrl()}/api/wheelpros/wheels/search?fields=inventory,price,images,properties&priceType=msrp&currencyCode=USD&page=1&pageSize=1&sku=${encodeURIComponent(sku)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return { error: await res.text() };
  return res.json();
}

function extractModelToken(title: string) {
  // Titles often look like:
  // "BR ALISO 18X9 6X5.5 G-BRONZE 12MM"
  // But some titles begin with size: "18X8 P33 5X120.7 ..."
  // We only want a model token when it's clearly a name (letters), otherwise return "".
  const parts = String(title || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return "";

  const rest = parts.slice(1);
  const sizeIdx = rest.findIndex((p) => /^\d+(\.\d+)?X\d+(\.\d+)?$/i.test(p));
  const modelParts = sizeIdx >= 0 ? rest.slice(0, sizeIdx) : rest.slice(0, 2);
  const token = modelParts.join(" ").trim();

  // If the token doesn't contain any letters, it's not a model name.
  if (!/[A-Z]/i.test(token)) return "";
  return token;
}

function parseVariant(it: WheelProsItem): WheelVariant | null {
  const sku = it?.sku ? String(it.sku) : "";
  if (!sku) return null;

  const p = it?.properties || {};
  const title = String(it?.title || "");

  // Fallback parsing from title when WheelPros leaves properties blank.
  const sizeMatch = title.toUpperCase().match(/\b(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)\b/);
  const diameterFromTitle = sizeMatch ? sizeMatch[1] : undefined;
  const widthFromTitle = sizeMatch ? sizeMatch[2] : undefined;

  const boltMatch = title.toUpperCase().match(/\b(\d{4,5}|\d)X(\d+(?:\.\d+)?)\b/);
  const boltFromTitle = boltMatch ? `${boltMatch[1]}X${boltMatch[2]}` : undefined;

  const offsetMatch = title.toUpperCase().match(/\b(-?\d+(?:\.\d+)?)\s*MM\b/);
  const offsetFromTitle = offsetMatch ? offsetMatch[1] : undefined;

  const diameter = p?.diameter != null ? String(p.diameter) : diameterFromTitle;
  const width = p?.width != null ? String(p.width) : widthFromTitle;
  const offset = p?.offset != null ? String(p.offset) : offsetFromTitle;
  const finish = p?.finish != null ? String(p.finish) : undefined;
  const boltPattern =
    p?.boltPatternMetric != null
      ? String(p.boltPatternMetric)
      : (p?.boltPattern != null ? String(p.boltPattern) : boltFromTitle);

  return { sku, diameter, width, boltPattern, offset, finish };
}

async function fetchVariants({
  brandCode,
  modelToken,
}: {
  brandCode?: string;
  modelToken?: string;
}) {
  // Only attempt variant grouping when we have a clear model token.
  if (!brandCode || !modelToken || modelToken.length < 2) return [] as WheelVariant[];

  const res = await fetch(
    `${getBaseUrl()}/api/wheelpros/wheels/search?fields=inventory,price,images,properties&page=1&pageSize=200&brand_cd=${encodeURIComponent(brandCode)}&q=${encodeURIComponent(modelToken)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return [] as WheelVariant[];

  const data = (await res.json()) as { items?: unknown[]; results?: unknown[] };
  const raw: unknown[] = Array.isArray(data?.items) ? data.items : Array.isArray(data?.results) ? data.results : [];

  const parsed = raw
    .map((u) => ({ it: u as WheelProsItem, v: parseVariant(u as WheelProsItem) }))
    .filter((x): x is { it: WheelProsItem; v: WheelVariant } => !!x.v);

  const prefix = `${String(brandCode).toUpperCase()} ${String(modelToken).toUpperCase()}`.trim();
  const narrowed = parsed
    .filter(({ it }) => {
      const t = String(it?.title || "").toUpperCase();
      return t.startsWith(prefix);
    })
    .map(({ v }) => v);

  return narrowed.length ? narrowed : parsed.map(({ v }) => v);
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

  const diameter = it?.properties?.diameter != null ? String(it.properties.diameter) : "";
  const width = it?.properties?.width != null ? String(it.properties.width) : "";
  const boltPattern = it?.properties?.boltPatternMetric != null
    ? String(it.properties.boltPatternMetric)
    : (it?.properties?.boltPattern != null ? String(it.properties.boltPattern) : "");
  const offset = it?.properties?.offset != null ? String(it.properties.offset) : "";
  const finish = it?.properties?.finish != null ? String(it.properties.finish) : "";

  const brandCode = brandObj?.code || (typeof it?.brand === "object" ? (it.brand as WheelProsBrand | undefined)?.code : undefined);
  const modelToken = extractModelToken(String(it?.title || ""));
  const variants = await fetchVariants({ brandCode, modelToken });
  const variantsForSelector = variants.length
    ? variants
    : ([{ sku, diameter, width, boltPattern, offset, finish }].filter((v) => v.sku) as WheelVariant[]);

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
                <div className="text-xs font-extrabold text-neutral-900">Options</div>
                <div className="mt-3">
                  <WheelVariantSelector
                    variants={variantsForSelector}
                    currentSku={sku}
                    selected={{
                      diameter: diameter || undefined,
                      width: width || undefined,
                      boltPattern: boltPattern || undefined,
                      offset: offset || undefined,
                      finish: finish || undefined,
                    }}
                  />
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

            <div className="mt-4 text-xs text-neutral-600">Part / SKU: {sku}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
