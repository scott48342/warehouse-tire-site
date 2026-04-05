import Link from "next/link";
import { GarageWidget } from "@/components/GarageWidget";
import { RecommendedFitmentCard } from "@/components/RecommendedFitmentCard";
import { BRAND } from "@/lib/brand";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { FavoritesButton } from "@/components/FavoritesButton";
import { vehicleSlug } from "@/lib/vehicleSlug";
import { SelectTireButton } from "@/components/SelectTireButton";
import { SelectTireButtonAxle } from "@/components/SelectTireButtonAxle";
import { TireMatchingBanner } from "@/components/TireMatchingBanner";
import { QuickAddTireButton } from "@/components/AddTiresToCartButton";
import { PackageSummary } from "@/components/PackageSummary";
import { PackageJourneyBar } from "@/components/PackageJourneyBar";
import { TiresGridWithSelection } from "@/components/TiresGridWithSelection";
import { TirePageCompactHeader } from "@/components/TirePageCompactHeader";
import {
  generatePlusSizeCandidates,
  generateAftermarketTireSizes,
  type PlusSizeCandidate,
} from "@/lib/tirePlusSizing";
import { getDisplayTrim } from "@/lib/vehicleDisplay";
import { cleanTireDisplayTitle } from "@/lib/productFormat";
import { TireFilterSidebar } from "@/components/TireFilterSidebar";

import { 
  type TreadCategory, 
  TREAD_CATEGORIES,
  MILEAGE_BANDS,
  LOAD_RANGES,
  formatMileageDisplay,
  meetsMinimumMileage,
  type MileageBand,
} from "@/lib/tires/normalization";

type Tire = {
  source?: "wp" | "km" | "tw";
  /** Raw source from API (e.g., "tireweb:atd", "km", "wheelpros") for cart tracking */
  rawSource?: string;
  partNumber?: string;
  mfgPartNumber?: string;
  brand?: string;
  description?: string;
  /** Supplier cost (what we pay) */
  cost?: number;
  /** Retail price / MAP (what customer pays) - use this for display when available */
  price?: number;
  quantity?: { primary?: number; alternate?: number; national?: number };
  imageUrl?: string;
  displayName?: string;
  badges?: {
    terrain?: string | null;
    construction?: string | null;
    warrantyMiles?: number | null;
    loadIndex?: string | null;
    speedRating?: string | null;
  };
  prettyName?: string;
  tireLibraryId?: number;
  // Enrichment data for filtering and display
  enrichment?: {
    mileage: number | null;
    treadCategory: TreadCategory | null;
    mileageBadge: 'Long Life' | 'Ultra Long Life' | null;
    loadRange: string | null;
    isRunFlat: boolean;
    isXL: boolean;
    is3PMSF: boolean;
    isAllWeather: boolean;
  };
};

type TireAsset = {
  km_description?: string;
  display_name?: string;
  image_url?: string;
};

// Premium tire brands for scoring
const PREMIUM_BRANDS = ["michelin", "bridgestone", "continental", "goodyear", "pirelli"];
const MID_TIER_BRANDS = ["cooper", "toyo", "bfgoodrich", "yokohama", "hankook", "falken", "general", "kumho", "nexen"];

// ============================================================================
// TREAD CATEGORY RESOLUTION (shared between counting and filtering)
// ============================================================================

/**
 * Resolves tread category for a tire using consistent fallback chain:
 * 1. enrichment.treadCategory (from API normalization)
 * 2. badges.terrain (normalized to TreadCategory)
 * 3. Model name pattern matching
 * 4. Default to "All-Season"
 * 
 * This MUST be used by both counting and filtering to ensure consistency.
 */
function resolveTreadCategory(tire: Tire): TreadCategory {
  // 1. Primary: enrichment.treadCategory (normalize if needed)
  if (tire.enrichment?.treadCategory) {
    const cat = tire.enrichment.treadCategory;
    // Normalize uppercase variants (API may return "ALL SEASON" instead of "All-Season")
    const upper = String(cat).toUpperCase();
    if (upper === 'ALL SEASON' || upper === 'ALL-SEASON') return 'All-Season';
    if (upper === 'ALL WEATHER' || upper === 'ALL-WEATHER') return 'All-Weather';
    if (upper === 'ALL TERRAIN' || upper === 'ALL-TERRAIN') return 'All-Terrain';
    if (upper === 'MUD TERRAIN' || upper === 'MUD-TERRAIN') return 'Mud-Terrain';
    if (upper === 'RUGGED TERRAIN' || upper === 'RUGGED-TERRAIN') return 'Rugged-Terrain';
    if (upper === 'HIGHWAY/TOURING' || upper === 'HIGHWAY TOURING') return 'Highway/Touring';
    // If already properly cased, return as-is
    if (TREAD_CATEGORIES.includes(cat as TreadCategory)) {
      return cat as TreadCategory;
    }
  }
  
  // 2. Fallback: badges.terrain (normalized)
  if (tire.badges?.terrain) {
    const terrain = String(tire.badges.terrain).toUpperCase();
    if (terrain.includes('HIGHWAY') || terrain.includes('TOURING') || terrain.includes('H/T') || terrain.includes('HT')) {
      return 'Highway/Touring';
    } else if (terrain.includes('ALL-TERRAIN') || terrain.includes('ALL TERRAIN') || terrain.includes('A/T') || /\bAT\b/.test(terrain)) {
      return 'All-Terrain';
    } else if (terrain.includes('MUD') || terrain.includes('M/T') || /\bMT\b/.test(terrain)) {
      return 'Mud-Terrain';
    } else if (terrain.includes('RUGGED') || terrain.includes('R/T') || /\bRT\b/.test(terrain)) {
      return 'Rugged-Terrain';
    } else if (terrain.includes('ALL-SEASON') || terrain.includes('ALL SEASON') || terrain.includes('A/S')) {
      return 'All-Season';
    } else if (terrain.includes('WINTER') || terrain.includes('SNOW') || terrain.includes('ICE')) {
      return 'Winter';
    } else if (terrain.includes('SUMMER')) {
      return 'Summer';
    } else if (terrain.includes('PERFORMANCE') || terrain.includes('UHP')) {
      return 'Performance';
    } else if (terrain.includes('ALL-WEATHER') || terrain.includes('ALL WEATHER')) {
      return 'All-Weather';
    }
  }
  
  // 3. Fallback: model name pattern matching
  const m = String(tire.description || tire.displayName || '').toUpperCase();
  if (/\bWINTER\b|\bBLIZZAK\b|\bX-ICE\b|\bICE\b|\bSNOW\b|\bWS\d+\b|\bARCTIC\b/.test(m)) {
    return 'Winter';
  } else if (/\bM[\/\-]?T\b|\bMUD[\s\-]?TERRAIN\b|\bMUD[\s\-]?GRAPPLER\b/.test(m)) {
    return 'Mud-Terrain';
  } else if (/\bR[\/\-]?T\b|\bRUGGED[\s\-]?TERRAIN\b/.test(m)) {
    return 'Rugged-Terrain';
  } else if (/\bA[\/\-]?T\d*[A-Z]?\b|\bA[\/\-]?T[-]?[A-Z]\b|\bALL[\s\-]?TERRAIN\b|\bTERRA\s*TRAC\b|\bKO2\b|\bGRAPPLER\b/.test(m) && !/MUD/.test(m)) {
    return 'All-Terrain';
  } else if (/\bH[\/\-]?T\d*[A-Z]?\d*\b|\bHIGHWAY\b|\bTOURING\b|\bGRAND\s*TOUR/.test(m)) {
    return 'Highway/Touring';
  } else if (/\bPILOT\s*SPORT\b|\bPOTENZA\b|\bPS4S\b|\bPZERO\b|\bP\s*ZERO\b|\bUHP\b|\bSPORT\s*MAXX\b|\bEAGLE\s*F1\b/.test(m)) {
    return 'Performance';
  } else if (/\bALL[\s\-]?WEATHER\b|\bWEATHER\s*READY\b|\b4SEASON\b|\bCROSS\s*CLIMATE\b/.test(m)) {
    return 'All-Weather';
  } else if (/\bSUMMER\b/.test(m) && !/ALL/.test(m)) {
    return 'Summer';
  } else if (/\bA[\/\-]?S\b|\bALL[\s\-]?SEASON\b/.test(m)) {
    return 'All-Season';
  }
  
  // 4. Default
  return 'All-Season';
}

// ============================================================================
// TIRE SIZE PARSING UTILITIES (for mixed flotation + metric filtering)
// ============================================================================

interface ParsedTireSize {
  rimDiameter: number | null;       // 20 from both "35X12.50R20" and "285/65R20"
  sectionWidth: number | null;      // 12.5 from flotation, 285 from metric (normalized to inches: 285mm ≈ 11.2")
  overallDiameter: number | null;   // 35 from flotation, calculated from metric
  isFlotation: boolean;
  original: string;
}

function parseTireSize(size: string, description?: string): ParsedTireSize {
  const s = String(size || description || "").trim().toUpperCase();
  
  // Try flotation format first: 35X12.50R20, 35/12.50R20, 33X12.5R17
  const flotation = s.match(/(\d{2,3})\s*[X\/\-]\s*(\d{1,2}(?:\.\d+)?)\s*[A-Z]*\s*R(\d{2})/i);
  if (flotation) {
    const overallDia = parseFloat(flotation[1]);
    const width = parseFloat(flotation[2]);
    const rim = parseInt(flotation[3], 10);
    return {
      rimDiameter: rim,
      sectionWidth: width,
      overallDiameter: overallDia,
      isFlotation: true,
      original: s,
    };
  }
  
  // Try metric format: 285/65R20, P245/50R18, LT285/70R17
  const metric = s.match(/(?:LT|P)?(\d{3})\s*\/\s*(\d{2})\s*[A-Z]*R(\d{2})/i);
  if (metric) {
    const widthMm = parseInt(metric[1], 10);
    const aspect = parseInt(metric[2], 10);
    const rim = parseInt(metric[3], 10);
    
    // Convert width to inches: mm / 25.4
    const widthInches = widthMm / 25.4;
    
    // Calculate overall diameter: 2 × (width × aspect% / 25.4) + rim
    // Sidewall height = width × aspect% = widthMm × (aspect/100)
    // Sidewall in inches = sidewall / 25.4
    // Overall = 2 × sidewall_inches + rim_diameter
    const sidewallInches = (widthMm * (aspect / 100)) / 25.4;
    const overallDia = Math.round((2 * sidewallInches + rim) * 10) / 10; // Round to 1 decimal
    
    return {
      rimDiameter: rim,
      sectionWidth: Math.round(widthInches * 10) / 10, // Normalize to inches
      overallDiameter: overallDia,
      isFlotation: false,
      original: s,
    };
  }
  
  // Fallback: try to extract just rim diameter
  const rimMatch = s.match(/R(\d{2})/i);
  return {
    rimDiameter: rimMatch ? parseInt(rimMatch[1], 10) : null,
    sectionWidth: null,
    overallDiameter: null,
    isFlotation: false,
    original: s,
  };
}

// Round overall diameter to nearest standard size (33, 34, 35, 37, etc.)
function normalizeOverallDiameter(dia: number | null): string | null {
  if (dia === null) return null;
  // Standard flotation diameters: 30, 31, 32, 33, 34, 35, 37, 38, 40
  // For metric tires, round to nearest inch
  return `${Math.round(dia)}"`;
}

// Format section width for display
function formatSectionWidth(width: number | null, isFlotation: boolean): string | null {
  if (width === null) return null;
  if (isFlotation) {
    return `${width}"`;
  }
  // Convert back to mm for display (metric convention)
  const mm = Math.round(width * 25.4 / 5) * 5; // Round to nearest 5mm
  return `${mm}mm`;
}

/**
 * Calculate display price for a tire
 * - WheelPros: Use MSRP (passed as price field)
 * - TireWeb: Use price if available, else cost + $50
 */
function getDisplayPrice(tire: Tire): number | null {
  const price = typeof tire.price === "number" && tire.price > 0 ? tire.price : null;
  const cost = typeof tire.cost === "number" && tire.cost > 0 ? tire.cost : null;
  
  // Use price (MSRP for WheelPros, sellPrice for TireWeb) if available
  if (price) {
    return price;
  }
  
  // Fallback: cost + $50 margin (TireWeb when no sellPrice)
  if (cost) {
    return cost + 50;
  }
  
  return null;
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function fetchFitment(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const res = await fetch(`${getBaseUrl()}/api/vehicles/tire-sizes?${sp.toString()}`, { cache: "no-store" });
  if (!res.ok) return { error: await res.text() };
  return res.json();
}

// DB-first fitment profile fetch (primary source of truth when available)
// Also returns staggered info for staggered fitment detection
interface FitmentProfileResult {
  dbProfile: any | null;
  staggered: {
    isStaggered: boolean;
    reason?: string;
    frontSpec?: { diameter?: number; width?: number; offset?: number | null; tireSize?: string | null };
    rearSpec?: { diameter?: number; width?: number; offset?: number | null; tireSize?: string | null };
  } | null;
}
async function fetchDBProfile(params: Record<string, string | undefined>): Promise<FitmentProfileResult | null> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  // Use fitment-search which returns dbProfile + staggered info
  const res = await fetch(`${getBaseUrl()}/api/wheels/fitment-search?${sp.toString()}&pageSize=1`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    dbProfile: data?.fitment?.dbProfile || null,
    staggered: data?.fitment?.staggered || null,
  };
}

async function fetchKmTires(tireSize: string) {
  const sizeQ = normalizeTireSizeForQuery(tireSize);
  const res = await fetch(`${getBaseUrl()}/api/km/tiresizesearch?tireSize=${encodeURIComponent(sizeQ)}&minQty=4`, {
    cache: "no-store",
  });
  if (!res.ok) return { error: await res.text() };
  return res.json();
}

function normalizeTireSizeForQuery(s: string) {
  const v = String(s || "").trim().toUpperCase();
  const m = v.match(/\b(\d{3}\/\d{2})(?:ZR|R)(\d{2})\b/);
  if (m) return `${m[1]}R${m[2]}`;
  return String(s || "").trim();
}

async function fetchWpTires(tireSize: string) {
  const sizeQ = normalizeTireSizeForQuery(tireSize);
  const res = await fetch(`${getBaseUrl()}/api/wp/tires/search?size=${encodeURIComponent(sizeQ)}&minQty=4`, {
    cache: "no-store",
  });
  if (!res.ok) return { error: await res.text() };
  return res.json();
}

async function fetchActiveRebates() {
  const res = await fetch(`${getBaseUrl()}/api/rebates/active`, { cache: "no-store" });
  if (!res.ok) return { items: [] as any[] };
  return res.json();
}

/**
 * Fetch tires from TireWeb (ATD, NTW, US AutoForce)
 * Returns TireLibrary-enriched data including images
 */
async function fetchTireWebTires(tireSize: string) {
  const sizeQ = normalizeTireSizeForQuery(tireSize);
  try {
    const res = await fetch(`${getBaseUrl()}/api/tires/search?size=${encodeURIComponent(sizeQ)}&minQty=4`, {
      cache: "no-store",
    });
    if (!res.ok) return { results: [] };
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("[fetchTireWebTires] Error:", err);
    return { results: [] };
  }
}

/**
 * Staggered Tire Pair type - matched front + rear tires
 */
export type StaggeredTirePair = {
  pairId: string;
  brand: string;
  model: string;
  front: {
    partNumber: string;
    size: string;
    price: number;
    imageUrl: string | null;
    loadIndex?: string | null;
    speedRating?: string | null;
    quantity?: number;
  };
  rear: {
    partNumber: string;
    size: string;
    price: number;
    imageUrl: string | null;
    loadIndex?: string | null;
    speedRating?: string | null;
    quantity?: number;
  };
  setPrice: number;
  imageUrl: string | null;
  terrain?: string | null;
  warrantyMiles?: number | null;
  mileage?: number | null;
  treadCategory?: string | null;
};

/**
 * Fetch staggered tire pairs for vehicles with different front/rear wheel sizes
 * Returns matched pairs (same brand/model in both sizes)
 */
async function fetchStaggeredTirePairs(frontSize: string, rearSize: string) {
  try {
    const res = await fetch(
      `${getBaseUrl()}/api/tires/staggered-search?frontSize=${encodeURIComponent(frontSize)}&rearSize=${encodeURIComponent(rearSize)}&minQty=2`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      console.error("[fetchStaggeredTirePairs] API error:", res.status);
      return { pairs: [], pairCount: 0 };
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("[fetchStaggeredTirePairs] Error:", err);
    return { pairs: [], pairCount: 0 };
  }
}

// Score tires for "Top Picks" selection
function scoreTireForPicks(tire: Tire): number {
  let score = 0;
  const price = getDisplayPrice(tire) || 0;
  const brand = String(tire.brand || "").toLowerCase();
  
  // Price sweet spot ($80-$200 per tire)
  if (price >= 80 && price <= 200) score += 30;
  else if (price >= 60 && price <= 250) score += 15;
  else if (price > 250) score += 5;
  
  // Brand reputation
  if (PREMIUM_BRANDS.includes(brand)) score += 25;
  else if (MID_TIER_BRANDS.includes(brand)) score += 15;
  
  // Stock availability
  const q = tire.quantity || {};
  const totalStock = (q.primary || 0) + (q.alternate || 0) + (q.national || 0);
  if (totalStock >= 16) score += 20;
  else if (totalStock >= 8) score += 10;
  else if (totalStock >= 4) score += 5;
  
  // Has image
  if (tire.imageUrl) score += 10;
  
  // Has display name (better product data)
  if (tire.displayName || tire.prettyName) score += 5;
  
  return score;
}

// Helper to safely convert any value to string (fixes [object Object] bug)
function safeString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  // Handle objects - extract a sensible string value
  if (typeof val === "object") {
    // Try common property names
    const obj = val as Record<string, unknown>;
    if (typeof obj.name === "string") return obj.name.trim();
    if (typeof obj.value === "string") return obj.value.trim();
    if (typeof obj.label === "string") return obj.label.trim();
    if (typeof obj.title === "string") return obj.title.trim();
    if (typeof obj.description === "string") return obj.description.trim();
    // Last resort: return empty string instead of [object Object]
    return "";
  }
  return "";
}

