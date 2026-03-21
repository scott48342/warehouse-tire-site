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
import {
  generatePlusSizeCandidates,
  type PlusSizeCandidate,
} from "@/lib/tirePlusSizing";
import { getDisplayTrim } from "@/lib/vehicleDisplay";

type Tire = {
  source?: "wp" | "km";
  partNumber?: string;
  mfgPartNumber?: string;
  brand?: string;
  description?: string;
  cost?: number;
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
};

type TireAsset = {
  km_description?: string;
  display_name?: string;
  image_url?: string;
};

// Premium tire brands for scoring
const PREMIUM_BRANDS = ["michelin", "bridgestone", "continental", "goodyear", "pirelli"];
const MID_TIER_BRANDS = ["cooper", "toyo", "bfgoodrich", "yokohama", "hankook", "falken", "general", "kumho", "nexen"];

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

// Score tires for "Top Picks" selection
function scoreTireForPicks(tire: Tire): number {
  let score = 0;
  const price = typeof tire.cost === "number" ? tire.cost + 50 : 0;
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

  const seasonsRaw = sp.season;
  const seasons = Array.isArray(seasonsRaw)
    ? seasonsRaw.map(String).map((s) => s.trim()).filter(Boolean)
    : seasonsRaw
      ? [String(seasonsRaw).trim()].filter(Boolean)
      : [];

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

  // Use safeString to handle potential object values (fixes [object Object] bug)
  const year = safeString(Array.isArray(sp.year) ? sp.year[0] : sp.year);
  const make = safeString(Array.isArray(sp.make) ? sp.make[0] : sp.make);
  const model = safeString(Array.isArray(sp.model) ? sp.model[0] : sp.model);
  const trim = safeString(Array.isArray(sp.trim) ? sp.trim[0] : sp.trim);
  const modification = safeString(Array.isArray(sp.modification) ? sp.modification[0] : sp.modification);

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
  const wheelUnit = safeString(Array.isArray((sp as any).wheelUnit) ? (sp as any).wheelUnit[0] : (sp as any).wheelUnit);
  const wheelQty = safeString(Array.isArray((sp as any).wheelQty) ? (sp as any).wheelQty[0] : (sp as any).wheelQty);
  const wheelDia = safeString(Array.isArray((sp as any).wheelDia) ? (sp as any).wheelDia[0] : (sp as any).wheelDia);
  const wheelWidth = safeString(Array.isArray((sp as any).wheelWidth) ? (sp as any).wheelWidth[0] : (sp as any).wheelWidth);

  const isStaggered = Boolean(wheelSkuRear);
  const wheelDiaActive = axle === "rear" ? (wheelDiaRear || wheelDia) : (wheelDiaFront || wheelDia);
  const wheelWidthActive = axle === "rear" ? (wheelWidthRear || wheelWidth) : (wheelWidthFront || wheelWidth);

  const basePath = year && make && model ? `/tires/v/${vehicleSlug(year, make, model)}` : "/tires";
  const hasVehicle = Boolean(year && make && model);

  // Package flow detection - user came from wheel selection
  const isPackageFlow = Boolean(wheelSku);

  if (year && make && model && !modification) {
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

  const fitmentStrict = year && make && model
    ? await fetchFitment({ year, make, model, modification: modification || undefined })
    : null;

  const fitmentAgg = year && make && model
    ? await fetchFitment({ year, make, model })
    : null;

  const tireSizesStrict: string[] = Array.isArray(fitmentStrict?.tireSizes)
    ? fitmentStrict.tireSizes.map(String)
    : [];

  const tireSizesAgg: string[] = Array.isArray(fitmentAgg?.tireSizes)
    ? fitmentAgg.tireSizes.map(String)
    : [];

  const tireSizes = Array.from(new Set([...tireSizesStrict, ...tireSizesAgg]));

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
    const m = String(s || "").toUpperCase().match(/R(\d{2})\b/);
    return m ? Number(m[1]) : null;
  }

  const wheelDiaNum = wheelDiaActive ? Number(String(wheelDiaActive).replace(/[^0-9.]/g, "")) : NaN;
  const wheelWidthNum = wheelWidthActive ? Number(String(wheelWidthActive).replace(/[^0-9.]/g, "")) : NaN;

  const oemWheelMatchedSizes = Number.isFinite(wheelDiaNum) && wheelDiaNum > 0
    ? tireSizes.filter((s) => {
        const rimDia = rimDiaFromSize(s);
        return rimDia === Math.round(wheelDiaNum);
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
    // Only compute plus-sizes when:
    // 1. We have a valid wheel diameter
    // 2. No OEM sizes match the wheel diameter
    // 3. We have at least one OEM size to calculate from
    if (!Number.isFinite(wheelDiaNum) || wheelDiaNum <= 0) return null;
    if (oemWheelMatchedSizes.length > 0) return null; // OEM sizes exist, no need
    if (tireSizesStrict.length === 0) return null; // No OEM sizes to calculate from
    
    // Use the first OEM size as the reference for plus-sizing
    const referenceOemSize = tireSizesStrict[0];
    
    // Generate plus-size candidates
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
  })();

  // Plus-size suggestions: prioritize primary (±2%), then acceptable (±3%)
  const plusSizeSuggestions: string[] = plusSizeResult
    ? plusSizeResult.acceptableCandidates.map((c) => c.size)
    : [];

  // Plus-size candidates with full metadata (for display)
  const plusSizeCandidates: PlusSizeCandidate[] = plusSizeResult
    ? plusSizeResult.acceptableCandidates
    : [];

  // Primary plus-sizes (±2% OD) - recommended
  const primaryPlusSizes: string[] = plusSizeResult
    ? plusSizeResult.primaryCandidates.map((c) => c.size)
    : [];

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
      // No OEM sizes match, but we have plus-size candidates - use those
      lockedSizes = plusSizeSuggestions;
    }
    // If neither OEM nor plus-sizes are available, lockedSizes stays empty
    // This will show a "no compatible sizes" message
  }

  // IMPORTANT: When wheel diameter is specified, ONLY show matching sizes
  // Do NOT fall back to all tire sizes - that would show wrong-diameter tires
  const displayedSizes = Number.isFinite(wheelDiaNum) && wheelDiaNum > 0
    ? lockedSizes // Only show sizes matching wheel diameter (OEM or plus-size)
    : (lockedSizes.length ? lockedSizes : tireSizes); // No wheel = show all OEM sizes

  const selectedSizeRaw = (axle === "rear" ? sizeRearRaw : sizeFrontRaw) || (safeString(Array.isArray(sp.size) ? sp.size[0] : sp.size));
  const metricSizeOverride = safeString(Array.isArray((sp as any).metricSize) ? (sp as any).metricSize[0] : (sp as any).metricSize);
  const selectedSizeCandidate = selectedSizeRaw
    ? String(selectedSizeRaw)
    : (displayedSizes[0] || plusSizeSuggestions[0] || tireSizesStrict[0] || tireSizes[0] || "");

  // Validate selected size is in the allowed set
  const allowedSizes = lockedSizes.length > 0 ? lockedSizes : displayedSizes;
  const selectedSize = allowedSizes.length > 0
    ? (allowedSizes.includes(selectedSizeCandidate) ? selectedSizeCandidate : (allowedSizes[0] || ""))
    : selectedSizeCandidate;

  const sizeFront = axle === "front" ? selectedSize : (sizeFrontRaw || "");
  const sizeRear = axle === "rear" ? selectedSize : (sizeRearRaw || "");

  const km = selectedSize ? await fetchKmTires(selectedSize) : null;
  const wpSize = metricSizeOverride || selectedSize;
  const wp = wpSize ? await fetchWpTires(wpSize) : null;
  const rebates = await fetchActiveRebates();

  const rebatesByBrand = new Map<string, any>();
  for (const r of (rebates as any)?.items || []) {
    const b = String(r?.brand || "").trim().toLowerCase();
    if (!b) continue;
    if (!rebatesByBrand.has(b)) rebatesByBrand.set(b, r);
  }

  const itemsKm: Tire[] = (Array.isArray(km?.items) ? km.items : []).map((t: Tire) => ({ ...t, source: "km" as const }));
  const itemsWp: Tire[] = (Array.isArray(wp?.items) ? wp.items : []).map((t: Tire) => ({ ...t, source: "wp" as const }));

  const byId = new Map<string, Tire>();
  for (const t of itemsKm) {
    const id = t.partNumber ? `km:${String(t.partNumber)}` : t.mfgPartNumber ? `km:${String(t.mfgPartNumber)}` : "";
    if (!id) continue;
    byId.set(id, t);
  }
  for (const t of itemsWp) {
    const id = t.mfgPartNumber ? `wp:${String(t.mfgPartNumber)}` : t.partNumber ? `wp:${String(t.partNumber)}` : "";
    if (!id) continue;
    byId.set(id, t);
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

  const seasonCounts = new Map<string, number>();
  const speedCounts = new Map<string, number>();
  let runFlatCount = 0;
  let snowRatedCount = 0;
  let allWeatherCount = 0;
  let xlCount = 0;
  const loadRangeCounts = new Map<string, number>();

  for (const t of itemsEnriched) {
    const parsed = parseFromDescription(String(t.description || ""));
    if (parsed.season) seasonCounts.set(parsed.season, (seasonCounts.get(parsed.season) || 0) + 1);
    if (parsed.speed) speedCounts.set(parsed.speed, (speedCounts.get(parsed.speed) || 0) + 1);
    if (parsed.isRunFlat) runFlatCount++;
    if (parsed.isSnowRated) snowRatedCount++;
    if (parsed.isAllWeather) allWeatherCount++;
    if (parsed.isXL) xlCount++;

    const lrRaw = (t as any)?.loadRange;
    const lr = lrRaw != null ? String(lrRaw).trim().toUpperCase() : "";
    if (lr) loadRangeCounts.set(lr, (loadRangeCounts.get(lr) || 0) + 1);
  }

  const seasonsAvailable = Array.from(seasonCounts.entries()).sort((a, b) => b[1] - a[1]).map(([s]) => s);
  const speedsAvailable = Array.from(speedCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s]) => s);

  function normalizeSizeKey(s: string) {
    return String(s || "").toUpperCase().replace(/\s+/g, "").replace(/ZR/g, "R").replace(/-/g, "");
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

    if (lockedSizes.length) {
      const sizeInDesc = extractSizeFromText(desc0);
      if (sizeInDesc) {
        const rim = rimDiaFromSize(sizeInDesc);
        if (Number.isFinite(wheelDiaNum) && wheelDiaNum > 0) {
          if (rim !== wheelDiaNum) return false;
        }
        if (normalizeSizeKey(sizeInDesc) !== selectedSizeKey) return false;
      }
    }

    if (brands.length) {
      const b = String(t.brand || "").toLowerCase();
      const ok = brands.some((x) => b === String(x).toLowerCase());
      if (!ok) return false;
    }

    if (seasons.length) {
      const s = parsed.season || "";
      if (!seasons.includes(s)) return false;
    }

    if (speeds.length) {
      const spd = parsed.speed || "";
      if (!speeds.includes(spd)) return false;
    }

    if (runFlat && !parsed.isRunFlat) return false;
    if (snowRated && !parsed.isSnowRated) return false;
    if (allWeather && !parsed.isAllWeather) return false;
    if (xlOnly && !parsed.isXL) return false;

    if (loadRanges.length) {
      const lrRaw = (t as any)?.loadRange;
      const lr = lrRaw != null ? String(lrRaw).trim().toUpperCase() : "";
      if (!lr || !loadRanges.includes(lr)) return false;
    }

    const p = typeof t.cost === "number" ? t.cost + 50 : null;
    if (typeof priceMin === "number" && Number.isFinite(priceMin)) {
      if (p == null || p < priceMin) return false;
    }
    if (typeof priceMax === "number" && Number.isFinite(priceMax)) {
      if (p == null || p > priceMax) return false;
    }

    return true;
  });

  const items: Tire[] = [...itemsFiltered].sort((a, b) => {
    const aPrice = typeof a.cost === "number" ? a.cost + 50 : Number.POSITIVE_INFINITY;
    const bPrice = typeof b.cost === "number" ? b.cost + 50 : Number.POSITIVE_INFINITY;
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

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-screen-2xl px-4 py-8">
        {/* Package Context Header - when coming from wheel selection */}
        {isPackageFlow && hasVehicle ? (
          <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-sm font-bold text-white">✓</div>
                <div>
                  <div className="text-xs font-semibold text-green-700 uppercase tracking-wide">Step 1 Complete</div>
                  <div className="text-sm font-extrabold text-neutral-900">Wheels Selected</div>
                </div>
              </div>
              <div className="hidden sm:block text-2xl text-neutral-300">→</div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">2</div>
                <div>
                  <div className="text-xs font-semibold text-red-700 uppercase tracking-wide">Now</div>
                  <div className="text-sm font-extrabold text-neutral-900">Choose Matching Tires</div>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              Building package for <span className="font-bold">{year} {make} {model}</span>
              {displayTrim ? <span className="text-neutral-500"> • {displayTrim}</span> : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
              Tires
            </h1>
            <p className="mt-1 text-sm text-neutral-700">
              {hasVehicle
                ? `Showing tires for ${year} ${make} ${model}${displayTrim ? ` ${displayTrim}` : ""}.`
                : "Select your vehicle in the header to filter tires."}
            </p>

            {hasVehicle ? (
              <>
                <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800">
                  <span className="text-neutral-500">Vehicle:</span>
                  <span className="font-extrabold text-neutral-900">
                    {year} {make} {model}
                    {displayTrim ? ` ${displayTrim}` : ""}
                  </span>
                </div>
                <GarageWidget type="tires" />
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
                { value: "best", label: "Best Match" },
                { value: "price_desc", label: "Price High to Low" },
                { value: "brand_asc", label: "Brand A–Z" },
                { value: "stock_desc", label: "Most Stock" },
              ]}
            />
          </div>
        </div>

        {/* Trust & Install Strip - matches wheels page */}
        {hasVehicle ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-gradient-to-r from-green-50 to-white border border-green-100 px-5 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-green-800">
              <span className="text-green-600 text-base">✓</span> Ship to your installer
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-green-800">
              <span className="text-green-600 text-base">✓</span> Local installation available
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-green-800">
              <span className="text-green-600 text-base">✓</span> Mount &amp; balance included
            </div>
            <div className="ml-auto text-xs font-bold text-green-700 bg-green-100 px-3 py-1 rounded-full">
              Guaranteed fitment
            </div>
          </div>
        ) : null}

        {/* Size Selection with Guided UX */}
        {hasVehicle && (displayedSizes.length > 0 || hasPlusSizes) ? (
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
            
            {/* Stock Sizes (from selected trim) - Recommended */}
            {tireSizesStrict.length > 0 ? (
              <div className="mb-4">
                <div className="text-xs font-bold text-green-700 mb-2 flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">✓</span>
                  Recommended — OEM sizes for your {modification || "trim"}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(wheelDiaNum ? tireSizesStrict.filter(s => rimDiaFromSize(s) === Math.round(wheelDiaNum)) : tireSizesStrict).map((s) => {
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
                            : "rounded-xl border-2 border-green-200 bg-green-50 px-4 py-2.5 text-sm font-extrabold text-neutral-900 hover:border-green-400 hover:bg-green-100 transition-colors"
                        }
                      >
                        <span>{s}</span>
                        {rim ? <span className="ml-1.5 text-xs opacity-70">({rim}&quot;)</span> : null}
                      </Link>
                    );
                  })}
                </div>
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
            {noOemSizesForWheel && hasPlusSizes ? (
              <div className="mt-4">
                <div className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">⚙</span>
                  Plus-Sizes — Calculated for your {Math.round(wheelDiaNum)}&quot; wheels
                </div>
                <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-900">
                  <div className="font-semibold">No factory {Math.round(wheelDiaNum)}&quot; option for this vehicle</div>
                  <div className="mt-1 text-blue-700">
                    These plus-sizes maintain your original overall diameter (OEM: {tireSizesStrict[0] || tireSizes[0] || "N/A"} = {plusSizeResult?.oemOverallDiameter?.toFixed(1) || "?"}&quot; OD).
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
            ) : noOemSizesForWheel && !hasPlusSizes ? (
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

        <div className="mt-5 grid gap-6 md:grid-cols-[340px_1fr]">
          {/* Filters Sidebar - matching wheels page spacing */}
          <aside className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 md:block">
            {hasVehicle ? (
              <div className="mb-4">
                <RecommendedFitmentCard fitment={{ year, make, model, trim, modification }} />
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold">Filters</h2>
              <Link
                href={`${basePath}?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}${trim ? `&trim=${encodeURIComponent(trim)}` : ""}${modification ? `&modification=${encodeURIComponent(modification)}` : ""}${wheelSku ? `&wheelSku=${encodeURIComponent(wheelSku)}` : ""}${wheelDia ? `&wheelDia=${encodeURIComponent(wheelDia)}` : ""}${selectedSize ? `&size=${encodeURIComponent(selectedSize)}` : ""}${sort ? `&sort=${encodeURIComponent(sort)}` : ""}`}
                className="text-sm font-semibold text-neutral-600 hover:underline"
              >
                Clear all
              </Link>
            </div>

            <form action={basePath} method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="wheelSku" value={wheelSku} />
              <input type="hidden" name="wheelDia" value={wheelDia} />
              <input type="hidden" name="size" value={selectedSize} />
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="priceMin" value={priceMinRaw ? String(priceMinRaw) : ""} />
              <input type="hidden" name="priceMax" value={priceMaxRaw ? String(priceMaxRaw) : ""} />

              <FilterGroup title="Brand">
                {topBrands.length ? (
                  <div className="grid gap-3">
                    {topBrands.map((b) => (
                      <div key={b} className="flex items-center justify-between gap-2">
                        <Check label={b} name="brand" value={b} defaultChecked={brands.includes(b)} />
                        <span className="text-xs font-semibold text-neutral-500">{brandCounts.get(b) || 0}</span>
                      </div>
                    ))}
                    {restBrands.length ? (
                      <details className="rounded-xl border border-neutral-200 bg-white p-3">
                        <summary className="cursor-pointer select-none text-xs font-extrabold text-neutral-900">
                          More brands ({restBrands.length})
                        </summary>
                        <div className="mt-3 grid gap-3">
                          {restBrands.map((b) => (
                            <div key={b} className="flex items-center justify-between gap-2">
                              <Check label={b} name="brand" value={b} defaultChecked={brands.includes(b)} />
                              <span className="text-xs font-semibold text-neutral-500">{brandCounts.get(b) || 0}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-xs text-neutral-600">No brand data yet.</div>
                )}
                <button className="mt-3 h-12 w-full rounded-xl px-4 text-base font-extrabold btn-outline-red">Apply brand</button>
              </FilterGroup>
            </form>

            <form action={basePath} method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="size" value={selectedSize} />
              <input type="hidden" name="sort" value={sort} />
              {brands.map((b) => (<input key={b} type="hidden" name="brand" value={b} />))}

              <FilterGroup title="Price">
                <div className="grid grid-cols-2 gap-3">
                  <input name="priceMin" defaultValue={priceMinRaw ? String(priceMinRaw) : ""} placeholder="$ min" className="h-12 rounded-xl border border-neutral-200 bg-white px-4 text-base font-semibold" />
                  <input name="priceMax" defaultValue={priceMaxRaw ? String(priceMaxRaw) : ""} placeholder="$ max" className="h-12 rounded-xl border border-neutral-200 bg-white px-4 text-base font-semibold" />
                </div>
                <button className="mt-3 h-12 w-full rounded-xl px-4 text-base font-extrabold btn-outline-red">Apply price</button>
              </FilterGroup>
            </form>

            <form action={basePath} method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="size" value={selectedSize} />
              <input type="hidden" name="sort" value={sort} />
              {brands.map((b) => (<input key={b} type="hidden" name="brand" value={b} />))}
              <input type="hidden" name="priceMin" value={priceMinRaw ? String(priceMinRaw) : ""} />
              <input type="hidden" name="priceMax" value={priceMaxRaw ? String(priceMaxRaw) : ""} />
              {speeds.map((s) => (<input key={s} type="hidden" name="speed" value={s} />))}
              <input type="hidden" name="runFlat" value={runFlat ? "1" : ""} />
              <input type="hidden" name="snowRated" value={snowRated ? "1" : ""} />
              <input type="hidden" name="allWeather" value={allWeather ? "1" : ""} />
              <input type="hidden" name="xl" value={xlOnly ? "1" : ""} />

              <FilterGroup title="Season">
                {seasonsAvailable.length ? (
                  <div className="grid gap-3">
                    {seasonsAvailable.map((s) => (
                      <div key={s} className="flex items-center justify-between gap-2">
                        <Check label={s} name="season" value={s} defaultChecked={seasons.includes(s)} />
                        <span className="text-xs font-semibold text-neutral-500">{seasonCounts.get(s) || 0}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-neutral-600">No season data yet.</div>
                )}
                <button className="mt-3 h-12 w-full rounded-xl px-4 text-base font-extrabold btn-outline-red">Apply season</button>
              </FilterGroup>
            </form>

            <form action={basePath} method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="size" value={selectedSize} />
              <input type="hidden" name="sort" value={sort} />
              {brands.map((b) => (<input key={b} type="hidden" name="brand" value={b} />))}
              <input type="hidden" name="priceMin" value={priceMinRaw ? String(priceMinRaw) : ""} />
              <input type="hidden" name="priceMax" value={priceMaxRaw ? String(priceMaxRaw) : ""} />
              {seasons.map((s) => (<input key={s} type="hidden" name="season" value={s} />))}
              <input type="hidden" name="runFlat" value={runFlat ? "1" : ""} />
              <input type="hidden" name="snowRated" value={snowRated ? "1" : ""} />
              <input type="hidden" name="allWeather" value={allWeather ? "1" : ""} />
              <input type="hidden" name="xl" value={xlOnly ? "1" : ""} />

              <FilterGroup title="Speed Rating">
                {speedsAvailable.length ? (
                  <div className="grid gap-3">
                    {speedsAvailable.slice(0, 12).map((s) => (
                      <div key={s} className="flex items-center justify-between gap-2">
                        <Check label={s} name="speed" value={s} defaultChecked={speeds.includes(s)} />
                        <span className="text-xs font-semibold text-neutral-500">{speedCounts.get(s) || 0}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-neutral-600">No speed rating data yet.</div>
                )}
                <button className="mt-3 h-12 w-full rounded-xl px-4 text-base font-extrabold btn-outline-red">Apply speed</button>
              </FilterGroup>
            </form>

            <form action={basePath} method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="size" value={selectedSize} />
              <input type="hidden" name="sort" value={sort} />
              {brands.map((b) => (<input key={b} type="hidden" name="brand" value={b} />))}
              <input type="hidden" name="priceMin" value={priceMinRaw ? String(priceMinRaw) : ""} />
              <input type="hidden" name="priceMax" value={priceMaxRaw ? String(priceMaxRaw) : ""} />
              {seasons.map((s) => (<input key={s} type="hidden" name="season" value={s} />))}
              {speeds.map((s) => (<input key={s} type="hidden" name="speed" value={s} />))}
              <input type="hidden" name="snowRated" value={snowRated ? "1" : ""} />
              <input type="hidden" name="allWeather" value={allWeather ? "1" : ""} />
              {loadRanges.map((lr) => (<input key={lr} type="hidden" name="loadRange" value={lr} />))}

              <FilterGroup title="Features">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Check label="Run-flat" name="runFlat" value="1" defaultChecked={runFlat} />
                    <span className="text-xs font-semibold text-neutral-500">{runFlatCount}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Check label="XL (Extra Load)" name="xl" value="1" defaultChecked={xlOnly} />
                    <span className="text-xs font-semibold text-neutral-500">{xlCount}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Check label="Snow rated (3PMSF)" name="snowRated" value="1" defaultChecked={snowRated} />
                    <span className="text-xs font-semibold text-neutral-500">{snowRatedCount}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Check label="All Weather" name="allWeather" value="1" defaultChecked={allWeather} />
                    <span className="text-xs font-semibold text-neutral-500">{allWeatherCount}</span>
                  </div>
                </div>
                <button className="mt-3 h-12 w-full rounded-xl px-4 text-base font-extrabold btn-outline-red">Apply</button>
              </FilterGroup>
            </form>

            <form action={basePath} method="get">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="make" value={make} />
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="trim" value={trim} />
              <input type="hidden" name="modification" value={modification} />
              <input type="hidden" name="size" value={selectedSize} />
              <input type="hidden" name="sort" value={sort} />
              {brands.map((b) => (<input key={b} type="hidden" name="brand" value={b} />))}
              <input type="hidden" name="priceMin" value={priceMinRaw ? String(priceMinRaw) : ""} />
              <input type="hidden" name="priceMax" value={priceMaxRaw ? String(priceMaxRaw) : ""} />
              {seasons.map((s) => (<input key={s} type="hidden" name="season" value={s} />))}
              {speeds.map((s) => (<input key={s} type="hidden" name="speed" value={s} />))}
              <input type="hidden" name="runFlat" value={runFlat ? "1" : ""} />
              <input type="hidden" name="snowRated" value={snowRated ? "1" : ""} />
              <input type="hidden" name="allWeather" value={allWeather ? "1" : ""} />
              <input type="hidden" name="xl" value={xlOnly ? "1" : ""} />

              <FilterGroup title="Load Range">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Check label="Load Range E" name="loadRange" value="E" defaultChecked={loadRanges.includes("E")} />
                    <span className="text-xs font-semibold text-neutral-500">{loadRangeCounts.get("E") || 0}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Check label="Load Range F" name="loadRange" value="F" defaultChecked={loadRanges.includes("F")} />
                    <span className="text-xs font-semibold text-neutral-500">{loadRangeCounts.get("F") || 0}</span>
                  </div>
                </div>
                <button className="mt-3 h-12 w-full rounded-xl px-4 text-base font-extrabold btn-outline-red">Apply</button>
              </FilterGroup>
            </form>
          </aside>

          <section>
            {/* Staggered axle selector */}
            {isStaggered ? (
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
                {selectedSize ? <Chip active>{selectedSize}</Chip> : null}
                <Chip>In stock</Chip>
              </div>
            </div>

            {/* Top Picks Section - matches wheels page styling */}
            {hasVehicle && topPicks.length > 0 && safePage === 1 ? (
              <div className="mt-5 mb-8 rounded-2xl bg-gradient-to-b from-neutral-50 to-white border border-neutral-200 p-6 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">⭐</span>
                      <h2 className="text-xl font-extrabold text-neutral-900">
                        Top Tire Picks for Your {year} {make} {model}
                      </h2>
                    </div>
                    <p className="mt-1 text-sm text-neutral-600">
                      Hand-picked based on fitment, value, and popularity
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                  {noOemSizesForWheel && Number.isFinite(wheelDiaNum) ? (
                    <div>
                      <div className="font-extrabold text-amber-900 text-base">
                        No OEM tire sizes for {Math.round(wheelDiaNum)}&quot; wheels
                      </div>
                      <div className="mt-2 text-amber-800">
                        Your {year} {make} {model} doesn&apos;t have factory {Math.round(wheelDiaNum)}&quot; wheel options.
                        The OEM sizes are: <span className="font-semibold">{tireSizes.join(", ") || "not found"}</span>
                      </div>
                      <div className="mt-3 text-amber-700">
                        <strong>Options:</strong>
                        <ul className="mt-1 list-disc pl-5 space-y-1">
                          <li>Choose wheels matching your OEM tire sizes ({tireSizes.map(s => {
                            const m = s.match(/R(\d{2})/);
                            return m ? m[1] + '"' : null;
                          }).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ") || "check fitment"})</li>
                          <li>Call us for plus-size tire recommendations</li>
                        </ul>
                      </div>
                      <div className="mt-4">
                        <a href="/wheels" className="inline-flex h-10 items-center rounded-xl bg-amber-600 px-4 text-sm font-extrabold text-white hover:bg-amber-700">
                          ← Choose different wheels
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
  const displayTitle = stripSizeFromName(t.displayName || t.prettyName || t.description || "") ||
    t.displayName || t.prettyName || t.description || t.partNumber || "Tire";

  return (
    <article className={`group relative overflow-hidden rounded-2xl border bg-white p-5 hover:shadow-md transition-shadow ${isTopPick ? "border-green-200 ring-1 ring-green-100" : "border-neutral-200 hover:border-red-300"}`}>
      {/* Left accent bar - matching wheels card */}
      <div className={`pointer-events-none absolute left-0 top-0 h-full w-1 ${isTopPick ? "bg-green-500" : "bg-neutral-800"}`} />

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

      {/* Badges row - matching wheels card */}
      <div className="relative z-10 mt-2 flex flex-wrap gap-1.5">
        {isTopPick ? (
          <span className="rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
            ⭐ Top Pick
          </span>
        ) : null}
        {rebateLabel ? (
          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-900">
            {rebateLabel}
          </span>
        ) : null}
        {t.badges?.terrain ? (
          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-bold text-neutral-700">
            {String(t.badges.terrain)}
          </span>
        ) : null}
        {t.badges?.loadIndex && t.badges?.speedRating ? (
          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-bold text-neutral-700">
            {String(t.badges.loadIndex)}{String(t.badges.speedRating)}
          </span>
        ) : null}
      </div>

      {/* Product image - matching wheels card */}
      <div className="relative z-10 mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
        {t.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.imageUrl}
            alt={displayTitle}
            className="h-48 w-full object-contain bg-white transition-transform duration-200 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="grid h-48 place-items-center bg-white p-3 text-center">
            <div>
              <div className="text-xs font-extrabold text-neutral-900">Image coming soon</div>
              <div className="mt-1 text-[11px] text-neutral-600">{t.brand || "Tire"}</div>
            </div>
          </div>
        )}
      </div>

      {/* Fitment messaging - matching wheels card */}
      {hasVehicle ? (
        <div className="relative z-10 mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs space-y-1">
          {(() => {
            // CRITICAL: Only show "Matches your selected wheels" if tire rim diameter
            // actually equals the selected wheel diameter
            const wheelDiaN = wheelDia ? Number(String(wheelDia).replace(/[^0-9.]/g, "")) : NaN;
            const tireRimDia = (() => {
              const desc = String(t.description || selectedSize || "").toUpperCase();
              const m = desc.match(/R(\d{2})\b/);
              return m ? Number(m[1]) : NaN;
            })();
            const wheelMatches = isPackageFlow && Number.isFinite(wheelDiaN) && Number.isFinite(tireRimDia)
              && Math.round(wheelDiaN) === Math.round(tireRimDia);
            
            return wheelMatches ? (
              <div className="flex items-center gap-1.5 text-blue-700 font-medium">
                <span className="text-blue-600">✓</span>
                <span>Matches your selected {Math.round(wheelDiaN)}&quot; wheels</span>
              </div>
            ) : isPackageFlow && Number.isFinite(wheelDiaN) ? (
              <div className="flex items-center gap-1.5 text-amber-700 font-medium">
                <span className="text-amber-500">⚠</span>
                <span>Size doesn&apos;t match {Math.round(wheelDiaN)}&quot; wheels</span>
              </div>
            ) : null;
          })()}
          <div className="flex items-center gap-1.5 text-green-700 font-medium">
            <span className="text-green-600">✓</span>
            <span>Fits your {year} {make} {model}</span>
          </div>
          <div className="flex items-center gap-1.5 text-neutral-600">
            <span>📍</span>
            <span>Install available near you</span>
          </div>
        </div>
      ) : null}

      {/* Price and stock - matching wheels card */}
      <div className="relative z-10 mt-4">
        <div className="text-2xl font-extrabold text-neutral-900">
          {typeof t.cost === "number" ? `$${(t.cost + 50).toFixed(2)}` : "Call for price"}
        </div>
        <div className="text-sm text-neutral-600">each</div>

        <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
          <span className={"inline-block h-2.5 w-2.5 rounded-full " + (inStock ? "bg-green-500" : "bg-red-500")} />
          <span className={inStock ? "text-green-800" : "text-red-800"}>
            {inStock ? "In stock" : "Backordered"}
          </span>
        </div>
      </div>

      {/* CTA buttons - matching wheels card structure */}
      <div className="relative z-10 mt-4 grid gap-2">
        {typeof t.cost === "number" && wheelSku && tireSku ? (
          isStaggered ? (
            <SelectTireButtonAxle
              wheelSku={String(wheelSku)}
              axle={axle}
              tire={{
                sku: tireSku,
                brand: String(t.brand || ""),
                title: String(displayTitle),
                size: "",
                price: typeof t.cost === "number" ? t.cost + 50 : undefined,
                imageUrl: t.imageUrl,
                speed: t.badges?.speedRating ? String(t.badges.speedRating) : undefined,
                loadIndex: t.badges?.loadIndex ? String(t.badges.loadIndex) : undefined,
                season: t.badges?.terrain ? String(t.badges.terrain) : undefined,
                runFlat: Boolean(t.description && /\b(RFT|EMT|ROF|RUN\s*-?FLAT)\b/i.test(String(t.description))),
                xl: Boolean(t.description && /\bXL\b/i.test(String(t.description))),
              }}
            />
          ) : (
            <SelectTireButton
              wheelSku={String(wheelSku)}
              tire={{
                sku: tireSku,
                brand: String(t.brand || ""),
                title: String(displayTitle),
                size: "",
                price: typeof t.cost === "number" ? t.cost + 50 : undefined,
                imageUrl: t.imageUrl,
                speed: t.badges?.speedRating ? String(t.badges.speedRating) : undefined,
                loadIndex: t.badges?.loadIndex ? String(t.badges.loadIndex) : undefined,
                season: t.badges?.terrain ? String(t.badges.terrain) : undefined,
                runFlat: Boolean(t.description && /\b(RFT|EMT|ROF|RUN\s*-?FLAT)\b/i.test(String(t.description))),
                xl: Boolean(t.description && /\bXL\b/i.test(String(t.description))),
              }}
            />
          )
        ) : typeof t.cost === "number" ? (
          <QuickAddTireButton
            sku={tireSku}
            brand={String(t.brand || "Tire")}
            model={String(displayTitle)}
            size={selectedSize}
            imageUrl={t.imageUrl}
            unitPrice={t.cost + 50}
            vehicle={year && make && model ? { year, make, model, trim, modification } : undefined}
            quantity={4}
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
