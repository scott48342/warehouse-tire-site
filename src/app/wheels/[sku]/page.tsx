import Link from "next/link";
import type { Metadata } from "next";
import { WheelVariantSelector, type WheelVariant } from "@/components/WheelVariantSelector";
import { FinishThumbnailStrip } from "@/components/FinishThumbnailStrip";
import { getTechfeedWheelBySku, getTechfeedWheelsByStyle } from "@/lib/techfeed/wheels";
import { ImageGallery } from "@/components/ImageGallery";
import { RecommendedFitmentCard } from "@/components/RecommendedFitmentCard";
import { AddToCartButton } from "@/components/AddToCartButton";
import { WheelBuyBox } from "@/components/WheelBuyBox";
import { BRAND } from "@/lib/brand";
import { PDPTrustBlock } from "@/components/StoreReviews";
import { vehicleSlug } from "@/lib/vehicleSlug";
import { extractDisplayTrim } from "@/lib/vehicleDisplay";
// Wheel PDP Enhancements - Matching Tire PDP Quality (2026-04-06)
import {
  BestForWheel,
  WhyChooseThisWheel,
  WheelComparisonContext,
  WheelWhatHappensNext,
  WheelTrustStrip,
  WheelWarrantySupport,
  WheelSpecsCard,
} from "@/components/WheelPDPEnhancements";
// Real behavior-driven popularity signals (2026-04-06)
import { PopularityBadge, type PopularitySignalData } from "@/components/PopularityBadge";
import { getPopularitySignal } from "@/lib/analytics/productPopularity";
// TPMS contextual upsell (2026-04-06)
import { TPMSSuggestion } from "@/components/TPMSSuggestion";
// Customers also added (2026-04-06)
import { CustomersAlsoAdded } from "@/components/CustomersAlsoAdded";
import { getCoAddedProductsForPDP } from "@/lib/analytics/coPurchaseServer";
// Financing badges (2026-04-11)
import { FinancingBadge } from "@/components/FinancingBadge";
// Real vehicle gallery from WheelPros Canto (2026-04-20)
import { WheelGalleryBlock } from "@/components/WheelGalleryBlock";

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

async function fetchDbProfile(params: {
  year: string;
  make: string;
  model: string;
  modification?: string;
}): Promise<{ dbProfile: import("@/hooks/useAccessoryFitment").DBProfileForAccessories | null }> {
  const { year, make, model, modification } = params;
  if (!year || !make || !model) return { dbProfile: null };

  try {
    const sp = new URLSearchParams({ year, make, model, pageSize: "1", debug: "1" });
    if (modification) sp.set("modification", modification);

    const res = await fetch(`${getBaseUrl()}/api/wheels/fitment-search?${sp.toString()}`, { cache: "no-store" });
    if (!res.ok) return { dbProfile: null };

    const data = await res.json();
    const fitment = data?.fitment;
    
    if (fitment?.dbProfile) return { dbProfile: fitment.dbProfile };
    if (fitment?.envelope) {
      return {
        dbProfile: {
          threadSize: null,
          seatType: null,
          centerBoreMm: fitment.envelope.centerBore || null,
          boltPattern: fitment.envelope.boltPattern || null,
        },
      };
    }
    return { dbProfile: null };
  } catch {
    return { dbProfile: null };
  }
}

function extractModelToken(title: string) {
  const parts = String(title || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return "";
  const rest = parts.slice(1);
  const sizeIdx = rest.findIndex((p) => /^\d+(\.\d+)?X\d+(\.\d+)?$/i.test(p));
  const modelParts = sizeIdx >= 0 ? rest.slice(0, sizeIdx) : rest.slice(0, 2);
  const token = modelParts.join(" ").trim();
  if (!/[A-Z]/i.test(token)) return "";
  return token;
}

function parseVariant(it: WheelProsItem): WheelVariant | null {
  const sku = it?.sku ? String(it.sku) : "";
  if (!sku) return null;

  const p = it?.properties || {};
  const title = String(it?.title || "");

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
  const boltPattern = p?.boltPatternMetric != null ? String(p.boltPatternMetric) : (p?.boltPattern != null ? String(p.boltPattern) : boltFromTitle);

  return { sku, diameter, width, boltPattern, offset, finish };
}

async function fetchVariants({ brandCode, modelToken }: { brandCode?: string; modelToken?: string }) {
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
  const narrowed = parsed.filter(({ it }) => String(it?.title || "").toUpperCase().startsWith(prefix)).map(({ v }) => v);

  return narrowed.length ? narrowed : parsed.map(({ v }) => v);
}

function safeString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (typeof obj.name === "string") return obj.name.trim();
    if (typeof obj.value === "string") return obj.value.trim();
  }
  return "";
}

// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL URL - Always points to national site for SEO safety
// Local mode pages get noindex header + canonical to prevent duplicate content
// ═══════════════════════════════════════════════════════════════════════════
export async function generateMetadata({
  params,
}: {
  params: Promise<{ sku: string }>;
}): Promise<Metadata> {
  const { sku } = await params;
  const decodedSku = decodeURIComponent(sku);
  
  return {
    alternates: {
      canonical: `https://shop.warehousetiredirect.com/wheels/${decodedSku}`,
    },
  };
}

export default async function WheelDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ sku: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sku: rawSku } = await params;
  const sku = decodeURIComponent(rawSku);
  const sp = (await searchParams) || {};
  
  const year = safeString(Array.isArray(sp.year) ? sp.year[0] : sp.year);
  const make = safeString(Array.isArray(sp.make) ? sp.make[0] : sp.make);
  const model = safeString(Array.isArray(sp.model) ? sp.model[0] : sp.model);
  const trim = safeString(Array.isArray(sp.trim) ? sp.trim[0] : sp.trim);
  const modification = safeString(Array.isArray(sp.modification) ? sp.modification[0] : sp.modification);
  
  const wheelDiaParam = safeString(Array.isArray((sp as any).wheelDia) ? (sp as any).wheelDia[0] : (sp as any).wheelDia);
  const wheelWidthParam = safeString(Array.isArray((sp as any).wheelWidth) ? (sp as any).wheelWidth[0] : (sp as any).wheelWidth);
  
  // Lifted build context
  const liftedSource = safeString(Array.isArray(sp.liftedSource) ? sp.liftedSource[0] : sp.liftedSource);
  const liftedPreset = safeString(Array.isArray(sp.liftedPreset) ? sp.liftedPreset[0] : sp.liftedPreset);
  const liftedInchesRaw = safeString(Array.isArray(sp.liftedInches) ? sp.liftedInches[0] : sp.liftedInches);
  const liftedInches = liftedInchesRaw ? parseInt(liftedInchesRaw, 10) : 0;
  const liftedTireSizesRaw = safeString(Array.isArray(sp.liftedTireSizes) ? sp.liftedTireSizes[0] : sp.liftedTireSizes);
  const liftedTireSizes = liftedTireSizesRaw ? liftedTireSizesRaw.split(",").filter(Boolean) : [];
  const liftedTireDiaMin = safeString(Array.isArray(sp.liftedTireDiaMin) ? sp.liftedTireDiaMin[0] : sp.liftedTireDiaMin);
  const liftedTireDiaMax = safeString(Array.isArray(sp.liftedTireDiaMax) ? sp.liftedTireDiaMax[0] : sp.liftedTireDiaMax);
  
  const isLiftedBuild = liftedSource === "lifted" && liftedPreset && liftedInches > 0;
  
  const displayTrim = extractDisplayTrim(trim);
  const vehicleLabel = [year, make, model, displayTrim].filter(Boolean).join(" ");
  const vehicleSlugStr = year && make && model ? vehicleSlug(year, make, model) : "";
  const hasVehicle = Boolean(year && make && model);

  const fitmentStrict = hasVehicle ? await fetchFitment({ year, make, model, modification: modification || undefined }) : null;
  const { dbProfile } = hasVehicle ? await fetchDbProfile({ year, make, model, modification: modification || undefined }) : { dbProfile: null };

  const oemTireSizesAll: string[] = Array.isArray((fitmentStrict as any)?.tireSizes) ? (fitmentStrict as any).tireSizes.map(String) : [];
  let wheelDiaN: number | null = null;
  let oemTireSizes = oemTireSizesAll;

  // Fetch wheel data
  const data = await fetchWheelBySku(sku);
  const maybeData = data as { items?: unknown[]; results?: unknown[]; error?: unknown };
  const rawItems: unknown[] = Array.isArray(maybeData?.items) ? maybeData.items : (Array.isArray(maybeData?.results) ? maybeData.results : []);
  let it = (rawItems[0] as WheelProsItem | undefined) || undefined;

  // Fallback to TechFeed
  if (!it) {
    const tf = await getTechfeedWheelBySku(sku);
    if (tf) {
      it = {
        sku: tf.sku,
        title: tf.product_desc || tf.sku,
        brand: tf.brand_desc || tf.brand_cd || "",
        properties: {
          model: tf.product_desc,
          finish: tf.abbreviated_finish_desc || tf.fancy_finish_desc || "",
          width: tf.width,
          diameter: tf.diameter,
          offset: tf.offset,
          boltPattern: tf.bolt_pattern_standard,
          boltPatternMetric: tf.bolt_pattern_metric,
          centerbore: tf.centerbore,
        },
        prices: tf.msrp ? { msrp: [{ currencyAmount: tf.msrp, currencyCode: "USD" }] } : undefined,
        images: tf.images?.map((url) => ({ imageUrlLarge: url, imageUrlMedium: url, imageUrlSmall: url, imageUrlOriginal: url })),
      } as WheelProsItem;
    }
  }

  if (maybeData?.error || !it) {
    return (
      <main className="bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">Wheel not found (SKU: {sku}).</div>
          <div className="mt-4">
            <Link href="/wheels" className="text-sm font-extrabold text-neutral-900 hover:underline">← Back to wheels</Link>
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

  const tfSelf = await getTechfeedWheelBySku(sku);

  const wpImgs = Array.isArray(it?.images) ? it.images.map((im) => im?.imageUrlLarge || im?.imageUrlMedium || im?.imageUrlOriginal || im?.imageUrlSmall).filter(Boolean).map(String) : [];
  const tfImgs = Array.isArray(tfSelf?.images) ? tfSelf.images.map(String) : [];
  const galleryImages = Array.from(new Set([...wpImgs, ...tfImgs]));
  const imageUrl = galleryImages[0] || undefined;

  const diameter = it?.properties?.diameter != null ? String(it.properties.diameter) : "";
  const width = it?.properties?.width != null ? String(it.properties.width) : "";
  wheelDiaN = (() => { const n = Number(String(diameter || "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? n : null; })();
  oemTireSizes = wheelDiaN ? oemTireSizesAll.filter((s) => { const m = String(s).toUpperCase().match(/R(\d{2})\b/); const rim = m ? Number(m[1]) : NaN; return Number.isFinite(rim) && rim === wheelDiaN; }) : oemTireSizesAll;

  const boltPattern = it?.properties?.boltPatternMetric != null ? String(it.properties.boltPatternMetric) : (it?.properties?.boltPattern != null ? String(it.properties.boltPattern) : "");
  const offset = it?.properties?.offset != null ? String(it.properties.offset) : "";
  const finish = it?.properties?.finish != null ? String(it.properties.finish) : "";
  const centerBore = tfSelf?.centerbore || (it?.properties?.centerbore ? String(it.properties.centerbore) : "");

  // Variants
  const styleKey = tfSelf?.style || tfSelf?.display_style_no || "";
  const tfStyleRows = styleKey ? await getTechfeedWheelsByStyle(styleKey) : null;

  const finishThumbs = Array.isArray(tfStyleRows) ? (() => {
    const seen = new Set<string>();
    const thumbs: { finish: string; sku: string; imageUrl?: string }[] = [];
    for (const r of tfStyleRows) {
      const fin = String(r.abbreviated_finish_desc || r.fancy_finish_desc || r.box_label_desc || "").trim();
      if (!fin || seen.has(fin)) continue;
      seen.add(fin);
      thumbs.push({ finish: fin, sku: r.sku, imageUrl: Array.isArray(r.images) && r.images.length ? r.images[0] : undefined });
    }
    return thumbs;
  })() : [];

  const tfVariants: WheelVariant[] = Array.isArray(tfStyleRows) ? tfStyleRows.map((r) => ({
    sku: r.sku,
    diameter: r.diameter || undefined,
    width: r.width || undefined,
    boltPattern: r.bolt_pattern_metric || r.bolt_pattern_standard || undefined,
    offset: r.offset || undefined,
    finish: r.abbreviated_finish_desc || r.fancy_finish_desc || r.box_label_desc || undefined,
  })).filter((v) => v.sku) : [];

  const brandCode = brandObj?.code || (typeof it?.brand === "object" ? (it.brand as WheelProsBrand | undefined)?.code : undefined);
  const modelToken = extractModelToken(String(it?.title || ""));
  const wpVariants = tfVariants.length ? [] : await fetchVariants({ brandCode, modelToken });

  const variantsForSelector = tfVariants.length ? tfVariants : (wpVariants.length ? wpVariants : ([{ sku, diameter, width, boltPattern, offset, finish }].filter((v) => v.sku) as WheelVariant[]));

  // Build back link with params
  const buildBackLink = () => {
    if (!hasVehicle) return "/wheels";
    const params: Record<string, string> = { year, make, model };
    if (trim) params.trim = trim;
    if (modification) params.modification = modification;
    if (liftedSource) params.liftedSource = liftedSource;
    if (liftedPreset) params.liftedPreset = liftedPreset;
    if (liftedInches) params.liftedInches = String(liftedInches);
    if (liftedTireSizesRaw) params.liftedTireSizes = liftedTireSizesRaw;
    return `/wheels?${new URLSearchParams(params).toString()}`;
  };

  // Quick benefits for above-the-fold
  const quickBenefits = [
    hasVehicle ? "Verified fitment guaranteed" : null,
    "Premium quality construction",
  ].filter(Boolean).slice(0, 2);

  // Fetch real popularity signal (non-blocking, cached)
  let popularitySignal: PopularitySignalData | null = null;
  try {
    popularitySignal = await getPopularitySignal("wheel", sku);
  } catch {
    // Silent fail - no signal is fine
  }

  // Fetch co-add recommendations (non-blocking, cached)
  const coAddedProducts = await getCoAddedProductsForPDP(sku, "wheel");

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Breadcrumb */}
        <Link href={buildBackLink()} className="text-sm font-extrabold text-neutral-900 hover:underline">← Back to wheels</Link>

        {/* ═══════════════════════════════════════════════════════════════════
            ROW 1: Hero - Image + Streamlined Buy Box
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Left: Image */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔍</span>
                <span className="text-xs font-medium text-neutral-500">Click image to zoom</span>
              </div>
              <div className="text-[11px] text-neutral-400 italic">Finish may vary by screen</div>
            </div>
            <ImageGallery images={galleryImages} alt={String(it?.title || sku)} note="Finish may vary by lighting" />
          </div>

          {/* Right: Streamlined Buy Box */}
          <div className="lg:sticky lg:top-6 space-y-3">
            {/* Fitment bar */}
            {hasVehicle ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-green-50 border border-green-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white text-xs">✓</span>
                  <div>
                    <div className="text-sm font-bold text-green-900">Fits {year} {make} {model}</div>
                    <div className="text-[11px] text-green-700">Guaranteed fitment</div>
                  </div>
                </div>
                <Link href={`/wheels?${new URLSearchParams({ year, make, model, trim, modification }).toString()}`} className="text-xs font-semibold text-green-700 hover:underline">
                  Change
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                <span className="text-sm text-amber-800">Select vehicle to confirm fit</span>
                <Link href="/wheels" className="text-xs font-semibold text-amber-700 hover:underline">Select</Link>
              </div>
            )}

            {/* Brand */}
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{brand || "Wheel"}</div>
            
            {/* Title */}
            <h1 className="-mt-1 text-2xl font-extrabold text-neutral-900 leading-tight">{it?.title || sku}</h1>

            {/* Best For / Style guidance */}
            <BestForWheel finish={finish} diameter={diameter} />

            {/* Key spec chips */}
            <div className="flex flex-wrap items-center gap-2">
              {finish && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1 text-xs font-bold text-white">
                  🎨 {finish}
                </span>
              )}
              {diameter && width && (
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                  {diameter}&quot; × {width}&quot;
                </span>
              )}
              {boltPattern && (
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                  {boltPattern}
                </span>
              )}
              {offset && (
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                  {offset}mm offset
                </span>
              )}
            </div>

            {/* Quick benefits */}
            {quickBenefits.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-700">
                {quickBenefits.map((benefit, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    <span className="text-green-600">✓</span>
                    <span>{benefit}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Price + CTA Block */}
            <WheelBuyBox
              sku={sku}
              brand={brand || "Wheel"}
              model={String(it?.title || sku)}
              finish={finish || undefined}
              diameter={diameter || undefined}
              width={width || undefined}
              offset={offset || undefined}
              boltPattern={boltPattern || undefined}
              imageUrl={imageUrl}
              unitPrice={typeof price === "number" && Number.isFinite(price) ? price : 0}
              vehicle={hasVehicle ? { year, make, model, trim: trim || undefined, modification: modification || undefined } : undefined}
              hasVehicle={hasVehicle}
              dbProfile={dbProfile}
              wheelCenterBore={centerBore ? Number(centerBore) : undefined}
            />

            {/* Real behavior-driven popularity signal */}
            <PopularityBadge signal={popularitySignal} />

            {/* TPMS contextual upsell - only for 2007+ vehicles */}
            <TPMSSuggestion
              vehicleYear={hasVehicle ? year : null}
              vehicleMake={hasVehicle ? make : null}
              vehicleModel={hasVehicle ? model : null}
              context="pdp"
            />

            {/* Customers also added - real co-purchase data */}
            {coAddedProducts.length > 0 && (
              <CustomersAlsoAdded
                products={coAddedProducts}
                context="pdp"
                sourceSku={sku}
              />
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            ROW 2: Supporting Cards (3-column)
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <WhyChooseThisWheel finish={finish} hasVerifiedFit={hasVehicle} />
          <WheelComparisonContext finish={finish} diameter={diameter} />
          <WheelWhatHappensNext />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            ROW 3: Specs + Variant Selector + Add Tires
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <WheelSpecsCard
            diameter={diameter}
            width={width}
            boltPattern={boltPattern}
            offset={offset}
            centerBore={centerBore}
            finish={finish}
          />
          
          {/* Variant Selector + Add Tires */}
          <div className="space-y-4">
            {/* Variant Selector */}
            <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-5 shadow-sm">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">Pick your setup</div>
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
              {finishThumbs.length > 1 && (
                <div className="mt-3">
                  <FinishThumbnailStrip items={finishThumbs} selectedFinish={finish || undefined} />
                </div>
              )}
            </div>

            {/* Add Tires Card */}
            <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-5 shadow-sm">
              <div className="text-sm font-extrabold text-neutral-900">Add matching tires</div>
              <div className="mt-1 text-xs text-neutral-600">
                {isLiftedBuild
                  ? `Choose lifted tire sizes for your ${liftedInches}" lift.`
                  : vehicleLabel && wheelDiaN
                    ? `Find tires that fit your ${wheelDiaN}" wheels.`
                    : "Select a vehicle to see tire options."}
              </div>

              {isLiftedBuild && (
                <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1">
                  <div className="flex items-center gap-1.5 text-xs text-amber-800">
                    <span>🚀</span>
                    <span className="font-semibold">Lifted Build</span>
                    <span className="text-amber-600">• {liftedInches}&quot; {liftedPreset}</span>
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {(() => {
                  const liftedUrlParams: Record<string, string> = {};
                  if (isLiftedBuild) {
                    if (liftedSource) liftedUrlParams.liftedSource = liftedSource;
                    if (liftedPreset) liftedUrlParams.liftedPreset = liftedPreset;
                    if (liftedInches) liftedUrlParams.liftedInches = String(liftedInches);
                    if (liftedTireSizesRaw) liftedUrlParams.liftedTireSizes = liftedTireSizesRaw;
                  }
                  
                  const effectiveTireSizes = isLiftedBuild
                    ? liftedTireSizes.filter((s) => { const m = String(s).toUpperCase().match(/R(\d{2})\b/); const rim = m ? Number(m[1]) : NaN; return !wheelDiaN || (Number.isFinite(rim) && rim === wheelDiaN); })
                    : oemTireSizes;
                  
                  const buildParams = (params: Record<string, string | number | null | undefined>) => {
                    const filtered: Record<string, string> = {};
                    for (const [k, v] of Object.entries(params)) if (v != null && v !== "") filtered[k] = String(v);
                    return new URLSearchParams(filtered).toString();
                  };
                  
                  if (vehicleLabel && effectiveTireSizes.length > 0) {
                    return effectiveTireSizes.slice(0, 4).map((s) => (
                      <Link key={s} href={vehicleSlugStr ? `/tires/v/${vehicleSlugStr}?${buildParams({ year, make, model, trim, modification, size: s, wheelDia: wheelDiaN, wheelWidth: width, ...liftedUrlParams })}` : `/tires?${buildParams({ year, make, model, trim, modification, size: s, wheelDia: wheelDiaN, wheelWidth: width, ...liftedUrlParams })}`}
                        className={`rounded-xl border px-3 py-2 text-xs font-extrabold hover:border-neutral-300 ${isLiftedBuild ? "border-amber-200 bg-amber-50 text-amber-900" : "border-neutral-200 bg-white text-neutral-900"}`}>
                        {s}
                      </Link>
                    ));
                  }
                  
                  if (vehicleLabel && wheelDiaN) {
                    return (
                      <Link href={vehicleSlugStr ? `/tires/v/${vehicleSlugStr}?${buildParams({ year, make, model, trim, modification, wheelDia: wheelDiaN, wheelWidth: width, ...liftedUrlParams })}` : `/tires?${buildParams({ year, make, model, trim, modification, wheelDia: wheelDiaN, wheelWidth: width, ...liftedUrlParams })}`}
                        className="rounded-xl bg-neutral-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-neutral-800">
                        Find {wheelDiaN}&quot; tires
                      </Link>
                    );
                  }
                  
                  return (
                    <Link href={`/tires?${buildParams({ year, make, model, trim, modification, ...liftedUrlParams })}`} className="rounded-xl bg-neutral-900 px-3 py-2 text-xs font-extrabold text-white">
                      Select vehicle
                    </Link>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            ROW 3.5: Real Vehicle Gallery (WheelPros Canto Assets)
            Shows this wheel on actual customer vehicles
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="mt-8">
          <WheelGalleryBlock
            wheelBrand={brand || undefined}
            wheelModel={modelToken || it?.properties?.model || undefined}
            vehicleYear={year || undefined}
            vehicleMake={make || undefined}
            vehicleModel={model || undefined}
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            ROW 4: Trust & Support
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <WheelWarrantySupport />
          <PDPTrustBlock />
        </div>

        {/* Fitment Guide (if vehicle selected) */}
        {hasVehicle && (
          <div className="mt-8">
            <RecommendedFitmentCard fitment={{ year, make, model, trim, modification }} productType="wheels" />
          </div>
        )}

        <div className="mt-6 text-xs text-neutral-400">SKU: {sku}</div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white p-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold text-neutral-900">
              {typeof price === "number" && Number.isFinite(price) ? `$${price.toFixed(2)}` : "Call"}
            </div>
            <div className="text-[11px] text-neutral-500">per wheel</div>
          </div>
          <a href="#add-to-cart" className="flex-1 max-w-[200px] h-11 rounded-xl bg-[var(--brand-red)] px-4 flex items-center justify-center text-sm font-extrabold text-white">
            Add to Cart
          </a>
        </div>
      </div>
    </main>
  );
}