export default async function TiresPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const zip = "";
  const sortRaw = Array.isArray(sp.sort) ? sp.sort[0] : sp.sort;
  const sort = (sortRaw ?? "price_asc").trim();
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number(pageRaw || "1") || 1);

  // Filters (querystring-driven)
  const brandsRaw = sp.brand;
  const brands = Array.isArray(brandsRaw)
    ? brandsRaw.map(String).map((s) => s.trim()).filter(Boolean)
    : brandsRaw
      ? [String(brandsRaw).trim()].filter(Boolean)
      : [];

  const priceMinRaw = Array.isArray(sp.priceMin) ? sp.priceMin[0] : sp.priceMin;
  const priceMaxRaw = Array.isArray(sp.priceMax) ? sp.priceMax[0] : sp.priceMax;
  const priceMin = priceMinRaw ? Number(String(priceMinRaw)) : null;
  const priceMax = priceMaxRaw ? Number(String(priceMaxRaw)) : null;

  // NOTE: Old "season" filter removed - use treadCategory instead (normalized categories)

  const speedsRaw = sp.speed;
  const speeds = Array.isArray(speedsRaw)
    ? speedsRaw.map(String).map((s) => s.trim()).filter(Boolean)
    : speedsRaw
      ? [String(speedsRaw).trim()].filter(Boolean)
      : [];

  const runFlat = (Array.isArray(sp.runFlat) ? sp.runFlat[0] : sp.runFlat) === "1";
  const snowRated = (Array.isArray(sp.snowRated) ? sp.snowRated[0] : sp.snowRated) === "1";
  const allWeather = (Array.isArray(sp.allWeather) ? sp.allWeather[0] : sp.allWeather) === "1";
  const xlOnly = (Array.isArray(sp.xl) ? sp.xl[0] : sp.xl) === "1";

  const loadRangesRaw = (sp as any).loadRange;
  const loadRanges = Array.isArray(loadRangesRaw)
    ? loadRangesRaw.map(String).map((s) => s.trim().toUpperCase()).filter(Boolean)
    : loadRangesRaw
      ? [String(loadRangesRaw).trim().toUpperCase()].filter(Boolean)
      : [];

  // Mileage band filter (40K+, 60K+, 80K+)
  const mileageBandRaw = (sp as any).mileageBand;
  const mileageBand = Array.isArray(mileageBandRaw) ? mileageBandRaw[0] : mileageBandRaw;
  const selectedMileageBand = (mileageBand && MILEAGE_BANDS.includes(mileageBand as MileageBand)) 
    ? mileageBand as MileageBand 
    : null;

  // Tread category filter (All-Season, All-Terrain, etc.)
  const treadCategoriesRaw = (sp as any).treadCategory;
  const treadCategories: TreadCategory[] = Array.isArray(treadCategoriesRaw)
    ? treadCategoriesRaw.filter((t): t is TreadCategory => TREAD_CATEGORIES.includes(t as TreadCategory))
    : treadCategoriesRaw && TREAD_CATEGORIES.includes(treadCategoriesRaw as TreadCategory)
      ? [treadCategoriesRaw as TreadCategory]
      : [];

  // Rim diameter filter (for mixed size searches)
  const rimDiaRaw = (sp as any).rimDia;
  const rimDiameters: number[] = Array.isArray(rimDiaRaw)
    ? rimDiaRaw.map(Number).filter(n => Number.isFinite(n) && n > 0)
    : rimDiaRaw && Number.isFinite(Number(rimDiaRaw))
      ? [Number(rimDiaRaw)]
      : [];

  // Overall diameter filter (for mixed size searches)
  const overallDiaRaw = (sp as any).overallDia;
  const overallDiameters: string[] = Array.isArray(overallDiaRaw)
    ? overallDiaRaw.map(String).filter(Boolean)
    : overallDiaRaw
      ? [String(overallDiaRaw)]
      : [];

  // Use safeString to handle potential object values (fixes [object Object] bug)
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
    if (/^s_[a-f0-9]{8}$/.test(trimRaw) || /^[a-f0-9]{10}$/.test(trimRaw)) {
      modification = trimRaw;
      trimLabel = "";
      console.warn(`[tires] DEPRECATION: Using 'trim' as modificationId. Migrate to 'modification=${trimRaw}'`);
    }
  }
  
  if (!modification && trimRaw && !trimRaw.includes(" ")) {
    modification = trimRaw;
  }
  
  // IMPORTANT: Never use modification as display trim - it's a hex ID, not a customer-facing label
  // Only use trimLabel (actual display text) or empty string
  const trim = trimLabel || "";

  // Quote carry-over (so wheel stays on quote when selecting tires)
  const wheelSku = safeString(Array.isArray((sp as any).wheelSku) ? (sp as any).wheelSku[0] : (sp as any).wheelSku);
  const axleRaw = safeString(Array.isArray((sp as any).axle) ? (sp as any).axle[0] : (sp as any).axle);
  const axle = (axleRaw === "rear" ? "rear" : "front") as "front" | "rear";

  const tireSku = safeString(Array.isArray((sp as any).tireSku) ? (sp as any).tireSku[0] : (sp as any).tireSku);
  const tireSkuFront = safeString(Array.isArray((sp as any).tireSkuFront) ? (sp as any).tireSkuFront[0] : (sp as any).tireSkuFront);
  const tireSkuRear = safeString(Array.isArray((sp as any).tireSkuRear) ? (sp as any).tireSkuRear[0] : (sp as any).tireSkuRear);

  const wheelSkuRear = safeString(Array.isArray((sp as any).wheelSkuRear) ? (sp as any).wheelSkuRear[0] : (sp as any).wheelSkuRear);
  const wheelDiaFront = safeString(Array.isArray((sp as any).wheelDiaFront) ? (sp as any).wheelDiaFront[0] : (sp as any).wheelDiaFront);
  const wheelDiaRear = safeString(Array.isArray((sp as any).wheelDiaRear) ? (sp as any).wheelDiaRear[0] : (sp as any).wheelDiaRear);
  const wheelWidthFront = safeString(Array.isArray((sp as any).wheelWidthFront) ? (sp as any).wheelWidthFront[0] : (sp as any).wheelWidthFront);
  const wheelWidthRear = safeString(Array.isArray((sp as any).wheelWidthRear) ? (sp as any).wheelWidthRear[0] : (sp as any).wheelWidthRear);

  const sizeFrontRaw = safeString(Array.isArray((sp as any).sizeFront) ? (sp as any).sizeFront[0] : (sp as any).sizeFront);
  const sizeRearRaw = safeString(Array.isArray((sp as any).sizeRear) ? (sp as any).sizeRear[0] : (sp as any).sizeRear);

  const wheelName = safeString(Array.isArray((sp as any).wheelName) ? (sp as any).wheelName[0] : (sp as any).wheelName);
  const wheelImage = safeString(Array.isArray((sp as any).wheelImage) ? (sp as any).wheelImage[0] : (sp as any).wheelImage);
  const wheelPriceRaw = safeString(Array.isArray((sp as any).wheelPrice) ? (sp as any).wheelPrice[0] : (sp as any).wheelPrice);
  const wheelPrice = wheelPriceRaw ? parseFloat(wheelPriceRaw) : null;
  const wheelFinish = safeString(Array.isArray((sp as any).wheelFinish) ? (sp as any).wheelFinish[0] : (sp as any).wheelFinish);
  const wheelUnit = safeString(Array.isArray((sp as any).wheelUnit) ? (sp as any).wheelUnit[0] : (sp as any).wheelUnit);
  const wheelQty = safeString(Array.isArray((sp as any).wheelQty) ? (sp as any).wheelQty[0] : (sp as any).wheelQty);
  const wheelDia = safeString(Array.isArray((sp as any).wheelDia) ? (sp as any).wheelDia[0] : (sp as any).wheelDia);
  const wheelWidth = safeString(Array.isArray((sp as any).wheelWidth) ? (sp as any).wheelWidth[0] : (sp as any).wheelWidth);
  
  // Setup mode: "square" or "staggered" - allows user to override automatic staggered detection
  const setupMode = safeString(Array.isArray((sp as any).setup) ? (sp as any).setup[0] : (sp as any).setup);
  const forceSquare = setupMode === "square";
  const forceStaggered = setupMode === "staggered";

  // Initial staggered check from URL - may be overridden by fitment detection later
  const isStaggeredFromUrlParams = Boolean(wheelSkuRear);
  // Note: isStaggeredVehicle is computed after fetchDBProfile and considers fitment data
  const wheelDiaActive = axle === "rear" ? (wheelDiaRear || wheelDia) : (wheelDiaFront || wheelDia);
  const wheelWidthActive = axle === "rear" ? (wheelWidthRear || wheelWidth) : (wheelWidthFront || wheelWidth);

  const basePath = year && make && model ? `/tires/v/${vehicleSlug(year, make, model)}` : "/tires";
  const hasVehicle = Boolean(year && make && model);

  // Package flow detection - user came from wheel selection
  const isPackageFlow = Boolean(wheelSku);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔍 DEBUG: RENDER FLOW AUDIT (2026-04-03)
  // Trace route path, query params, resolved mode, and component selection
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[TIRES_AUDIT] 📍 Route: /tires (or /tires/v/[slug])');
  console.log('[TIRES_AUDIT] 🔧 Query params:', {
    year, make, model, modification, trim,
    wheelSku: wheelSku || '(none)',
    package: sp.package || '(none)',
    size: sp.size || '(auto)',
  });
  console.log('[TIRES_AUDIT] 📊 Render decision:', {
    isPackageFlow,
    hasVehicle,
    showPackageJourneyBar: hasVehicle && isPackageFlow,
    componentMode: 'TIRES',
  });
  if (isPackageFlow) {
    console.log('[TIRES_AUDIT] 📦 PACKAGE FLOW - showing PackageJourneyBar (user came from wheel selection)');
  } else {
    console.log('[TIRES_AUDIT] ✅ STANDARD TIRE SEARCH - PackageJourneyBar hidden');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFTED BUILD CONTEXT
  // ═══════════════════════════════════════════════════════════════════════════
  // When user comes from /lifted page, use lifted tire recommendations instead of OEM
  const liftedSource = safeString(Array.isArray(sp.liftedSource) ? sp.liftedSource[0] : sp.liftedSource);
  const liftedPreset = safeString(Array.isArray(sp.liftedPreset) ? sp.liftedPreset[0] : sp.liftedPreset);
  const liftedInchesRaw = safeString(Array.isArray(sp.liftedInches) ? sp.liftedInches[0] : sp.liftedInches);
  const liftedInches = liftedInchesRaw ? parseInt(liftedInchesRaw, 10) : 0;
  const liftedTireSizesRaw = safeString(Array.isArray(sp.liftedTireSizes) ? sp.liftedTireSizes[0] : sp.liftedTireSizes);
  const liftedTireSizes = liftedTireSizesRaw ? liftedTireSizesRaw.split(",").filter(Boolean) : [];
  const liftedTireDiaMinRaw = safeString(Array.isArray(sp.liftedTireDiaMin) ? sp.liftedTireDiaMin[0] : sp.liftedTireDiaMin);
  const liftedTireDiaMin = liftedTireDiaMinRaw ? parseInt(liftedTireDiaMinRaw, 10) : 0;
  const liftedTireDiaMaxRaw = safeString(Array.isArray(sp.liftedTireDiaMax) ? sp.liftedTireDiaMax[0] : sp.liftedTireDiaMax);
  const liftedTireDiaMax = liftedTireDiaMaxRaw ? parseInt(liftedTireDiaMaxRaw, 10) : 0;
  
  // Lifted build is active when we have valid lifted context from URL params
  // liftedSource can be "lifted" (from /lifted page), "manual" (user-selected), or any truthy value
  const isLiftedBuild = Boolean(liftedSource) && Boolean(liftedPreset) && liftedInches > 0;
  
  if (isLiftedBuild) {
    console.log('[tires/page] 🚀 LIFTED BUILD DETECTED:', {
      presetId: liftedPreset,
      liftInches: liftedInches,
      tireSizes: liftedTireSizes,
      tireDiameterRange: `${liftedTireDiaMin}"-${liftedTireDiaMax}"`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DB-FIRST FITMENT PROFILE (Primary Source of Truth)
  // ═══════════════════════════════════════════════════════════════════════════
  // Fetch dbProfile first when modification is known (canonical fitment data from our DB)
  // Also extracts staggered fitment info for staggered vehicles (e.g., Corvette)
  const fitmentResult = year && make && model && modification
    ? await fetchDBProfile({ year, make, model, modification })
    : null;
  const dbProfile = fitmentResult?.dbProfile || null;
  const fitmentStaggered = fitmentResult?.staggered || null;
  
  // Staggered detection: from URL params (wheelSkuRear) OR from fitment profile
  const isStaggeredFromFitment = Boolean(fitmentStaggered?.isStaggered);
  const isStaggeredFromUrl = Boolean(wheelSkuRear);
  const isStaggeredVehicle = isStaggeredFromFitment || isStaggeredFromUrl;
  
  // For package flow with staggered vehicles, use isStaggeredVehicle
  // This allows staggered detection even when only one wheel is in the URL
  const isStaggered = isPackageFlow ? isStaggeredVehicle : isStaggeredFromUrl;
  
  if (isStaggeredVehicle) {
    console.log('[tires/page] 🔄 STAGGERED VEHICLE DETECTED:', {
      fromFitment: isStaggeredFromFitment,
      fromUrl: isStaggeredFromUrl,
      reason: fitmentStaggered?.reason,
      frontSpec: fitmentStaggered?.frontSpec,
      rearSpec: fitmentStaggered?.rearSpec,
      isPackageFlow,
    });
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STAGGERED WHEEL SPECS (for tire size generation)
  // ═══════════════════════════════════════════════════════════════════════════
  // When vehicle is staggered (detected from fitment), use the correct wheel specs
  // for each axle to generate appropriate tire sizes.
  // This handles the case where URL only has one wheel but fitment tells us about both.
  const staggeredFrontDia = fitmentStaggered?.frontSpec?.diameter;
  const staggeredFrontWidth = fitmentStaggered?.frontSpec?.width;
  const staggeredRearDia = fitmentStaggered?.rearSpec?.diameter;
  const staggeredRearWidth = fitmentStaggered?.rearSpec?.width;
  
  // Effective wheel specs for tire search
  // CRITICAL: For staggered vehicles, prioritize fitment spec over generic wheelDia URL param
  // because wheelDia might be for one axle only (e.g., rear 20" in URL, but front is 19")
  const effectiveWheelDia = axle === "front"
    ? (wheelDiaFront || (isStaggeredFromFitment && staggeredFrontDia ? String(staggeredFrontDia) : wheelDia) || "")
    : (wheelDiaRear || (isStaggeredFromFitment && staggeredRearDia ? String(staggeredRearDia) : wheelDia) || "");
  const effectiveWheelWidth = axle === "front"
    ? (wheelWidthFront || (isStaggeredFromFitment && staggeredFrontWidth ? String(staggeredFrontWidth) : wheelWidth) || "")
    : (wheelWidthRear || (isStaggeredFromFitment && staggeredRearWidth ? String(staggeredRearWidth) : wheelWidth) || "");
  
  if (isStaggeredVehicle && isPackageFlow) {
    console.log('[tires/page] 🎯 STAGGERED TIRE SEARCH:', {
      axle,
      urlWheelDia: wheelDiaActive,
      urlWheelWidth: wheelWidthActive,
      fitmentDia: axle === "front" ? staggeredFrontDia : staggeredRearDia,
      fitmentWidth: axle === "front" ? staggeredFrontWidth : staggeredRearWidth,
      effectiveWheelDia,
      effectiveWheelWidth,
    });
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STAGGERED TIRE SIZE GENERATION
  // ═══════════════════════════════════════════════════════════════════════════
  // For staggered vehicles, generate tire sizes for BOTH front and rear wheels
  // to enable paired tire search (same brand/model in both sizes)
  let staggeredFrontTireSize: string | null = null;
  let staggeredRearTireSize: string | null = null;
  
  // IMPORTANT: Check if user selected their own wheel sizes (override OEM staggered)
  // If user has wheelDia without wheelDiaFront/wheelDiaRear, they chose a square setup
  const userSelectedSquareSetup = wheelDia && !wheelDiaFront && !wheelDiaRear;
  const userSelectedStaggeredSetup = wheelDiaFront && wheelDiaRear;
  
  // For staggered vehicles with single diameter selection, infer staggered widths from OEM DIFFERENCE
  // e.g., Corvette OEM is 8.5" front / 11" rear (difference 2.5"). 
  // If user selects 20x11 (closer to OEM rear) → front = 11 - 2.5 = 8.5"
  // If user selects 22x9 (closer to OEM front) → rear = 9 + 2 = 11" (capped for 22"+)
  const rawOemWidthDiff = (staggeredFrontWidth && staggeredRearWidth) 
    ? staggeredRearWidth - staggeredFrontWidth 
    : 0;
  // Cap width difference at 2" for 22"+ wheels (larger stagger = rare tire sizes)
  const selectedDia = Number(wheelDia) || 0;
  const oemWidthDiff = selectedDia >= 22 ? Math.min(rawOemWidthDiff, 2) : rawOemWidthDiff;
  const selectedWidth = Number(wheelWidth) || 0;
  
  // Determine if selected wheel is closer to OEM front or rear width
  const distanceToOemFront = staggeredFrontWidth ? Math.abs(selectedWidth - staggeredFrontWidth) : Infinity;
  const distanceToOemRear = staggeredRearWidth ? Math.abs(selectedWidth - staggeredRearWidth) : Infinity;
  const selectedIsRearWheel = distanceToOemRear <= distanceToOemFront;
  
  // Calculate the other axle's width based on OEM difference
  let inferredFrontWidth: number | null = null;
  let inferredRearWidth: number | null = null;
  
  if (staggeredFrontWidth && staggeredRearWidth && selectedWidth) {
    if (selectedIsRearWheel) {
      // Selected is rear wheel, calculate front
      inferredFrontWidth = Math.round((selectedWidth - oemWidthDiff) * 2) / 2;
      inferredRearWidth = selectedWidth;
    } else {
      // Selected is front wheel, calculate rear
      inferredFrontWidth = selectedWidth;
      inferredRearWidth = Math.round((selectedWidth + oemWidthDiff) * 2) / 2;
    }
  }
  
  // SANITY CHECK: Both widths must be realistic (>=8" for performance cars)
  const inferredWidthsAreRealistic = inferredFrontWidth && inferredFrontWidth >= 8 && 
                                      inferredRearWidth && inferredRearWidth >= 8;
  
  // Determine actual wheel specs to use for tire generation
  const actualFrontDia = userSelectedStaggeredSetup 
    ? Number(wheelDiaFront) 
    : userSelectedSquareSetup 
      ? Number(wheelDia) 
      : staggeredFrontDia;
  const actualRearDia = userSelectedStaggeredSetup 
    ? Number(wheelDiaRear) 
    : userSelectedSquareSetup 
      ? Number(wheelDia) 
      : staggeredRearDia;
  
  // Staggered tire display logic:
  // - If user explicitly selected staggered wheels (front/rear specs in URL) → staggered
  // - If user selected single wheel (square) → square by default
  // - User can opt-in to staggered via setup=staggered URL param
  // This ensures tires match the actual wheel selection, not just OEM fitment
  const useStaggeredWidths = userSelectedStaggeredSetup || 
    (forceStaggered && isStaggeredFromFitment && inferredWidthsAreRealistic);
  
  const actualFrontWidth = userSelectedStaggeredSetup 
    ? Number(wheelWidthFront) || staggeredFrontWidth 
    : useStaggeredWidths
      ? inferredFrontWidth! // Use inferred width for staggered vehicle
      : userSelectedSquareSetup 
        ? Number(wheelWidth) || 9 // Square: same width front and rear
        : staggeredFrontWidth;
  const actualRearWidth = userSelectedStaggeredSetup 
    ? Number(wheelWidthRear) || staggeredRearWidth 
    : useStaggeredWidths
      ? inferredRearWidth! // Use inferred width for staggered vehicle
      : userSelectedSquareSetup 
        ? Number(wheelWidth) || 9 // Square: same width front and rear
        : staggeredRearWidth;
  
  // Staggered = different diameters OR different widths (same dia but 8.5" front vs 11" rear)
  const isDifferentDiameters = actualFrontDia !== actualRearDia;
  const isDifferentWidths = actualFrontWidth !== actualRearWidth;
  const isActuallyStaggered = isDifferentDiameters || isDifferentWidths;
  
  console.log('[tires/page] 🔧 STAGGERED WIDTH CALCULATION:', {
    oemWidthDiff,
    selectedWidth,
    selectedIsRearWheel,
    inferredFrontWidth,
    inferredRearWidth,
    inferredWidthsAreRealistic,
    useStaggeredWidths,
    actualFrontWidth,
    actualRearWidth,
    isDifferentWidths,
    isActuallyStaggered,
    userSelectedSquareSetup,
    isStaggeredFromFitment,
  });
  
  // CRITICAL: Override isStaggered for UI purposes
  // If user selected a square setup (same size front/rear), don't show staggered UI
  const showStaggeredUI = isStaggeredVehicle && isPackageFlow && isActuallyStaggered;
  
  if (isStaggeredVehicle && isPackageFlow && actualFrontDia && actualRearDia && actualFrontWidth && actualRearWidth && isActuallyStaggered) {
    // Generate recommended tire sizes based on wheel specs
    // Standard tire widths: 205, 215, 225, 235, 245, 255, 265, 275, 285, 295, 305, 315...
    const STANDARD_TIRE_WIDTHS = [195, 205, 215, 225, 235, 245, 255, 265, 275, 285, 295, 305, 315, 325, 335, 345];
    
    const findNearestTireWidth = (wheelWidthInches: number, wheelDia: number): number => {
      // Performance tires run wider - larger wheels get more stretch
      // 22"+ wheels: +45mm (for better inventory match), 20-21": +30mm, smaller: +25mm
      const stretchMm = wheelDia >= 22 ? 45 : wheelDia >= 20 ? 30 : 25;
      const targetMm = wheelWidthInches * 25.4 + stretchMm;
      return STANDARD_TIRE_WIDTHS.reduce((prev, curr) => 
        Math.abs(curr - targetMm) < Math.abs(prev - targetMm) ? curr : prev
      );
    };
    
    const frontTireWidth = findNearestTireWidth(actualFrontWidth || 8.5, actualFrontDia);
    let rearTireWidth = findNearestTireWidth(actualRearWidth || 11, actualRearDia);
    // Cap rear tire at 315mm for 22"+ (larger sizes have poor inventory)
    if (actualRearDia >= 22 && rearTireWidth > 315) rearTireWidth = 315;
    
    // Calculate aspect ratio - use 35 for most sizes, 30 for very wide (285mm+) tires
    const frontAspect = frontTireWidth >= 285 ? 30 : 35;
    const rearAspect = rearTireWidth >= 285 ? 30 : 35;
    
    staggeredFrontTireSize = `${frontTireWidth}/${frontAspect}R${actualFrontDia}`;
    staggeredRearTireSize = `${rearTireWidth}/${rearAspect}R${actualRearDia}`;
    
    console.log('[tires/page] 🔄 STAGGERED TIRE SIZES GENERATED:', {
      front: staggeredFrontTireSize,
      rear: staggeredRearTireSize,
      userOverride: userSelectedSquareSetup ? 'square' : userSelectedStaggeredSetup ? 'staggered' : 'none',
      actualSpecs: {
        front: `${actualFrontDia}" × ${actualFrontWidth}"`,
        rear: `${actualRearDia}" × ${actualRearWidth}"`,
      },
    });
  } else if (isStaggeredVehicle && isPackageFlow && userSelectedSquareSetup) {
    console.log('[tires/page] ℹ️ User selected SQUARE setup on staggered vehicle - showing single size search');
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CLASSIC VEHICLE CHECK
  // ═══════════════════════════════════════════════════════════════════════════
  // For classic vehicles without trim data (e.g., 1970 Chevelle), check if we
  // have static tire sizes available. If so, proceed without requiring a modification.
  const prefetchFitment = year && make && model && !modification
    ? await fetchFitment({ year, make, model })
    : null;
  
  const hasStaticTireData = prefetchFitment?.tireSizes?.length > 0 || prefetchFitment?.hasLegacySizes;
  
  // Only require trim selection if:
  // 1. We have a vehicle selected (year/make/model)
  // 2. No modification is specified
  // 3. AND we don't have static tire data available (not a classic vehicle)
  if (year && make && model && !modification && !hasStaticTireData) {
    return (
      <main className="bg-neutral-50">
        <div className="mx-auto max-w-screen-2xl px-4 py-8">
          <div className="rounded-3xl border border-red-100 bg-gradient-to-r from-red-50 via-white to-white p-6">
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Tires</h1>
            <p className="mt-2 text-sm text-neutral-700">
              Select your vehicle <span className="font-semibold">trim / option</span> to show tires that fit.
            </p>
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
              Current selection: <span className="font-semibold">{year} {make} {model}</span>
              <div className="mt-2 text-xs text-neutral-500">
                Tip: Open the vehicle picker and choose a trim (it will auto-search).
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }
  
  if (dbProfile) {
    console.log('[tires/page] ✅ DB PROFILE CONSUMED:', {
      modificationId: dbProfile.modificationId,
      displayTrim: dbProfile.displayTrim,
      oemTireSizes: dbProfile.oemTireSizes,
      boltPattern: dbProfile.boltPattern,
      source: dbProfile.source,
    });
  } else if (hasVehicle && modification) {
    console.log('[tires/page] ⚠️ NO DB PROFILE - falling back to legacy tire-sizes API');
  } else if (hasVehicle && hasStaticTireData) {
    console.log('[tires/page] 🚗 CLASSIC VEHICLE - using static tire data without modification');
  }

  // Legacy API fallback (only used when dbProfile unavailable)
  // For classic vehicles without modification, use the prefetched data
  const fitmentStrict = prefetchFitment || (year && make && model
    ? await fetchFitment({ year, make, model, modification: modification || undefined })
    : null);

  // Aggregate fitment (all trims) - use prefetch if available to avoid duplicate call
  const fitmentAgg = prefetchFitment || (year && make && model
    ? await fetchFitment({ year, make, model })
    : null);

  // ═══════════════════════════════════════════════════════════════════════════
  // TIRE SIZE RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════
  // Priority:
  // 1. LIFTED BUILD: Use lifted tire recommendations (e.g., 35x12.50R20)
  // 2. DB PROFILE: Use oemTireSizes from fitment database (internal only, no external fallback)
  //
  // LEGACY SIZE CONVERSION:
  // Classic vehicles (pre-1975) often have legacy tire sizes like E70-14, G60-15.
  // The API returns both:
  //   - tireSizes: Original OEM sizes (for display, e.g., "E70-14")
  //   - searchableSizes: Modern P-metric equivalents (for search, e.g., "205/75R14")
  // We display the original sizes but use searchableSizes for actual product search.
  
  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY TIRE SIZE DATA
  // ═══════════════════════════════════════════════════════════════════════════
  // Extract legacy conversion data from API response
  const hasLegacySizes: boolean = Boolean(fitmentStrict?.hasLegacySizes);
  const sizeConversions: Array<{
    originalSize: string;
    recommendedSize: string;
    alternatives: string[];
    isLegacy: boolean;
  }> = Array.isArray(fitmentStrict?.sizeConversions) ? fitmentStrict.sizeConversions : [];
  
  // Searchable sizes = modern P-metric equivalents for legacy sizes
  // Falls back to tireSizes if no conversion needed
  const searchableSizesFromApi: string[] = Array.isArray(fitmentStrict?.searchableSizes)
    ? fitmentStrict.searchableSizes.map(String)
    : [];
  
  // Build a map from original size → searchable size for chip selection
  const sizeConversionMap = new Map<string, string>();
  for (const conv of sizeConversions) {
    if (conv.isLegacy && conv.recommendedSize) {
      sizeConversionMap.set(conv.originalSize, conv.recommendedSize);
    }
  }

  // OEM sizes from fitment data (used for non-lifted builds and as fallback)
  // These are the ORIGINAL sizes (may be legacy like E70-14)
  const oemTireSizesStrict: string[] = dbProfile?.oemTireSizes?.length
    ? dbProfile.oemTireSizes.map(String)
    : (Array.isArray(fitmentStrict?.tireSizes) ? fitmentStrict.tireSizes.map(String) : []);

  const oemTireSizesAgg: string[] = Array.isArray(fitmentAgg?.tireSizes)
    ? fitmentAgg.tireSizes.map(String)
    : [];

  // LIFTED BUILD: Override tire sizes with lifted recommendations
  // When user comes from /lifted page, use those sizes instead of stock OEM
  const tireSizesStrict: string[] = isLiftedBuild && liftedTireSizes.length > 0
    ? liftedTireSizes
    : oemTireSizesStrict;

  // For lifted builds, don't include OEM aggregate sizes (they're stock, not lifted)
  const tireSizesAgg: string[] = isLiftedBuild
    ? [] // Don't mix stock sizes with lifted recommendations
    : oemTireSizesAgg;

  // tireSizes = original OEM sizes for DISPLAY (may include legacy like E70-14)
  const tireSizes = Array.from(new Set([...tireSizesStrict, ...tireSizesAgg]));
  
  // searchableTireSizes = modern P-metric sizes for SEARCH
  // For legacy vehicles, use the converted sizes; otherwise use original
  const searchableTireSizes: string[] = hasLegacySizes && searchableSizesFromApi.length > 0
    ? searchableSizesFromApi
    : tireSizes;
  
  // Log tire size source for debugging
  if (hasVehicle) {
    console.log('[tires/page] 📊 Tire sizes:', {
      source: isLiftedBuild ? 'LIFTED BUILD' : (dbProfile?.oemTireSizes?.length ? 'dbProfile' : 'legacy API'),
      isLiftedBuild,
      liftedSizes: isLiftedBuild ? liftedTireSizes : null,
      strict: tireSizesStrict,
      aggregate: tireSizesAgg.filter(s => !tireSizesStrict.includes(s)),
      total: tireSizes.length,
      hasLegacySizes,
      searchableSizes: hasLegacySizes ? searchableTireSizes : null,
      conversions: sizeConversions.length > 0 ? sizeConversions.map(c => `${c.originalSize}→${c.recommendedSize}`) : null,
    });
  }

  // Resolve modificationId to display label if trim looks like a hash ID
  let resolvedTrimLabel: string | undefined;
  if (trim && /^s_[a-f0-9]{8}$/.test(trim) && year && make && model) {
    try {
      const trimsRes = await fetch(
        `${getBaseUrl()}/api/vehicles/trims?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`,
        { cache: "force-cache" }
      );
      if (trimsRes.ok) {
        const trimsData = await trimsRes.json();
        const match = trimsData?.results?.find((t: any) => t.modificationId === trim || t.value === trim);
        if (match?.label) {
          resolvedTrimLabel = match.label;
        }
      }
    } catch {
      // Ignore lookup errors
    }
  }

  // Build display-friendly trim label (never shows engine text like "5.7i")
  const displayTrim = getDisplayTrim({
    trim: resolvedTrimLabel || trim,
    submodel: (fitmentStrict as any)?.selectedModification?.name || (fitmentStrict as any)?.vehicle?.trim,
  });

  function rimDiaFromSize(s: string) {
    const str = String(s || "").toUpperCase();
    
    // Modern P-metric: 205/75R14, 275/65R18 → extract R## part
    const modernMatch = str.match(/R(\d{2})\b/);
    if (modernMatch) return Number(modernMatch[1]);
    
    // Legacy alphanumeric: E70-14, F60-15, G78-14 → extract trailing ##
    // Pattern: [letter][##]-[##] where last ## is rim diameter
    const legacyMatch = str.match(/^[A-Z]\d{2}-(\d{2})$/);
    if (legacyMatch) return Number(legacyMatch[1]);
    
    // Legacy with optional letters: FR70-14, GR70-15 → extract trailing ##
    const legacyRadialMatch = str.match(/^[A-Z]+R?\d{2}-(\d{2})$/);
    if (legacyRadialMatch) return Number(legacyRadialMatch[1]);
    
    return null;
  }

  // For staggered vehicles, use effective wheel specs that consider fitment data
  // This handles the case where URL only has one wheel but fitment tells us about both axles
  const wheelDiaForTireSearch = isStaggeredVehicle && isPackageFlow && effectiveWheelDia
    ? effectiveWheelDia
    : wheelDiaActive;
  const wheelWidthForTireSearch = isStaggeredVehicle && isPackageFlow && effectiveWheelWidth
    ? effectiveWheelWidth
    : wheelWidthActive;
  
  const wheelDiaNum = wheelDiaForTireSearch ? Number(String(wheelDiaForTireSearch).replace(/[^0-9.]/g, "")) : NaN;
  const wheelWidthNum = wheelWidthForTireSearch ? Number(String(wheelWidthForTireSearch).replace(/[^0-9.]/g, "")) : NaN;

  // For legacy vehicles, match using either the original sizes OR the converted sizes
  // This ensures wheel matching works for both E70-14 (rim=14) and 205/75R14 (rim=14)
  const oemWheelMatchedSizes = Number.isFinite(wheelDiaNum) && wheelDiaNum > 0
    ? tireSizes.filter((s) => {
        // First try direct rim extraction from the original size
        const rimDia = rimDiaFromSize(s);
        if (rimDia === Math.round(wheelDiaNum)) return true;
        
        // For legacy sizes, also check the converted searchable size
        if (sizeConversionMap.has(s)) {
          const converted = sizeConversionMap.get(s)!;
          const convertedRimDia = rimDiaFromSize(converted);
          if (convertedRimDia === Math.round(wheelDiaNum)) return true;
        }
        
        return false;
      })
    : [];

  const strictMatchedSizes = Number.isFinite(wheelDiaNum) && wheelDiaNum > 0
    ? tireSizesStrict.filter((s) => rimDiaFromSize(s) === Math.round(wheelDiaNum))
    : [];

  const aggMatchedSizes = Number.isFinite(wheelDiaNum) && wheelDiaNum > 0
    ? tireSizesAgg.filter((s) => rimDiaFromSize(s) === Math.round(wheelDiaNum) && !strictMatchedSizes.includes(s))
    : [];

  // PLUS-SIZING: When wheel diameter is selected but no OEM sizes match,
  // compute plus-size tire candidates using the real tire-sizes.json database.
  // Uses overall diameter matching (±3% acceptable, ±2% primary/recommended).
  const plusSizeResult = (() => {
    // Only compute plus-sizes when we have a valid wheel diameter and no OEM match
    if (!Number.isFinite(wheelDiaNum) || wheelDiaNum <= 0) return null;
    if (oemWheelMatchedSizes.length > 0) return null; // OEM sizes exist, no need
    
    // CRITICAL: Skip plus-sizing for lifted builds
    // Lifted sizes are intentional recommendations, not OEM sizes to be scaled
    // If lifted sizes don't match wheel diameter, we should NOT fall back to calculated sizes
    if (isLiftedBuild) return null;
    
    // If we have OEM sizes, use them as reference for plus-sizing
    if (tireSizesStrict.length > 0) {
      const referenceOemSize = tireSizesStrict[0];
      const result = generatePlusSizeCandidates(
        referenceOemSize,
        Math.round(wheelDiaNum),
        {
          wheelWidth: Number.isFinite(wheelWidthNum) ? wheelWidthNum : undefined,
          maxOdDiffPercent: 3,
          primaryOdDiffPercent: 2,
        }
      );
      return result;
    }
    
    // No OEM sizes available - use aftermarket fallback
    // This happens when fitment data is missing/incomplete
    return null; // Will be handled by aftermarketFallback below
  })();
  
  // AFTERMARKET FALLBACK: When NO OEM data exists at all,
  // suggest tire sizes based purely on wheel specs and vehicle class.
  // This is critical for aftermarket wheel builds on vehicles without fitment data.
  const aftermarketFallback = (() => {
    // Only use fallback when:
    // 1. We have a wheel diameter
    // 2. No OEM sizes available at all (not just no match for this diameter)
    // 3. Plus-sizing couldn't help (no reference)
    // 4. NOT a lifted build (lifted builds use specific sizes)
    if (!Number.isFinite(wheelDiaNum) || wheelDiaNum <= 0) return null;
    if (oemWheelMatchedSizes.length > 0) return null; // Have OEM match
    if (plusSizeResult && plusSizeResult.acceptableCandidates.length > 0) return null; // Plus-sizing worked
    if (isLiftedBuild) return null; // Lifted builds don't use aftermarket fallback
    
    // Detect vehicle class from model name for better suggestions
    const modelLower = String(model || "").toLowerCase();
    let vehicleClass: 'truck' | 'suv' | 'car' = 'car';
    if (/f-\d{3}|silverado|sierra|ram|tundra|titan|tacoma|ranger|frontier|colorado|canyon|ridgeline|maverick/i.test(modelLower)) {
      vehicleClass = 'truck';
    } else if (/wrangler|bronco|4runner|tahoe|suburban|expedition|explorer|highlander|pilot|pathfinder|telluride|palisade|defender|grand cherokee|durango|sequoia|armada|escalade|yukon/i.test(modelLower)) {
      vehicleClass = 'suv';
    }
    
    // Use aftermarket sizing function for wheel-based suggestions
    return generateAftermarketTireSizes(
      Math.round(wheelDiaNum),
      Number.isFinite(wheelWidthNum) ? wheelWidthNum : undefined,
      vehicleClass
    );
  })();

  // Plus-size suggestions: prioritize primary (±2%), then acceptable (±3%)
  // Also include aftermarket fallback if plus-sizing didn't produce valid results
  // BUG FIX: Check if plusSizeResult has actual candidates, not just if it exists
  const plusSizeHasResults = plusSizeResult && plusSizeResult.acceptableCandidates.length > 0;
  
  const plusSizeSuggestions: string[] = plusSizeHasResults
    ? plusSizeResult.acceptableCandidates.map((c) => c.size)
    : (aftermarketFallback ? aftermarketFallback.sizes : []);

  // Plus-size candidates with full metadata (for display)
  const plusSizeCandidates: PlusSizeCandidate[] = plusSizeHasResults
    ? plusSizeResult.acceptableCandidates
    : (aftermarketFallback ? aftermarketFallback.candidates : []);

  // Primary plus-sizes (±2% OD) - recommended
  const primaryPlusSizes: string[] = plusSizeHasResults
    ? plusSizeResult.primaryCandidates.map((c) => c.size)
    : (aftermarketFallback ? aftermarketFallback.candidates.filter((c: any) => c.isPrimary).map((c: any) => c.size) : []);

  // Track sizing method for display/logging (computed later after lockedSizes)
  const sizingMethod = oemWheelMatchedSizes.length > 0 
    ? 'oem' 
    : (plusSizeHasResults ? 'plus-size' : (aftermarketFallback ? 'aftermarket-fallback' : 'none'));

  let lockedSizes: string[] = [];
  const noOemSizesForWheel = Number.isFinite(wheelDiaNum) && wheelDiaNum > 0 && oemWheelMatchedSizes.length === 0;
  const hasPlusSizes = plusSizeSuggestions.length > 0;

  if (Number.isFinite(wheelDiaNum) && wheelDiaNum > 0) {
    // CRITICAL: Only lock to sizes that MATCH the wheel diameter
    // Rule 7: Never show a tire whose rim does not equal the selected wheel diameter
    // Rule 8: Never fall back to OEM sizes when a non-OEM wheel diameter is selected
    if (oemWheelMatchedSizes.length > 0) {
      // OEM sizes exist for this wheel diameter - use them
      lockedSizes = oemWheelMatchedSizes;
    } else if (plusSizeSuggestions.length > 0) {
      // No OEM sizes match, but we have plus-size or aftermarket candidates - use those
      lockedSizes = plusSizeSuggestions;
    }
    // If neither OEM nor plus-sizes nor aftermarket available, lockedSizes stays empty
  }

  // IMPORTANT: When wheel diameter is specified, ONLY show matching sizes
  // Do NOT fall back to all tire sizes - that would show wrong-diameter tires
  const displayedSizes = Number.isFinite(wheelDiaNum) && wheelDiaNum > 0
    ? lockedSizes // Only show sizes matching wheel diameter (OEM or plus-size)
    : (lockedSizes.length ? lockedSizes : tireSizes); // No wheel = show all OEM sizes

  const selectedSizeRaw = (axle === "rear" ? sizeRearRaw : sizeFrontRaw) || (safeString(Array.isArray(sp.size) ? sp.size[0] : sp.size));
  const metricSizeOverride = safeString(Array.isArray((sp as any).metricSize) ? (sp as any).metricSize[0] : (sp as any).metricSize);
  
  // BUG FIX: When wheel diameter is selected, NEVER fall back to incompatible OEM sizes
  // Only use OEM sizes as fallback when NO wheel is selected (general tire browsing)
  const hasWheelDiameter = Number.isFinite(wheelDiaNum) && wheelDiaNum > 0;
  const selectedSizeCandidate = selectedSizeRaw
    ? String(selectedSizeRaw)
    : hasWheelDiameter
      // Wheel selected: only use wheel-compatible sizes (no OEM fallback)
      ? (displayedSizes[0] || plusSizeSuggestions[0] || "")
      // No wheel: can use any OEM size
      : (displayedSizes[0] || plusSizeSuggestions[0] || tireSizesStrict[0] || tireSizes[0] || "");

  // Validate selected size is in the allowed set
  const allowedSizes = lockedSizes.length > 0 ? lockedSizes : displayedSizes;
  const selectedSize = allowedSizes.length > 0
    ? (allowedSizes.includes(selectedSizeCandidate) ? selectedSizeCandidate : (allowedSizes[0] || ""))
    : selectedSizeCandidate;

  const sizeFront = axle === "front" ? selectedSize : (sizeFrontRaw || "");
  const sizeRear = axle === "rear" ? selectedSize : (sizeRearRaw || "");

  // DISPLAY SIZE: Prefer flotation format for user-facing display
  // selectedSize is the normalized digits (33125020) for search, but we want to show
  // the human-readable flotation format (33x12.50R20) when available
  const flotationParam = safeString(Array.isArray((sp as any).flotation) ? (sp as any).flotation[0] : (sp as any).flotation);
  const displaySize = flotationParam && /^\d{2,3}x\d{1,2}(\.\d{2})?R\d{2}$/i.test(flotationParam)
    ? flotationParam  // Use flotation format for display: "33x12.50R20"
    : selectedSize;   // Fallback to metric/standard format

  // Debug logging for wheel→tire size resolution (now that lockedSizes is computed)
  if (hasVehicle && hasWheelDiameter) {
    console.log('[tires/page] 🔧 WHEEL→TIRE SIZE RESOLUTION:', {
      wheelDiameter: wheelDiaNum,
      wheelWidth: wheelWidthNum || 'unknown',
      oemSizesAvailable: tireSizesStrict,
      oemMatchingWheel: oemWheelMatchedSizes,
      plusSizeResult: plusSizeResult ? {
        referenceOem: plusSizeResult.oemSize,
        referenceOd: plusSizeResult.oemOverallDiameter,
        candidateCount: plusSizeResult.acceptableCandidates.length,
        candidates: plusSizeResult.acceptableCandidates.slice(0, 3).map(c => `${c.size} (${c.odDiffPercent > 0 ? '+' : ''}${c.odDiffPercent.toFixed(1)}%)`),
      } : null,
      aftermarketFallback: aftermarketFallback ? {
        sizeCount: aftermarketFallback.sizes.length,
        sizes: aftermarketFallback.sizes.slice(0, 5),
      } : null,
      finalMethod: sizingMethod,
      finalSuggestions: plusSizeSuggestions.slice(0, 5),
      lockedSizes: lockedSizes.slice(0, 5),
      selectedSize,
    });
  }
  
  if (aftermarketFallback && hasWheelDiameter) {
    console.log('[tires/page] 🔧 AFTERMARKET FALLBACK USED:', aftermarketFallback.debug);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY SIZE → SEARCH SIZE CONVERSION
  // ═══════════════════════════════════════════════════════════════════════════
  // When selectedSize is a legacy format (E70-14, etc.), convert it to the
  // modern P-metric equivalent for the actual tire search.
  // Display shows original size, but search uses converted size.
  const searchSizeForFetch = (() => {
    // For flotation sizes (33x12.50R20 format), ALWAYS use the flotation format for search
    // because K&M returns different tires for flotation vs metric equivalent
    const flotationParam = safeString(Array.isArray((sp as any).flotation) ? (sp as any).flotation[0] : (sp as any).flotation);
    if (flotationParam && /^\d{2,3}x\d{1,2}(\.\d{2})?R\d{2}$/i.test(flotationParam)) {
      // Convert flotation to simple size format: 33x12.50R20 -> 33125020
      const m = flotationParam.match(/^(\d{2,3})x(\d{1,2})(?:\.(\d{2}))?R(\d{2})$/i);
      if (m) {
        const whole = m[1];
        const width = m[2];
        const decimal = m[3] || "00";
        const rim = m[4];
        return `${whole}${width}${decimal}${rim}`;
      }
    }
    
    // If we have a metricSizeOverride from URL and no flotation, use that
    if (metricSizeOverride) return metricSizeOverride;
    
    // If selectedSize is in our legacy conversion map, use the converted size
    if (selectedSize && sizeConversionMap.has(selectedSize)) {
      const converted = sizeConversionMap.get(selectedSize)!;
      console.log(`[tires/page] 🔄 Legacy size conversion: ${selectedSize} → ${converted}`);
      return converted;
    }
    
    // For non-legacy vehicles or if no conversion needed, use selectedSize as-is
    return selectedSize;
  })();
  
  // Fetch tires from unified search (includes K&M, WheelPros, TireWeb + admin overrides)
  const wpSize = searchSizeForFetch;
  
  // For staggered vehicles in package flow, also fetch tire pairs
  const shouldFetchStaggeredPairs = isStaggeredVehicle && isPackageFlow && staggeredFrontTireSize && staggeredRearTireSize;
  
  const [unifiedTires, staggeredPairsData, rebates] = await Promise.all([
    (wpSize || selectedSize) ? fetchTireWebTires(wpSize || selectedSize) : null,
    shouldFetchStaggeredPairs 
      ? fetchStaggeredTirePairs(staggeredFrontTireSize!, staggeredRearTireSize!)
      : Promise.resolve({ pairs: [], pairCount: 0 }),
    fetchActiveRebates(),
  ]);
  
  // Extract staggered tire pairs
  const staggeredTirePairs: StaggeredTirePair[] = staggeredPairsData?.pairs || [];
  if (shouldFetchStaggeredPairs) {
    console.log(`[tires/page] 🔄 STAGGERED PAIRS FETCHED: ${staggeredTirePairs.length} pairs`);
  }
  
  // Unified search returns all sources with overrides applied
  const tw = unifiedTires;
  // K&M and WP are now part of unified search - set to empty for backward compat
  const km: { items?: any[]; error?: string } | null = { items: [] };
  const wp: { items?: any[]; error?: string } | null = { items: [] };

  const rebatesByBrand = new Map<string, any>();
  for (const r of (rebates as any)?.items || []) {
    const b = String(r?.brand || "").trim().toLowerCase();
    if (!b) continue;
    if (!rebatesByBrand.has(b)) rebatesByBrand.set(b, r);
  }

  // Map TireWeb results to our Tire format
  type TireWebResult = {
    partNumber?: string;
    mfgPartNumber?: string;
    brand?: string;
    model?: string;
    description?: string;
    cost?: number;
    price?: number;
    quantity?: { primary?: number; alternate?: number; national?: number };
    imageUrl?: string;
    tireLibraryId?: number;
    source?: string;
    badges?: any;
  };
  
  const itemsTw: Tire[] = (Array.isArray(tw?.results) ? tw.results : []).map((t: TireWebResult) => {
    // Map source from unified search: "km" → "km", "wheelpros" → "wp", "TireWeb:*" → "tw"
    let mappedSource: "wp" | "km" | "tw" = "tw";
    if (t.source === "km") mappedSource = "km";
    else if (t.source === "wheelpros") mappedSource = "wp";
    else if (t.source?.startsWith("TireWeb")) mappedSource = "tw";
    
    return {
      source: mappedSource,
      rawSource: t.source, // Preserve full source for cart tracking (e.g., "tireweb:atd")
      partNumber: t.partNumber,
      mfgPartNumber: t.mfgPartNumber,
      brand: t.brand,
      description: t.description || (t.brand && t.model ? `${t.brand} ${t.model}` : undefined),
      cost: t.cost,
      price: t.price, // Retail price / MAP from TireWeb
      quantity: t.quantity,
      imageUrl: t.imageUrl, // TireLibrary images!
      displayName: t.model ? `${t.brand || ''} ${t.model}`.trim() : undefined,
      badges: t.badges,
      enrichment: (t as any).enrichment, // Preserve enrichment data for filters!
    };
  });

  const itemsKm: Tire[] = (Array.isArray(km?.items) ? km.items : []).map((t: Tire) => ({ ...t, source: "km" as const, rawSource: "km" }));
  const itemsWp: Tire[] = (Array.isArray(wp?.items) ? wp.items : []).map((t: Tire) => ({ ...t, source: "wp" as const, rawSource: "wheelpros" }));

  // Build deduped map: TireWeb first (has images), then K&M, then WP
  // Key by brand + normalized part number for matching
  const byId = new Map<string, Tire>();
  
  function normalizeKey(brand: string | undefined, partNumber: string | undefined): string {
    const b = String(brand || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const p = String(partNumber || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return `${b}:${p}`;
  }
  
  // Add TireWeb results first (they have TireLibrary images)
  for (const t of itemsTw) {
    const key = normalizeKey(t.brand, t.mfgPartNumber || t.partNumber);
    if (!key || key === ":") continue;
    byId.set(key, t);
  }
  
  // Add K&M results - if matching TireWeb exists, enrich K&M with TireWeb image
  for (const t of itemsKm) {
    const key = normalizeKey(t.brand, t.mfgPartNumber || t.partNumber);
    if (!key || key === ":") continue;
    
    const existing = byId.get(key);
    if (existing?.imageUrl) {
      // TireWeb has this tire with image - use K&M data but keep TireWeb image
      byId.set(key, { ...t, imageUrl: existing.imageUrl, displayName: existing.displayName || t.displayName });
    } else {
      byId.set(key, t);
    }
  }
  
  // Add WP results - similar enrichment
  for (const t of itemsWp) {
    const key = normalizeKey(t.brand, t.mfgPartNumber || t.partNumber);
    if (!key || key === ":") continue;
    
    const existing = byId.get(key);
    if (existing) {
      // Already have from TW or K&M - skip or merge
      if (!existing.imageUrl && t.imageUrl) {
        existing.imageUrl = t.imageUrl;
      }
    } else {
      byId.set(key, t);
    }
  }

  const itemsFallback: Tire[] = Array.from(byId.values());

  const assets = await Promise.all(
    itemsFallback.slice(0, 60).map(async (t) => {
      const km = t.description ? String(t.description) : "";
      if (!km) return null;
      try {
        const res = await fetch(`${getBaseUrl()}/api/assets/tire?km=${encodeURIComponent(km)}`, { cache: "no-store" });
        if (!res.ok) return null;
        const data = (await res.json()) as { results?: TireAsset[] };
        const hit = Array.isArray(data?.results) ? data.results[0] : null;
        if (!hit) return null;
        return { km, asset: hit };
      } catch {
        return null;
      }
    })
  );

  const assetByKm = new Map<string, TireAsset>();
  for (const a of assets) {
    if (a?.km) assetByKm.set(a.km, a.asset);
  }

  function stripSizeFromName(name: string) {
    const s = String(name || "");
    if (!s) return "";
    let out = s.replace(/\b(?:LT|P)?\d{3}\/\d{2}(?:ZR|R)-?\d{2}\b/gi, "");
    out = out.replace(/\b\d{2}\/\d{4}r\d{2}(?:\/[a-z])?\b/gi, "");
    out = out.replace(/\b\d{2}\s*[xX]\s*\d{1,2}\.\d{2}\s*R\s*\d{2}(?:\.5)?\b/gi, "");
    out = out.replace(/\b\d{7}\b/g, "").replace(/\b\d{8}\b/g, "");
    out = out.replace(/\b\d{2}\.\d\b/g, "");
    out = out.replace(/\s*\/e\s+/gi, " "); // Strip K&M economy tier prefix
    out = out.replace(/\s+/g, " ").trim();
    return out;
  }

  function prettyKmName(brand: string, description: string) {
    const b = String(brand || "").trim();
    const d = String(description || "").trim();
    if (!d) return "";

    const tokens = d.toUpperCase().replace(/\s+/g, " ").split(" ").filter(Boolean);
    const start = tokens.length && /^[A-Z]{2,4}$/.test(tokens[0]) ? 1 : 0;

    const cleaned = tokens
      .slice(start)
      .filter((t) => !/^\d{3}\/\d{2}R\d{2}$/.test(t) && !/^\d{3}\/\d{2}ZR\d{2}$/.test(t))
      .filter((t) => !/^(?:LT|P)?\d{3}\/\d{2}R\d{2}$/.test(t) && !/^(?:LT|P)?\d{3}\/\d{2}ZR\d{2}$/.test(t))
      .filter((t) => !/^\d{2}\/\d{4}R\d{2}(?:\/[A-Z])?$/.test(t))
      .filter((t) => !/^\d{7}$/.test(t) && !/^\d{8}$/.test(t))
      .filter((t) => !/^\d{2}\.\d$/.test(t));

    const map: Record<string, string> = {
      AS: "All Season", "A/": "All Season", "A/S": "All Season",
      AW: "All Weather", AT: "All Terrain", "A/T": "All Terrain",
      MT: "Mud Terrain", "M/T": "Mud Terrain", HT: "Highway Terrain", "H/T": "Highway Terrain",
      WIN: "Winter", WTR: "Winter", SNOW: "Winter",
      TOUR: "Touring", PERF: "Performance", HP: "Performance", UHP: "Ultra High Performance",
      RFT: "Run Flat", RF: "Run Flat",
      CINT: "Cinturato", EAG: "Eagle", SPRT: "Sport", ASSUR: "Assurance",
      WRAN: "Wrangler", DEST: "Destination", DUEL: "Dueler", DEF: "Defender",
      PILOT: "Pilot", PRIM: "Primacy", LAT: "Latitude", ENERGY: "Energy",
    };

    const words: string[] = [];
    for (const t of cleaned) {
      if (/^\d{2,3}(?:\/\d{2,3})?[A-Z]$/.test(t)) continue;
      if (/^\d{2,3}$/.test(t)) continue;
      const v = map[t] || map[t.replace(/[^A-Z0-9/]/g, "")] || "";
      words.push(v || t);
    }

    const joined = words.join(" ").replace(/\s+/g, " ").trim();
    if (!joined) return "";

    const out = b && !joined.toLowerCase().startsWith(b.toLowerCase()) ? `${b} ${joined}` : joined;
    return out
      .split(" ")
      .map((w) => (w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))
      .join(" ")
      .replace(/\bRft\b/g, "RFT")
      .replace(/\bUhp\b/g, "UHP")
      .replace(/\bHp\b/g, "HP")
      .replace(/\bAt\b/g, "AT")
      .replace(/\bMt\b/g, "MT")
      .replace(/\bHt\b/g, "HT");
  }

  const itemsEnriched: Tire[] = itemsFallback.map((t) => {
    const km = t.description ? String(t.description) : "";
    const asset = km ? assetByKm.get(km) : undefined;
    const prettyName =
      !asset?.display_name && t.source === "km" && t.brand && t.description
        ? prettyKmName(String(t.brand), String(t.description))
        : undefined;

    return {
      ...t,
      displayName: asset?.display_name || t.displayName || undefined,
      imageUrl: asset?.image_url || t.imageUrl || undefined,
      prettyName,
    };
  });

  function parseFromDescription(desc: string) {
    const d = String(desc || "").toUpperCase();
    const isRunFlat = /\b(RFT|EMT|ROF|RUN\s*-?FLAT)\b/.test(d);
    const isXL = /\bXL\b/.test(d);
    const speedMatch = d.match(/\b\d{2,3}([A-Z])\b(?!.*\b\d{2,3}[A-Z]\b)/);
    const speed = speedMatch ? speedMatch[1] : undefined;

    let season: "All-season" | "Winter" | "Summer" | "All-terrain" | undefined;
    if (/\b(BLIZZAK|WS\d+|X-ICE|ICE|WINTER|SNOW)\b/.test(d)) season = "Winter";
    else if (/\b(A\/?S|AS\b|ALL\s*-?SEASON)\b/.test(d)) season = "All-season";
    else if (/\b(A\/T|AT\b|ALL\s*-?TERRAIN)\b/.test(d)) season = "All-terrain";
    else if (/\b(SUMMER|MAX\s*-?PERFORMANCE)\b/.test(d)) season = "Summer";

    const isAllWeather = /\bALL\s*-?WEATHER\b/.test(d);
    const isSnowRated = /\b(3PMSF|\b3\s*PEAK\b|M\+S|M\s*\+\s*S)\b/.test(d);

    return { isRunFlat, isXL, speed, season, isAllWeather, isSnowRated };
  }

  const brandCounts = new Map<string, number>();
  for (const t of itemsEnriched) {
    const b = String(t.brand || "").trim();
    if (!b) continue;
    brandCounts.set(b, (brandCounts.get(b) || 0) + 1);
  }

  const brandsByCount = Array.from(brandCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const topBrands = brandsByCount.slice(0, 6).map(([b]) => b);
  const restBrands = brandsByCount.slice(6).map(([b]) => b).sort((a, b) => a.localeCompare(b));
  const allBrands = [...topBrands, ...restBrands];

  const speedCounts = new Map<string, number>();
  let runFlatCount = 0;
  let snowRatedCount = 0;  // 3PMSF
  let allWeatherCount = 0;
  let xlCount = 0;
  const loadRangeCounts = new Map<string, number>();

  for (const t of itemsEnriched) {
    // Extract speed rating from description
    const d = String(t.description || "").toUpperCase();
    const speedMatch = d.match(/\b\d{2,3}([A-Z])\b(?!.*\b\d{2,3}[A-Z]\b)/);
    if (speedMatch) speedCounts.set(speedMatch[1], (speedCounts.get(speedMatch[1]) || 0) + 1);
    
    // Use enrichment data for feature flags (API normalizes these)
    if (t.enrichment?.isRunFlat) runFlatCount++;
    if (t.enrichment?.is3PMSF) snowRatedCount++;
    if (t.enrichment?.isAllWeather) allWeatherCount++;
    if (t.enrichment?.isXL) xlCount++;

    // Load range from enrichment
    const lr = t.enrichment?.loadRange;
    if (lr) loadRangeCounts.set(lr, (loadRangeCounts.get(lr) || 0) + 1);
  }

  // Tread category counts - uses resolveTreadCategory() for consistency with filtering
  const treadCategoryCounts = new Map<TreadCategory, number>();
  let mileage40kCount = 0;
  let mileage60kCount = 0;
  let mileage80kCount = 0;

  for (const t of itemsEnriched) {
    // Use shared resolution function for consistent counting/filtering
    const category = resolveTreadCategory(t);
    treadCategoryCounts.set(category, (treadCategoryCounts.get(category) || 0) + 1);
    
    const mileage = t.enrichment?.mileage ?? t.badges?.warrantyMiles;
    if (mileage && mileage >= 40000) mileage40kCount++;
    if (mileage && mileage >= 60000) mileage60kCount++;
    if (mileage && mileage >= 80000) mileage80kCount++;
  }

  // Sort tread categories by count, keeping only those with items
  const treadCategoriesAvailable = TREAD_CATEGORIES
    .filter(tc => treadCategoryCounts.get(tc))
    .sort((a, b) => (treadCategoryCounts.get(b) || 0) - (treadCategoryCounts.get(a) || 0));

  const speedsAvailable = Array.from(speedCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s]) => s);

  // Load ranges available - only show options that exist in results
  const loadRangesAvailable = LOAD_RANGES
    .filter(lr => loadRangeCounts.get(lr.value))
    .sort((a, b) => (loadRangeCounts.get(b.value) || 0) - (loadRangeCounts.get(a.value) || 0));

  // Size-based facets (rim diameter, overall diameter) for mixed flotation + metric results
  const rimDiameterCounts = new Map<number, number>();
  const overallDiameterCounts = new Map<string, number>();

  for (const t of itemsEnriched) {
    const sizeStr = (t as any).size || (t as any).description || "";
    const parsed = parseTireSize(sizeStr, t.description);
    
    if (parsed.rimDiameter) {
      rimDiameterCounts.set(parsed.rimDiameter, (rimDiameterCounts.get(parsed.rimDiameter) || 0) + 1);
    }
    
    const normalizedDia = normalizeOverallDiameter(parsed.overallDiameter);
    if (normalizedDia) {
      overallDiameterCounts.set(normalizedDia, (overallDiameterCounts.get(normalizedDia) || 0) + 1);
    }
  }

  // Sort rim diameters numerically
  const rimDiametersAvailable = Array.from(rimDiameterCounts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rim]) => rim);

  // Sort overall diameters by numeric value
  const overallDiametersAvailable = Array.from(overallDiameterCounts.entries())
    .sort((a, b) => {
      const numA = parseInt(a[0]) || 0;
      const numB = parseInt(b[0]) || 0;
      return numA - numB;
    })
    .map(([dia]) => dia);

  function normalizeSizeKey(s: string) {
    // Strip LT/P prefix, spaces, dashes, and convert ZR to R for consistent matching
    return String(s || "").toUpperCase().replace(/^(LT|P)/i, "").replace(/\s+/g, "").replace(/ZR/g, "R").replace(/-/g, "");
  }

  function extractSizeFromText(s: string) {
    const m = String(s || "").toUpperCase().match(/\b(\d{3}\/\d{2}(?:ZR|R)\d{2})\b/);
    return m ? m[1].replace("ZR", "R") : "";
  }

  const selectedSizeCore = extractSizeFromText(String(selectedSize || "")) || String(selectedSize || "");
  const selectedSizeKey = normalizeSizeKey(selectedSizeCore);

  const itemsFiltered: Tire[] = itemsEnriched.filter((t) => {
    const desc0 = String(t.description || "");
    const parsed = parseFromDescription(desc0);

    // CRITICAL FIX: When a wheel diameter is selected, ALWAYS filter out tires
    // that don't match, even if lockedSizes is empty (no compatible sizes found)
    // This prevents showing 16" tires when 26" wheels are selected
    if (Number.isFinite(wheelDiaNum) && wheelDiaNum > 0) {
      const sizeInDesc = extractSizeFromText(desc0);
      if (sizeInDesc) {
        const rim = rimDiaFromSize(sizeInDesc);
        // Reject any tire whose rim diameter doesn't match the wheel
        if (rim !== Math.round(wheelDiaNum)) return false;
      }
    }

    if (lockedSizes.length) {
      const sizeInDesc = extractSizeFromText(desc0);
      if (sizeInDesc) {
        if (normalizeSizeKey(sizeInDesc) !== selectedSizeKey) return false;
      }
    }

    if (brands.length) {
      const b = String(t.brand || "").toLowerCase();
      const ok = brands.some((x) => b === String(x).toLowerCase());
      if (!ok) return false;
    }

    // NOTE: Old season filter removed - treadCategory filter below handles category filtering

    if (speeds.length) {
      const spd = parsed.speed || "";
      if (!speeds.includes(spd)) return false;
    }

    // Feature filters - use enrichment data from API
    if (runFlat && !t.enrichment?.isRunFlat) return false;
    if (snowRated && !t.enrichment?.is3PMSF) return false;
    if (allWeather && !t.enrichment?.isAllWeather) return false;
    if (xlOnly && !t.enrichment?.isXL) return false;

    // Load range filter - use enrichment data
    if (loadRanges.length) {
      const lr = t.enrichment?.loadRange || "";
      if (!lr || !loadRanges.includes(lr)) return false;
    }

    // Mileage band filter
    if (selectedMileageBand) {
      const mileage = t.enrichment?.mileage ?? t.badges?.warrantyMiles;
      if (!meetsMinimumMileage(mileage ?? null, selectedMileageBand)) return false;
    }

    // Tread category filter - uses shared resolveTreadCategory() for consistency with counts
    if (treadCategories.length > 0) {
      const tireTread = resolveTreadCategory(t);
      if (!treadCategories.includes(tireTread)) return false;
    }

    const p = getDisplayPrice(t);
    if (typeof priceMin === "number" && Number.isFinite(priceMin)) {
      if (p == null || p < priceMin) return false;
    }
    if (typeof priceMax === "number" && Number.isFinite(priceMax)) {
      if (p == null || p > priceMax) return false;
    }

    // Rim diameter filter (for mixed size searches)
    if (rimDiameters.length > 0) {
      const sizeStr = (t as any).size || t.description || "";
      const parsed = parseTireSize(sizeStr, t.description);
      if (!parsed.rimDiameter || !rimDiameters.includes(parsed.rimDiameter)) return false;
    }

    // Overall diameter filter (for mixed size searches)
    if (overallDiameters.length > 0) {
      const sizeStr = (t as any).size || t.description || "";
      const parsed = parseTireSize(sizeStr, t.description);
      const normalizedDia = normalizeOverallDiameter(parsed.overallDiameter);
      if (!normalizedDia || !overallDiameters.includes(normalizedDia)) return false;
    }

    return true;
  });

  const items: Tire[] = [...itemsFiltered].sort((a, b) => {
    const aPrice = getDisplayPrice(a) ?? Number.POSITIVE_INFINITY;
    const bPrice = getDisplayPrice(b) ?? Number.POSITIVE_INFINITY;
    const aBrand = (a.brand || "").toLowerCase();
    const bBrand = (b.brand || "").toLowerCase();
    const aStock = (a.quantity?.primary ?? 0) + (a.quantity?.alternate ?? 0) + (a.quantity?.national ?? 0);
    const bStock = (b.quantity?.primary ?? 0) + (b.quantity?.alternate ?? 0) + (b.quantity?.national ?? 0);

    switch (sort) {
      case "price_asc": return aPrice - bPrice;
      case "price_desc": return bPrice - aPrice;
      case "brand_asc": return aBrand.localeCompare(bBrand);
      case "stock_desc": return bStock - aStock;
      default: return 0;
    }
  });

  // Top Picks: curated selection based on value, brand, and stock
  const topPicks: Tire[] = (() => {
    if (!hasVehicle || items.length === 0) return [];
    
    const scored = items
      .filter((t) => t.imageUrl && typeof t.cost === "number")
      .map((t) => ({ tire: t, score: scoreTireForPicks(t) }))
      .sort((a, b) => b.score - a.score);
    
    // Take top 8, ensuring brand variety
    const picks: Tire[] = [];
    const usedBrands = new Map<string, number>();
    
    for (const { tire } of scored) {
      if (picks.length >= 8) break;
      const brand = String(tire.brand || "").toLowerCase();
      const brandCount = usedBrands.get(brand) || 0;
      
      if (brandCount < 2) {
        picks.push(tire);
        usedBrands.set(brand, brandCount + 1);
      }
    }
    
    // Fill remaining slots if needed
    if (picks.length < 4) {
      for (const { tire } of scored) {
        if (picks.length >= 8) break;
        if (!picks.includes(tire)) picks.push(tire);
      }
    }
    
    return picks;
  })();

  // Pagination
  const tiresPerPage = 24;
  const totalPages = Math.max(1, Math.ceil(items.length / tiresPerPage));
  const safePage = Math.min(page, totalPages);
  const itemsPage = items.slice((safePage - 1) * tiresPerPage, safePage * tiresPerPage);

  // Build query base for pagination
  const qBase = `${basePath}?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}${trim ? `&trim=${encodeURIComponent(trim)}` : ""}${modification ? `&modification=${encodeURIComponent(modification)}` : ""}${selectedSize ? `&size=${encodeURIComponent(selectedSize)}` : ""}${sort ? `&sort=${encodeURIComponent(sort)}` : ""}${wheelSku ? `&wheelSku=${encodeURIComponent(wheelSku)}` : ""}${wheelDia ? `&wheelDia=${encodeURIComponent(wheelDia)}` : ""}`;

  // Lifted preset display name for UI
  const liftedPresetLabel = liftedPreset === "daily" ? "Daily Driver" : liftedPreset === "offroad" ? "Off-Road" : liftedPreset === "extreme" ? "Extreme" : liftedPreset;

  return (
    <main className="bg-neutral-50">
      {/* ═══════════════════════════════════════════════════════════════════════
          PACKAGE JOURNEY BAR - Only shows when user is building a package
          (came from wheel selection with wheelSku in URL)
          ═══════════════════════════════════════════════════════════════════════ */}
      {hasVehicle && isPackageFlow ? (
        <PackageJourneyBar
          currentStep="tires"
          vehicle={{
            year,
            make,
            model,
          }}
        />
      ) : null}

      <div className="mx-auto max-w-screen-2xl px-4 py-4">
        {/* ═══════════════════════════════════════════════════════════════════════
            COMPACT HEADER - All info in minimal vertical space
            Vehicle + Trust + Sort + Size selector
            ═══════════════════════════════════════════════════════════════════════ */}
        {hasVehicle ? (
          <TirePageCompactHeader
            year={year}
            make={make}
            model={model}
            displayTrim={displayTrim}
            modification={modification}
            selectedSize={selectedSize}
            availableSizes={displayedSizes}
            wheelDia={wheelDia}
            wheelWidth={wheelWidthActive || wheelWidth}
            basePath={basePath}
            sort={sort}
            wheelSku={wheelSku}
            wheelName={wheelName}
            wheelImage={wheelImage}
            wheelPrice={wheelPrice}
            wheelFinish={wheelFinish}
            isPackageFlow={isPackageFlow}
            isLiftedBuild={isLiftedBuild}
            liftedInches={liftedInches}
            liftedPreset={liftedPresetLabel}
            trim={trim}
            liftedParams={isLiftedBuild ? `&liftedSource=${encodeURIComponent(liftedSource)}&liftedPreset=${encodeURIComponent(liftedPreset)}&liftedInches=${liftedInches}&liftedTireSizes=${encodeURIComponent(liftedTireSizesRaw)}${liftedTireDiaMin ? `&liftedTireDiaMin=${liftedTireDiaMin}` : ""}${liftedTireDiaMax ? `&liftedTireDiaMax=${liftedTireDiaMax}` : ""}` : ""}
          />
        ) : (
          <div className="mb-4">
            <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">Tires</h1>
            <p className="mt-1 text-sm text-neutral-600">Select your vehicle in the header to see compatible tires.</p>
          </div>
        )}

        {/* Lifted Build Context Banner - only show for lifted builds */}
        {isLiftedBuild && hasVehicle ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex items-center gap-2 text-xs">
            <span className="text-amber-600">🚀</span>
            <span className="font-semibold text-amber-800">{liftedInches}" {liftedPresetLabel} Lift</span>
            <span className="text-amber-700">— Showing recommended sizes</span>
          </div>
        ) : null}

        {/* Legacy Size Selection - hidden when compact header is active (hasVehicle) */}
        {!hasVehicle && (displayedSizes.length > 0 || hasPlusSizes) ? (
          <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-extrabold text-neutral-900">Select Tire Size</h2>
                <p className="mt-0.5 text-xs text-neutral-500">Choose the right size for your setup</p>
              </div>
              {wheelDiaActive ? (
                <span className="rounded-full bg-blue-100 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-800">
                  {Math.round(wheelDiaNum)}&quot; wheels selected
                </span>
              ) : null}
            </div>
            
            {/* Tire Sizes - Recommended (Lifted or OEM depending on mode) */}
            {tireSizesStrict.length > 0 ? (
              <div className="mb-4">
                <div className={`text-xs font-bold mb-2 flex items-center gap-2 ${isLiftedBuild ? "text-amber-700" : "text-green-700"}`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-white ${isLiftedBuild ? "bg-amber-500" : "bg-green-500"}`}>
                    {isLiftedBuild ? "🚀" : "✓"}
                  </span>
                  {isLiftedBuild 
                    ? `Recommended — Lifted sizes for ${liftedInches}" ${liftedPresetLabel} build`
                    : `Recommended — OEM sizes for your ${modification || "trim"}`
                  }
                </div>
                <div className="flex flex-wrap gap-2">
                  {(wheelDiaNum ? tireSizesStrict.filter(s => rimDiaFromSize(s) === Math.round(wheelDiaNum)) : tireSizesStrict).map((s) => {
                    const active = s === selectedSize;
                    const rim = rimDiaFromSize(s);
                    // Check if this is a legacy size with conversion
                    const isLegacy = sizeConversionMap.has(s);
                    const modernEquivalent = isLegacy ? sizeConversionMap.get(s) : null;
                    // Preserve lifted context in size links
                    const liftedParams = isLiftedBuild ? `&liftedSource=${encodeURIComponent(liftedSource)}&liftedPreset=${encodeURIComponent(liftedPreset)}&liftedInches=${liftedInches}&liftedTireSizes=${encodeURIComponent(liftedTireSizesRaw)}${liftedTireDiaMin ? `&liftedTireDiaMin=${liftedTireDiaMin}` : ""}${liftedTireDiaMax ? `&liftedTireDiaMax=${liftedTireDiaMax}` : ""}` : "";
                    const href = `${basePath}?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}${trim ? `&trim=${encodeURIComponent(trim)}` : ""}${modification ? `&modification=${encodeURIComponent(modification)}` : ""}${wheelSku ? `&wheelSku=${encodeURIComponent(wheelSku)}` : ""}${wheelDia ? `&wheelDia=${encodeURIComponent(wheelDia)}` : ""}${sort ? `&sort=${encodeURIComponent(sort)}` : ""}&size=${encodeURIComponent(s)}${liftedParams}`;
                    return (
                      <Link
                        key={s}
                        href={href}
                        title={isLegacy ? `${s} (Classic size) → Modern equivalent: ${modernEquivalent}` : undefined}
                        className={
                          active
                            ? "rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm"
                            : isLiftedBuild
                              ? "rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-extrabold text-neutral-900 hover:border-amber-500 hover:bg-amber-100 transition-colors"
                              : isLegacy
                                ? "rounded-xl border-2 border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-extrabold text-neutral-900 hover:border-purple-400 hover:bg-purple-100 transition-colors"
                                : "rounded-xl border-2 border-green-200 bg-green-50 px-4 py-2.5 text-sm font-extrabold text-neutral-900 hover:border-green-400 hover:bg-green-100 transition-colors"
                        }
                      >
                        <span>{s}</span>
                        {isLegacy && modernEquivalent ? (
                          <span className="ml-1.5 text-xs opacity-80">→ {modernEquivalent}</span>
                        ) : rim ? (
                          <span className="ml-1.5 text-xs opacity-70">({rim}&quot;)</span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
                {/* Legacy size conversion info banner */}
                {hasLegacySizes && sizeConversions.length > 0 ? (
                  <div className="mt-3 rounded-lg bg-purple-50 border border-purple-200 px-3 py-2 text-xs text-purple-800">
                    <span className="font-semibold">🔧 Classic Vehicle:</span>{" "}
                    Original OEM sizes are shown. We search using modern equivalents to find compatible tires.
                  </div>
                ) : null}
                {/* Show note when lifted sizes don't match selected wheel diameter */}
                {isLiftedBuild && wheelDiaNum && tireSizesStrict.filter(s => rimDiaFromSize(s) === Math.round(wheelDiaNum)).length === 0 && (
                  <div className="mt-2 rounded-lg bg-amber-100 border border-amber-300 px-3 py-2 text-xs text-amber-800">
                    <span className="font-semibold">Note:</span> Your lifted build recommends {tireSizesStrict.slice(0, 3).map(s => {
                      const m = s.match(/R(\d+)/i);
                      return m ? m[1] : null;
                    }).filter(Boolean).join("/")}″ wheel sizes, but you selected {Math.round(wheelDiaNum)}″ wheels.
                    We&apos;re showing compatible {Math.round(wheelDiaNum)}″ tire options below.
                  </div>
                )}
              </div>
            ) : null}

            {/* Optional Upgrade Sizes (from other trims) */}
            {(() => {
              const upgradeSizes = wheelDiaNum 
                ? tireSizesAgg.filter(s => !tireSizesStrict.includes(s) && rimDiaFromSize(s) === Math.round(wheelDiaNum))
                : tireSizesAgg.filter(s => !tireSizesStrict.includes(s));
              
              if (upgradeSizes.length === 0) return null;
              
              return (
                <div>
                  <div className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">+</span>
                    Optional — Sportier / wider stance options
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {upgradeSizes.map((s) => {
                      const active = s === selectedSize;
                      const rim = rimDiaFromSize(s);
                      const href = `${basePath}?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}${trim ? `&trim=${encodeURIComponent(trim)}` : ""}${modification ? `&modification=${encodeURIComponent(modification)}` : ""}${wheelSku ? `&wheelSku=${encodeURIComponent(wheelSku)}` : ""}${wheelDia ? `&wheelDia=${encodeURIComponent(wheelDia)}` : ""}${sort ? `&sort=${encodeURIComponent(sort)}` : ""}&size=${encodeURIComponent(s)}`;
                      return (
                        <Link
                          key={s}
                          href={href}
                          className={
                            active
                              ? "rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm"
                              : "rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-extrabold text-neutral-900 hover:border-amber-400 hover:bg-amber-100 transition-colors"
                          }
                        >
                          <span>{s}</span>
                          {rim ? <span className="ml-1.5 text-xs opacity-70">({rim}&quot;)</span> : null}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Plus-Size Selection (when no OEM sizes match wheel diameter) */}
            {/* IMPORTANT: Skip plus-sizing for lifted builds - lifted sizes are intentionally larger */}
            {!isLiftedBuild && noOemSizesForWheel && hasPlusSizes ? (
              <div className="mt-4">
                <div className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">⚙</span>
                  Plus-Sizes — Calculated for your {Math.round(wheelDiaNum)}&quot; wheels
                </div>
                <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-900">
                  <div className="font-semibold">No factory {Math.round(wheelDiaNum)}&quot; option for this vehicle</div>
                  <div className="mt-1 text-blue-700">
                    These plus-sizes maintain your original overall diameter (OEM: {oemTireSizesStrict[0] || tireSizes[0] || "N/A"} = {plusSizeResult?.oemOverallDiameter?.toFixed(1) || "?"}&quot; OD).
                  </div>
                </div>
                
                {/* Primary Plus-Sizes (±2% OD) - Recommended */}
                {primaryPlusSizes.length > 0 ? (
                  <div className="mb-3">
                    <div className="text-[10px] font-bold text-green-700 mb-1.5 uppercase tracking-wide">
                      ✓ Recommended (±2% OD)
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {plusSizeCandidates.filter(c => c.isPrimary).map((c) => {
                        const active = c.size === selectedSize;
                        const diffLabel = c.odDiffPercent >= 0 ? `+${c.odDiffPercent.toFixed(1)}%` : `${c.odDiffPercent.toFixed(1)}%`;
                        const href = `${basePath}?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}${trim ? `&trim=${encodeURIComponent(trim)}` : ""}${modification ? `&modification=${encodeURIComponent(modification)}` : ""}${wheelSku ? `&wheelSku=${encodeURIComponent(wheelSku)}` : ""}${wheelDia ? `&wheelDia=${encodeURIComponent(wheelDia)}` : ""}${sort ? `&sort=${encodeURIComponent(sort)}` : ""}&size=${encodeURIComponent(c.size)}`;
                        return (
                          <Link
                            key={c.size}
                            href={href}
                            className={
                              active
                                ? "rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm"
                                : "rounded-xl border-2 border-green-300 bg-green-50 px-4 py-2.5 text-sm font-extrabold text-neutral-900 hover:border-green-500 hover:bg-green-100 transition-colors"
                            }
                          >
                            <span>{c.size}</span>
                            <span className="ml-1.5 text-xs opacity-70">({diffLabel})</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Acceptable Plus-Sizes (±3% OD but not primary) */}
                {(() => {
                  const acceptableOnly = plusSizeCandidates.filter(c => !c.isPrimary);
                  if (acceptableOnly.length === 0) return null;
                  return (
                    <div>
                      <div className="text-[10px] font-bold text-amber-700 mb-1.5 uppercase tracking-wide">
                        Acceptable (±3% OD)
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {acceptableOnly.map((c) => {
                          const active = c.size === selectedSize;
                          const diffLabel = c.odDiffPercent >= 0 ? `+${c.odDiffPercent.toFixed(1)}%` : `${c.odDiffPercent.toFixed(1)}%`;
                          const href = `${basePath}?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}${trim ? `&trim=${encodeURIComponent(trim)}` : ""}${modification ? `&modification=${encodeURIComponent(modification)}` : ""}${wheelSku ? `&wheelSku=${encodeURIComponent(wheelSku)}` : ""}${wheelDia ? `&wheelDia=${encodeURIComponent(wheelDia)}` : ""}${sort ? `&sort=${encodeURIComponent(sort)}` : ""}&size=${encodeURIComponent(c.size)}`;
                          return (
                            <Link
                              key={c.size}
                              href={href}
                              className={
                                active
                                  ? "rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm"
                                  : "rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-extrabold text-neutral-900 hover:border-amber-400 hover:bg-amber-100 transition-colors"
                              }
                            >
                              <span>{c.size}</span>
                              <span className="ml-1.5 text-xs opacity-70">({diffLabel})</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : !isLiftedBuild && noOemSizesForWheel && !hasPlusSizes ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                <div className="font-extrabold">No compatible tire sizes for {Math.round(wheelDiaNum)}&quot; wheels</div>
                <div className="mt-1">
                  This vehicle&apos;s factory tire sizes are: {tireSizes.join(", ") || "none found"}.
                  No plus-size options are available for {Math.round(wheelDiaNum)}&quot; wheels that maintain acceptable overall diameter.
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Tire Matching Banner - shows when coming from wheel selection */}
        {(wheelSku || wheelDia) && !isPackageFlow ? (
          <TireMatchingBanner
            wheelDiameter={wheelDiaActive || wheelDia}
            wheelWidth={wheelWidthActive || wheelWidth}
            wheelSku={wheelSku}
            oemSizes={oemWheelMatchedSizes}
            plusSizes={plusSizeSuggestions}
            selectedSize={selectedSize}
            vehicle={hasVehicle ? { year, make, model, trim, modification } : undefined}
            baseUrl={basePath}
          />
        ) : null}

        <div className="mt-5 grid gap-6 md:grid-cols-[280px_1fr]">
          {/* Filters Sidebar - Accordion style */}
          <aside className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 md:block">
            {/* Package Summary - shows when building a package */}
            <div className="mb-4">
              <PackageSummary variant="sidebar" showCheckout={true} />
            </div>

            {hasVehicle ? (
              <div className="mb-4">
                <RecommendedFitmentCard fitment={{ year, make, model, trim, modification }} />
              </div>
            ) : null}

            <TireFilterSidebar
              data={{
                // Current filter state
                brands,
                priceMin,
                priceMax,
                treadCategories,
                speeds,
                loadRanges,
                mileageBand: selectedMileageBand,
                runFlat,
                snowRated,
                allWeather,
                xlOnly,
                rimDiameters,
                overallDiameters,
                
                // Available options with counts
                brandOptions: allBrands.map(b => ({ value: b, count: brandCounts.get(b) || 0 })),
                treadCategoryOptions: treadCategoriesAvailable.map(tc => ({ value: tc, count: treadCategoryCounts.get(tc) || 0 })),
                speedOptions: speedsAvailable.map(s => ({ value: s, count: speedCounts.get(s) || 0 })),
                loadRangeOptions: loadRangesAvailable.map(lr => ({ value: lr.value, count: loadRangeCounts.get(lr.value) || 0 })),
                mileageOptions: [
                  { value: "40K+" as const, count: mileage40kCount },
                  { value: "60K+" as const, count: mileage60kCount },
                  { value: "80K+" as const, count: mileage80kCount },
                ],
                rimDiameterOptions: rimDiametersAvailable.map(rim => ({ value: rim, count: rimDiameterCounts.get(rim) || 0 })),
                overallDiameterOptions: overallDiametersAvailable.map(dia => ({ value: dia, count: overallDiameterCounts.get(dia) || 0 })),
                
                // Feature counts
                runFlatCount,
                snowRatedCount,
                allWeatherCount,
                xlCount,
                
                // Context for URL building
                basePath,
                year,
                make,
                model,
                trim,
                modification,
                selectedSize,
                sort,
                wheelSku,
                wheelDia,
                
                // Stock info
                inStockCount: items.length,
                totalCount: itemsEnriched.length,
              }}
            />

          </aside>

          <section>
            {/* ═══════════════════════════════════════════════════════════════════════
                PACKAGE FLOW: Enhanced tire selection with grouping
                When user came from wheel selection, show conversion-optimized grid
                ═══════════════════════════════════════════════════════════════════════ */}
            {isPackageFlow && !isStaggered ? (
              <TiresGridWithSelection
                tires={items.map(t => ({
                  source: t.source,
                  rawSource: t.rawSource,
                  partNumber: t.partNumber,
                  mfgPartNumber: t.mfgPartNumber,
                  brand: t.brand,
                  description: t.description,
                  displayName: t.displayName,
                  prettyName: t.prettyName,
                  cost: t.cost,
                  price: t.price,
                  quantity: t.quantity,
                  imageUrl: t.imageUrl,
                  badges: t.badges,
                  tireLibraryId: t.tireLibraryId,
                }))}
                selectedSize={selectedSize}
                viewParams={{
                  year,
                  make,
                  model,
                  trim,
                  modification,
                  wheelSku,
                  wheelDia,
                  selectedSize,
                }}
                selectedWheel={wheelSku ? {
                  sku: wheelSku,
                  brand: wheelName || "Wheel",
                  model: wheelName || wheelSku,
                  diameter: wheelDia,
                  width: wheelWidth,
                  setPrice: wheelPrice || (wheelUnit ? Number(wheelUnit) * (Number(wheelQty) || 4) : 0),
                  imageUrl: wheelImage || undefined,
                } : null}
                dbProfile={dbProfile ? {
                  threadSize: dbProfile.threadSize,
                  seatType: dbProfile.seatType,
                  centerBoreMm: dbProfile.centerBoreMm,
                  boltPattern: dbProfile.boltPattern,
                } : null}
              />
            ) : (
            <>
            {/* Setup toggle for staggered vehicles - allows opting into staggered tires */}
            {isStaggeredVehicle && isPackageFlow && inferredWidthsAreRealistic && !userSelectedStaggeredSetup && (() => {
              const baseParams: Record<string, string> = {};
              if (year) baseParams.year = year;
              if (make) baseParams.make = make;
              if (model) baseParams.model = model;
              if (modification) baseParams.modification = modification;
              if (wheelSku) baseParams.wheelSku = wheelSku;
              if (wheelDia) baseParams.wheelDia = wheelDia;
              if (wheelWidth) baseParams.wheelWidth = wheelWidth;
              if (wheelName) baseParams.wheelName = wheelName;
              if (wheelImage) baseParams.wheelImage = wheelImage;
              if (wheelPrice) baseParams.wheelPrice = wheelPrice.toString();
              if (wheelFinish) baseParams.wheelFinish = wheelFinish;
              const squareUrl = `?${new URLSearchParams(baseParams).toString()}`;
              const staggeredUrl = `?${new URLSearchParams({ ...baseParams, setup: "staggered" }).toString()}`;
              return (
              <div className="mb-4 flex items-center gap-3 rounded-xl bg-neutral-100 p-3">
                <span className="text-sm font-medium text-neutral-700">Tire Setup:</span>
                <div className="flex gap-2">
                  <a
                    href={squareUrl}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                      !forceStaggered 
                        ? "bg-neutral-900 text-white" 
                        : "bg-white text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    ⬛ Square
                  </a>
                  <a
                    href={staggeredUrl}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                      forceStaggered 
                        ? "bg-neutral-900 text-white" 
                        : "bg-white text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    🏁 Staggered
                  </a>
                </div>
                <span className="text-xs text-neutral-500">
                  {forceStaggered 
                    ? `${inferredFrontWidth}" front / ${inferredRearWidth}" rear wheels` 
                    : "Same tire size all corners"}
                </span>
              </div>
              );
            })()}
            
            {/* Staggered tire pairs display - only when user's selection is actually staggered */}
            {showStaggeredUI && staggeredTirePairs.length > 0 ? (
              <div className="mb-6">
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-lg font-bold text-neutral-900">🏁 Staggered Tire Sets</span>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                    {staggeredTirePairs.length} matched pairs
                  </span>
                </div>
                <p className="mb-4 text-sm text-neutral-600">
                  Front: {staggeredFrontTireSize} • Rear: {staggeredRearTireSize}
                </p>
                
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {staggeredTirePairs.slice(0, 12).map((pair) => (
                    <div
                      key={pair.pairId}
                      className="overflow-hidden rounded-2xl border-2 border-green-500 bg-white shadow-sm hover:shadow-lg transition-shadow"
                    >
                      {/* Green header banner */}
                      <div className="bg-green-500 px-4 py-2">
                        <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                          <span>⚡</span> Staggered Set
                        </div>
                        <div className="text-xs text-green-100">✓ Matched front &amp; rear pair</div>
                      </div>
                      
                      <div className="p-4">
                        {/* Brand & Model */}
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          {pair.brand}
                        </div>
                        <div className="mb-1 text-base font-bold text-neutral-900">{pair.model}</div>
                        
                        {/* Mileage warranty */}
                        {pair.mileage && pair.mileage >= 40000 && (
                          <div className="mb-2 text-xs text-green-700">
                            ✓ {Math.round(pair.mileage / 1000)}K mile warranty
                          </div>
                        )}
                        
                        {/* Category badge */}
                        {pair.treadCategory && (
                          <span className="mb-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            🌤️ {pair.treadCategory}
                          </span>
                        )}
                        
                        {/* Tire image */}
                        <div className="relative my-3 flex justify-center">
                          {pair.imageUrl ? (
                            <img
                              src={pair.imageUrl}
                              alt={`${pair.brand} ${pair.model}`}
                              className="h-32 w-32 object-contain"
                            />
                          ) : (
                            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-neutral-100 text-4xl">
                              🛞
                            </div>
                          )}
                        </div>
                        
                        {/* Front/Rear specs stacked */}
                        <div className="mb-3 space-y-2">
                          <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                            <div className="text-xs font-semibold uppercase text-blue-600">Front ×2</div>
                            <div className="text-sm font-bold text-neutral-900">{pair.front.size}</div>
                          </div>
                          <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                            <div className="text-xs font-semibold uppercase text-orange-600">Rear ×2</div>
                            <div className="text-sm font-bold text-neutral-900">{pair.rear.size}</div>
                          </div>
                        </div>
                        
                        {/* Fits vehicle */}
                        <div className="mb-2 text-xs text-green-700">
                          ✓ Fits {year} {make} {model}
                        </div>
                        
                        {/* Stock & shipping */}
                        <div className="mb-3 text-xs text-green-700">
                          ✓ In stock • Free Shipping
                        </div>
                        
                        {/* Price section */}
                        <div className="border-t border-neutral-100 pt-3">
                          <div className="text-2xl font-bold text-neutral-900">
                            ${pair.setPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                          <div className="mb-3 text-xs text-neutral-500">
                            ${(pair.setPrice / 4).toFixed(2)}/ea × 4 tires
                          </div>
                          
                          {/* Select button */}
                          <Link
                            href={`/tires/${pair.front.partNumber}?size=${encodeURIComponent(pair.front.size)}&year=${year}&make=${make}&model=${model}&staggeredPair=${encodeURIComponent(pair.pairId)}&rearSku=${encodeURIComponent(pair.rear.partNumber)}&rearSize=${encodeURIComponent(pair.rear.size)}`}
                            className="block w-full rounded-full bg-red-600 py-3 text-center text-sm font-bold text-white hover:bg-red-700 transition-colors"
                          >
                            Select Staggered Set
                          </Link>
                          <Link
                            href={`/tires/${pair.front.partNumber}?size=${encodeURIComponent(pair.front.size)}&year=${year}&make=${make}&model=${model}`}
                            className="mt-2 block w-full text-center text-xs font-medium text-neutral-500 hover:text-neutral-700"
                          >
                            View Details
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {staggeredTirePairs.length > 12 && (
                  <div className="mt-4 text-center text-sm text-neutral-500">
                    Showing 12 of {staggeredTirePairs.length} matched pairs
                  </div>
                )}
              </div>
            ) : showStaggeredUI ? (
              /* Fallback: show front/rear selector if no pairs found */
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-neutral-500">Selecting:</span>
                <a
                  href={(() => {
                    const p = new URLSearchParams();
                    p.set("year", year); p.set("make", make); p.set("model", model);
                    if (trim) p.set("trim", trim);
                    if (modification) p.set("modification", modification);
                    if (wheelSku) p.set("wheelSku", wheelSku);
                    if (wheelSkuRear) p.set("wheelSkuRear", wheelSkuRear);
                    if (wheelDiaFront) p.set("wheelDiaFront", wheelDiaFront);
                    if (wheelDiaRear) p.set("wheelDiaRear", wheelDiaRear);
                    if (sizeFront) p.set("sizeFront", sizeFront);
                    if (sizeRear) p.set("sizeRear", sizeRear);
                    if (sort) p.set("sort", sort);
                    p.set("axle", "front");
                    return `/tires?${p.toString()}`;
                  })()}
                  className={axle === "front" ? "rounded-full bg-neutral-900 px-3 py-1 text-xs font-extrabold text-white" : "rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-extrabold text-neutral-900"}
                >
                  Front tires
                </a>
                <a
                  href={(() => {
                    const p = new URLSearchParams();
                    p.set("year", year); p.set("make", make); p.set("model", model);
                    if (trim) p.set("trim", trim);
                    if (modification) p.set("modification", modification);
                    if (wheelSku) p.set("wheelSku", wheelSku);
                    if (wheelSkuRear) p.set("wheelSkuRear", wheelSkuRear);
                    if (wheelDiaFront) p.set("wheelDiaFront", wheelDiaFront);
                    if (wheelDiaRear) p.set("wheelDiaRear", wheelDiaRear);
                    if (sizeFront) p.set("sizeFront", sizeFront);
                    if (sizeRear) p.set("sizeRear", sizeRear);
                    if (sort) p.set("sort", sort);
                    p.set("axle", "rear");
                    return `/tires?${p.toString()}`;
                  })()}
                  className={axle === "rear" ? "rounded-full bg-neutral-900 px-3 py-1 text-xs font-extrabold text-white" : "rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-extrabold text-neutral-900"}
                >
                  Rear tires
                </a>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-neutral-600">
              <div>
                Showing {itemsPage.length} of {items.length} tires{totalPages > 1 ? ` (page ${safePage} of ${totalPages})` : ""}
              </div>
              <div className="flex flex-wrap gap-2">
                {displaySize ? <Chip active>{displaySize}</Chip> : null}
                <Chip>In stock</Chip>
              </div>
            </div>

            {/* Top Picks Section - Premium styling with visual separation */}
            {hasVehicle && topPicks.length > 0 && safePage === 1 ? (
              <div className="mt-5 mb-10 relative">
                {/* Decorative background */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-green-50 via-emerald-50/50 to-white -z-10" />
                <div className="absolute inset-0 rounded-3xl border-2 border-green-100 -z-10" />
                
                <div className="p-6 md:p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25">
                          <span className="text-lg text-white">⭐</span>
                        </div>
                        <div>
                          <h2 className="text-xl font-extrabold text-neutral-900">
                            Top Picks for Your {year} {make} {model}
                          </h2>
                          <p className="text-sm text-neutral-600">
                            Expert-selected for value, performance, and fit
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="tire-grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {topPicks.slice(0, 4).map((t, idx) => (
                    <TireCard
                      key={`top-${t.partNumber || t.mfgPartNumber || idx}`}
                      tire={t}
                      stripSizeFromName={stripSizeFromName}
                      rebatesByBrand={rebatesByBrand}
                      year={year}
                      make={make}
                      model={model}
                      trim={trim}
                      modification={modification}
                      selectedSize={selectedSize}
                      sort={sort}
                      wheelSku={wheelSku}
                      wheelName={wheelName}
                      wheelUnit={wheelUnit}
                      wheelQty={wheelQty}
                      wheelDia={wheelDia}
                      isStaggered={isStaggered}
                      axle={axle}
                      isTopPick
                      hasVehicle={hasVehicle}
                      isPackageFlow={isPackageFlow}
                    />
                  ))}
                  </div>
                </div>
              </div>
            ) : null}

            {/* All Tires section header */}
            {hasVehicle && topPicks.length > 0 && safePage === 1 ? (
              <div className="mb-4">
                <h3 className="text-lg font-extrabold text-neutral-900">All Tires</h3>
                <p className="text-sm text-neutral-600">Browse all {items.length} tires that fit your vehicle</p>
              </div>
            ) : null}

            {km?.error ? (
              <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                Tire search error: {String(km.error).slice(0, 500)}
              </div>
            ) : null}

            {wp?.error ? (
              <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                Tire search error (WheelPros): {String(wp.error).slice(0, 500)}
              </div>
            ) : null}

            <div className="tire-grid mt-3 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {itemsPage.length ? (
                itemsPage.map((t, idx) => (
                  <TireCard
                    key={t.partNumber || t.mfgPartNumber || idx}
                    tire={t}
                    stripSizeFromName={stripSizeFromName}
                    rebatesByBrand={rebatesByBrand}
                    year={year}
                    make={make}
                    model={model}
                    trim={trim}
                    modification={modification}
                    selectedSize={selectedSize}
                    sort={sort}
                    wheelSku={wheelSku}
                    wheelName={wheelName}
                    wheelUnit={wheelUnit}
                    wheelQty={wheelQty}
                    wheelDia={wheelDia}
                    isStaggered={isStaggered}
                    axle={axle}
                    hasVehicle={hasVehicle}
                    isPackageFlow={isPackageFlow}
                  />
                ))
              ) : (
                <div className="col-span-full rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm">
                  {noOemSizesForWheel && Number.isFinite(wheelDiaNum) && hasPlusSizes ? (
                    /* We have aftermarket/plus-size suggestions but no tires in stock */
                    <div>
                      <div className="font-extrabold text-amber-900 text-base">
                        No tires currently in stock for {Math.round(wheelDiaNum)}&quot; wheels
                      </div>
                      <div className="mt-2 text-amber-800">
                        We searched for sizes compatible with your {Math.round(wheelDiaNum)}&quot; wheels 
                        ({plusSizeSuggestions.slice(0, 3).join(", ")}{plusSizeSuggestions.length > 3 ? "..." : ""})
                        but couldn&apos;t find matching tires in stock.
                      </div>
                      <div className="mt-3 text-amber-700">
                        <strong>Try:</strong>
                        <ul className="mt-1 list-disc pl-5 space-y-1">
                          <li>Call us at 248-332-4120 for availability</li>
                          <li>Try a different wheel diameter</li>
                        </ul>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <a href="/wheels" className="inline-flex h-10 items-center rounded-xl bg-amber-600 px-4 text-sm font-extrabold text-white hover:bg-amber-700">
                          ← Choose different wheels
                        </a>
                        <a href="tel:+12483324120" className="inline-flex h-10 items-center rounded-xl border border-amber-600 px-4 text-sm font-extrabold text-amber-700 hover:bg-amber-50">
                          📞 Call us
                        </a>
                      </div>
                    </div>
                  ) : noOemSizesForWheel && Number.isFinite(wheelDiaNum) ? (
                    /* No OEM data AND no aftermarket suggestions */
                    <div>
                      <div className="font-extrabold text-amber-900 text-base">
                        No tire data for {Math.round(wheelDiaNum)}&quot; wheels
                      </div>
                      <div className="mt-2 text-amber-800">
                        We don&apos;t have fitment data for {Math.round(wheelDiaNum)}&quot; wheels on your {year} {make} {model}.
                        {tireSizes.length > 0 && (
                          <span> Factory sizes include: <span className="font-semibold">{tireSizes.join(", ")}</span></span>
                        )}
                      </div>
                      <div className="mt-3 text-amber-700">
                        <strong>Options:</strong>
                        <ul className="mt-1 list-disc pl-5 space-y-1">
                          {tireSizes.length > 0 && (
                            <li>Choose wheels matching your OEM tire sizes ({tireSizes.map(s => {
                              const m = s.match(/R(\d{2})/);
                              return m ? m[1] + '"' : null;
                            }).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ")})</li>
                          )}
                          <li>Call us at 248-332-4120 for help finding the right tires</li>
                        </ul>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <a href="/wheels" className="inline-flex h-10 items-center rounded-xl bg-amber-600 px-4 text-sm font-extrabold text-white hover:bg-amber-700">
                          ← Choose different wheels
                        </a>
                        <a href="tel:+12483324120" className="inline-flex h-10 items-center rounded-xl border border-amber-600 px-4 text-sm font-extrabold text-amber-700 hover:bg-amber-50">
                          📞 Call us
                        </a>
                      </div>
                    </div>
                  ) : hasVehicle ? (
                    <div className="text-neutral-700">
                      {tireSizes.length
                        ? "No tire results for this size. Try a different size."
                        : "No OEM tire size returned for this vehicle/trim yet."}
                    </div>
                  ) : (
                    <div className="text-neutral-700">Select a vehicle in the header to see tires.</div>
                  )}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 ? (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-neutral-600">
                  {items.length} tires total
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {safePage > 1 ? (
                    <a
                      className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-extrabold text-neutral-900 hover:bg-neutral-50"
                      href={`${qBase}&page=${safePage - 1}`}
                    >
                      Prev
                    </a>
                  ) : null}

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                    .map((p, i, arr) => {
                      const prev = arr[i - 1];
                      const gap = prev != null && p - prev > 1;
                      return (
                        <span key={p} className="flex items-center gap-2">
                          {gap ? <span className="px-1 text-xs text-neutral-500">…</span> : null}
                          <a
                            href={`${qBase}&page=${p}`}
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
                      href={`${qBase}&page=${safePage + 1}`}
                    >
                      Next
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}
            </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

// Tire Card Component - matches wheel card design
function TireCard({
  tire: t,
  stripSizeFromName,
  rebatesByBrand,
  year,
  make,
  model,
  trim,
  modification,
  selectedSize,
  sort,
  wheelSku,
  wheelName,
  wheelUnit,
  wheelQty,
  wheelDia,
  isStaggered,
  axle,
  isTopPick,
  hasVehicle,
  isPackageFlow,
}: {
  tire: Tire;
  stripSizeFromName: (name: string) => string;
  rebatesByBrand: Map<string, any>;
  year: string;
  make: string;
  model: string;
  trim: string;
  modification: string;
  selectedSize: string;
  sort: string;
  wheelSku: string;
  wheelName: string;
  wheelUnit: string;
  wheelQty: string;
  wheelDia: string;
  isStaggered: boolean;
  axle: "front" | "rear";
  isTopPick?: boolean;
  hasVehicle: boolean;
  isPackageFlow?: boolean;
}) {
  const brandKey = String(t.brand || "").trim().toLowerCase();
  const reb = brandKey ? rebatesByBrand.get(brandKey) : null;
  const headline = reb?.headline ? String(reb.headline) : "";
  const amt = headline.match(/\$(\d{2,4})/);
  const rebateLabel = amt ? `$${amt[1]} rebate` : (reb ? "Rebate" : "");

  const q = t.quantity || {};
  const primary = typeof q.primary === "number" ? q.primary : 0;
  const alternate = typeof q.alternate === "number" ? q.alternate : 0;
  const national = typeof q.national === "number" ? q.national : 0;
  const maxQty = Math.max(primary, alternate, national, 0);
  const inStock = maxQty >= 4;

  const tireSku = String(t.partNumber || t.mfgPartNumber || "").trim();
  // Clean the display title: remove redundant brand (shown separately) and "/sl" load markers
  const rawTitle = stripSizeFromName(t.displayName || t.prettyName || t.description || "") ||
    t.displayName || t.prettyName || t.description || t.partNumber || "Tire";
  const displayTitle = cleanTireDisplayTitle(rawTitle, t.brand);

  // Determine highlight label (selective - only for standout items)
  const highlightLabel = (() => {
    if (isTopPick) return null; // Top picks already have badge
    const mileage = t.enrichment?.mileage ?? t.badges?.warrantyMiles;
    if (mileage && mileage >= 80000) return { text: "Long Life", bg: "bg-emerald-600" };
    // Best Value could be based on price-to-quality ratio (simplified: mid-range brands with good stock)
    const price = getDisplayPrice(t);
    if (price && price >= 80 && price <= 150 && maxQty >= 16 && MID_TIER_BRANDS.includes(brandKey)) {
      return { text: "Best Value", bg: "bg-blue-600" };
    }
    // Popular: high stock levels suggest popularity
    if (maxQty >= 50 && PREMIUM_BRANDS.includes(brandKey)) return { text: "Popular", bg: "bg-violet-600" };
    return null;
  })();

  return (
    <article className={`tire-card group relative overflow-hidden rounded-2xl border bg-white p-5 transition-all duration-200 ${
      isTopPick 
        ? "border-green-200 ring-1 ring-green-100 shadow-sm" 
        : "border-neutral-200 hover:border-neutral-300 hover:shadow-lg hover:-translate-y-0.5"
    }`}>
      {/* Left accent bar - matching wheels card */}
      <div className={`pointer-events-none absolute left-0 top-0 h-full w-1 ${isTopPick ? "bg-green-500" : "bg-neutral-800"}`} />
      
      {/* Highlight label - top right corner */}
      {highlightLabel && (
        <div className={`absolute top-3 right-3 z-20 rounded-full ${highlightLabel.bg} px-2.5 py-1 text-[10px] font-bold text-white shadow-md`}>
          {highlightLabel.text}
        </div>
      )}

      {t.source === "wp" && t.mfgPartNumber ? (
        <Link
          href={`/tires/${encodeURIComponent(String(t.mfgPartNumber))}?${new URLSearchParams({
            year, make, model, trim, modification, size: selectedSize, sort, wheelSku, wheelName, wheelUnit, wheelQty, wheelDia,
          }).toString()}`}
          className="absolute inset-0 z-0"
          aria-label={`View ${displayTitle}`}
        />
      ) : t.source === "km" && t.partNumber ? (
        <Link
          href={`/tires/km/${encodeURIComponent(String(t.partNumber))}?${new URLSearchParams({
            year, make, model, trim, modification, size: selectedSize, sort,
          }).toString()}`}
          className="absolute inset-0 z-0"
          aria-label={`View ${displayTitle}`}
        />
      ) : (t.source === "tw" || t.rawSource?.startsWith("tireweb")) && t.partNumber ? (
        <Link
          href={`/tires/${encodeURIComponent(String(t.partNumber))}?${new URLSearchParams({
            year, make, model, trim, modification, size: selectedSize, sort, source: "tireweb",
          }).toString()}`}
          className="absolute inset-0 z-0"
          aria-label={`View ${displayTitle}`}
        />
      ) : null}

      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-neutral-600">{t.brand || "Tire"}</div>
        {t.source === "wp" && t.mfgPartNumber ? (
          <FavoritesButton
            type="tire"
            sku={t.mfgPartNumber}
            label={`${t.brand || "Tire"} ${displayTitle}`}
            href={`/tires?${new URLSearchParams({ year, make, model, trim, modification, size: selectedSize, sort, wheelSku, wheelName, wheelUnit, wheelQty, wheelDia }).toString()}`}
            imageUrl={t.imageUrl}
          />
        ) : null}
      </div>

      <h3 className="relative z-10 mt-1 text-base font-extrabold tracking-tight text-neutral-900 group-hover:underline">
        {displayTitle}
      </h3>

      {/* Mileage warranty - text line under title */}
      {t.enrichment?.mileage && t.enrichment.mileage >= 40000 ? (
        <div className="relative z-10 mt-0.5 text-xs text-neutral-600">
          ✓ {Math.round(t.enrichment.mileage / 1000)}K mile warranty
        </div>
      ) : null}

      {/* Tire size - prominent display */}
      <div className="relative z-10 mt-1 text-sm font-medium text-neutral-700">
        {selectedSize}
        {t.badges?.loadIndex && t.badges?.speedRating ? (
          <span className="ml-1 text-neutral-500">
            {String(t.badges.loadIndex)}{String(t.badges.speedRating)}
          </span>
        ) : null}
      </div>

      {/* Badges row - only Top Pick and Rebate (category moved to image) */}
      {(isTopPick || rebateLabel) ? (
        <div className="relative z-10 mt-2 flex flex-wrap gap-1.5">
          {isTopPick ? (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
              ⭐ Top Pick
            </span>
          ) : null}
          {rebateLabel ? (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
              🔥 {rebateLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Product image with badge stack overlay */}
      <div className="tire-card-image-container relative z-10 mt-3">
        {t.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.imageUrl}
            alt={displayTitle}
            loading="lazy"
          />
        ) : (
          <div className="tire-card-image-placeholder">
            <div className="text-xs font-extrabold text-neutral-900">Image coming soon</div>
            <div className="mt-1 text-[11px] text-neutral-600">{t.brand || "Tire"}</div>
          </div>
        )}
        
        {/* Badge stack - top left of image */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {/* Category badge with icon - infer from model name if not in data */}
          {(() => {
            // Determine category from enrichment, badges, or model name inference
            // Hierarchy: enrichment.treadCategory → badges.terrain → model name patterns
            const m = (displayTitle + ' ' + (t.description || '')).toUpperCase();
            let category = t.enrichment?.treadCategory || t.badges?.terrain || null;
            
            // Infer from model name patterns if not set (improved regex)
            if (!category) {
              // Winter patterns (check first - most specific)
              if (/\bWINTER\b|\bBLIZZAK\b|\bX-ICE\b|\bICE\b|\bSNOW\b|\bWS\d+\b|\bARCTIC\b|\bFROST\b/.test(m)) {
                category = 'Winter';
              // Mud-Terrain patterns (M/T, MT, MUD) - before A/T
              } else if (/\bM[\/\-]?T\b|\bMUD[\s\-]?TERRAIN\b|\bMUD[\s\-]?GRAPPLER\b/.test(m)) {
                category = 'Mud-Terrain';
              // Rugged-Terrain patterns (R/T, RT, RUGGED)
              } else if (/\bR[\/\-]?T\b|\bRUGGED[\s\-]?TERRAIN\b/.test(m)) {
                category = 'Rugged-Terrain';
              // All-Terrain: A/T, AT, AT2, ATX, AT-X, TERRA TRAC, KO2, GRAPPLER (without MUD)
              } else if (/\bA[\/\-]?T\d*[A-Z]?\b|\bA[\/\-]?T[-]?[A-Z]\b|\bALL[\s\-]?TERRAIN\b|\bTERRA\s*TRAC\b|\bKO2\b|\bGRAPPLER\b/.test(m) && !/MUD/.test(m)) {
                category = 'All-Terrain';
              // Highway/Touring: H/T, HT, HT2, HTX, HTX2, TOURING, HIGHWAY
              } else if (/\bH[\/\-]?T\d*[A-Z]?\d*\b|\bHIGHWAY\b|\bTOURING\b|\bGRAND\s*TOUR/.test(m)) {
                category = 'Highway/Touring';
              // Performance patterns
              } else if (/\bPILOT\s*SPORT\b|\bPOTENZA\b|\bPS4S?\b|\bPZERO\b|\bP\s*ZERO\b|\bUHP\b|\bSPORT\s*MAXX\b|\bEAGLE\s*F1\b/.test(m)) {
                category = 'Performance';
              // All-Weather patterns
              } else if (/\bALL[\s\-]?WEATHER\b|\bWEATHER\s*READY\b|\b4SEASON\b|\bCROSS\s*CLIMATE\b/.test(m)) {
                category = 'All-Weather';
              } else {
                category = 'All-Season'; // Default fallback
              }
            }
            
            const catStyle = {
              'All-Terrain': { bg: 'bg-gradient-to-r from-amber-600 to-amber-500', icon: '🏔️' },
              'Mud-Terrain': { bg: 'bg-gradient-to-r from-orange-700 to-orange-600', icon: '🪨' },
              'Rugged-Terrain': { bg: 'bg-gradient-to-r from-stone-700 to-stone-600', icon: '⛰️' },
              'Winter': { bg: 'bg-gradient-to-r from-sky-600 to-sky-500', icon: '❄️' },
              'Performance': { bg: 'bg-gradient-to-r from-red-600 to-red-500', icon: '🏎️' },
              'Highway/Touring': { bg: 'bg-gradient-to-r from-blue-600 to-blue-500', icon: '🛣️' },
              'All-Season': { bg: 'bg-gradient-to-r from-green-600 to-green-500', icon: '🌤️' },
              'All-Weather': { bg: 'bg-gradient-to-r from-teal-600 to-teal-500', icon: '🌦️' },
            }[category] || { bg: 'bg-gradient-to-r from-green-600 to-green-500', icon: '🌤️' };
            
            return (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-white shadow-md ${catStyle.bg}`}>
                <span className="drop-shadow-sm">{catStyle.icon}</span> {category}
              </span>
            );
          })()}
        </div>
      </div>

      {/* Fitment confirmation - single line */}
      {hasVehicle ? (
        <div className="relative z-10 mt-2 text-[11px] font-medium text-green-700">
          <span className="text-green-600">✓</span> Fits {year} {make} {model}
          {(() => {
            const wheelDiaN = wheelDia ? Number(String(wheelDia).replace(/[^0-9.]/g, "")) : NaN;
            const tireRimDia = (() => {
              const desc = String(t.description || selectedSize || "").toUpperCase();
              const m = desc.match(/R(\d{2})\b/);
              return m ? Number(m[1]) : NaN;
            })();
            const wheelMatches = isPackageFlow && Number.isFinite(wheelDiaN) && Number.isFinite(tireRimDia)
              && Math.round(wheelDiaN) === Math.round(tireRimDia);
            return wheelMatches ? (
              <span className="ml-2 text-blue-600">• Matches {Math.round(wheelDiaN)}&quot; wheels</span>
            ) : null;
          })()}
        </div>
      ) : null}

      {/* Availability row - concise */}
      <div className="relative z-10 mt-3 flex items-center gap-1.5 text-[11px] font-medium">
        {inStock ? (
          <>
            <span className="text-green-600">✓</span>
            <span className="text-green-700">
              {maxQty >= 20 ? 'In stock' : `${maxQty} in stock`} • Ships 1–2 days
            </span>
          </>
        ) : (
          <>
            <span className="text-amber-500">📦</span>
            <span className="text-amber-700">Available • Ships 1–2 weeks</span>
          </>
        )}
      </div>

      {/* Price block - set of 4 primary */}
      <div className="relative z-10 mt-3 pt-3 border-t border-neutral-100">
        <div className="flex items-end justify-between">
          <div>
            {(() => {
              const unitPrice = getDisplayPrice(t);
              return unitPrice != null ? (
                <>
                  <div className="text-2xl font-extrabold text-neutral-900">
                    ${(unitPrice * 4).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-neutral-500">
                    ${unitPrice.toFixed(2)}/ea × 4 tires
                  </div>
                </>
              ) : (
                <div className="text-xl font-extrabold text-neutral-900">Call for price</div>
              );
            })()}
          </div>
          {/* Stock indicator dot */}
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span className={"inline-block h-2 w-2 rounded-full " + (inStock ? "bg-green-500" : "bg-amber-500")} />
            <span className={inStock ? "text-green-700" : "text-amber-700"}>
              {inStock ? (maxQty >= 100 ? "100+" : maxQty) : "Order"}
            </span>
          </div>
        </div>
      </div>
      
      {/* Trust row - single badge */}
      <div className="relative z-10 mt-2 text-[10px] text-neutral-500">
        <span className="text-green-600">✓</span> Free Shipping
      </div>

      {/* CTA buttons - matching wheels card structure */}
      <div className="tire-card-cta relative z-10 grid gap-2">
        {typeof t.cost === "number" && wheelSku && tireSku ? (
          isStaggered ? (
            <SelectTireButtonAxle
              wheelSku={String(wheelSku)}
              axle={axle}
              tire={{
                sku: tireSku,
                brand: String(t.brand || ""),
                title: String(displayTitle),
                size: selectedSize,
                price: getDisplayPrice(t) ?? undefined,
                imageUrl: t.imageUrl,
                speed: t.badges?.speedRating ? String(t.badges.speedRating) : undefined,
                loadIndex: t.badges?.loadIndex ? String(t.badges.loadIndex) : undefined,
                season: t.badges?.terrain ? String(t.badges.terrain) : undefined,
                runFlat: Boolean(t.description && /\b(RFT|EMT|ROF|RUN\s*-?FLAT)\b/i.test(String(t.description))),
                xl: Boolean(t.description && /\bXL\b/i.test(String(t.description))),
                source: t.rawSource,
              }}
            />
          ) : (
            <SelectTireButton
              wheelSku={String(wheelSku)}
              tire={{
                sku: tireSku,
                brand: String(t.brand || ""),
                title: String(displayTitle),
                size: selectedSize,
                price: getDisplayPrice(t) ?? undefined,
                imageUrl: t.imageUrl,
                speed: t.badges?.speedRating ? String(t.badges.speedRating) : undefined,
                loadIndex: t.badges?.loadIndex ? String(t.badges.loadIndex) : undefined,
                season: t.badges?.terrain ? String(t.badges.terrain) : undefined,
                runFlat: Boolean(t.description && /\b(RFT|EMT|ROF|RUN\s*-?FLAT)\b/i.test(String(t.description))),
                xl: Boolean(t.description && /\bXL\b/i.test(String(t.description))),
                source: t.rawSource,
              }}
            />
          )
        ) : getDisplayPrice(t) != null ? (
          <QuickAddTireButton
            sku={tireSku}
            brand={String(t.brand || "Tire")}
            model={String(displayTitle)}
            size={selectedSize}
            imageUrl={t.imageUrl}
            unitPrice={getDisplayPrice(t)!}
            vehicle={year && make && model ? { year, make, model, trim, modification } : undefined}
            quantity={4}
            source={t.rawSource}
          />
        ) : (
          <a href={BRAND.links.tel} className="rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-extrabold text-white hover:bg-red-700">
            Call for price
          </a>
        )}

        <Link
          href={t.source === "wp" && t.mfgPartNumber
            ? `/tires/${encodeURIComponent(String(t.mfgPartNumber))}?${new URLSearchParams({ year, make, model, trim, modification, size: selectedSize, sort }).toString()}`
            : t.source === "km" && t.partNumber
              ? `/tires/km/${encodeURIComponent(String(t.partNumber))}?${new URLSearchParams({ year, make, model, trim, modification, size: selectedSize, sort }).toString()}`
              : (t.source === "tw" || t.rawSource?.startsWith("tireweb")) && t.partNumber
                ? `/tires/${encodeURIComponent(String(t.partNumber))}?${new URLSearchParams({ year, make, model, trim, modification, size: selectedSize, sort, source: "tireweb" }).toString()}`
                : "#"
          }
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-center text-sm font-extrabold text-neutral-900 hover:bg-neutral-50 hover:border-neutral-400 transition-colors"
        >
          View Details
        </Link>
      </div>
    </article>
  );
}

function Chip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span className={active
      ? "inline-flex items-center rounded-full bg-neutral-900 px-3 py-1 text-xs font-extrabold text-white"
      : "inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-800"
    }>
      {children}
    </span>
  );
}

// FilterGroup - matching wheels page spacing (mt-6, text-sm title, mt-3 content gap-3)
function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="text-sm font-extrabold text-neutral-900">{title}</div>
      <div className="mt-3 grid gap-3">{children}</div>
    </div>
  );
}

function Check({ label, name, value, defaultChecked }: { label: string; name?: string; value?: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-800">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="h-4 w-4 rounded border-neutral-300" />
      <span className="text-sm">{label}</span>
    </label>
  );
}
