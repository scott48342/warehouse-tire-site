import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { WheelsStyleCard } from "@/components/WheelsStyleCard";
import { FilterGroup } from "./FilterGroup";
import { GarageWidget } from "@/components/GarageWidget";
import { RecommendedFitmentCard } from "@/components/RecommendedFitmentCard";
import { vehicleSlug } from "@/lib/vehicleSlug";

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
  finishThumbs?: { finish: string; sku: string; imageUrl?: string; price?: number }[];
  pair?: {
    staggered: boolean;
    front: { sku: string; diameter?: string; width?: string; offset?: string };
    rear?: { sku: string; diameter?: string; width?: string; offset?: string };
  };
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

// Fast local browse using techfeed data (no WheelPros API call)
async function fetchWheelsFast(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }

  const res = await fetch(
    `${getBaseUrl()}/api/wheels/browse?${sp.toString()}`,
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

  const priceMinRaw = (Array.isArray(sp.priceMin) ? sp.priceMin[0] : sp.priceMin) || "";
  const priceMaxRaw = (Array.isArray(sp.priceMax) ? sp.priceMax[0] : sp.priceMax) || "";
  const priceMin = priceMinRaw ? Number(String(priceMinRaw)) : null;
  const priceMax = priceMaxRaw ? Number(String(priceMaxRaw)) : null;

  const offsetMinRaw = (Array.isArray(sp.offsetMin) ? sp.offsetMin[0] : sp.offsetMin) || "";
  const offsetMaxRaw = (Array.isArray(sp.offsetMax) ? sp.offsetMax[0] : sp.offsetMax) || "";
  const offsetMinUser = offsetMinRaw ? Number(String(offsetMinRaw)) : null;
  const offsetMaxUser = offsetMaxRaw ? Number(String(offsetMaxRaw)) : null;

  // Fitment level: "oem" (default, strict offset) vs "lifted" (show all offsets for modified vehicles)
  const fitLevelRaw = (Array.isArray(sp.fitLevel) ? sp.fitLevel[0] : sp.fitLevel) || "";
  const fitLevel = String(fitLevelRaw || "oem").trim();

  const needsTrimNotice = Boolean(year && make && model && !modification);

  // Only show the guided wheel+tire package UI when explicitly requested.
  // (Wheels-only browsing shouldn't show "Step 1/Step 2" package cards.)
  const packageRaw = (Array.isArray((sp as any).package) ? (sp as any).package[0] : (sp as any).package) || "";
  const isPackageFlow = String(packageRaw).trim() === "1";

  // View filter: staggered vs square. If vehicle is inferred staggered, default to staggered-only.
  const fitViewRaw = (Array.isArray((sp as any).fitView) ? (sp as any).fitView[0] : (sp as any).fitView) || "";
  const fitView = String(fitViewRaw || "").trim();

  // 1) Resolve fitment (bolt pattern, width/offset ranges, etc.)
  const isWpSubmodel = modification.startsWith("wp:");
  const wpSubmodel = isWpSubmodel ? modification.slice(3) : "";

  const fitment = year && make && model
    ? (isWpSubmodel
        ? await fetch(`${getBaseUrl()}/api/wp/vehicles/fitment?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&submodel=${encodeURIComponent(wpSubmodel)}`, { cache: "no-store" }).then((r) => r.json())
        : await fetchFitment({
            year,
            make,
            model,
            modification: modification || undefined,
          }))
    : null;

  const fit = (fitment as any)?.fitment ? (fitment as any).fitment : fitment;
  const hasVehicle = Boolean(year && make && model);
  const bp: string | undefined = hasVehicle ? (boltPatternParam || fit?.boltPattern || undefined) : undefined;

  function rimDiaFromTireSize(s: string) {
    const m = String(s || "").toUpperCase().match(/R(\d{2})\b/);
    return m ? Number(m[1]) : NaN;
  }

  const tireDias = Array.isArray(fit?.tireSizes)
    ? (fit.tireSizes as any[]).map((x) => rimDiaFromTireSize(String(x))).filter((n) => Number.isFinite(n))
    : [];
  
  // Only treat as staggered if fitment data explicitly indicates it
  // (e.g., fit.staggered === true or separate front/rear specs).
  // Multiple tire size OPTIONS (17", 18", 20") does NOT mean staggered.
  const vehicleCallsForStaggered = Boolean(fit?.staggered);

  // Default to showing all wheels (no fitView filter). User can opt into staggered view.
  const effectiveFitView = fitView || "";

  // Centerbore: WheelPros properties/filters are inconsistent; don't hard-filter on it upstream.
  const cb: string | undefined = undefined;

  const diaRange: [number | null, number | null] = Array.isArray(fit?.wheelDiameterRangeIn)
    ? fit.wheelDiameterRangeIn
    : [null, null];
  const widthRange: [number | null, number | null] = Array.isArray(fit?.wheelWidthRangeIn)
    ? fit.wheelWidthRangeIn
    : [null, null];
  const offRange: [number | null, number | null] = Array.isArray(fit?.offsetRangeMm)
    ? (fit.offsetRangeMm as any)
    : [null, null];

  // Option 2: OEM + tolerance (improves results while staying sane).
  const OFFSET_TOLERANCE_MM = 5;
  const minOffN0 = offRange?.[0] != null ? Number(offRange[0]) : NaN;
  const maxOffN0 = offRange?.[1] != null ? Number(offRange[1]) : NaN;
  const minOffN = Number.isFinite(minOffN0) ? minOffN0 - OFFSET_TOLERANCE_MM : NaN;
  const maxOffN = Number.isFinite(maxOffN0) ? maxOffN0 + OFFSET_TOLERANCE_MM : NaN;

  const minOff = Number.isFinite(minOffN) ? String(minOffN) : undefined;
  const maxOff = Number.isFinite(maxOffN) ? String(maxOffN) : undefined;

  function fmtOneDecimal(v: string) {
    const x = Number(String(v || "").trim());
    return Number.isFinite(x) ? x.toFixed(1) : String(v || "").trim();
  }

  // WheelPros expects a single diameter/width.
  const diameterNum = diaRange?.[1] != null ? Number(diaRange[1]) : (diaRange?.[0] != null ? Number(diaRange[0]) : NaN);
  // If user picked a diameter filter, normalize to WheelPros format (often "20.0").
  const diameter = diameterParam
    ? fmtOneDecimal(diameterParam)
    : (Number.isFinite(diameterNum) ? diameterNum.toFixed(1) : undefined);

  // Same idea for width.
  const width = widthParam ? fmtOneDecimal(widthParam) : undefined;
  // IMPORTANT: don't auto-restrict offset to the exact OEM range.
  // WheelPros/DealerLineX commonly show many valid fitments across a wide offset range.
  // Only apply offset range when the user explicitly filters it.
  const minOffset = hasVehicle && Number.isFinite(offsetMinUser as number) ? String(offsetMinUser) : undefined;
  const maxOffset = hasVehicle && Number.isFinite(offsetMaxUser as number) ? String(offsetMaxUser) : undefined;

  // 2) Query WheelPros using fitment-derived filters.
  // Apply OEM offset filtering by default (fitLevel=oem), unless user explicitly wants lifted/modified fitments
  // or has manually set offset filters.
  const autoApplyOemOffset = hasVehicle && fitLevel !== "lifted" && offsetMinUser == null && offsetMaxUser == null;
  
  // Use OEM offset range when auto-applying (with tolerance for aftermarket wheels)
  const OEM_OFFSET_TOLERANCE_MM = 5;
  const minOffOem = autoApplyOemOffset && Number.isFinite(minOffN0) ? minOffN0 - OEM_OFFSET_TOLERANCE_MM : NaN;
  const maxOffOem = autoApplyOemOffset && Number.isFinite(maxOffN0) ? maxOffN0 + OEM_OFFSET_TOLERANCE_MM : NaN;

  // Final offset values: user explicit > OEM auto > none
  const minOffsetFinal = offsetMinUser != null ? String(offsetMinUser) 
    : (Number.isFinite(minOffOem) ? String(minOffOem) : undefined);
  const maxOffsetFinal = offsetMaxUser != null ? String(offsetMaxUser)
    : (Number.isFinite(maxOffOem) ? String(maxOffOem) : undefined);

  // IMPORTANT: Don't auto-restrict diameter/width unless the user explicitly chose them.
  // Doing so can collapse results (e.g., WheelPros shows many fitments/sizes).
  const upstreamPageSize = 120;

  const baseWheelProsParams: Record<string, string | undefined> = {
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
    // For size-only searches (no vehicle), WheelPros filters are unreliable; fetch broad and filter client-side.
    diameter: hasVehicle && diameterParam && widthParam ? diameter : undefined,
    width: hasVehicle && widthParam ? width : undefined,

    // Facet filters (WheelPros taxonomy)
    brand_cd: brandCd || undefined,
    abbreviated_finish_desc: finish || undefined,

    minOffset: minOffsetFinal,
    maxOffset: maxOffsetFinal,
    offsetType: minOffsetFinal || maxOffsetFinal ? "RANGE" : undefined,
  };

  // Use WheelPros API for accurate fitment and full inventory
  // (Local techfeed browse was showing wrong bolt patterns in facets)
  const useFastBrowse = false;
  
  let data: any;
  let fastBrowseData: any = null;
  
  if (useFastBrowse) {
    // Fast path: query local techfeed data
    fastBrowseData = await fetchWheelsFast({
      page: String(page),
      pageSize: "48", // Smaller page for faster response
      boltPattern: bp,
      diameter: diameterParam || undefined,
      width: widthParam || undefined,
      offsetMin: minOffsetFinal,
      offsetMax: maxOffsetFinal,
      brand_cd: brandCd || undefined,
      finish: finish || undefined,
      priceMin: priceMin != null ? String(priceMin) : undefined,
      priceMax: priceMax != null ? String(priceMax) : undefined,
    });
    
    // If no results with bolt pattern, try without
    if (fastBrowseData?.totalStyles === 0 && hasVehicle && bp) {
      fastBrowseData = await fetchWheelsFast({
        page: String(page),
        pageSize: "48",
        diameter: diameterParam || undefined,
        width: widthParam || undefined,
        brand_cd: brandCd || undefined,
        finish: finish || undefined,
        priceMin: priceMin != null ? String(priceMin) : undefined,
        priceMax: priceMax != null ? String(priceMax) : undefined,
      });
    }
    
    // Convert fast browse format to expected format
    data = { results: [], totalCount: fastBrowseData?.totalStyles || 0, facets: fastBrowseData?.facets || {} };
  } else {
    // Slow path: WheelPros API
    data = await fetchWheels(baseWheelProsParams);

    // If we get zero results for a vehicle-based search, relax filters.
    const emptyFirstPass =
      (Array.isArray(data?.items) && data.items.length === 0) ||
      (Array.isArray(data?.results) && data.results.length === 0);

    if (emptyFirstPass && hasVehicle) {
      data = await fetchWheels({
        ...baseWheelProsParams,
        boltPattern: undefined,
        minOffset: undefined,
        maxOffset: undefined,
        offsetType: undefined,
      });
    }
  }

  // If using fast browse, convert directly to final format (skip all the WheelPros processing)
  let fastItems: Wheel[] = [];
  let fastTotalCount = 0;
  let fastFacets: any = {};
  let fastTotalPages = 1;
  
  if (useFastBrowse && fastBrowseData?.styles) {
    // Fast path: data is already grouped by style
    fastItems = (fastBrowseData.styles as any[]).map((style: any) => ({
      sku: style.finishes?.[0]?.sku || style.styleKey,
      brand: style.brand,
      brandCode: style.brandCode,
      model: style.model,
      finish: style.finishes?.[0]?.finish,
      diameter: style.finishes?.[0]?.diameter,
      width: style.finishes?.[0]?.width,
      offset: style.finishes?.[0]?.offset,
      imageUrl: style.imageUrl,
      price: style.price,
      styleKey: style.styleKey,
      finishThumbs: style.finishes?.map((f: any) => ({
        finish: f.finish,
        sku: f.sku,
        imageUrl: f.imageUrl,
        price: f.price,
      })),
      pair: undefined, // Fast browse doesn't compute staggered pairs yet
    }));
    
    fastTotalCount = fastBrowseData.totalStyles || 0;
    fastTotalPages = fastBrowseData.totalPages || 1;
    
    // Convert facets format
    fastFacets = {
      abbreviated_finish_desc: { buckets: fastBrowseData.facets?.finishes?.map((f: any) => ({ value: f.value, count: f.count })) || [] },
      bolt_pattern_metric: { buckets: fastBrowseData.facets?.boltPatterns?.map((f: any) => ({ value: f.value, count: f.count })) || [] },
      brand_cd: { buckets: fastBrowseData.facets?.brands?.map((f: any) => ({ value: f.code, count: f.count })) || [] },
      wheel_diameter: { buckets: fastBrowseData.facets?.diameters?.map((f: any) => ({ value: f.value, count: f.count })) || [] },
      width: { buckets: fastBrowseData.facets?.widths?.map((f: any) => ({ value: f.value, count: f.count })) || [] },
    };
  }
  
  // Slow path: process WheelPros data
  const maybeData = data as {
    items?: unknown[];
    results?: unknown[];
    totalCount?: number;
    facets?: any;
  };

  // common patterns: { items: [] } or { results: [] }
  const rawItems: unknown[] = useFastBrowse ? [] : (Array.isArray(maybeData?.items)
    ? maybeData.items
    : (Array.isArray(maybeData?.results) ? maybeData.results : []));

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
      const fallbackKey = `${String(w.brandCode || w.brand || "").trim()}::${String(w.model || "").trim()}`;
      const k = String(w.styleKey || "").trim() || (fallbackKey.includes("::") ? fallbackKey : "");
      if (!k || k === "::") {
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

      function n(v: any) {
        const x = Number(String(v || "").trim());
        return Number.isFinite(x) ? x : NaN;
      }

      const variants = arr
        .map((x) => ({
          sku: String(x.sku || ""),
          diameter: x.diameter,
          width: x.width,
          offset: x.offset,
          d: n(x.diameter),
          w: n(x.width),
        }))
        .filter((v) => v.sku && Number.isFinite(v.d) && Number.isFinite(v.w));

      function rimDiaFromTireSize(s: string) {
        const m = String(s || "").toUpperCase().match(/R(\d{2})\b/);
        return m ? Number(m[1]) : NaN;
      }

      // Only compute staggered pairs for vehicles that explicitly support staggered fitment.
      // Multiple tire size OPTIONS does not mean staggered (e.g., F-150 has 17/18/20" options but not staggered).
      const useMixedDia = vehicleCallsForStaggered;
      const inferredFrontDia = NaN;
      const inferredRearDia = NaN;

      // Finish dropdown options (also carries a finish-specific pair so selecting a finish updates both axles).
      const thumbs: { finish: string; sku: string; imageUrl?: string; price?: number; pair?: Wheel["pair"] }[] = [];
      const seen = new Set<string>();
      for (const x of arr) {
        const fin = String(x.finish || "").trim();
        if (!fin || seen.has(fin)) continue;
        seen.add(fin);

        const arrFin = arr.filter((z) => String(z.finish || "").trim() === fin);
        const variantsFin = arrFin
          .map((z) => ({
            sku: String(z.sku || ""),
            diameter: z.diameter,
            width: z.width,
            offset: z.offset,
            d: n(z.diameter),
            w: n(z.width),
          }))
          .filter((v) => v.sku && Number.isFinite(v.d) && Number.isFinite(v.w));

        const maxDiaFin = variantsFin.length ? Math.max(...variantsFin.map((v) => v.d)) : NaN;

        const frontPoolFin = useMixedDia
          ? variantsFin.filter((v) => Math.abs(v.d - inferredFrontDia) < 0.11)
          : (Number.isFinite(maxDiaFin) ? variantsFin.filter((v) => Math.abs(v.d - maxDiaFin) < 0.06) : []);

        const rearPoolFin = useMixedDia
          ? variantsFin.filter((v) => Math.abs(v.d - inferredRearDia) < 0.11)
          : frontPoolFin;

        const poolFrontFin = frontPoolFin.length ? frontPoolFin : variantsFin;
        const poolRearFin = rearPoolFin.length ? rearPoolFin : variantsFin;

        let pairFin: Wheel["pair"] | undefined = undefined;
        if (poolFrontFin.length) {
          const frontV = [...poolFrontFin].sort((a, b) => a.w - b.w)[0];
          const rearV = [...poolRearFin].sort((a, b) => b.w - a.w)[0];

          const staggered =
            Boolean(rearV && frontV) &&
            (useMixedDia
              ? (rearV.d - frontV.d >= 1 || rearV.w - frontV.w >= 1.0)
              : (rearV.sku !== frontV.sku && rearV.w - frontV.w >= 1.0));

          pairFin = {
            staggered,
            front: { sku: frontV.sku, diameter: frontV.diameter, width: frontV.width, offset: frontV.offset },
            rear: staggered
              ? { sku: rearV.sku, diameter: rearV.diameter, width: rearV.width, offset: rearV.offset }
              : undefined,
          };
        }

        thumbs.push({
          finish: fin,
          sku: pairFin?.front?.sku || x.sku || "",
          imageUrl: x.imageUrl,
          price: x.price,
          pair: pairFin,
        });
      }

      const maxDia = variants.length ? Math.max(...variants.map((v) => v.d)) : NaN;

      const frontPool = useMixedDia
        ? variants.filter((v) => Math.abs(v.d - inferredFrontDia) < 0.11)
        : (Number.isFinite(maxDia) ? variants.filter((v) => Math.abs(v.d - maxDia) < 0.06) : []);

      const rearPool = useMixedDia
        ? variants.filter((v) => Math.abs(v.d - inferredRearDia) < 0.11)
        : frontPool;

      const poolFront = frontPool.length ? frontPool : variants;
      const poolRear = rearPool.length ? rearPool : variants;

      let pair: Wheel["pair"] | undefined = undefined;
      if (poolFront.length) {
        const frontV = [...poolFront].sort((a, b) => a.w - b.w)[0];
        const rearV = [...poolRear].sort((a, b) => b.w - a.w)[0];

        const staggered =
          Boolean(rearV && frontV) &&
          (useMixedDia
            ? (rearV.d - frontV.d >= 1 || rearV.w - frontV.w >= 1.0)
            : (rearV.sku !== frontV.sku && rearV.w - frontV.w >= 1.0));

        pair = {
          staggered,
          front: {
            sku: frontV.sku,
            diameter: frontV.diameter,
            width: frontV.width,
            offset: frontV.offset,
          },
          rear: staggered
            ? {
                sku: rearV.sku,
                diameter: rearV.diameter,
                width: rearV.width,
                offset: rearV.offset,
              }
            : undefined,
        };
      }

      out.push({
        ...rep,
        styleKey: k,
        finishThumbs: thumbs.filter((t) => t.sku),
        pair,
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
      const want = Number(String(diameterParam).trim());
      const have = Number(String(w.diameter || "").trim());
      if (Number.isFinite(want) && Number.isFinite(have)) {
        if (Math.abs(have - want) > 0.05) return false;
      } else {
        const d = String(w.diameter || "").trim();
        if (d && d !== String(diameterParam).trim()) return false;
      }
    }

    if (widthParam) {
      const want = Number(String(widthParam).trim());
      const have = Number(String(w.width || "").trim());
      if (Number.isFinite(want) && Number.isFinite(have)) {
        if (Math.abs(have - want) > 0.05) return false;
      } else {
        const ww = String(w.width || "").trim();
        if (ww && ww !== String(widthParam).trim()) return false;
      }
    }

    return true;
  });

  // Fitment offset filter (important for passenger cars like Altima: +50ish).
  // Use the final calculated offset range (OEM auto-applied or user-specified).
  const minOffN2 = typeof minOffsetFinal === "string" ? Number(minOffsetFinal) : NaN;
  const maxOffN2 = typeof maxOffsetFinal === "string" ? Number(maxOffsetFinal) : NaN;

  const itemsFilteredOffset = Number.isFinite(minOffN2) && Number.isFinite(maxOffN2)
    ? itemsFilteredBasic.filter((w) => {
        const raw = String(w.offset || "").trim();
        if (!raw) return false; // if we know the vehicle offset range, require wheel offset
        const n = Number(raw);
        if (!Number.isFinite(n)) return false;
        return n >= minOffN2 && n <= maxOffN2;
      })
    : itemsFilteredBasic;

  const itemsFilteredPrice = Number.isFinite(priceMin as number) || Number.isFinite(priceMax as number)
    ? itemsFilteredOffset.filter((w) => {
        const p = typeof w.price === "number" ? w.price : null;
        if (p == null) return false;
        if (Number.isFinite(priceMin as number) && p < (priceMin as number)) return false;
        if (Number.isFinite(priceMax as number) && p > (priceMax as number)) return false;
        return true;
      })
    : itemsFilteredOffset;

  // Use fast browse results if available, otherwise use processed WheelPros results
  const itemsFinal = useFastBrowse && fastItems.length > 0
    ? fastItems
    : (effectiveFitView === "staggered"
        ? itemsFilteredPrice.filter((w) => Boolean(w.pair?.staggered))
        : effectiveFitView === "square"
          ? itemsFilteredPrice.filter((w) => !w.pair?.staggered)
          : itemsFilteredPrice);

  // Paginate styles client-side (we group SKUs into styles).
  const stylesPerPage = 24;
  const totalPages = useFastBrowse ? fastTotalPages : Math.max(1, Math.ceil(itemsFinal.length / stylesPerPage));
  const safePage = Math.min(page, totalPages);
  
  // For fast browse, items are already paginated server-side
  const itemsPage: Wheel[] = useFastBrowse 
    ? itemsFinal 
    : itemsFinal.slice((safePage - 1) * stylesPerPage, safePage * stylesPerPage);

  // Still show raw SKU count for reference.
  const totalCount = useFastBrowse ? fastTotalCount : (typeof maybeData?.totalCount === "number" ? maybeData.totalCount : itemsUnsorted.length);

  const facets = useFastBrowse ? fastFacets : ((maybeData as any)?.facets || {});
  const buckets = (k: string): Array<{ value: string; count?: number }> => {
    const f = facets?.[k];
    const arr = Array.isArray(f?.buckets) ? f.buckets : [];
    return arr
      .map((b: any) => ({ value: String(b?.value ?? "").trim(), count: b?.count != null ? Number(b.count) : undefined }))
      .filter((b: any) => b.value);
  };

  // Brand options: prefer actual brand names from the results we have.
  const brandOptions: Array<{ code: string; desc: string }> = (() => {
    if (useFastBrowse && fastBrowseData?.facets?.brands) {
      return fastBrowseData.facets.brands.map((b: any) => ({
        code: String(b.code || ""),
        desc: String(b.name || ""),
      }));
    }
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
  // Sort diameter buckets numerically (smallest to largest)
  const diameterBuckets = buckets("wheel_diameter").sort((a: { value: string; count?: number }, b: { value: string; count?: number }) => {
    const aNum = parseFloat(a.value);
    const bNum = parseFloat(b.value);
    return aNum - bNum;
  });
  // Sort width buckets numerically (smallest to largest)
  const widthBuckets = buckets("width").sort((a: { value: string; count?: number }, b: { value: string; count?: number }) => {
    const aNum = parseFloat(a.value);
    const bNum = parseFloat(b.value);
    return aNum - bNum;
  });
  const boltPatternBuckets = buckets("bolt_pattern_metric");

  const basePath = year && make && model ? `/wheels/v/${vehicleSlug(year, make, model)}` : "/wheels";

  const qBase = `${basePath}?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}${trim ? `&trim=${encodeURIComponent(trim)}` : ""}${modification ? `&modification=${encodeURIComponent(modification)}` : ""}${sort ? `&sort=${encodeURIComponent(sort)}` : ""}${effectiveFitView ? `&fitView=${encodeURIComponent(effectiveFitView)}` : ""}${fitLevel !== "oem" ? `&fitLevel=${encodeURIComponent(fitLevel)}` : ""}`;

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-screen-2xl px-4 py-8">
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
                {/* Workspace header (Tireweb-style guided flow) */}
                {isPackageFlow ? (
                  <div className="mt-4 md:hidden grid gap-3 rounded-3xl border border-neutral-200 bg-white p-4">
                  <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4">
                    <div className="text-xs font-semibold text-neutral-600">Step 1</div>
                    <div className="mt-1 text-sm font-extrabold text-neutral-900">Select a wheel to load details</div>
                    <div className="mt-1 text-xs text-neutral-600">Pick a style below-details will appear on the wheel page.</div>
                  </div>
                  <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4">
                    <div className="text-xs font-semibold text-neutral-600">Step 2</div>
                    <div className="mt-1 text-sm font-extrabold text-neutral-900">Add tires</div>
                    <div className="mt-1 text-xs text-neutral-600">We'll show OEM sizes and options that match your vehicle.</div>
                    <div className="mt-3">
                      <Link
                        href={`/tires?${new URLSearchParams({ year, make, model, trim, modification }).toString()}`}
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-extrabold text-white"
                      >
                        Click here to select tires
                      </Link>
                    </div>
                  </div>

                    {needsTrimNotice ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        Tip: picking a trim/submodel usually improves results (bolt pattern + offset).
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-neutral-600">Sort</label>
            <AutoSubmitSelect
              name="sort"
              defaultValue={sort}
              className="h-12 rounded-xl border border-neutral-200 bg-white px-4 text-base font-semibold"
              options={[
                { value: "price_asc", label: "Price Low to High" },
                { value: "price_desc", label: "Price High to Low" },
                { value: "brand_asc", label: "Brand A-Z" },
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

        <div className="mt-5 grid gap-6 md:grid-cols-[340px_1fr]">
          <aside className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 md:block">
            {year && make && model ? (
              <div className="mb-4">
                <RecommendedFitmentCard fitment={{ year, make, model, trim, modification }} />
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold">Filters</h2>
              <a href={qBase} className="text-sm font-semibold text-neutral-600 hover:underline">
                Clear all
              </a>
            </div>

            {/* Fitment Level Toggle - OEM vs Lifted/Modified */}
            {hasVehicle && offRange?.[0] != null && offRange?.[1] != null ? (
              <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-xs font-semibold text-neutral-600 mb-2">Fitment Type</div>
                <div className="flex gap-2">
                  <a
                    href={`${qBase}${brandCd ? `&brand_cd=${encodeURIComponent(brandCd)}` : ""}${finish ? `&finish=${encodeURIComponent(finish)}` : ""}${diameterParam ? `&diameter=${encodeURIComponent(diameterParam)}` : ""}${widthParam ? `&width=${encodeURIComponent(widthParam)}` : ""}${boltPatternParam ? `&boltPattern=${encodeURIComponent(boltPatternParam)}` : ""}&fitLevel=oem&page=1`}
                    className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-extrabold transition-colors ${
                      fitLevel === "oem"
                        ? "bg-neutral-900 text-white"
                        : "bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    OEM Fit
                  </a>
                  <a
                    href={`${qBase}${brandCd ? `&brand_cd=${encodeURIComponent(brandCd)}` : ""}${finish ? `&finish=${encodeURIComponent(finish)}` : ""}${diameterParam ? `&diameter=${encodeURIComponent(diameterParam)}` : ""}${widthParam ? `&width=${encodeURIComponent(widthParam)}` : ""}${boltPatternParam ? `&boltPattern=${encodeURIComponent(boltPatternParam)}` : ""}&fitLevel=lifted&page=1`}
                    className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-extrabold transition-colors ${
                      fitLevel === "lifted"
                        ? "bg-neutral-900 text-white"
                        : "bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    Lifted/Modified
                  </a>
                </div>
                <div className="mt-2 text-xs text-neutral-500">
                  {fitLevel === "oem" 
                    ? `Showing wheels with offset ${offRange[0]}–${offRange[1]}mm (±${OEM_OFFSET_TOLERANCE_MM}mm tolerance)`
                    : "Showing all wheels regardless of offset"}
                </div>
              </div>
            ) : null}

            <form action={basePath} method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="page" value={"1"} />
              <input type="hidden" name="fitLevel" value={fitLevel} />

              <input type="hidden" name="brand_cd" value={brandCd} />
              <input type="hidden" name="finish" value={finish} />
              <input type="hidden" name="diameter" value={diameterParam} />
              <input type="hidden" name="width" value={widthParam} />
              <input type="hidden" name="boltPattern" value={boltPatternParam} />
              <input type="hidden" name="offsetMin" value={offsetMinRaw} />
              <input type="hidden" name="offsetMax" value={offsetMaxRaw} />

              <FilterGroup title="Price">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="priceMin"
                    defaultValue={priceMinRaw}
                    placeholder="$ min"
                    className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-base font-semibold"
                  />
                  <input
                    name="priceMax"
                    defaultValue={priceMaxRaw}
                    placeholder="$ max"
                    className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-base font-semibold"
                  />
                </div>

                <button className="mt-3 h-12 w-full rounded-xl px-4 text-base font-extrabold btn-outline-red">
                  Apply price
                </button>
              </FilterGroup>
            </form>

            <form action={basePath} method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="page" value={"1"} />
              <input type="hidden" name="fitLevel" value={fitLevel} />

              <input type="hidden" name="brand_cd" value={brandCd} />
              <input type="hidden" name="finish" value={finish} />
              <input type="hidden" name="diameter" value={diameterParam} />
              <input type="hidden" name="width" value={widthParam} />
              <input type="hidden" name="boltPattern" value={boltPatternParam} />
              <input type="hidden" name="priceMin" value={priceMinRaw} />
              <input type="hidden" name="priceMax" value={priceMaxRaw} />

              <FilterGroup title="Offset (mm)">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="offsetMin"
                    defaultValue={offsetMinRaw}
                    placeholder="min"
                    className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-base font-semibold"
                  />
                  <input
                    name="offsetMax"
                    defaultValue={offsetMaxRaw}
                    placeholder="max"
                    className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-base font-semibold"
                  />
                </div>

                <button className="mt-3 h-12 w-full rounded-xl px-4 text-base font-extrabold btn-outline-red">
                  Apply offset
                </button>
              </FilterGroup>
            </form>

            <form action={basePath} method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="page" value={"1"} />
              <input type="hidden" name="fitLevel" value={fitLevel} />

              {/* keep other filters */}
              <input type="hidden" name="finish" value={finish} />
              <input type="hidden" name="diameter" value={diameterParam} />
              <input type="hidden" name="width" value={widthParam} />
              <input type="hidden" name="boltPattern" value={boltPatternParam} />
              <input type="hidden" name="priceMin" value={priceMinRaw} />
              <input type="hidden" name="priceMax" value={priceMaxRaw} />
              <input type="hidden" name="offsetMin" value={offsetMinRaw} />
              <input type="hidden" name="offsetMax" value={offsetMaxRaw} />

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

                <button className="mt-3 h-12 w-full rounded-xl px-4 text-base font-extrabold btn-outline-red">
                  Apply brand
                </button>
              </FilterGroup>
            </form>

            <form action={basePath} method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="page" value={"1"} />
              <input type="hidden" name="fitLevel" value={fitLevel} />

              <input type="hidden" name="brand_cd" value={brandCd} />
              <input type="hidden" name="diameter" value={diameterParam} />
              <input type="hidden" name="width" value={widthParam} />
              <input type="hidden" name="boltPattern" value={boltPatternParam} />

              <FilterGroup title="Finish">
                <select
                  name="finish"
                  defaultValue={finish}
                  className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-base font-semibold"
                >
                  <option value="">All finishes</option>
                  {finishBuckets.slice(0, 80).map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.value}{b.count != null ? ` (${b.count})` : ""}
                    </option>
                  ))}
                </select>

                <button className="mt-3 h-12 w-full rounded-xl px-4 text-base font-extrabold btn-outline-red">
                  Apply finish
                </button>
              </FilterGroup>
            </form>

            <form action={basePath} method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="page" value={"1"} />
              <input type="hidden" name="fitLevel" value={fitLevel} />

              <input type="hidden" name="brand_cd" value={brandCd} />
              <input type="hidden" name="finish" value={finish} />
              <input type="hidden" name="width" value={widthParam} />
              <input type="hidden" name="boltPattern" value={boltPatternParam} />

              <FilterGroup title="Diameter">
                <select
                  name="diameter"
                  defaultValue={diameterParam}
                  className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-base font-semibold"
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

                <button className="mt-3 h-12 w-full rounded-xl px-4 text-base font-extrabold btn-outline-red">
                  Apply diameter
                </button>
              </FilterGroup>
            </form>

            <form action={basePath} method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="page" value={"1"} />
              <input type="hidden" name="fitLevel" value={fitLevel} />

              <input type="hidden" name="brand_cd" value={brandCd} />
              <input type="hidden" name="finish" value={finish} />
              <input type="hidden" name="diameter" value={diameterParam} />
              <input type="hidden" name="boltPattern" value={boltPatternParam} />

              <FilterGroup title="Width">
                <select
                  name="width"
                  defaultValue={widthParam}
                  className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-base font-semibold"
                >
                  <option value="">All widths</option>
                  {widthBuckets.slice(0, 80).map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.value}{b.count != null ? ` (${b.count})` : ""}
                    </option>
                  ))}
                </select>

                <button className="mt-3 h-12 w-full rounded-xl px-4 text-base font-extrabold btn-outline-red">
                  Apply width
                </button>
              </FilterGroup>
            </form>

            <form action={basePath} method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="page" value={"1"} />
              <input type="hidden" name="fitLevel" value={fitLevel} />

              <input type="hidden" name="brand_cd" value={brandCd} />
              <input type="hidden" name="finish" value={finish} />
              <input type="hidden" name="diameter" value={diameterParam} />
              <input type="hidden" name="width" value={widthParam} />

              <FilterGroup title="Bolt pattern">
                <select
                  name="boltPattern"
                  defaultValue={boltPatternParam}
                  className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-base font-semibold"
                >
                  <option value="">Vehicle bolt pattern</option>
                  {boltPatternBuckets.slice(0, 80).map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.value}{b.count != null ? ` (${b.count})` : ""}
                    </option>
                  ))}
                </select>

                <button className="mt-3 h-12 w-full rounded-xl px-4 text-base font-extrabold btn-outline-red">
                  Apply bolt pattern
                </button>
              </FilterGroup>
            </form>
          </aside>

          <section>
            {/* Sticky workspace header (desktop): stays visible while scrolling results */}
            {/* Only show Step 1/Step 2 package flow when explicitly requested via ?package=1 */}
            {year && make && model && isPackageFlow ? (
              <div className="sticky top-24 z-30 hidden md:block">
                <div className="mx-auto max-w-[980px] rounded-3xl border border-neutral-200 bg-white/95 p-4 backdrop-blur">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4">
                      <div className="text-xs font-semibold text-neutral-600">Step 1</div>
                      <div className="mt-1 text-sm font-extrabold text-neutral-900">Select a wheel to load details</div>
                      <div className="mt-1 text-xs text-neutral-600">Pick a style below—details will appear on the wheel page.</div>
                    </div>

                    <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4">
                      <div className="text-xs font-semibold text-neutral-600">Step 2</div>
                      <div className="mt-1 text-sm font-extrabold text-neutral-900">Add tires</div>
                      <div className="mt-1 text-xs text-neutral-600">We'll show OEM sizes and options that match your vehicle.</div>
                      <div className="mt-3">
                        <Link
                          href={`/tires?${new URLSearchParams({ year, make, model, trim, modification }).toString()}`}
                          className="inline-flex h-10 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-extrabold text-white"
                        >
                          Click here to select tires
                        </Link>
                      </div>
                    </div>
                  </div>

                  {needsTrimNotice ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      Tip: picking a trim/submodel usually improves results (bolt pattern + offset).
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-neutral-600">
              <div>
                Showing {itemsPage.length} styles (page {safePage} of {totalPages})
              </div>

              {hasVehicle ? (
                <div className="flex flex-wrap items-center gap-2">
                  {vehicleCallsForStaggered ? (
                    <>
                      <span className="text-xs font-semibold text-neutral-500">View:</span>
                      {effectiveFitView === "staggered" ? (
                        <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-extrabold text-white">Staggered</span>
                      ) : (
                        <Link
                          href={`${qBase}${brandCd ? `&brand_cd=${encodeURIComponent(brandCd)}` : ""}${finish ? `&finish=${encodeURIComponent(finish)}` : ""}${diameterParam ? `&diameter=${encodeURIComponent(diameterParam)}` : ""}${widthParam ? `&width=${encodeURIComponent(widthParam)}` : ""}${boltPatternParam ? `&boltPattern=${encodeURIComponent(boltPatternParam)}` : ""}&fitView=staggered&page=1`}
                          className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-extrabold text-neutral-900"
                        >
                          Staggered
                        </Link>
                      )}

                      {effectiveFitView === "square" ? (
                        <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-extrabold text-white">Square</span>
                      ) : (
                        <Link
                          href={`${qBase}${brandCd ? `&brand_cd=${encodeURIComponent(brandCd)}` : ""}${finish ? `&finish=${encodeURIComponent(finish)}` : ""}${diameterParam ? `&diameter=${encodeURIComponent(diameterParam)}` : ""}${widthParam ? `&width=${encodeURIComponent(widthParam)}` : ""}${boltPatternParam ? `&boltPattern=${encodeURIComponent(boltPatternParam)}` : ""}&fitView=square&page=1`}
                          className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-extrabold text-neutral-900"
                        >
                          Square
                        </Link>
                      )}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {itemsPage.length ? (
                itemsPage.map((w, idx) => (
                  <WheelsStyleCard
                    selectToTires
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
                    pair={w.pair}
                    specLabel={{
                      boltPattern: (w as any).boltPattern,
                      offset: (w as any).offset,
                    }}
                    finishThumbs={w.finishThumbs}
                    viewParams={{
                      year,
                      make,
                      model,
                      trim,
                      modification,
                      sort,
                      page: String(page),
                    }}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
                  No wheel results. Try clearing filters.
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-neutral-600">
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
