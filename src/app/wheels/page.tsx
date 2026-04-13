import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { WheelsStyleCard } from "@/components/WheelsStyleCard";
import { WheelsGridWithSelection } from "@/components/WheelsGridWithSelection";
import { WheelFilterSidebar } from "@/components/WheelFilterSidebar";
import { GarageWidget } from "@/components/GarageWidget";
import { RecommendedFitmentCard } from "@/components/RecommendedFitmentCard";
import { PackageSummary } from "@/components/PackageSummary";
import { PackageJourneyBar } from "@/components/PackageJourneyBar";
import { FitmentUnavailable, FitmentMediumConfidenceWarning } from "@/components/FitmentUnavailable";
import { type FitmentConfidenceLevel } from "@/components/FitmentConfidenceBadge";
import { VehicleEntryGate } from "@/components/VehicleEntryGate";
import { vehicleSlug } from "@/lib/vehicleSlug";
import { getDisplayTrim } from "@/lib/vehicleDisplay";
import { getClassicFitment } from "@/lib/classic-fitment/classicLookup";
import { buildDiameterOptions, type DiameterOption } from "@/lib/fitment/diameterOptions";
import { groupWheelsBySpec, type WheelVariantInput } from "@/lib/wheels";
import { getIndexingDecision, buildPageIndexingData, getRobotsContent } from "@/lib/seo";
import { SeoContentBlock } from "@/components/SeoContentBlock";
import { type FitmentLevel, type BuildRequirement } from "@/lib/fitment/guidance";
import { filterWheelsForBuildType, type BuildType as BuildTypeEnum } from "@/lib/fitment/buildTypeFilter";
import { BuildStyleToggle } from "@/components/BuildStyleToggle";
import { parseHomepageIntent, getLiftLevelConfig } from "@/lib/homepage-intent";
import { HomepageIntentBar } from "@/components/HomepageIntentBar";
import { LiftLevelSelector } from "@/components/LiftLevelSelector";
import { RearWheelConfigSelector, trackRearWheelConfigPromptShown } from "@/components/RearWheelConfigSelector";
import {
  type RearWheelConfig,
  isDRWCapable,
  needsRearWheelConfigSelection,
  getEffectiveRearWheelConfig,
  parseRearWheelConfigParam,
  canShowResults as canShowRearWheelResults,
} from "@/lib/fitment/rearWheelConfig";
import type { Metadata } from "next";

