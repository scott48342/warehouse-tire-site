import Link from "next/link";
import { WheelVariantSelector, type WheelVariant } from "@/components/WheelVariantSelector";
import { FinishThumbnailStrip } from "@/components/FinishThumbnailStrip";
import { getTechfeedWheelBySku, getTechfeedWheelsByStyle } from "@/lib/techfeed/wheels";
import { QuoteRequest } from "@/components/QuoteRequest";
import { ImageGallery } from "@/components/ImageGallery";
import { RecommendedFitmentCard } from "@/components/RecommendedFitmentCard";
import { AddToCartButton } from "@/components/AddToCartButton";
import { BRAND } from "@/lib/brand";
import { vehicleSlug } from "@/lib/vehicleSlug";
import { extractDisplayTrim } from "@/lib/vehicleDisplay";

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

/**
 * Fetch dbProfile from our fitment profile service (DB-first).
 * This provides threadSize, seatType, centerBoreMm needed for accessory calculation.
 */
async function fetchDbProfile(params: {
  year: string;
  make: string;
  model: string;
  modification?: string;
}): Promise<{ dbProfile: import("@/hooks/useAccessoryFitment").DBProfileForAccessories | null }> {
  const { year, make, model, modification } = params;
  if (!year || !make || !model) return { dbProfile: null };

  try {
    // Use fitment-search endpoint with minimal params to get dbProfile
    const sp = new URLSearchParams({
      year,
      make,
      model,
      pageSize: "1", // We only need profile data, not wheel results
      debug: "1",
    });
    if (modification) sp.set("modification", modification);

    const res = await fetch(`${getBaseUrl()}/api/wheels/fitment-search?${sp.toString()}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn("[wheel-pdp] Failed to fetch dbProfile:", await res.text());
      return { dbProfile: null };
    }

    const data = await res.json();
    const fitment = data?.fitment;
    
    // Extract dbProfile-compatible fields from fitment response
    if (fitment?.dbProfile) {
      // Direct dbProfile from fitment-search response
      return { dbProfile: fitment.dbProfile };
    }
    
    // Fallback: construct from envelope data (legacy support)
    if (fitment?.envelope) {
      return {
        dbProfile: {
          threadSize: null, // Not available in legacy envelope
          seatType: null,
          centerBoreMm: fitment.envelope.centerBore || null,
          boltPattern: fitment.envelope.boltPattern || null,
        },
      };
    }

    return { dbProfile: null };
  } catch (err) {
    console.error("[wheel-pdp] Error fetching dbProfile:", err);
    return { dbProfile: null };
  }
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

// Helper to safely extract string from search param (handles objects)
function safeString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (typeof obj.name === "string") return obj.name.trim();
    if (typeof obj.value === "string") return obj.value.trim();
    return "";
  }
  return "";
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
  const year = safeString(Array.isArray(sp.year) ? sp.year[0] : sp.year);
  const make = safeString(Array.isArray(sp.make) ? sp.make[0] : sp.make);
  const model = safeString(Array.isArray(sp.model) ? sp.model[0] : sp.model);
  const trim = safeString(Array.isArray(sp.trim) ? sp.trim[0] : sp.trim);
  const modification = safeString(Array.isArray(sp.modification) ? sp.modification[0] : sp.modification);
  
  // Wheel variant params passed from listing page
  const wheelDiaParam = safeString(Array.isArray((sp as any).wheelDia) ? (sp as any).wheelDia[0] : (sp as any).wheelDia);
  const wheelWidthParam = safeString(Array.isArray((sp as any).wheelWidth) ? (sp as any).wheelWidth[0] : (sp as any).wheelWidth);
  const wheelOffsetParam = safeString(Array.isArray((sp as any).wheelOffset) ? (sp as any).wheelOffset[0] : (sp as any).wheelOffset);
  const wheelBoltParam = safeString(Array.isArray((sp as any).wheelBolt) ? (sp as any).wheelBolt[0] : (sp as any).wheelBolt);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // LIFTED BUILD CONTEXT - Read from URL params (passed from /wheels listing)
  // ═══════════════════════════════════════════════════════════════════════════
  const liftedSource = safeString(Array.isArray(sp.liftedSource) ? sp.liftedSource[0] : sp.liftedSource);
  const liftedPreset = safeString(Array.isArray(sp.liftedPreset) ? sp.liftedPreset[0] : sp.liftedPreset);
  const liftedInchesRaw = safeString(Array.isArray(sp.liftedInches) ? sp.liftedInches[0] : sp.liftedInches);
  const liftedInches = liftedInchesRaw ? parseInt(liftedInchesRaw, 10) : 0;
  const liftedTireSizesRaw = safeString(Array.isArray(sp.liftedTireSizes) ? sp.liftedTireSizes[0] : sp.liftedTireSizes);
  const liftedTireSizes = liftedTireSizesRaw ? liftedTireSizesRaw.split(",").filter(Boolean) : [];
  const liftedTireDiaMin = safeString(Array.isArray(sp.liftedTireDiaMin) ? sp.liftedTireDiaMin[0] : sp.liftedTireDiaMin);
  const liftedTireDiaMax = safeString(Array.isArray(sp.liftedTireDiaMax) ? sp.liftedTireDiaMax[0] : sp.liftedTireDiaMax);
  
  // Check if lifted build is active
  const isLiftedBuild = liftedSource === "lifted" && liftedPreset && liftedInches > 0;
  
  if (isLiftedBuild) {
    console.log('[wheel-pdp] 🚀 LIFTED BUILD CONTEXT:', {
      presetId: liftedPreset,
      liftInches: liftedInches,
      tireSizes: liftedTireSizes,
    });
  }
  
  // Never show raw engine text - extract clean submodel or omit
  const displayTrim = extractDisplayTrim(trim);
  const vehicleLabel = [year, make, model, displayTrim].filter(Boolean).join(" ");

  const vehicleSlugStr = year && make && model ? vehicleSlug(year, make, model) : "";

  const fitmentStrict = year && make && model
    ? await fetchFitment({ year, make, model, modification: modification || undefined })
    : null;

  // Extract DB profile for accessory fitment calculation
  // NOTE: fitmentStrict (from /api/vehicles/search) does NOT include dbProfile.
  // We need to fetch it separately from our fitment profile service.
  const { dbProfile } = year && make && model
    ? await fetchDbProfile({ year, make, model, modification: modification || undefined })
    : { dbProfile: null };
  
  // Log for debugging
  console.log("[wheel-pdp] Accessory fitment data:", {
    vehicle: `${year} ${make} ${model}`,
    hasDbProfile: !!dbProfile,
    threadSize: dbProfile?.threadSize,
    seatType: dbProfile?.seatType,
    centerBoreMm: dbProfile?.centerBoreMm,
  });

  const oemTireSizesAll: string[] = Array.isArray((fitmentStrict as any)?.tireSizes)
    ? (fitmentStrict as any).tireSizes.map(String)
    : [];

  // We'll filter OEM tire sizes to match the wheel diameter after we parse the wheel's size.
  let wheelDiaN: number | null = null;
  let oemTireSizes = oemTireSizesAll;

  // Try WheelPros first
  const data = await fetchWheelBySku(sku);

  const maybeData = data as { items?: unknown[]; results?: unknown[]; error?: unknown };
  const rawItems: unknown[] = Array.isArray(maybeData?.items)
    ? maybeData.items
    : (Array.isArray(maybeData?.results) ? maybeData.results : []);

  let it = (rawItems[0] as WheelProsItem | undefined) || undefined;
  let isFromTechfeed = false;

  // FALLBACK: If WheelPros doesn't have the SKU, try techfeed directly
  if (!it) {
    const tf = await getTechfeedWheelBySku(sku);
    if (tf) {
      isFromTechfeed = true;
      // Convert techfeed data to WheelProsItem format
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
        prices: tf.msrp ? {
          msrp: [{ currencyAmount: tf.msrp, currencyCode: "USD" }],
        } : undefined,
        images: tf.images?.map((url) => ({
          imageUrlLarge: url,
          imageUrlMedium: url,
          imageUrlSmall: url,
          imageUrlOriginal: url,
        })),
      } as WheelProsItem;
    }
  }

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

  // VARIANT RESOLUTION: Check if URL params request a different variant than current SKU
  // If so, find the correct variant and redirect
  const needsVariantRedirect = (() => {
    // Only check if we have URL params specifying a different size
    if (!wheelDiaParam && !wheelWidthParam) return null;
    
    // Normalize for comparison
    const normNum = (v?: string) => {
      if (!v) return undefined;
      const n = Number(String(v).trim());
      return Number.isFinite(n) ? String(n) : v.trim();
    };
    
    const currentDia = normNum(diameter);
    const currentWidth = normNum(width);
    const wantDia = normNum(wheelDiaParam);
    const wantWidth = normNum(wheelWidthParam);
    
    // Check if current wheel already matches requested specs
    const diaMatches = !wantDia || currentDia === wantDia;
    const widthMatches = !wantWidth || currentWidth === wantWidth;
    
    if (diaMatches && widthMatches) return null; // Already on correct variant
    
    // Find variant matching the requested specs
    const matchingVariant = variantsForSelector.find((v) => {
      const vDia = normNum(v.diameter);
      const vWidth = normNum(v.width);
      const diaOk = !wantDia || vDia === wantDia;
      const widthOk = !wantWidth || vWidth === wantWidth;
      return diaOk && widthOk;
    });
    
    if (matchingVariant && matchingVariant.sku !== sku) {
      // Build redirect URL preserving all params
      const redirectParams = new URLSearchParams();
      if (year) redirectParams.set("year", year);
      if (make) redirectParams.set("make", make);
      if (model) redirectParams.set("model", model);
      if (trim) redirectParams.set("trim", trim);
      if (modification) redirectParams.set("modification", modification);
      if (matchingVariant.diameter) redirectParams.set("wheelDia", matchingVariant.diameter);
      if (matchingVariant.width) redirectParams.set("wheelWidth", matchingVariant.width);
      if (matchingVariant.offset) redirectParams.set("wheelOffset", matchingVariant.offset);
      if (matchingVariant.boltPattern) redirectParams.set("wheelBolt", matchingVariant.boltPattern);
      
      const qs = redirectParams.toString();
      return `/wheels/${encodeURIComponent(matchingVariant.sku)}${qs ? `?${qs}` : ""}`;
    }
    
    return null;
  })();
  
  // If we need to redirect to a different variant, do server-side redirect
  if (needsVariantRedirect) {
    const { redirect } = await import("next/navigation");
    redirect(needsVariantRedirect);
  }

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
                  {isLiftedBuild
                    ? `Choose lifted tire sizes for your ${liftedInches}" lift build.`
                    : vehicleLabel
                      ? (wheelDiaN && oemTireSizes.length > 0
                          ? `Choose an OEM tire size that fits ${wheelDiaN}" wheels.`
                          : wheelDiaN && oemTireSizes.length === 0
                            ? `Find compatible tires for your ${wheelDiaN}" wheels.`
                            : "Choose an OEM tire size for your vehicle.")
                      : "Select a vehicle to see OEM tire sizes."}
                </div>

                {/* LIFTED BUILD: Show lifted tire sizes instead of OEM */}
                {isLiftedBuild && (
                  <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1">
                    <div className="flex items-center gap-1.5 text-xs text-amber-800">
                      <span>🚀</span>
                      <span className="font-semibold">Lifted Build Mode</span>
                      <span className="text-amber-600">• {liftedInches}" {liftedPreset}</span>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {/* LIFTED BUILD TIRE SIZES - prioritize lifted recommendations */}
                  {(() => {
                    // Build common URL params including lifted context
                    // Filter out empty values to satisfy URLSearchParams type requirements
                    const liftedUrlParams: Record<string, string> = {};
                    if (isLiftedBuild) {
                      if (liftedSource) liftedUrlParams.liftedSource = liftedSource;
                      if (liftedPreset) liftedUrlParams.liftedPreset = liftedPreset;
                      if (liftedInches) liftedUrlParams.liftedInches = String(liftedInches);
                      if (liftedTireSizesRaw) liftedUrlParams.liftedTireSizes = liftedTireSizesRaw;
                      if (liftedTireDiaMin) liftedUrlParams.liftedTireDiaMin = liftedTireDiaMin;
                      if (liftedTireDiaMax) liftedUrlParams.liftedTireDiaMax = liftedTireDiaMax;
                    }
                    
                    // Get tire sizes matching wheel diameter
                    const effectiveTireSizes = isLiftedBuild
                      ? liftedTireSizes.filter((s) => {
                          // Filter lifted sizes to match the wheel diameter
                          const m = String(s).toUpperCase().match(/R(\d{2})\b/);
                          const rim = m ? Number(m[1]) : NaN;
                          return !wheelDiaN || (Number.isFinite(rim) && rim === wheelDiaN);
                        })
                      : oemTireSizes;
                    
                    // Helper to build URL params (filters empty values)
                    const buildParams = (params: Record<string, string | number | null | undefined>) => {
                      const filtered: Record<string, string> = {};
                      for (const [k, v] of Object.entries(params)) {
                        if (v != null && v !== "") filtered[k] = String(v);
                      }
                      return new URLSearchParams(filtered).toString();
                    };
                    
                    // Case 1: Have tire sizes that match the wheel - show them
                    if (vehicleLabel && effectiveTireSizes.length > 0) {
                      return effectiveTireSizes.slice(0, 4).map((s) => (
                        <Link
                          key={s}
                          href={
                            vehicleSlugStr
                              ? `/tires/v/${vehicleSlugStr}?${buildParams({ 
                                  year, make, model, trim, modification, size: s,
                                  wheelDia: wheelDiaN, wheelWidth: width,
                                  ...liftedUrlParams,
                                })}`
                              : `/tires?${buildParams({ 
                                  year, make, model, trim, modification, size: s,
                                  wheelDia: wheelDiaN, wheelWidth: width,
                                  ...liftedUrlParams,
                                })}`
                          }
                          className={`rounded-xl border px-3 py-2 text-xs font-extrabold hover:border-neutral-300 ${
                            isLiftedBuild
                              ? "border-amber-200 bg-amber-50 text-amber-900"
                              : "border-neutral-200 bg-white text-neutral-900"
                          }`}
                        >
                          {s}
                        </Link>
                      ));
                    }
                    
                    // Case 2: No matching sizes for wheel diameter - find tires
                    if (vehicleLabel && wheelDiaN) {
                      return (
                        <Link
                          href={
                            vehicleSlugStr
                              ? `/tires/v/${vehicleSlugStr}?${buildParams({ 
                                  year, make, model, trim, modification,
                                  wheelDia: wheelDiaN, wheelWidth: width,
                                  ...liftedUrlParams,
                                })}`
                              : `/tires?${buildParams({ 
                                  year, make, model, trim, modification,
                                  wheelDia: wheelDiaN, wheelWidth: width,
                                  ...liftedUrlParams,
                                })}`
                          }
                          className="rounded-xl bg-neutral-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-neutral-800"
                        >
                          Find {wheelDiaN}" tires
                        </Link>
                      );
                    }
                    
                    // Case 3: No vehicle or wheel diameter - select vehicle
                    return (
                      <Link
                        href={`/tires?${buildParams({ year, make, model, trim, modification, ...liftedUrlParams })}`}
                        className="rounded-xl bg-neutral-900 px-3 py-2 text-xs font-extrabold text-white"
                      >
                        Select vehicle
                      </Link>
                    );
                  })()}
                </div>

                {/* Plus-size notice - only show for stock builds, not lifted */}
                {!isLiftedBuild && wheelDiaN && oemTireSizes.length === 0 && oemTireSizesAll.length > 0 && (
                  <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
                    This is a plus-size wheel. We will find compatible tire sizes.
                  </div>
                )}

                <div className="mt-2 text-[11px] text-neutral-600">
                  {isLiftedBuild 
                    ? "Lifted tire recommendations are based on common fitments for your lift level."
                    : "We will verify fitment before install."}
                </div>
              </div>
            </div>

            {/* Space reserved for future modules under the photo (tire matching, accessories, etc.) */}
          </div>

          <div className="lg:sticky lg:top-6 rounded-3xl border border-neutral-200 bg-white p-6">
            {/* Fitment Summary */}
            {year && make && model ? (
              <div className="mb-4">
                {/* Fitment Confirmation Banner */}
                <div className="rounded-2xl bg-green-50 border border-green-200 p-4 mb-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">✓</span>
                    <div>
                      <div className="font-extrabold text-green-900">
                        Fits your {year} {make} {model}
                      </div>
                      <div className="mt-1 text-sm text-green-800">
                        Guaranteed fitment - no returns due to fitment issues
                      </div>
                    </div>
                  </div>
                </div>

                <RecommendedFitmentCard fitment={{ year, make, model, trim, modification }} />
                <div className="mt-2">
                  <Link
                    href={`/wheels?${new URLSearchParams({ year, make, model, trim, modification }).toString()}`}
                    className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-xs font-extrabold text-neutral-900 hover:border-neutral-300"
                  >
                    Change vehicle
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <div className="font-extrabold text-amber-900">Select your vehicle</div>
                    <div className="mt-1 text-sm text-amber-800">
                      We'll verify this wheel fits before you buy
                    </div>
                    <div className="mt-3">
                      <Link
                        href={`/wheels?${new URLSearchParams({ year, make, model, trim, modification }).toString()}`}
                        className="inline-flex h-9 items-center rounded-xl bg-amber-600 px-4 text-xs font-extrabold text-white hover:bg-amber-700"
                      >
                        Select vehicle
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
              <div className="text-xs font-extrabold text-neutral-900">Why you'll like it</div>
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

              {/* Installation Options */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="text-xs font-extrabold text-neutral-900 mb-3">Installation Options</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-neutral-700">
                    <span className="text-green-600">✓</span>
                    <span>Ship to your installer</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-700">
                    <span className="text-green-600">✓</span>
                    <span>Local installation available</span>
                    <span className="text-neutral-400">📍</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-700">
                    <span className="text-green-600">✓</span>
                    <span>Mount &amp; balance included</span>
                  </div>
                </div>
              </div>

              {/* Buy Actions */}
              <div id="quote" className="rounded-2xl border border-green-200 bg-green-50 p-4">
                <div className="text-sm font-extrabold text-neutral-900 mb-3">Ready to buy?</div>
                <div className="grid gap-2">
                  <AddToCartButton
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
                    quantity={4}
                    vehicle={
                      year && make && model
                        ? { year, make, model, trim: trim || undefined, modification: modification || undefined }
                        : undefined
                    }
                    className="w-full"
                    showPriceInButton={typeof price === "number" && Number.isFinite(price)}
                    dbProfile={dbProfile}
                    wheelCenterBore={tfSelf?.centerbore ? Number(tfSelf.centerbore) : (it?.properties?.centerbore ? Number(it.properties.centerbore) : undefined)}
                  />
                  <QuoteRequest productType="wheel" sku={sku} productName={it?.title || sku} />
                </div>

                <div className="mt-3 pt-3 border-t border-green-200">
                  <div className="text-xs text-green-800 space-y-1">
                    <div><span className="font-semibold">✓</span> Fitment verified before shipping</div>
                    <div><span className="font-semibold">✓</span> No returns due to fitment issues</div>
                    <div><span className="font-semibold">✓</span> Expert support included</div>
                  </div>
                </div>

                <div className="mt-3 text-center">
                  <a href={BRAND.links.tel} className="text-xs font-extrabold text-neutral-900 hover:underline">
                    Questions? Call us
                  </a>
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
