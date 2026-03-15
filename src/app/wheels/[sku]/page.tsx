import Link from "next/link";
import { WheelVariantSelector, type WheelVariant } from "@/components/WheelVariantSelector";
import { FinishThumbnailStrip } from "@/components/FinishThumbnailStrip";
import { getTechfeedWheelBySku, getTechfeedWheelsByStyle } from "@/lib/techfeed/wheels";
import { QuoteRequest } from "@/components/QuoteRequest";
import { ImageGallery } from "@/components/ImageGallery";
import { BRAND } from "@/lib/brand";
import { vehicleSlug } from "@/lib/vehicleSlug";

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

async function fetchFitment(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const res = await fetch(`${getBaseUrl()}/api/vehicles/search?${sp.toString()}`, { cache: "no-store" });
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
  searchParams,
}: {
  params: Promise<{ sku: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sku } = await params;
  const sp = (await searchParams) || {};
  const year = String((sp as any).year || "");
  const make = String((sp as any).make || "");
  const model = String((sp as any).model || "");
  const trim = String((sp as any).trim || "");
  const modification = String((sp as any).modification || "");
  const vehicleLabel = [year, make, model, trim].filter(Boolean).join(" ");

  const vehicleSlugStr = year && make && model ? vehicleSlug(year, make, model) : "";

  const fitmentStrict = year && make && model
    ? await fetchFitment({ year, make, model, modification: modification || undefined })
    : null;

  const oemTireSizesAll: string[] = Array.isArray((fitmentStrict as any)?.tireSizes)
    ? (fitmentStrict as any).tireSizes.map(String)
    : [];

  // We'll filter OEM tire sizes to match the wheel diameter after we parse the wheel's size.
  let wheelDiaN: number | null = null;
  let oemTireSizes = oemTireSizesAll;

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

  function fmt(v: string) {
    const s = String(v || "").trim();
    if (!s) return "";
    const n = Number(s);
    return Number.isFinite(n) ? n.toString() : s;
  }

  function buildWheelDescription() {
    const tfBrand = tfSelf?.brand_desc ? String(tfSelf.brand_desc).trim() : "";
    const b = String(brand || tfBrand || "Wheel").trim();

    const title = String(it?.title || "").trim();
    const modelTok = extractModelToken(title);
    const modelName = String(tfSelf?.product_desc || modelTok || title || sku).trim();

    const dia = fmt(tfSelf?.diameter || diameter);
    const wid = fmt(tfSelf?.width || width);
    const bp2 = String(tfSelf?.bolt_pattern_metric || boltPattern || "").trim();
    const off = fmt(tfSelf?.offset || offset);
    const cb2 = fmt(tfSelf?.centerbore || (it?.properties?.centerbore ? String(it.properties.centerbore) : ""));

    const finishName = String(tfSelf?.abbreviated_finish_desc || finish || "").trim();

    const parts: string[] = [];
    const size = dia && wid ? `${dia}x${wid}` : dia ? `${dia}"` : "";

    parts.push(`${b} ${modelName}${size ? ` in ${size}` : ""}.`);

    const bullets: string[] = [];
    if (finishName) bullets.push(`Finish: ${finishName}`);
    if (bp2) bullets.push(`Bolt pattern: ${bp2}`);
    if (off) bullets.push(`Offset: ${off} mm`);
    if (cb2) bullets.push(`Center bore: ${cb2} mm`);

    const desc = String(tfSelf?.product_desc || "").trim();
    const paragraph = desc && desc !== modelName ? desc : parts.join(" ");

    return { paragraph, bullets };
  }

  const msrp = it?.prices?.msrp;
  const firstPrice = Array.isArray(msrp) ? msrp[0] : undefined;
  const price = firstPrice?.currencyAmount != null ? Number(firstPrice.currencyAmount) : undefined;

  // Prefer TechFeed for variant grouping (stable style id + complete data).
  const tfSelf = await getTechfeedWheelBySku(sku);

  const wpImgs = Array.isArray(it?.images)
    ? it.images
        .map((im) => im?.imageUrlLarge || im?.imageUrlMedium || im?.imageUrlOriginal || im?.imageUrlSmall)
        .filter(Boolean)
        .map(String)
    : [];

  const tfImgs = Array.isArray(tfSelf?.images) ? tfSelf.images.map(String) : [];

  const galleryImages = Array.from(new Set([...wpImgs, ...tfImgs]));
  const imageUrl = galleryImages[0] || undefined;

  const diameter = it?.properties?.diameter != null ? String(it.properties.diameter) : "";
  const width = it?.properties?.width != null ? String(it.properties.width) : "";

  wheelDiaN = (() => {
    const n = Number(String(diameter || "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  })();

  oemTireSizes = wheelDiaN
    ? oemTireSizesAll.filter((s) => {
        const m = String(s).toUpperCase().match(/R(\d{2})\b/);
        const rim = m ? Number(m[1]) : NaN;
        return Number.isFinite(rim) && rim === wheelDiaN;
      })
    : oemTireSizesAll;
  const boltPattern = it?.properties?.boltPatternMetric != null
    ? String(it.properties.boltPatternMetric)
    : (it?.properties?.boltPattern != null ? String(it.properties.boltPattern) : "");
  const offset = it?.properties?.offset != null ? String(it.properties.offset) : "";
  const finish = it?.properties?.finish != null ? String(it.properties.finish) : "";

  const generated = buildWheelDescription();
  const styleKey = tfSelf?.style || tfSelf?.display_style_no || "";
  const tfStyleRows = styleKey ? await getTechfeedWheelsByStyle(styleKey) : null;

  const finishThumbs = Array.isArray(tfStyleRows)
    ? (() => {
        const seen = new Set<string>();
        const thumbs: { finish: string; sku: string; imageUrl?: string }[] = [];
        for (const r of tfStyleRows) {
          const fin = String(r.abbreviated_finish_desc || r.fancy_finish_desc || r.box_label_desc || "").trim();
          if (!fin || seen.has(fin)) continue;
          seen.add(fin);
          const img = Array.isArray(r.images) && r.images.length ? r.images[0] : undefined;
          thumbs.push({ finish: fin, sku: r.sku, imageUrl: img });
        }
        return thumbs;
      })()
    : [];
  const tfVariants: WheelVariant[] = Array.isArray(tfStyleRows)
    ? tfStyleRows
        .map((r) => ({
          sku: r.sku,
          diameter: r.diameter || undefined,
          width: r.width || undefined,
          boltPattern: r.bolt_pattern_metric || r.bolt_pattern_standard || undefined,
          offset: r.offset || undefined,
          finish: r.abbreviated_finish_desc || r.fancy_finish_desc || r.box_label_desc || undefined,
        }))
        .filter((v) => v.sku)
    : [];

  const brandCode =
    brandObj?.code || (typeof it?.brand === "object" ? (it.brand as WheelProsBrand | undefined)?.code : undefined);
  const modelToken = extractModelToken(String(it?.title || ""));
  const wpVariants = tfVariants.length ? [] : await fetchVariants({ brandCode, modelToken });

  const variantsForSelector = tfVariants.length
    ? tfVariants
    : (wpVariants.length
        ? wpVariants
        : ([{ sku, diameter, width, boltPattern, offset, finish }].filter((v) => v.sku) as WheelVariant[]));

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <Link href="/wheels" className="text-sm font-extrabold text-neutral-900 hover:underline">
            ← Back to wheels
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="grid gap-4">
            <div className="rounded-3xl border border-neutral-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-neutral-600">Product photo</div>
                <div className="text-[11px] text-neutral-500">Finish may vary by lighting</div>
              </div>
              <ImageGallery images={galleryImages} alt={String(it?.title || sku)} note="Finish may vary by lighting" />

              <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="text-xs font-extrabold text-neutral-900">Add tires</div>
                <div className="mt-1 text-xs text-neutral-600">
                  {vehicleLabel
                    ? (wheelDiaN
                        ? `Choose an OEM tire size that fits ${wheelDiaN}" wheels.`
                        : "Choose an OEM tire size for your vehicle.")
                    : "Select a vehicle to see OEM tire sizes."}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {vehicleLabel && (oemTireSizes.length || oemTireSizesAll.length) ? (
                    (oemTireSizes.length ? oemTireSizes : oemTireSizesAll).slice(0, 4).map((s) => (
                      <Link
                        key={s}
                        href={
                          vehicleSlugStr
                            ? `/tires/v/${vehicleSlugStr}?${new URLSearchParams({ year, make, model, trim, modification, size: s }).toString()}`
                            : `/tires?${new URLSearchParams({ year, make, model, trim, modification, size: s }).toString()}`
                        }
                        className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-extrabold text-neutral-900 hover:border-neutral-300"
                      >
                        {s}
                      </Link>
                    ))
                  ) : (
                    <Link
                      href={`/tires?${new URLSearchParams({ year, make, model, trim, modification }).toString()}`}
                      className="rounded-xl bg-neutral-900 px-3 py-2 text-xs font-extrabold text-white"
                    >
                      Select vehicle
                    </Link>
                  )}
                </div>

                <div className="mt-2 text-[11px] text-neutral-600">Well verify fitment before install.</div>
              </div>
            </div>

            {/* Space reserved for future modules under the photo (tire matching, accessories, etc.) */}
          </div>

          <div className="lg:sticky lg:top-6 rounded-3xl border border-neutral-200 bg-white p-6">
            <div className="rounded-2xl border border-neutral-200 bg-white p-3">
              <div className="text-[11px] font-semibold text-neutral-600">Vehicle</div>
              <div className="mt-0.5 text-sm font-extrabold text-neutral-900">
                {vehicleLabel || "Select vehicle to verify fitment"}
              </div>
              <div className="mt-2">
                <Link
                  href={`/wheels?${new URLSearchParams({ year, make, model, trim, modification }).toString()}`}
                  className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-xs font-extrabold text-neutral-900 hover:border-neutral-300"
                >
                  {vehicleLabel ? "Change vehicle" : "Select vehicle"}
                </Link>
              </div>
            </div>

            <div className="mt-4 text-xs font-semibold text-neutral-600">{brand || "Wheel"}</div>
            <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">{it?.title || sku}</h1>

            <div className="mt-3 flex flex-wrap gap-2">
              {diameter ? <Badge>{diameter}"</Badge> : null}
              {width ? <Badge>{width} wide</Badge> : null}
              {boltPattern ? <Badge>{boltPattern}</Badge> : null}
              {offset ? <Badge>Offset {offset}mm</Badge> : null}
              {finish ? <Badge>{finish}</Badge> : null}
            </div>

            <div className="mt-4">
              <div className="text-3xl font-extrabold text-neutral-900">
                {typeof price === "number" && Number.isFinite(price) ? `$${price.toFixed(2)}` : "Call for price"}
              </div>
              <div className="text-xs text-neutral-600">each</div>
            </div>

            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-xs font-extrabold text-neutral-900">Why you’ll like it</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                {(generated.bullets.length ? generated.bullets : [generated.paragraph]).slice(0, 5).map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs font-extrabold text-neutral-900">Pick your setup</div>
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

                  {finishThumbs.length > 1 ? (
                    <FinishThumbnailStrip items={finishThumbs} selectedFinish={finish || undefined} />
                  ) : null}
                </div>
              </div>

              {/* Fitment moved under photo */}

              <div id="quote" className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs font-extrabold text-neutral-900">Get your quote</div>
                <div className="mt-1 text-xs text-neutral-600">
                  We’ll confirm pricing, availability, and the right fit before you commit.
                </div>
                <div className="mt-3 grid gap-2">
                  <div className="flex flex-wrap gap-2">
                    <QuoteRequest productType="wheel" sku={sku} productName={it?.title || sku} />
                    <Link
                      href={
                        `/quote/new?${new URLSearchParams({
                          year,
                          make,
                          model,
                          trim,
                          modification,
                          wheelSku: sku,
                          wheelName: String(it?.title || sku),
                          wheelUnit: typeof price === "number" && Number.isFinite(price) ? String(price) : "",
                          wheelQty: "4",
                        }).toString()}`
                      }
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-extrabold text-neutral-900 hover:border-neutral-300"
                    >
                      Build quote
                    </Link>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-600">
                    <span>Fitment verified before install</span>
                    <span className="text-neutral-300">•</span>
                    <span>Local install scheduling</span>
                    <span className="text-neutral-300">•</span>
                    <a href={BRAND.links.tel} className="font-extrabold text-neutral-900 hover:underline">
                      Prefer to talk? Call us
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-xs font-extrabold text-neutral-900">About this wheel</div>
              <p className="mt-2 text-sm text-neutral-700">{generated.paragraph}</p>
            </div>

            <div className="mt-4 text-xs text-neutral-600">Part / SKU: {sku}</div>
          </div>
        </div>

        {/* Mobile sticky CTA */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-1">
            <div>
              <div className="text-sm font-extrabold text-neutral-900">
                {typeof price === "number" && Number.isFinite(price) ? `$${price.toFixed(2)}` : "Call for price"}
              </div>
              <div className="text-[11px] text-neutral-600">Per wheel • Quote in minutes</div>
            </div>
            <a
              href="#quote"
              className="h-10 rounded-xl bg-[var(--brand-red)] px-4 py-2 text-center text-sm font-extrabold text-white"
            >
              Request quote
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-extrabold text-neutral-900">
      {children}
    </span>
  );
}