type Wheel = {
  sku?: string;
  brand?: string;
  brandCode?: string;
  model?: string;
  finish?: string;
  diameter?: string;
  width?: string;
  offset?: string;
  boltPattern?: string; // Bolt pattern for grouping (e.g., "5x114.3")
  centerbore?: string; // Wheel center bore in mm (for hub ring calculation)
  imageUrl?: string;
  price?: number;
  stockQty?: number; // Combined local + global inventory count
  inventoryType?: string; // WheelPros inventory type code (ST, BW, SO, CS, DB, etc.)
  styleKey?: string;
  fitmentClass?: "surefit" | "specfit" | "extended"; // Fitment classification from validation engine
  finishThumbs?: { finish: string; sku: string; imageUrl?: string; price?: number; stockQty?: number; inventoryType?: string }[];
  pair?: {
    staggered: boolean;
    front: { sku: string; diameter?: string; width?: string; offset?: string };
    rear?: { sku: string; diameter?: string; width?: string; offset?: string };
  };
  // Fitment guidance (2026-04-07)
  fitmentGuidance?: {
    level: FitmentLevel;
    levelLabel: string;
    buildRequirement: BuildRequirement;
    buildLabel: string;
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
    abbreviated_finish_desc?: string; // Finish name from WheelPros API
    diameter?: string;
    width?: string;
    offset?: string;
    boltPattern?: string; // Bolt pattern (from TechFeed)
    boltPatternMetric?: string; // Metric bolt pattern (e.g., "5x114.3")
    centerbore?: string; // Wheel center bore in mm (from TechFeed)
  };
  prices?: {
    msrp?: WheelProsPrice[];
  };
  images?: WheelProsImage[];
  inventory?: {
    type?: string;
    localStock?: number;
    globalStock?: number;
  };
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
  // For vehicle-based browsing, prefer fitment-aware search so facets reflect ONLY current results.
  // For browse mode (no vehicle), use DB-first /api/wheels/browse instead of legacy WheelPros proxy.
  const hasVehicle = Boolean(params.year && params.make && params.model);
  const path = hasVehicle ? "/api/wheels/fitment-search" : "/api/wheels/browse";

  const res = await fetch(
    `${getBaseUrl()}${path}?${sp.toString()}`,
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

// Helper to safely convert any value to string (fixes [object Object] bug)
function safeString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (typeof obj.name === "string") return obj.name.trim();
    if (typeof obj.value === "string") return obj.value.trim();
    if (typeof obj.label === "string") return obj.label.trim();
    if (typeof obj.title === "string") return obj.title.trim();
    if (typeof obj.description === "string") return obj.description.trim();
    return "";
  }
  return "";
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

  const year = safeString(Array.isArray(sp.year) ? sp.year[0] : sp.year);
  const make = safeString(Array.isArray(sp.make) ? sp.make[0] : sp.make);
  const model = safeString(Array.isArray(sp.model) ? sp.model[0] : sp.model);

  // PARAM SEPARATION: modification = fitment identity, trim = display label only
  const modificationRaw = safeString(Array.isArray(sp.modification) ? sp.modification[0] : sp.modification);
  const trimRaw = safeString(Array.isArray(sp.trim) ? sp.trim[0] : sp.trim);

  // Resolve canonical modificationId: prefer 'modification' param, fallback to 'trim' if it looks like a modificationId
  let modification = modificationRaw;
  let trimLabel = trimRaw;

  if (!modification && trimRaw) {
    // Check if trim looks like a modificationId (hash or hex slug)
    if (/^s_[a-f0-9]{8}$/.test(trimRaw) || /^[a-f0-9]{10}$/.test(trimRaw)) {
      // Legacy URL using trim as modificationId - migrate it
      modification = trimRaw;
      trimLabel = ""; // Will be resolved below
      console.warn(`[wheels] DEPRECATION: Using 'trim' as modificationId. Migrate to 'modification=${trimRaw}'`);
    }
  }

  // For backward compat, also support plain trim slugs (e.g., "ltz") as modification
  // but only if modification is not set
  if (!modification && trimRaw && !trimRaw.includes(" ")) {
    modification = trimRaw;
  }

  // Alias for places still using 'trim' variable
  // IMPORTANT: Never use modification as display trim - it's a hex ID, not a customer-facing label
  // Only use trimLabel (actual display text) or empty string
  const trim = trimLabel || "";

  // Optional user-supplied wheel filters.
  const diameterParam = (Array.isArray(sp.diameter) ? sp.diameter[0] : sp.diameter) || "";
  const widthParam = (Array.isArray(sp.width) ? sp.width[0] : sp.width) || "";
  const boltPatternParam = (Array.isArray(sp.boltPattern) ? sp.boltPattern[0] : sp.boltPattern) || "";
  const brandCd = (Array.isArray(sp.brand_cd) ? sp.brand_cd[0] : sp.brand_cd) || "";
  const finish = (Array.isArray(sp.finish) ? sp.finish[0] : sp.finish) || "";
  
  // Offset filter - supports multiple values via checkbox selection
  const offsetParamRaw = sp.offset;
  const offsetParams: string[] = Array.isArray(offsetParamRaw) 
    ? offsetParamRaw.filter(Boolean) 
    : (offsetParamRaw ? [offsetParamRaw] : []);

  const priceMinRaw = (Array.isArray(sp.priceMin) ? sp.priceMin[0] : sp.priceMin) || "";
  const priceMaxRaw = (Array.isArray(sp.priceMax) ? sp.priceMax[0] : sp.priceMax) || "";
  const priceMin = priceMinRaw ? Number(String(priceMinRaw)) : null;
  const priceMax = priceMaxRaw ? Number(String(priceMaxRaw)) : null;

  // Staggered setup mode (for staggered-capable vehicles)
  const setupParam = (Array.isArray(sp.setup) ? sp.setup[0] : sp.setup) || "";
  const initialSetupMode = (setupParam === "square" || setupParam === "staggered") ? setupParam : undefined;

  const offsetMinRaw = (Array.isArray(sp.offsetMin) ? sp.offsetMin[0] : sp.offsetMin) || "";
  const offsetMaxRaw = (Array.isArray(sp.offsetMax) ? sp.offsetMax[0] : sp.offsetMax) || "";
  const offsetMinUser = offsetMinRaw ? Number(String(offsetMinRaw)) : null;
  const offsetMaxUser = offsetMaxRaw ? Number(String(offsetMaxRaw)) : null;

  // Fitment level: "oem" (default, strict offset) vs "lifted" (show all offsets for modified vehicles)
  const fitLevelRaw = (Array.isArray(sp.fitLevel) ? sp.fitLevel[0] : sp.fitLevel) || "";
  const fitLevel = String(fitLevelRaw || "oem").trim();

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD TYPE - Guided build style filtering (stock/level/lifted)
  // ═══════════════════════════════════════════════════════════════════════════
  const buildTypeRaw = (Array.isArray(sp.buildType) ? sp.buildType[0] : sp.buildType) || "";
  const buildTypeParam = buildTypeRaw === "stock" || buildTypeRaw === "level" || buildTypeRaw === "lifted" 
    ? buildTypeRaw as BuildTypeEnum 
    : null;

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFTED BUILD CONTEXT
  // ═══════════════════════════════════════════════════════════════════════════
  // Preserve lifted context from URL params (passed from /lifted page)
  const liftedSource = safeString(Array.isArray(sp.liftedSource) ? sp.liftedSource[0] : sp.liftedSource);
  const liftedPreset = safeString(Array.isArray(sp.liftedPreset) ? sp.liftedPreset[0] : sp.liftedPreset);
  const liftedInchesRaw = safeString(Array.isArray(sp.liftedInches) ? sp.liftedInches[0] : sp.liftedInches);
  const liftedInches = liftedInchesRaw ? parseInt(liftedInchesRaw, 10) : 0;
  const liftedTireSizesRaw = safeString(Array.isArray(sp.liftedTireSizes) ? sp.liftedTireSizes[0] : sp.liftedTireSizes);
  const liftedTireSizes = liftedTireSizesRaw ? liftedTireSizesRaw.split(",").filter(Boolean) : [];
  const liftedTireDiaMin = safeString(Array.isArray(sp.liftedTireDiaMin) ? sp.liftedTireDiaMin[0] : sp.liftedTireDiaMin);
  const liftedTireDiaMax = safeString(Array.isArray(sp.liftedTireDiaMax) ? sp.liftedTireDiaMax[0] : sp.liftedTireDiaMax);

  // Lifted wheel diameter recommendations
  const liftedWheelDiaMinRaw = safeString(Array.isArray(sp.liftedWheelDiaMin) ? sp.liftedWheelDiaMin[0] : sp.liftedWheelDiaMin);
  const liftedWheelDiaMaxRaw = safeString(Array.isArray(sp.liftedWheelDiaMax) ? sp.liftedWheelDiaMax[0] : sp.liftedWheelDiaMax);
  const liftedWheelDiaMin = liftedWheelDiaMinRaw ? parseInt(liftedWheelDiaMinRaw, 10) : null;
  const liftedWheelDiaMax = liftedWheelDiaMaxRaw ? parseInt(liftedWheelDiaMaxRaw, 10) : null;
  const liftedPopularWheelSizesRaw = safeString(Array.isArray(sp.liftedPopularWheelSizes) ? sp.liftedPopularWheelSizes[0] : sp.liftedPopularWheelSizes);
  const liftedPopularWheelSizes = liftedPopularWheelSizesRaw
    ? liftedPopularWheelSizesRaw.split(",").map(s => parseInt(s, 10)).filter(n => Number.isFinite(n))
    : [];

  // Lifted build is active when we have valid lifted context from URL params
  const isLiftedBuild = Boolean(liftedSource === "lifted" && liftedPreset && liftedInches > 0);

  if (isLiftedBuild) {
    console.log('[wheels/page] 🚀 LIFTED BUILD DETECTED:', {
      presetId: liftedPreset,
      liftInches: liftedInches,
      tireSizes: liftedTireSizes,
      offsetRange: `${offsetMinUser}mm to ${offsetMaxUser}mm`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REAR WHEEL CONFIG (SRW/DRW) - For DRW-capable HD trucks (3500 class)
  // ═══════════════════════════════════════════════════════════════════════════
  const rearWheelConfigRaw = safeString(Array.isArray(sp.rearWheelConfig) ? sp.rearWheelConfig[0] : sp.rearWheelConfig);
  const rearWheelConfigParam = parseRearWheelConfigParam(rearWheelConfigRaw || null);
  
  // Check if this vehicle needs rear wheel config selection
  const vehicleIsDRWCapable = make && model ? isDRWCapable(make, model) : false;
  const vehicleNeedsRearWheelConfig = make && model ? needsRearWheelConfigSelection(make, model, trim) : false;
  const effectiveRearWheelConfig = make && model 
    ? getEffectiveRearWheelConfig(make, model, trim, rearWheelConfigParam)
    : null;
  
  if (vehicleIsDRWCapable) {
    console.log('[wheels/page] 🛻 DRW-CAPABLE VEHICLE:', {
      make, model, trim,
      paramValue: rearWheelConfigParam,
      needsSelection: vehicleNeedsRearWheelConfig,
      effectiveConfig: effectiveRearWheelConfig,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HOMEPAGE INTENT SYSTEM
  // Only activates when entry=homepage is present in URL params.
  // This provides specialized search flows for users entering from homepage blocks.
  // ═══════════════════════════════════════════════════════════════════════════
  const homepageIntentState = parseHomepageIntent(sp);
  
  // Track if this is a homepage intent lifted build (vs /lifted page flow)
  // Includes: lifted_35, lifted, leveled, lifted_packages
  const liftedIntentIds = ["lifted_35", "lifted", "leveled", "lifted_packages"];
  const isHomepageIntentLiftedBuild = homepageIntentState.isActive && 
    homepageIntentState.config?.liftLevelAdjustable === true;
  
  // Track if this is a street performance intent
  const isStreetPerformanceIntent = homepageIntentState.isActive && 
    homepageIntentState.config?.id === "street_performance";

  // Apply intent-specific offset ranges if:
  // 1. Homepage intent is active
  // 2. User hasn't manually set offset params
  // 3. Intent has resolved offset values
  let effectiveOffsetMinUser = offsetMinUser;
  let effectiveOffsetMaxUser = offsetMaxUser;

  if (homepageIntentState.isActive && homepageIntentState.resolved) {
    const { resolved } = homepageIntentState;
    
    // Only apply intent offsets if user hasn't manually overridden
    if (offsetMinUser === null && resolved.offsetMin !== undefined) {
      effectiveOffsetMinUser = resolved.offsetMin;
    }
    if (offsetMaxUser === null && resolved.offsetMax !== undefined) {
      effectiveOffsetMaxUser = resolved.offsetMax;
    }

    console.log('[wheels/page] 🎯 HOMEPAGE INTENT ACTIVE:', {
      intent: homepageIntentState.config?.id,
      liftLevel: resolved.liftLevel,
      buildType: resolved.buildType,
      offsetRange: `${effectiveOffsetMinUser}mm to ${effectiveOffsetMaxUser}mm`,
    });
  }

  const needsTrimNotice = Boolean(year && make && model && !modification);

  // Only show the guided wheel+tire package UI when explicitly requested.
  // (Wheels-only browsing shouldn't show "Step 1/Step 2" package cards.)
  const packageRaw = (Array.isArray((sp as any).package) ? (sp as any).package[0] : (sp as any).package) || "";
  const isPackageFlow = String(packageRaw).trim() === "1";

  // View filter: staggered vs square. If vehicle is inferred staggered, default to staggered-only.
  const fitViewRaw = (Array.isArray((sp as any).fitView) ? (sp as any).fitView[0] : (sp as any).fitView) || "";
  const fitView = String(fitViewRaw || "").trim();

  // 1) Resolve fitment (bolt pattern, width/offset ranges, etc.)
  // NOTE: WheelPros fitment fallback removed (2026-04-02). All fitment now from internal DB only.
  // Legacy wp: prefixed modifications are stripped and resolved against internal data.
  const cleanModification = modification.startsWith("wp:") ? modification.slice(3) : modification;

  const fitment = year && make && model
    ? await fetchFitment({
        year,
        make,
        model,
        modification: cleanModification || undefined,
      })
    : null;

  const fit = (fitment as any)?.fitment ? (fitment as any).fitment : fitment;
  const hasVehicle = Boolean(year && make && model);
  const bp: string | undefined = hasVehicle ? (boltPatternParam || fit?.boltPattern || undefined) : undefined;

  // Resolve modificationId to display label if trim looks like a hash ID
  let resolvedTrimLabel: string | undefined;
  if (trim && /^s_[a-f0-9]{8}$/.test(trim) && year && make && model) {
    // Fetch trims to resolve modificationId → label
    try {
      const trimsRes = await fetch(
        `${getBaseUrl()}/api/vehicles/trims?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`,
        { cache: "force-cache" } // Cache aggressively since supplements are stable
      );
      if (trimsRes.ok) {
        const trimsData = await trimsRes.json();
        const match = trimsData?.results?.find((t: any) => t.modificationId === trim || t.value === trim);
        if (match?.label) {
          resolvedTrimLabel = match.label;
        }
      }
    } catch {
      // Ignore lookup errors - fall back to other methods
    }
  }

  // Build display-friendly trim label (never shows engine text like "5.7i")
  const _submodelCandidate = fit?.vehicle?.trim || fit?.trim || (fitment as any)?.vehicle?.trim;
  const displayTrim = getDisplayTrim({
    trim: resolvedTrimLabel || trim, // Use resolved label if available
    submodel: _submodelCandidate,
  });

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
  // NOTE: The actual staggered determination now comes from fitment-search response
  //       (after we call fetchWheels below). This initial value is a fallback.
  let vehicleCallsForStaggered = Boolean(fit?.staggered?.isStaggered || fit?.staggered === true);

  // Default to showing all wheels (no fitView filter). User can opt into staggered view.
  // NOTE: The actual effectiveFitView is determined AFTER we know if vehicle supports staggered.
  // We'll update this after fetching wheel data.
  let effectiveFitView = fitView || "";

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
  // NOTE: The fitment engine (fitment-search endpoint) now handles all offset validation
  // through the surefit/specfit/extended classification. We only pass offset filters
  // when the USER explicitly sets them (via offset filter UI or fitLevel=lifted).
  // This ensures we show ALL valid wheels (specfit + extended + surefit) instead of
  // only those within the narrow OEM offset range.

  // Only pass user-explicit offset filters (not auto-derived OEM range)
  // Use effective offset values (may include homepage intent defaults)
  const minOffsetFinal = effectiveOffsetMinUser != null ? String(effectiveOffsetMinUser) : undefined;
  const maxOffsetFinal = effectiveOffsetMaxUser != null ? String(effectiveOffsetMaxUser) : undefined;

  // IMPORTANT: Don't auto-restrict diameter/width unless the user explicitly chose them.
  // Doing so can collapse results (e.g., WheelPros shows many fitments/sizes).
  // Fetch enough results to show all valid wheels (fitment engine already filters to ~200-300 for most vehicles)
  const upstreamPageSize = 500;

  const baseWheelProsParams: Record<string, string | undefined> = {
    // Vehicle info (triggers fitment-search endpoint when present)
    year: year || undefined,
    make: make || undefined,
    model: model || undefined,
    trim: trim || undefined,
    // modificationId is the canonical fitment identity
    modification: modification || undefined,
    // SRW/DRW selection for HD trucks
    rearWheelConfig: effectiveRearWheelConfig || undefined,
    // Sort order for results (price_asc, price_desc, or default relevance)
    sort: sort || undefined,

    page: String(page),
    // Fetch enough SKUs that grouping by style doesn't collapse to only a couple cards,
    // but keep it reasonable for performance.
    pageSize: String(upstreamPageSize),
    // Include properties so we have wheel center bore for required hub ring calculation.
    fields: "inventory,price,images,properties",
    priceType: "msrp",
    // NOTE: WheelPros docs say company is required for pricing, but in practice passing
    // company can zero results for some accounts/environments. Omit for now.
    currencyCode: "USD",

    boltPattern: bp,
    centerbore: cb,
    // For size-only searches (no vehicle), WheelPros filters are unreliable; fetch broad and filter client-side.
    diameter: hasVehicle && diameterParam ? diameter : (hasVehicle && widthParam ? diameter : undefined),
    width: hasVehicle && widthParam ? width : undefined,

    // Facet filters (WheelPros taxonomy)
    brand_cd: brandCd || undefined,
    abbreviated_finish_desc: finish || undefined,

    // For fitment-search endpoint (we'll filter offsets server-side so facets match)
    offsetMin: minOffsetFinal,
    offsetMax: maxOffsetFinal,

    // Legacy WP params (still used when browsing without a vehicle)
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

    // Extract staggered info from fitment-search response (authoritative source)
    if (data?.fitment?.staggered) {
      vehicleCallsForStaggered = Boolean(data.fitment.staggered.isStaggered);
    }
  }

  // Capture staggered debug info from fitment-search response
  const staggeredDebug = data?.fitment?.staggered || null;

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCKED STATE (Confidence too low to show wheels)
  // ═══════════════════════════════════════════════════════════════════════════
  // When the fitment engine doesn't have enough confidence in the data,
  // it returns blocked=true and we should NOT show wheel results.
  const isBlocked = Boolean(data?.blocked);
  const isProfileNotFound = Boolean(data?.profileNotFound);
  const blockReason = data?.blockReason || null;
  const blockSuggestions: string[] = Array.isArray(data?.suggestions) ? data.suggestions : [];

  // Extract confidence level and UI metadata
  const fitmentConfidence = (data?.fitment?.confidence || "none") as FitmentConfidenceLevel;
  const confidenceReasons: string[] = Array.isArray(data?.fitment?.confidenceReasons)
    ? data.fitment.confidenceReasons
    : [];
  const confidenceWarningMessage = data?.fitment?.ui?.warningMessage || null;

  // Capture bolt pattern from fitment-search response (more reliable than separate fitment call)
  const fitmentSearchBp = data?.fitment?.envelope?.boltPattern;

  // ═══════════════════════════════════════════════════════════════════════════
  // VEHICLE TYPE - Used for build style toggle visibility
  // ═══════════════════════════════════════════════════════════════════════════
  // Only show build style toggle for trucks/SUVs where leveling/lifting makes sense
  const fitmentVehicleType = (data?.fitment?.vehicleType as "truck" | "suv" | "car" | undefined) || undefined;

  // ═══════════════════════════════════════════════════════════════════════════
  // DB-FIRST FITMENT PROFILE (Primary Source of Truth)
  // ═══════════════════════════════════════════════════════════════════════════
  // dbProfile is the canonical fitment data from our own database.
  // It takes precedence over legacy envelope data when present.
  const dbProfile = data?.fitment?.dbProfile || null;

  if (dbProfile) {
    console.log('[wheels/page] ✅ DB PROFILE CONSUMED:', {
      modificationId: dbProfile.modificationId,
      displayTrim: dbProfile.displayTrim,
      boltPattern: dbProfile.boltPattern,
      centerBoreMm: dbProfile.centerBoreMm,
      oemWheelSizes: dbProfile.oemWheelSizes?.length || 0,
      oemTireSizes: dbProfile.oemTireSizes,
      offsetRange: dbProfile.offsetRange,
      source: dbProfile.source,
    });
  } else if (hasVehicle) {
    console.log('[wheels/page] ⚠️ NO DB PROFILE - falling back to legacy envelope');
  }

  // Use dbProfile values as primary, fallback to legacy envelope
  const primaryBoltPattern = dbProfile?.boltPattern || fitmentSearchBp || bp;
  const primaryCenterBore = dbProfile?.centerBoreMm || data?.fitment?.envelope?.centerBore;
  const primaryOemTireSizes = dbProfile?.oemTireSizes || [];
  const primaryModificationId = dbProfile?.modificationId || modification;

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD STYLE TOGGLE VISIBILITY
  // ═══════════════════════════════════════════════════════════════════════════
  // Determine if this vehicle supports build style selection (Stock/Level/Lifted)
  // TRUE for: trucks, SUVs, 6-lug or 8-lug bolt patterns (indicates truck/SUV)
  // FALSE for: cars, sedans, coupes, performance vehicles, EVs
  const vehicleSupportsBuildStyles = (() => {
    // Explicit truck/SUV type from API
    if (fitmentVehicleType === "truck" || fitmentVehicleType === "suv") {
      return true;
    }
    // Fallback: check bolt pattern (6-lug or 8-lug = almost always truck/SUV)
    if (primaryBoltPattern && (primaryBoltPattern.startsWith("6x") || primaryBoltPattern.startsWith("8x"))) {
      return true;
    }
    // Otherwise, assume car (hide build style toggle)
    return false;
  })();

  // Clear staggered fitView if vehicle doesn't support staggered
  // (prevents confusion when someone shares a URL with fitView=staggered for a non-staggered vehicle)
  if (!vehicleCallsForStaggered && effectiveFitView === "staggered") {
    effectiveFitView = "";
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
    // Extract finish (try multiple possible field names)
    const finish = it?.techfeed?.finish || it?.properties?.abbreviated_finish_desc || it?.properties?.finish;
    // Extract model name from title if properties.model is empty
    // Title format: "MODEL SIZE BOLTPATTERN CB OFFSET FINISH" e.g. "GRZ 20X10 5X112/120 72 +50 M-BLK"
    // We want just the model name (e.g. "GRZ") for style matching
    let model = it?.properties?.model;
    if (!model && it?.title) {
      // Extract model name: everything before the first size pattern (e.g., "20X10")
      const sizeMatch = it.title.match(/^(.+?)\s+\d+[Xx]\d/);
      model = sizeMatch ? sizeMatch[1].trim() : it.title.split(' ')[0];
    }
    const diameter = it?.properties?.diameter ? String(it.properties.diameter) : undefined;
    const width = it?.properties?.width ? String(it.properties.width) : undefined;
    const offset = it?.properties?.offset ? String(it.properties.offset) : undefined;
    // Bolt pattern for grouping (prefer metric format, e.g., "5x114.3")
    const boltPattern = it?.properties?.boltPatternMetric || it?.properties?.boltPattern || undefined;
    // Wheel center bore for hub ring calculation (from TechFeed via fitment-search API)
    const centerbore = it?.properties?.centerbore ? String(it.properties.centerbore) : undefined;

    const msrp = it?.prices?.msrp;
    const firstPrice = Array.isArray(msrp) ? msrp[0] : undefined;
    const price = firstPrice?.currencyAmount != null ? Number(firstPrice.currencyAmount) : undefined;

    const img0 = Array.isArray(it?.images) ? it.images[0] : undefined;
    const imageUrl = img0?.imageUrlLarge || img0?.imageUrlMedium || img0?.imageUrlOriginal || undefined;

    const styleKey = it?.techfeed?.style || undefined;

    // Extract fitmentClass from validation engine (from fitment-search endpoint)
    const fitmentValidation = (it as any)?.fitmentValidation;
    const fitmentClass = fitmentValidation?.fitmentClass as Wheel["fitmentClass"] | undefined;

    // Extract inventory counts (local + global) and type
    const inventory = it?.inventory;
    const localStock = typeof inventory?.localStock === "number" ? inventory.localStock : 0;
    const globalStock = typeof inventory?.globalStock === "number" ? inventory.globalStock : 0;
    const stockQty = localStock + globalStock;
    const inventoryType = typeof inventory?.type === "string" ? inventory.type.toUpperCase() : undefined;

    // Extract staggered pair info from fitment-search API response
    const pair = (it as any)?.pair;

    // Extract fitment guidance from API response (2026-04-07)
    const fitmentGuidanceRaw = (it as any)?.fitmentGuidance;
    const fitmentGuidance = fitmentGuidanceRaw ? {
      level: fitmentGuidanceRaw.level as FitmentLevel,
      levelLabel: fitmentGuidanceRaw.levelLabel || "",
      buildRequirement: fitmentGuidanceRaw.buildRequirement as BuildRequirement,
      buildLabel: fitmentGuidanceRaw.buildLabel || "",
    } : undefined;

    return {
      sku: it?.sku,
      brand,
      brandCode,
      model,
      finish,
      diameter,
      width,
      offset,
      boltPattern,
      centerbore,
      imageUrl,
      price: typeof price === "number" && Number.isFinite(price) ? price : undefined,
      stockQty: stockQty > 0 ? stockQty : undefined,
      inventoryType,
      styleKey,
      fitmentClass,
      pair,
      fitmentGuidance,
    };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WHEEL GROUPING - Deduplicate by size/spec, merge finishes
  // ═══════════════════════════════════════════════════════════════════════════
  // Group wheels by: brand + model + diameter + width + bolt pattern + offset + centerbore
  // Same specs → merge into one card with finish options
  // Different specs → separate cards
  const grouped: Wheel[] = groupWheelsBySpec(itemsUnsorted as WheelVariantInput[]).map((g) => ({
    sku: g.sku,
    brand: g.brand,
    brandCode: g.brandCode,
    model: g.model,
    finish: g.selectedFinish,
    diameter: g.diameter,
    width: g.width,
    offset: g.offset,
    boltPattern: g.boltPattern,
    centerbore: g.centerbore,
    imageUrl: g.imageUrl,
    price: g.price,
    stockQty: g.stockQty,
    inventoryType: g.inventoryType,
    styleKey: g.styleKey,
    fitmentClass: g.fitmentClass,
    pair: g.pair,
    finishThumbs: g.finishOptions,
    fitmentGuidance: g.fitmentGuidance,
  }));

  // Sort by fitmentClass first (surefit > specfit > extended), then by user's sort preference
  const fitmentClassRank = (fc: Wheel["fitmentClass"]) => {
    if (fc === "surefit") return 0;
    if (fc === "specfit") return 1;
    if (fc === "extended") return 2;
    return 3; // unknown
  };

  const items: Wheel[] = [...grouped].sort((a, b) => {
    // Primary sort: fitmentClass (surefit first, then specfit, then extended)
    const fitRankDiff = fitmentClassRank(a.fitmentClass) - fitmentClassRank(b.fitmentClass);
    if (fitRankDiff !== 0) return fitRankDiff;

    // Secondary sort: user's preference (price, brand, etc.)
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

  // Show ALL non-excluded results (don't filter by image availability).
  // Wheels without images will show a placeholder; fitmentClass controls sort order, not visibility.
  const itemsFinal0 = items;

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

  // NOTE: Offset filtering uses checkbox selection (multiple values).
  // User can select specific offsets from the available facets.
  // This replaces the old min/max range approach for better UX.
  const itemsFilteredOffset = offsetParams.length > 0
    ? itemsFilteredBasic.filter((w) => {
        const raw = String(w.offset || "").trim();
        if (!raw) return false;
        // Match if wheel's offset is in the selected offsets list
        return offsetParams.includes(raw);
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

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD TYPE FILTERING
  // ═══════════════════════════════════════════════════════════════════════════
  // Apply build type filtering to rank/prioritize matching wheels
  // NOTE: This does NOT hard-hide wheels; it ranks matching ones higher
  const oemEnvelope = {
    minDiameter: diaRange?.[0] ?? 16,
    maxDiameter: diaRange?.[1] ?? 20,
    minWidth: widthRange?.[0] ?? 6,
    maxWidth: widthRange?.[1] ?? 8,
    minOffset: offRange?.[0] ?? 30,
    maxOffset: offRange?.[1] ?? 50,
  };

  // Apply build type filter (ranks matching wheels higher, optionally filters for stock mode)
  // For trucks, we try strict filter first but fall back to non-strict if it returns 0 results
  // (Heavy-duty trucks often have no "stock-friendly" aftermarket wheels)
  let itemsFilteredBuildType = filterWheelsForBuildType(
    itemsFilteredPrice,
    buildTypeParam,
    oemEnvelope,
    { strictFilter: buildTypeParam === "stock" } // Stock mode uses strict filter
  );
  
  // Fallback: if strict stock filter returns 0 results but we have wheels, relax the filter
  const stockFilterRelaxed = buildTypeParam === "stock" && 
    itemsFilteredBuildType.length === 0 && 
    itemsFilteredPrice.length > 0;
  
  if (stockFilterRelaxed) {
    // Re-run without strict filter - just rank stock-friendly higher
    itemsFilteredBuildType = filterWheelsForBuildType(
      itemsFilteredPrice,
      buildTypeParam,
      oemEnvelope,
      { strictFilter: false }
    );
  }

  // Use fast browse results if available, otherwise use processed WheelPros results
  const itemsFinal = useFastBrowse && fastItems.length > 0
    ? fastItems
    : (effectiveFitView === "staggered"
        ? itemsFilteredBuildType.filter((w) => Boolean(w.pair?.staggered))
        : effectiveFitView === "square"
          ? itemsFilteredBuildType.filter((w) => !w.pair?.staggered)
          : itemsFilteredBuildType);

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

  // Debug: fitmentClass breakdown for rendered results
  const fitmentClassCounts = itemsFinal.reduce((acc, w) => {
    const fc = w.fitmentClass || "unknown";
    acc[fc] = (acc[fc] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Log in development
  if (process.env.NODE_ENV === "development") {
    console.log("[wheels/page] FitmentClass breakdown:", fitmentClassCounts);
    console.log("[wheels/page] Sort order confirmed: surefit → specfit → extended → unknown");
  }

  // Recommended wheels selection: curated top picks for the vehicle
  const recommendedWheels: Wheel[] = (() => {
    if (!hasVehicle || itemsFinal.length === 0) return [];

    // Common diameters for trucks (18-22) - adjust based on vehicle type
    const preferredDiameters = [18, 19, 20, 21, 22];

    // Score each wheel for recommendation
    const scored = itemsFinal
      .filter((w) => w.imageUrl) // Only recommend wheels with images
      .filter((w) => {
        // EXCLUDE aggressive fitment from Top Picks
        // Top Picks should only show: perfect, recommended, popular
        const level = w.fitmentGuidance?.level;
        return level !== "aggressive";
      })
      .map((w) => {
        let score = 0;

        // For staggered vehicles, STRONGLY prefer wheels with pair data
        // This ensures Top Picks shows actual staggered sets
        if (vehicleCallsForStaggered && w.pair?.staggered) {
          score += 200; // Highest priority for staggered pairs
        }

        // Fitment guidance priority (new system - 2026-04-07)
        const fgLevel = w.fitmentGuidance?.level;
        if (fgLevel === "perfect") score += 150;
        else if (fgLevel === "recommended") score += 100;
        else if (fgLevel === "popular") score += 50;
        // aggressive is already filtered out above

        // Fitment class priority (legacy system - still useful for bolt pattern match)
        if (w.fitmentClass === "surefit") score += 100;
        else if (w.fitmentClass === "specfit") score += 50;
        else if (w.fitmentClass === "extended") score += 10;

        // Prefer common diameters
        const dia = Number(String(w.diameter || "").trim());
        if (Number.isFinite(dia) && preferredDiameters.includes(Math.round(dia))) {
          score += 20;
        }

        // Prefer mid-range price ($200-$600 sweet spot)
        const price = typeof w.price === "number" ? w.price : 0;
        if (price >= 200 && price <= 600) score += 15;
        else if (price >= 100 && price <= 800) score += 5;

        // Slight bonus for having multiple finishes (popular styles)
        if (w.finishThumbs && w.finishThumbs.length > 2) score += 5;

        return { wheel: w, score };
      })
      .sort((a, b) => b.score - a.score);

    // Take top 8, ensuring variety (avoid same brand twice in a row)
    const picks: Wheel[] = [];
    const usedBrands = new Set<string>();

    for (const { wheel } of scored) {
      if (picks.length >= 8) break;

      const brand = String(wheel.brand || wheel.brandCode || "").toLowerCase();

      // Allow same brand only if we have fewer than 4 picks or it's been used only once
      const brandCount = picks.filter(p =>
        String(p.brand || p.brandCode || "").toLowerCase() === brand
      ).length;

      if (brandCount < 2) {
        picks.push(wheel);
      }
    }

    // If we don't have enough, fill with remaining top scored
    if (picks.length < 6) {
      for (const { wheel } of scored) {
        if (picks.length >= 8) break;
        if (!picks.includes(wheel)) {
          picks.push(wheel);
        }
      }
    }

    return picks;
  })();

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
  // Sort offset buckets numerically (smallest/most negative to largest/most positive)
  // IMPORTANT: Recalculate counts from grouped results (not raw SKUs) so facet counts match displayed cards
  const offsetBucketsRaw = buckets("offset");
  const offsetBuckets = (() => {
    // Count offsets from grouped/filtered results (itemsFilteredBasic = after grouping + diameter/width filters)
    const groupedOffsetCounts = new Map<string, number>();
    for (const w of itemsFilteredBasic) {
      const off = String(w.offset || "").trim();
      if (off) {
        groupedOffsetCounts.set(off, (groupedOffsetCounts.get(off) || 0) + 1);
      }
    }
    
    // Update counts in offset buckets, filter out zeros
    return offsetBucketsRaw
      .map((b: { value: string; count?: number }) => ({
        value: b.value,
        count: groupedOffsetCounts.get(b.value) || 0,
      }))
      .filter((b: { value: string; count: number }) => b.count > 0)
      .sort((a: { value: string; count: number }, b: { value: string; count: number }) => {
        const aNum = parseFloat(a.value);
        const bNum = parseFloat(b.value);
        return aNum - bNum;
      });
  })();
  const boltPatternBuckets = buckets("bolt_pattern_metric");

  // ═══════════════════════════════════════════════════════════════════════════
  // FITMENT DIAMETER CHIPS - Classic vs Modern
  // ═══════════════════════════════════════════════════════════════════════════
  // Fetch classic fitment data to determine if this is a classic vehicle
  let isClassicVehicle = false;
  let classicStockDiameter: number | null = null;
  let classicUpsizeRange: [number, number] = [15, 20];

  if (hasVehicle) {
    try {
      const classicData = await getClassicFitment(Number(year), make, model);
      if (classicData?.isClassicVehicle) {
        isClassicVehicle = true;
        classicStockDiameter = classicData.stockReference?.wheelDiameter ?? null;
        const recRange = classicData.recommendedRange?.diameter;
        if (recRange) {
          classicUpsizeRange = [recRange.min ?? 15, Math.max(recRange.max ?? 18, 20)];
        }
        console.log(`[wheels/page] 🏎️ CLASSIC VEHICLE: ${year} ${make} ${model}`);
        console.log(`  Stock diameter: ${classicStockDiameter}"`);
        console.log(`  Upsize range: ${classicUpsizeRange[0]}" - ${classicUpsizeRange[1]}"`);
      }
    } catch (err) {
      console.warn("[wheels/page] Classic fitment check failed:", err);
    }
  }

  // Build fitment-valid diameter options
  // For classic: stock + upsize range (e.g., 14-20")
  // For modern: OEM wheel sizes from dbProfile + upsizes with inventory

  // Get OEM wheel sizes from dbProfile
  const oemWheelSizes = hasVehicle
    ? (dbProfile?.oemWheelSizes || []) as Array<{ diameter?: number; width?: number }>
    : [];

  // Get stock diameters (smallest OEM diameter is considered "stock")
  const stockDiameters: number[] = [];
  if (isClassicVehicle && classicStockDiameter) {
    stockDiameters.push(classicStockDiameter);
  } else {
    // For modern vehicles, extract from OEM sizes
    for (const size of oemWheelSizes) {
      if (size.diameter && Number.isFinite(size.diameter)) {
        const dia = Math.round(size.diameter);
        if (!stockDiameters.includes(dia)) {
          stockDiameters.push(dia);
        }
      }
    }
  }

  // Effective stock diameter for display (smallest stock diameter)
  const effectiveStockDiameter = classicStockDiameter ?? (stockDiameters.length > 0 ? Math.min(...stockDiameters) : null);

  const fitmentDiameterOptions: DiameterOption[] = (() => {
    if (!hasVehicle) return [];

    return buildDiameterOptions({
      isClassicVehicle,
      isLiftedBuild,
      stockDiameters,
      classicUpsizeRange: isClassicVehicle ? classicUpsizeRange : undefined,
      liftedWheelDiaMin,
      liftedWheelDiaMax,
      liftedPopularWheelSizes,
      oemWheelSizes,
      inventoryFacets: diameterBuckets,
    });
  })();

  const basePath = year && make && model ? `/wheels/v/${vehicleSlug(year, make, model)}` : "/wheels";

  // URL construction: use 'modification' for fitment identity, omit 'trim' (legacy)
  // IMPORTANT: buildType is preserved through all filter/pagination changes
  const qBase = `${basePath}?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}${modification ? `&modification=${encodeURIComponent(modification)}` : ""}${sort ? `&sort=${encodeURIComponent(sort)}` : ""}${effectiveFitView ? `&fitView=${encodeURIComponent(effectiveFitView)}` : ""}${fitLevel !== "oem" ? `&fitLevel=${encodeURIComponent(fitLevel)}` : ""}${buildTypeParam ? `&buildType=${encodeURIComponent(buildTypeParam)}` : ""}`;

  // Lifted preset display name for UI
  const liftedPresetLabel = liftedPreset === "daily" ? "Daily Driver" : liftedPreset === "offroad" ? "Off-Road" : liftedPreset === "extreme" ? "Extreme" : liftedPreset;

  // ═══════════════════════════════════════════════════════════════════════════
  // SEO INDEXING DECISION
  // ═══════════════════════════════════════════════════════════════════════════
  // Determine whether this page should be indexed based on content quality
  const seoDecision = getIndexingDecision(buildPageIndexingData({
    pageType: "wheels",
    products: itemsFinal.map(w => ({ imageUrl: w.imageUrl, price: w.price })),
    year,
    make,
    model,
    trim,
    modification,
    path: basePath,
    fitmentConfidence: fitmentConfidence as "high" | "medium" | "low" | "none" | undefined,
  }));
  
  const robotsContent = getRobotsContent(seoDecision);
  
  // Log SEO decision in development
  if (process.env.NODE_ENV === "development") {
    console.log("[wheels/page] SEO Decision:", {
      noindex: seoDecision.noindex,
      reason: seoDecision.reason,
      canonical: seoDecision.canonicalUrl,
      robots: robotsContent,
      productCount: itemsFinal.length,
      productsWithImages: itemsFinal.filter(w => w.imageUrl).length,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VEHICLE ENTRY GATE - Show YMM selector when no vehicle context
  // Prevents showing empty product grids and guides users into vehicle selection
  // ═══════════════════════════════════════════════════════════════════════════
  if (!hasVehicle) {
    return (
      <main className="bg-neutral-50">
        <VehicleEntryGate productType="wheels" packageFlow={isPackageFlow} />
      </main>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REAR WHEEL CONFIG GATE - For DRW-capable HD trucks
  // Must select SRW or DRW before showing wheel results
  // ═══════════════════════════════════════════════════════════════════════════
  if (vehicleNeedsRearWheelConfig && !effectiveRearWheelConfig) {
    return (
      <main className="bg-neutral-50">
        {/* Package Journey Bar */}
        <PackageJourneyBar
          currentStep="wheels"
          vehicle={{ year, make, model }}
        />
        
        <div className="mx-auto max-w-screen-2xl px-4 py-8">
          <div className="max-w-2xl mx-auto">
            {/* Vehicle header */}
            <div className="mb-6">
              <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">
                {year} {make} {model}
              </h1>
              {displayTrim && (
                <p className="mt-1 text-sm text-neutral-600">{displayTrim}</p>
              )}
            </div>
            
            {/* Rear Wheel Config Selector */}
            <RearWheelConfigSelector
              selectedConfig={rearWheelConfigParam}
              inferredConfig={null}
              vehicle={{ year, make, model, trim: displayTrim }}
              basePath="/wheels"
            />
            
            {/* Info about why we're asking */}
            <div className="mt-6 rounded-xl bg-neutral-100 p-4">
              <h4 className="font-semibold text-neutral-800 text-sm">Why are we asking?</h4>
              <p className="mt-1 text-xs text-neutral-600">
                The {model} is available with both single rear wheel (SRW) and dual rear wheel (DRW/Dually) configurations. 
                These have different wheel bolt patterns and sizes, so we need to know which setup you have to show the correct fitment.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      {/* TODO: Move robots/canonical to generateMetadata export for proper SEO handling */}
      
      <main className="bg-neutral-50">
      {/* ═══════════════════════════════════════════════════════════════════════
          PACKAGE JOURNEY BAR - Guides user through wheel + tire flow
          ═══════════════════════════════════════════════════════════════════════ */}
      {hasVehicle ? (
        <PackageJourneyBar
          currentStep="wheels"
          vehicle={{
            year,
            make,
            model,
          }}
        />
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════════
          HOMEPAGE INTENT BAR - Shows intent-specific chips/toggles
          Only renders when entry=homepage + valid intent is in URL
          ═══════════════════════════════════════════════════════════════════════ */}
      {hasVehicle && homepageIntentState.isActive ? (
        <HomepageIntentBar
          intentState={homepageIntentState}
          basePath={basePath}
          vehicleSupportsStaggered={vehicleCallsForStaggered}
        />
      ) : null}

      <div className="mx-auto max-w-screen-2xl px-4 py-8">
        {/* Lifted Build Context Banner */}
        {isLiftedBuild && hasVehicle ? (
          <div className="mb-4 rounded-2xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-xl">🚀</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-amber-900">Lifted Build Mode</span>
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
                    {liftedInches}" {liftedPresetLabel}
                  </span>
                </div>
                <p className="mt-1 text-sm text-amber-800">
                  Showing wheels with offset range for your {liftedInches}" lift ({offsetMinUser ?? -20}mm to {offsetMaxUser ?? 0}mm).
                </p>
                {liftedTireSizes.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-xs text-amber-700">Recommended tires:</span>
                    {liftedTireSizes.slice(0, 3).map((size) => (
                      <span key={size} className="rounded-lg bg-white/80 border border-amber-200 px-2 py-1 text-xs font-semibold text-amber-900">
                        {size}
                      </span>
                    ))}
                    {liftedTireSizes.length > 3 ? (
                      <span className="text-xs text-amber-700">+{liftedTireSizes.length - 3} more</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
              Wheels
            </h1>
            <p className="mt-1 text-sm text-neutral-700">
              {year && make && model
                ? `Showing wheels for ${year} ${make} ${model}${displayTrim ? ` ${displayTrim}` : ""}.`
                : "Select your vehicle in the header to filter wheels."}
            </p>

            {/* Unified Vehicle Summary - merges vehicle info + fitment confidence into one block */}
            {year && make && model ? (
              <div className="mt-3 inline-flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-2.5">
                {/* Vehicle info with verification checkmark */}
                <div className="flex items-center gap-2">
                  <span className="text-green-600 text-sm">✓</span>
                  <span className="text-sm font-extrabold text-neutral-900">
                    {year} {make} {model}
                    {displayTrim ? ` ${displayTrim}` : ""}
                  </span>
                </div>
                {/* Fitment badges - combined */}
                <div className="flex items-center gap-2">
                  {hasVehicle && !isBlocked && !data?.error && fitmentConfidence === "high" ? (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">
                      Verified Fit
                    </span>
                  ) : hasVehicle && !isBlocked && !data?.error && fitmentConfidence === "medium" ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                      Good Fit
                    </span>
                  ) : null}
                  {vehicleCallsForStaggered ? (
                    <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700">
                      Staggered
                    </span>
                  ) : null}
                  {effectiveRearWheelConfig ? (
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                      {effectiveRearWheelConfig === 'drw' ? 'Dually (DRW)' : 'SRW'}
                    </span>
                  ) : null}
                  {primaryBoltPattern ? (
                    <span className="text-xs text-neutral-500">{primaryBoltPattern}</span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {/* Debug: show staggered fitment info (dev only) */}
            {year && make && model && staggeredDebug && process.env.NODE_ENV === "development" ? (
              <div className="mt-2 rounded-lg bg-neutral-100 px-3 py-2 text-[10px] font-mono text-neutral-600">
                <span className="font-bold">Staggered:</span> {staggeredDebug.isStaggered ? "YES" : "NO"} - {staggeredDebug.reason}
                {staggeredDebug.frontSpec ? (
                  <> | Front: {staggeredDebug.frontSpec.diameter}&quot;×{staggeredDebug.frontSpec.width}&quot; ET{staggeredDebug.frontSpec.offset}</>
                ) : null}
                {staggeredDebug.rearSpec ? (
                  <> | Rear: {staggeredDebug.rearSpec.diameter}&quot;×{staggeredDebug.rearSpec.width}&quot; ET{staggeredDebug.rearSpec.offset}</>
                ) : null}
              </div>
            ) : null}
            {year && make && model ? (
              <>
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
                        href={`/tires?${new URLSearchParams(Object.fromEntries(Object.entries({ year, make, model, modification }).filter(([,v]) => v))).toString()}`}
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

          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-500">Show me</span>
            <AutoSubmitSelect
              name="sort"
              defaultValue={sort}
              className="h-10 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold"
              options={[
                { value: "price_asc", label: "Price: Low to High" },
                { value: "price_desc", label: "Price: High to Low" },
                { value: "brand_asc", label: "Brand: A to Z" },
              ]}
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            FITMENT ERROR: Show FitmentUnavailable when vehicle isn't found
            ═══════════════════════════════════════════════════════════════════════ */}
        {data?.error && hasVehicle && (String(data.error).includes("fitment") || String(data.error).includes("profile") || data?.resolutionPath === "invalid") ? (
          <div className="mt-5">
            <FitmentUnavailable
              vehicle={{ year, make, model, trim: displayTrim }}
              blockReason={data.importError || String(data.error)}
              suggestions={[
                "This vehicle may not be in our fitment database",
                "Try selecting a different trim level if available",
                "Contact us at (248) 332-4120 for manual fitment lookup",
              ]}
              showAlternatives={true}
            />
          </div>
        ) : data?.error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Wheel search error: {String(data.error).slice(0, 500)}
            <div className="mt-2 text-xs text-red-800">
              (We may need to adjust the Wheel Pros query parameter names.)
            </div>
          </div>
        ) : null}

        {/* ═══════════════════════════════════════════════════════════════════════
            BLOCKED STATE: Show FitmentUnavailable when confidence too low OR vehicle not found
            ═══════════════════════════════════════════════════════════════════════ */}
        {isBlocked && hasVehicle && !data?.error ? (
          <div className="mt-5">
            <FitmentUnavailable
              vehicle={{ year, make, model, trim: displayTrim }}
              blockReason={blockReason}
              suggestions={blockSuggestions.length > 0 ? blockSuggestions : (isProfileNotFound ? [
                "Contact us for assistance with your specific vehicle",
                "Check back soon - we're constantly adding new vehicles",
                "Try a different model year if available",
              ] : undefined)}
              confidenceReasons={confidenceReasons}
              showAlternatives={true}
              variant={isProfileNotFound ? "not-found" : "blocked"}
            />
          </div>
        ) : null}

        {/* ═══════════════════════════════════════════════════════════════════════
            MEDIUM CONFIDENCE WARNING: Show warning banner but still display results
            ═══════════════════════════════════════════════════════════════════════ */}
        {!isBlocked && fitmentConfidence === "medium" && hasVehicle && confidenceWarningMessage ? (
          <div className="mt-5">
            <FitmentMediumConfidenceWarning message={confidenceWarningMessage} />
          </div>
        ) : null}

        {/* Main content grid - only show if NOT blocked */}
        {!isBlocked ? (
        <div className="mt-5 grid gap-6 md:grid-cols-[340px_1fr]">
          <aside className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 md:block">
            {/* Package Summary - shows when building a package */}
            <div className="mb-4">
              <PackageSummary variant="sidebar" showCheckout={true} />
            </div>

            {year && make && model ? (
              <div className="mb-4">
                <RecommendedFitmentCard fitment={{ year, make, model, trim, modification }} productType="wheels" setupMode={initialSetupMode || "staggered"} />
              </div>
            ) : null}

            {/* Wheel Filter Sidebar - client component with checkboxes */}
            <WheelFilterSidebar
              data={{
                // URL state (current selections)
                brands: brandCd ? [brandCd] : [],
                finishes: finish ? [finish] : [],
                diameters: diameterParam ? [diameterParam] : [],
                widths: widthParam ? [widthParam] : [],
                offsets: offsetParams,
                priceMin: priceMin,
                priceMax: priceMax,
                boltPattern: boltPatternParam || "",
                
                // Available options with counts
                brandOptions: brandOptions.slice(0, 50),
                finishOptions: finishBuckets.slice(0, 50).map(b => ({ value: b.value, count: b.count ?? undefined })),
                diameterOptions: diameterBuckets.slice(0, 30).map(b => ({ value: b.value, count: b.count ?? undefined })),
                widthOptions: widthBuckets.slice(0, 30).map(b => ({ value: b.value, count: b.count ?? undefined })),
                offsetOptions: offsetBuckets.slice(0, 50).map(b => ({ value: b.value, count: b.count ?? undefined })),
                boltPatternOptions: boltPatternBuckets.map(b => ({ value: b.value, count: b.count ?? undefined })),
                
                // Context
                basePath: basePath,
                year: year,
                make: make,
                model: model,
                trim: trim,
                modification: modification,
                sort: sort,
                fitLevel: fitLevel,
                
                // Vehicle bolt pattern
                vehicleBoltPattern: fitmentSearchBp || bp || undefined,
                
                // Total count
                totalCount: itemsFinal.length,
              }}
            />
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
                      <div className="mt-1 text-xs text-neutral-600">Pick a style below-details will appear on the wheel page.</div>
                    </div>

                    <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4">
                      <div className="text-xs font-semibold text-neutral-600">Step 2</div>
                      <div className="mt-1 text-sm font-extrabold text-neutral-900">Add tires</div>
                      <div className="mt-1 text-xs text-neutral-600">We'll show OEM sizes and options that match your vehicle.</div>
                      <div className="mt-3">
                        <Link
                          href={`/tires?${new URLSearchParams(Object.fromEntries(Object.entries({ year, make, model, modification }).filter(([,v]) => v))).toString()}`}
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

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
              <div>
                Showing <span className="font-semibold text-neutral-700">{itemsPage.length}</span> styles (page {safePage} of {totalPages})
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

            {/* ═══════════════════════════════════════════════════════════════════════
                BUILD STYLE TOGGLE - Guides users to stock/level/lifted results
                Only shown for trucks/SUVs where leveling/lifting makes sense
                Hidden for: sedans, coupes, performance cars, EVs, etc.
                ═══════════════════════════════════════════════════════════════════════ */}
            {/* Homepage Intent Lifted Build: Show lift level selector instead of build style toggle */}
            {hasVehicle && isHomepageIntentLiftedBuild && (
              <div className="mt-3 rounded-xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
                <LiftLevelSelector 
                  currentLiftLevel={homepageIntentState.resolved.liftLevel || "6in"} 
                />
              </div>
            )}
            
            {/* Normal Build Style Toggle: Only show when NOT in lifted intent mode */}
            {hasVehicle && !isLiftedBuild && !isHomepageIntentLiftedBuild && vehicleSupportsBuildStyles && (
              <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4">
                <BuildStyleToggle 
                  currentBuildType={buildTypeParam} 
                  vehicleType={fitmentVehicleType}
                />
              </div>
            )}

            {/* Install & Trust Strip - tighter spacing */}
            {hasVehicle ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-green-50 border border-green-100 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5 text-green-800 font-medium">
                    <span className="text-green-600">✓</span> Ship to your installer
                  </span>
                  <span className="flex items-center gap-1.5 text-green-800 font-medium">
                    <span className="text-green-600">✓</span> Local installation available
                  </span>
                  <span className="flex items-center gap-1.5 text-green-800 font-medium">
                    <span className="text-green-600">✓</span> Mount &amp; balance included
                  </span>
                </div>
                <div className="text-xs text-green-700 font-semibold">
                  No guesswork - guaranteed fitment
                </div>
              </div>
            ) : null}

            {/* ═══════════════════════════════════════════════════════════════════════
                WHEELS GRID WITH SELECTION - Enhanced conversion flow
                Features:
                - Selection confirmation block
                - Selected state highlighting
                - Dynamic pricing ("Typical" → "Your Package")
                - Next step guidance
                - CTA evolution (Selected/Compare or Switch)
                - Micro-animations on selection
                - Mobile sticky bar
                ═══════════════════════════════════════════════════════════════════════ */}
            <WheelsGridWithSelection
              wheels={itemsPage.map(w => ({
                sku: w.sku,
                brand: w.brand,
                brandCode: w.brandCode,
                model: w.model,
                finish: w.finish,
                diameter: diameterParam || w.diameter,
                width: widthParam || w.width,
                offset: w.offset,
                centerbore: w.centerbore,
                imageUrl: w.imageUrl,
                price: w.price,
                stockQty: w.stockQty,
                inventoryType: w.inventoryType,
                styleKey: w.styleKey,
                fitmentClass: w.fitmentClass,
                finishThumbs: w.finishThumbs,
                pair: w.pair,
                boltPattern: (w as any).boltPattern,
                fitmentGuidance: w.fitmentGuidance,
              }))}
              allWheels={itemsFinal.map(w => ({
                sku: w.sku,
                brand: w.brand,
                brandCode: w.brandCode,
                model: w.model,
                finish: w.finish,
                diameter: w.diameter,
                width: w.width,
                offset: w.offset,
                centerbore: w.centerbore,
                imageUrl: w.imageUrl,
                price: w.price,
                stockQty: w.stockQty,
                inventoryType: w.inventoryType,
                styleKey: w.styleKey,
                fitmentClass: w.fitmentClass,
                finishThumbs: w.finishThumbs,
                pair: w.pair,
                boltPattern: (w as any).boltPattern,
                fitmentGuidance: w.fitmentGuidance,
              }))}
              viewParams={{
                year,
                make,
                model,
                trim,
                modification,
                sort,
                page: String(page),
                // LIFTED BUILD CONTEXT
                ...(isLiftedBuild ? {
                  liftedSource,
                  liftedPreset,
                  liftedInches: String(liftedInches),
                  liftedTireSizes: liftedTireSizesRaw,
                  liftedTireDiaMin,
                  liftedTireDiaMax,
                } : {}),
              }}
              dbProfile={dbProfile}
              diameterParam={diameterParam}
              widthParam={widthParam}
              showRecommended={hasVehicle && recommendedWheels.length > 0 && safePage === 1}
              fitmentDiameters={fitmentDiameterOptions}
              isClassicVehicle={isClassicVehicle}
              isLiftedBuild={isLiftedBuild}
              stockDiameter={effectiveStockDiameter}
              showDiameterChips={hasVehicle && fitmentDiameterOptions.length > 0}
              staggeredInfo={staggeredDebug}
              initialSetupMode={initialSetupMode}
              showOffset={isHomepageIntentLiftedBuild}
              recommendedWheels={recommendedWheels.map(w => ({
                sku: w.sku,
                brand: w.brand,
                brandCode: w.brandCode,
                model: w.model,
                finish: w.finish,
                diameter: w.diameter,
                width: w.width,
                offset: w.offset,
                centerbore: w.centerbore,
                imageUrl: w.imageUrl,
                price: w.price,
                stockQty: w.stockQty,
                inventoryType: w.inventoryType,
                styleKey: w.styleKey,
                fitmentClass: w.fitmentClass,
                finishThumbs: w.finishThumbs,
                pair: w.pair,
                boltPattern: (w as any).boltPattern,
                fitmentGuidance: w.fitmentGuidance,
              }))}
            />

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-neutral-600">
                {itemsFinal.length} styles ({totalCount} SKUs)
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
        ) : null}
      </div>

      {/* SEO Content Block - Below products, above footer */}
      {hasVehicle && itemsFinal.length >= 3 && (
        <div className="mx-auto max-w-screen-2xl px-4 pb-8">
          <SeoContentBlock
            year={year}
            make={make}
            model={model}
            type="wheels"
            productCount={itemsFinal.length}
          />
        </div>
      )}
    </main>
    </>
  );
}
