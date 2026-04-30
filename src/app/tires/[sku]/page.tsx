import Link from "next/link";
import type { Metadata } from "next";
import pg from "pg";
import { BRAND } from "@/lib/brand";
import { ImageGallery } from "@/components/ImageGallery";
import { RecommendedFitmentCard } from "@/components/RecommendedFitmentCard";
import { AddTiresToCartButton } from "@/components/AddTiresToCartButton";
import { TireBuyBox } from "@/components/TireBuyBox";
import { BackToTiresButton } from "@/components/BackToTiresButton";
import { extractDisplayTrim } from "@/lib/vehicleDisplay";
import { cleanTireDisplayTitle, normalizeTireSize } from "@/lib/productFormat";
import { normalizeTreadCategory, isRunFlat, type TreadCategory } from "@/lib/tires/normalization";
import { derivePerformanceRatings, parseUTQG, type PerformanceRatings } from "@/lib/tires/tireSpecs";
import { PerformanceIndicators } from "@/components/PerformanceIndicators";
import { PDPTrustBlock } from "@/components/StoreReviews";
// PDP Conversion Enhancements - Phase 2 Layout Balanced (2026-04-06)
import { 
  BestForMicro, 
  EnhancedTrustStrip, 
  ReviewSummary,
  WhyChooseThisTire,
  ComparisonContext,
  WhatHappensNext,
  WarrantySupport,
  type TireCategory as EnhancedTireCategory
} from "@/components/TirePDPEnhancements";
// Real behavior-driven popularity signals (2026-04-06)
import { PopularityBadge, type PopularitySignalData } from "@/components/PopularityBadge";
import { getPopularitySignal } from "@/lib/analytics/productPopularity";
// Buying guides (2026-04-06)
import { TireSizeGuide, TireTypesGuide } from "@/components/BuyingGuides";
// TPMS contextual upsell (2026-04-06)
import { TPMSSuggestion } from "@/components/TPMSSuggestion";
// Customers also added (2026-04-06)
import { CustomersAlsoAdded } from "@/components/CustomersAlsoAdded";
import { getCoAddedProductsForPDP } from "@/lib/analytics/coPurchaseServer";
// Financing badges (2026-04-11)
import { FinancingBadge } from "@/components/FinancingBadge";
// Rebate display (2026-04-12)
import { RebatePDPBlockStatic } from "@/components/RebateBlock";
import { getPool as getRebatePool, listActiveRebates, getBestMatchingRebate, type SiteRebate } from "@/lib/rebates";
// Funnel analytics tracking (2026-04-26)
import { ProductViewTracker } from "@/components/ProductViewTracker";
// Shop context detection (local vs national)
import { headers } from "next/headers";
import { detectShopContext } from "@/lib/shopContext";

export const runtime = "nodejs";

type TireAsset = {
  km_description?: string;
  display_name?: string;
  image_url?: string;
};

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

const { Pool } = pg;

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

let pool: pg.Pool | null = null;
function getPool() {
  if (pool) return pool;
  const DATABASE_URL = required("POSTGRES_URL");
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  return pool;
}

function n(v: any): number | null {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function fmtMoney(v: number) {
  return `$${v.toFixed(2)}`;
}

function priceFromRow(r: any): number | null {
  const msrpUsd0 = n(r?.msrp_usd);
  const mapUsd0 = n(r?.map_usd);
  const msrpUsd = msrpUsd0 != null && msrpUsd0 > 0.01 ? msrpUsd0 : null;
  const mapUsd = mapUsd0 != null && mapUsd0 > 0.01 ? mapUsd0 : null;
  // Sell price = (MSRP × 0.85) + $50, fall back to MAP if no MSRP
  if (msrpUsd) return (msrpUsd * 0.85) + 50;
  if (mapUsd) return mapUsd; // MAP fallback (already retail price)
  return null;
}

// ============================================================================
// CATEGORY TAGLINE - Short, benefit-driven description
// ============================================================================

function getCategoryTagline(category: TreadCategory | null): { label: string; tagline: string } {
  switch (category) {
    case 'All-Season':
      return { label: "All-Season Tire", tagline: "Rain, shine, or light snow — confident grip year-round" };
    case 'All-Weather':
      return { label: "All-Weather Tire", tagline: "3-peak rated for real winters, no seasonal swaps needed" };
    case 'All-Terrain':
      return { label: "All-Terrain Tire", tagline: "Highway quiet, trail capable — best of both worlds" };
    case 'Mud-Terrain':
      return { label: "Mud-Terrain Tire", tagline: "Self-cleaning tread that bites through anything" };
    case 'Highway/Touring':
      return { label: "Highway Touring Tire", tagline: "Whisper-quiet comfort for long highway miles" };
    case 'Performance':
      return { label: "Performance Tire", tagline: "Sticky compound, sharp turn-in, track-day ready" };
    case 'Summer':
      return { label: "Summer Tire", tagline: "Max dry grip + confident wet braking above 45°F" };
    case 'Winter':
      return { label: "Winter Tire", tagline: "Soft compound stays grippy below freezing" };
    case 'Rugged-Terrain':
      return { label: "Rugged Terrain Tire", tagline: "Puncture-resistant sidewalls, smooth on pavement" };
    default:
      return { label: "Quality Tire", tagline: "Balanced grip and comfort for everyday driving" };
  }
}

// ============================================================================
// WHY THIS TIRE - Benefit-driven, conversational (for quick bullets)
// ============================================================================

function getWhyThisTirePoints(
  category: TreadCategory | null,
  mileageWarranty: string | null,
  isRunFlatTire: boolean,
  has3PMSF: boolean,
): string[] {
  const points: string[] = [];
  
  // Primary benefit based on category
  switch (category) {
    case 'All-Season':
      points.push("Keeps you confident in changing weather");
      points.push("Smooth, comfortable ride on any road");
      break;
    case 'All-Weather':
      points.push("No seasonal tire swaps needed");
      points.push("Rated for severe snow conditions");
      break;
    case 'All-Terrain':
      points.push("Take the scenic route without worry");
      points.push("Quiet enough for your daily commute");
      break;
    case 'Mud-Terrain':
      points.push("Gets you through when trails get gnarly");
      points.push("Self-cleaning tread throws mud fast");
      break;
    case 'Highway/Touring':
      points.push("Quiet cabin, comfortable long drives");
      points.push("Designed to go the distance");
      break;
    case 'Performance':
      points.push("Sharp handling when it matters");
      points.push("Confident grip through every curve");
      break;
    case 'Summer':
      points.push("Sticks to the road in heat and rain");
      points.push("Responsive feel for spirited driving");
      break;
    case 'Winter':
      points.push("Bites into ice and packed snow");
      points.push("Stays flexible in freezing temps");
      break;
    case 'Rugged-Terrain':
      points.push("Sidewalls built to shrug off trail damage");
      points.push("On-road comfort you'll actually enjoy");
      break;
    default:
      points.push("Reliable grip in everyday conditions");
      points.push("Quality construction you can trust");
  }
  
  return points.slice(0, 2); // Max 2 for above-the-fold
}

// ============================================================================
// CONFIDENCE SIGNAL - Trust builder near CTA
// ============================================================================

function getConfidenceSignal(qty: number, category: TreadCategory | null): string | null {
  if (qty >= 50) {
    return "Popular choice — customers love this one";
  } else if (qty >= 20) {
    return "Frequently purchased in this size";
  } else if (category === 'Highway/Touring' || category === 'All-Season') {
    return "Great everyday choice for most drivers";
  } else if (category === 'All-Terrain') {
    return "Top pick for trucks and SUVs";
  } else if (category === 'Performance') {
    return "Enthusiast favorite for spirited driving";
  }
  return null;
}

// ============================================================================
// DELIVERY MESSAGE - Confident and specific
// Different messaging for local (pickup) vs national (shipping) sites
// ============================================================================

function getDeliveryMessage(qty: number, isLocal: boolean = false): { text: string; color: string; icon: string; urgency: string | null } {
  if (isLocal) {
    // Local site: pickup-oriented messaging
    if (qty >= 8) {
      return { text: "In stock · Ready for install", color: "text-green-700 font-semibold", icon: "🔧", urgency: null };
    } else if (qty >= 4) {
      return { text: "In stock · Schedule your install", color: "text-green-700 font-semibold", icon: "📍", urgency: null };
    } else if (qty > 0) {
      return { text: "Available · Call to schedule", color: "text-green-700 font-semibold", icon: "📞", urgency: `Only ${qty} left` };
    } else {
      return { text: "Special order · Usually 1-2 days", color: "text-neutral-600", icon: "📋", urgency: null };
    }
  }
  
  // National site: shipping-oriented messaging
  if (qty >= 8) {
    return { text: "In stock · Ships tomorrow", color: "text-green-700 font-semibold", icon: "🚀", urgency: null };
  } else if (qty >= 4) {
    return { text: "In stock · Ships in 1-2 days", color: "text-green-700 font-semibold", icon: "📦", urgency: null };
  } else if (qty > 0) {
    return { text: "Ships in 1-2 days", color: "text-green-700 font-semibold", icon: "📦", urgency: `Only ${qty} left in stock` };
  } else {
    return { text: "Available to order · Ships in 1-2 weeks", color: "text-neutral-600", icon: "📋", urgency: null };
  }
}

// ============================================================================
// FULL SPECS (below the fold)
// ============================================================================

interface FullSpecsProps {
  tireSize: string | null;
  rimDiameter: number | null;
  tireDiameter: number | null;
  sectionWidth: number | null;
  aspectRatio: number | null;
  construction: string | null;
  loadIndex: string | null;
  speedRating: string | null;
  mileageWarranty: string | null;
  utqg: string | null;
  treadDepth: number | null;
  tireWeight: number | null;
}

function FullSpecs(props: FullSpecsProps) {
  const rows: { label: string; value: string }[] = [];
  
  if (props.tireSize) rows.push({ label: "Size", value: props.tireSize });
  if (props.loadIndex) rows.push({ label: "Load Index", value: props.loadIndex });
  if (props.speedRating) rows.push({ label: "Speed Rating", value: props.speedRating });
  if (props.utqg) rows.push({ label: "UTQG", value: props.utqg });
  if (props.treadDepth && props.treadDepth > 0) rows.push({ label: "Tread Depth", value: `${props.treadDepth}/32"` });
  if (props.mileageWarranty) rows.push({ label: "Mileage Warranty", value: `${Number(props.mileageWarranty).toLocaleString()} miles` });
  if (props.tireWeight && props.tireWeight > 0) rows.push({ label: "Tire Weight", value: `${props.tireWeight} lbs` });
  if (props.rimDiameter) rows.push({ label: "Wheel Diameter", value: `${props.rimDiameter}"` });
  if (props.tireDiameter) rows.push({ label: "Overall Diameter", value: `${props.tireDiameter}"` });
  if (props.sectionWidth) rows.push({ label: "Section Width", value: `${props.sectionWidth}mm` });
  if (props.aspectRatio) rows.push({ label: "Aspect Ratio", value: `${props.aspectRatio}` });
  if (props.construction) rows.push({ label: "Load Range", value: props.construction });
  
  if (rows.length === 0) return null;
  
  return (
    <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-5 shadow-sm">
      <div className="text-sm font-extrabold text-neutral-900 mb-4">Full Specifications</div>
      <div className="grid gap-0 text-sm">
        {rows.map((row, i) => (
          <div key={row.label} className={`flex justify-between items-center py-2.5 ${i < rows.length - 1 ? 'border-b border-neutral-100' : ''}`}>
            <span className="text-neutral-500 font-medium">{row.label}</span>
            <span className="font-bold text-neutral-900">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// PERFORMANCE SECTION - Compact
// ============================================================================

function PerformanceSection({ 
  ratings, 
  category 
}: { 
  ratings: PerformanceRatings | null;
  category: TreadCategory | null;
}) {
  if (!ratings) return null;
  
  // Choose 3 most relevant ratings
  let showRatings: ('treadLife' | 'wetTraction' | 'dryTraction' | 'comfort' | 'noise' | 'offRoad' | 'winter')[];
  
  switch (category) {
    case 'All-Terrain':
    case 'Mud-Terrain':
    case 'Rugged-Terrain':
      showRatings = ['offRoad', 'treadLife', 'wetTraction'];
      break;
    case 'Winter':
      showRatings = ['winter', 'wetTraction', 'treadLife'];
      break;
    case 'Performance':
    case 'Summer':
      showRatings = ['dryTraction', 'wetTraction', 'comfort'];
      break;
    case 'Highway/Touring':
      showRatings = ['comfort', 'treadLife', 'wetTraction'];
      break;
    default:
      showRatings = ['treadLife', 'wetTraction', 'comfort'];
  }
  
  return (
    <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-extrabold text-neutral-900">Performance</div>
        <div className="flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1">
          <span className="text-sm font-bold text-white">{ratings.overall}</span>
          <span className="text-[10px] text-neutral-400">/10</span>
        </div>
      </div>
      <PerformanceIndicators 
        ratings={ratings} 
        show={showRatings}
        compact={true}
        showLabels={true}
        showValues={true}
      />
    </div>
  );
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
      canonical: `https://shop.warehousetiredirect.com/tires/${decodedSku}`,
    },
  };
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default async function TireDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ sku: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sku } = await params;
  const sp = (await searchParams) || {};
  const safeSku = String(sku || "").trim();

  const year = String((sp as any).year || "");
  const make = String((sp as any).make || "");
  const model = String((sp as any).model || "");
  const trim = String((sp as any).trim || "");
  const modification = String((sp as any).modification || "");

  const displayTrim = extractDisplayTrim(trim);
  const hasVehicle = Boolean(year && make && model);

  const source = String((sp as any).source || "");
  const size = String((sp as any).size || "");

  // Detect shop mode (local vs national) for delivery messaging
  const headersList = await headers();
  const shopContext = detectShopContext(headersList);
  const isLocalSite = shopContext.mode === 'local';

  if (!safeSku) {
    return (
      <main className="bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">SKU required.</div>
        </div>
      </main>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TireWeb tires: fetch from search API
  // ═══════════════════════════════════════════════════════════════════════════
  if (source === "tireweb" && size) {
    try {
      const searchRes = await fetch(
        `${getBaseUrl()}/api/tires/search?size=${encodeURIComponent(size)}&partNumber=${encodeURIComponent(safeSku)}&limit=1`,
        { cache: "no-store" }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const tire = searchData?.results?.[0];
        if (tire) {
          const cost = typeof tire.cost === "number" && tire.cost > 0 ? tire.cost : null;
          const price = typeof tire.price === "number" && tire.price > 0 ? tire.price : null;
          const displayPrice = (price && cost && price > cost)
            ? price
            : cost
              ? cost + 50
              : null;
          const rawTitle = tire.displayName || tire.prettyName || tire.description || tire.model || safeSku;
          const title = cleanTireDisplayTitle(rawTitle, tire.brand);
          
          const category = normalizeTreadCategory(tire.badges?.terrain, tire.description);
          const isRunFlatTire = isRunFlat(null, tire.description, null);
          const has3PMSF = /3PMSF|3-PEAK|MOUNTAIN.*SNOWFLAKE/i.test(tire.description || '');
          
          // Parse UTQG for performance ratings
          const parsedUtqg = parseUTQG(tire.badges?.utqg);
          const ratings = derivePerformanceRatings(parsedUtqg, category, has3PMSF);
          const whyPoints = getWhyThisTirePoints(category, tire.badges?.warrantyMiles ? String(tire.badges.warrantyMiles) : null, isRunFlatTire, has3PMSF);
          const categoryTagline = getCategoryTagline(category);
          
          const q = tire.quantity || {};
          const totalQty = (q.primary || 0) + (q.alternate || 0) + (q.national || 0);
          const delivery = getDeliveryMessage(totalQty, isLocalSite);
          
          // Fetch real popularity signal (non-blocking, cached)
          let popularitySignal: PopularitySignalData | null = null;
          try {
            popularitySignal = await getPopularitySignal("tire", tire.partNumber || safeSku);
          } catch {
            // Silent fail - no signal is fine
          }

          // Fetch co-add recommendations (non-blocking, cached)
          const coAddedProducts = await getCoAddedProductsForPDP(tire.partNumber || safeSku, "tire");
          
          // Fetch rebate match (non-blocking, cached)
          let rebateMatch: { amount: string | null; headline: string; formUrl: string | null; learnMoreUrl: string | null; requirements: string | null; endsText: string | null; brand: string | null } | null = null;
          try {
            const rebateDb = getRebatePool();
            const activeRebates = await listActiveRebates(rebateDb);
            const match = getBestMatchingRebate(
              { sku: tire.partNumber || safeSku, brand: tire.brand || "", model: title, size: tire.size || size },
              activeRebates
            );
            if (match) {
              rebateMatch = {
                amount: match.rebate.rebate_amount,
                headline: match.rebate.headline,
                formUrl: match.rebate.form_url,
                learnMoreUrl: match.rebate.learn_more_url,
                requirements: match.rebate.requirements,
                endsText: match.rebate.ends_text,
                brand: match.rebate.brand,
              };
            }
          } catch (err) {
            // Silent fail - no rebate is fine
            console.error("[tire-pdp] Rebate fetch error:", err);
          }
          
          return (
            <main className="bg-neutral-50">
              {/* Funnel tracking */}
              <ProductViewTracker 
                sku={tire.partNumber || safeSku} 
                type="tire" 
                vehicle={hasVehicle ? { year: parseInt(year), make, model } : undefined} 
              />
              
              <div className="mx-auto max-w-6xl px-4 py-8">
                {/* Breadcrumb */}
                <BackToTiresButton />

                {/* ═══════════════════════════════════════════════════════════════════
                    ROW 1: Hero - Image + Buy Box (streamlined)
                    ═══════════════════════════════════════════════════════════════════ */}
                <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">
                  {/* Left: Image */}
                  <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-lg">🔍</span>
                      <span className="text-xs font-medium text-neutral-500">Click image to zoom</span>
                    </div>
                    <ImageGallery images={tire.imageUrl ? [tire.imageUrl] : []} alt={title} />
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
                        <Link href={`/tires?${new URLSearchParams({ year, make, model, trim, modification }).toString()}`} className="text-xs font-semibold text-green-700 hover:underline">
                          Change
                        </Link>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                        <span className="text-sm text-amber-800">Select vehicle to confirm fit</span>
                        <Link href="/tires" className="text-xs font-semibold text-amber-700 hover:underline">Select</Link>
                      </div>
                    )}

                    {/* Brand */}
                    <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{tire.brand || "Tire"}</div>
                    
                    {/* Title */}
                    <h1 className="-mt-1 text-2xl font-extrabold text-neutral-900 leading-tight">{title}</h1>
                    
                    {/* Category tagline */}
                    <p className="-mt-1 text-sm text-neutral-600">{categoryTagline.tagline}</p>

                    {/* Best For (compact) */}
                    <BestForMicro 
                      category={category as EnhancedTireCategory} 
                      mileageWarranty={tire.badges?.warrantyMiles ? Number(tire.badges.warrantyMiles) : null}
                      isRunFlat={isRunFlatTire}
                    />

                    {/* Key spec chips + guides */}
                    <div className="flex flex-wrap items-center gap-2">
                      {(tire.size || size) && (
                        <span className="inline-flex items-center rounded-full bg-neutral-900 px-3 py-1 text-xs font-bold text-white">
                          {normalizeTireSize(tire.size || size)}
                        </span>
                      )}
                      {(tire.size || size) && <TireSizeGuide variant="icon" />}
                      {tire.badges?.loadIndex && tire.badges?.speedRating && (
                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                          {String(tire.badges.loadIndex)}{String(tire.badges.speedRating)}
                        </span>
                      )}
                      {category && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                          {category}
                          <TireTypesGuide variant="icon" />
                        </span>
                      )}
                      {tire.badges?.warrantyMiles && Number(tire.badges.warrantyMiles) >= 40000 && (
                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                          {Math.round(Number(tire.badges.warrantyMiles)/1000)}K warranty
                        </span>
                      )}
                    </div>

                    {/* 1-2 quick benefit bullets */}
                    {whyPoints.length > 0 && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-700">
                        {whyPoints.map((point, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5">
                            <span className="text-green-600">✓</span>
                            <span>{point}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Price + CTA Block */}
                    <TireBuyBox
                      sku={tire.partNumber || safeSku}
                      brand={tire.brand || "Tire"}
                      model={title}
                      size={tire.size || size}
                      unitPrice={displayPrice}
                      imageUrl={tire.imageUrl}
                      vehicle={hasVehicle ? { year, make, model, trim, modification } : undefined}
                      hasVehicle={hasVehicle}
                      hasWarranty={tire.badges?.warrantyMiles ? Number(tire.badges.warrantyMiles) > 0 : true}
                      source={tire.rawSource || tire.source || "tireweb"}
                      delivery={delivery}
                    />

                    {/* Real behavior-driven popularity signal */}
                    <PopularityBadge signal={popularitySignal} />

                    {/* Manufacturer rebate block */}
                    {rebateMatch && (
                      <RebatePDPBlockStatic match={rebateMatch} />
                    )}

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
                        sourceSku={tire.partNumber || safeSku}
                      />
                    )}
                  </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════
                    ROW 2: Supporting Cards (moved from right column)
                    ═══════════════════════════════════════════════════════════════════ */}
                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  <WhyChooseThisTire 
                    category={category as EnhancedTireCategory}
                    mileageWarranty={tire.badges?.warrantyMiles ? Number(tire.badges.warrantyMiles) : null}
                    isRunFlat={isRunFlatTire}
                    has3PMSF={has3PMSF}
                  />
                  <ComparisonContext 
                    category={category as EnhancedTireCategory}
                    mileageWarranty={tire.badges?.warrantyMiles ? Number(tire.badges.warrantyMiles) : null}
                  />
                  <WhatHappensNext />
                </div>

                {/* ═══════════════════════════════════════════════════════════════════
                    ROW 3: Performance + Full Specs
                    ═══════════════════════════════════════════════════════════════════ */}
                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                  <PerformanceSection ratings={ratings} category={category} />
                  <FullSpecs
                    tireSize={normalizeTireSize(tire.size)}
                    rimDiameter={null}
                    tireDiameter={null}
                    sectionWidth={null}
                    aspectRatio={null}
                    construction={tire.badges?.construction || null}
                    loadIndex={tire.badges?.loadIndex ? String(tire.badges.loadIndex) : null}
                    speedRating={tire.badges?.speedRating ? String(tire.badges.speedRating) : null}
                    mileageWarranty={tire.badges?.warrantyMiles ? String(tire.badges.warrantyMiles) : null}
                    utqg={tire.badges?.utqg || null}
                    treadDepth={tire.badges?.treadDepth ?? null}
                    tireWeight={tire.badges?.tireWeight ?? null}
                  />
                </div>

                {/* ═══════════════════════════════════════════════════════════════════
                    ROW 4: Trust & Support
                    ═══════════════════════════════════════════════════════════════════ */}
                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                  <WarrantySupport 
                    mileageWarranty={tire.badges?.warrantyMiles ? Number(tire.badges.warrantyMiles) : null}
                    hasRoadHazard={true}
                  />
                  <PDPTrustBlock />
                </div>

                <div className="mt-6 text-xs text-neutral-400">SKU: {safeSku}</div>
              </div>

              {/* Mobile sticky CTA */}
              <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white p-3 md:hidden">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-extrabold text-neutral-900">{displayPrice != null ? fmtMoney(displayPrice) : "Call"}</div>
                    <div className="text-[11px] text-neutral-500">per tire</div>
                  </div>
                  <a href="#add-to-cart" className="flex-1 max-w-[200px] h-11 rounded-xl bg-[var(--brand-red)] px-4 flex items-center justify-center text-sm font-extrabold text-white">
                    Add to Cart
                  </a>
                </div>
              </div>
            </main>
          );
        }
      }
    } catch (err) {
      console.error("[tire-detail] TireWeb lookup failed:", err);
    }
    
    return (
      <main className="bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">Tire not found.</div>
          <div className="mt-4">
            <BackToTiresButton className="text-sm font-semibold text-neutral-900 hover:underline" />
          </div>
        </div>
      </main>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WheelPros tires: fetch from database
  // ═══════════════════════════════════════════════════════════════════════════
  const db = getPool();
  const { rows } = await db.query({
    text: `
      select
        t.sku,
        t.brand_desc,
        t.tire_description,
        t.tire_size,
        t.simple_size,
        t.terrain,
        t.construction_type,
        t.mileage_warranty,
        t.load_index,
        t.speed_rating,
        t.section_width,
        t.series,
        t.rim_diameter_in,
        t.tire_diameter_in,
        t.image_url,
        t.map_usd,
        t.msrp_usd,
        coalesce(i.qoh, 0) as qoh,
        -- Additional specs from raw JSON
        t.raw->>'utqg' as utqg,
        t.raw->>'tread_depth' as tread_depth,
        t.raw->>'treadwear' as treadwear,
        t.raw->>'traction' as traction,
        t.raw->>'temperature' as temperature,
        t.raw->>'tire_weight' as tire_weight
      from wp_tires t
      left join wp_inventory i
        on i.sku = t.sku
       and i.product_type = 'tire'
       and i.location_id = 'TOTAL'
      where t.sku = $1
      limit 1
    `,
    values: [safeSku],
  });

  const t = rows[0] || null;

  // ═══════════════════════════════════════════════════════════════════════════
  // TIREWEB FALLBACK: If not found in WheelPros, check TireWeb SKU cache
  // This handles bare URLs like /tires/IHR0144K without source/size params
  // ═══════════════════════════════════════════════════════════════════════════
  if (!t) {
    try {
      const cacheResult = await db.query({
        text: `SELECT size, source FROM tireweb_sku_cache WHERE part_number = $1 LIMIT 1`,
        values: [safeSku],
      });
      if (cacheResult.rows[0]) {
        const { size: cachedSize, source: cachedSource } = cacheResult.rows[0];
        // Redirect to the proper URL with params
        const redirectUrl = `/tires/${encodeURIComponent(safeSku)}?source=tireweb&size=${encodeURIComponent(cachedSize)}`;
        const { redirect } = await import("next/navigation");
        redirect(redirectUrl);
      }
    } catch (err) {
      // Cache lookup failed, continue to "not found" page
      console.error("[tire-pdp] TireWeb cache lookup failed:", err);
    }
  }

  // Related tires
  const related = t
    ? await db.query({
        text: `
          select sku, brand_desc, tire_description, tire_size, simple_size, image_url, map_usd, msrp_usd
          from wp_tires
          where simple_size = $1
            and sku <> $2
          order by brand_desc nulls last, tire_description nulls last
          limit 4
        `,
        values: [String(t.simple_size || ""), safeSku],
      })
    : { rows: [] as any[] };

  if (!t) {
    return (
      <main className="bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔍</span>
              <div>
                <div className="font-bold text-amber-900">Tire not found</div>
                <div className="mt-1 text-sm text-amber-800">
                  SKU <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">{safeSku}</code> wasn&apos;t found in our database.
                  This may be an outdated link or the product is no longer available.
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link 
                    href="/tires" 
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
                  >
                    Browse All Tires
                  </Link>
                  <BackToTiresButton className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50 transition-colors" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const displayPrice = priceFromRow(t);
  
  // Build UTQG from separate components if not available as single field
  const utqgValue = t.utqg || (
    t.treadwear && t.traction && t.temperature
      ? `${t.treadwear} ${t.traction} ${t.temperature}`
      : null
  );
  
  const category = normalizeTreadCategory(t.terrain, t.tire_description);
  const isRunFlatTire = isRunFlat(null, t.tire_description, null);
  const has3PMSF = /3PMSF|3-PEAK|MOUNTAIN.*SNOWFLAKE/i.test(t.tire_description || '');
  
  // Parse UTQG for performance ratings
  const parsedUtqg = parseUTQG(utqgValue);
  const ratings = derivePerformanceRatings(parsedUtqg, category, has3PMSF);
  const whyPoints = getWhyThisTirePoints(category, t.mileage_warranty ? String(t.mileage_warranty) : null, isRunFlatTire, has3PMSF);
  const categoryTagline = getCategoryTagline(category);
  const totalQty = Number(t.qoh) || 0;
  const delivery = getDeliveryMessage(totalQty, isLocalSite);

  // Fetch real popularity signal (non-blocking, cached)
  let popularitySignal: PopularitySignalData | null = null;
  try {
    popularitySignal = await getPopularitySignal("tire", safeSku);
  } catch {
    // Silent fail - no signal is fine
  }

  // Fetch co-add recommendations (non-blocking, cached)
  const coAddedProducts = await getCoAddedProductsForPDP(safeSku, "tire");

  // Fetch rebate match (non-blocking, cached)
  let rebateMatch: { amount: string | null; headline: string; formUrl: string | null; learnMoreUrl: string | null; requirements: string | null; endsText: string | null; brand: string | null } | null = null;
  try {
    const rebateDb = getRebatePool();
    const activeRebates = await listActiveRebates(rebateDb);
    const rawTitle = String(t.tire_description || t.tire_size || t.simple_size || t.sku);
    const titleForMatch = cleanTireDisplayTitle(rawTitle, t.brand_desc);
    const match = getBestMatchingRebate(
      { sku: safeSku, brand: String(t.brand_desc || ""), model: titleForMatch, size: String(t.tire_size || t.simple_size || "") },
      activeRebates
    );
    if (match) {
      rebateMatch = {
        amount: match.rebate.rebate_amount,
        headline: match.rebate.headline,
        formUrl: match.rebate.form_url,
        learnMoreUrl: match.rebate.learn_more_url,
        requirements: match.rebate.requirements,
        endsText: match.rebate.ends_text,
        brand: match.rebate.brand,
      };
    }
  } catch (err) {
    // Silent fail - no rebate is fine
    console.error("[tire-pdp] Rebate fetch error:", err);
  }

  // Enrich with tire asset image if needed
  let enrichedImageUrl: string | null = t.image_url || null;
  if (!enrichedImageUrl) {
    const description = String(t.tire_description || "").trim();
    if (description) {
      try {
        const assetRes = await fetch(`${getBaseUrl()}/api/assets/tire?km=${encodeURIComponent(description)}`, { cache: "no-store" });
        if (assetRes.ok) {
          const assetData = (await assetRes.json()) as { results?: TireAsset[] };
          const asset = Array.isArray(assetData?.results) ? assetData.results[0] : null;
          if (asset?.image_url) enrichedImageUrl = asset.image_url;
        }
      } catch {}
    }
  }

  const rawTitle = String(t.tire_description || t.tire_size || t.simple_size || t.sku);
  const title = cleanTireDisplayTitle(rawTitle, t.brand_desc);

  return (
    <main className="bg-neutral-50">
      {/* Funnel tracking - WheelPros tires */}
      <ProductViewTracker 
        sku={safeSku} 
        type="tire" 
        vehicle={hasVehicle ? { year: parseInt(year), make, model } : undefined} 
      />
      
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Breadcrumb */}
        <BackToTiresButton />

        {/* ═══════════════════════════════════════════════════════════════════
            ROW 1: Hero - Image + Buy Box (streamlined)
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Left: Image */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">🔍</span>
              <span className="text-xs font-medium text-neutral-500">Click image to zoom</span>
            </div>
            <ImageGallery images={enrichedImageUrl ? [String(enrichedImageUrl)] : []} alt={title} />
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
                <Link href={`/tires?${new URLSearchParams({ year, make, model, trim, modification }).toString()}`} className="text-xs font-semibold text-green-700 hover:underline">
                  Change
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                <span className="text-sm text-amber-800">Select vehicle to confirm fit</span>
                <Link href="/tires" className="text-xs font-semibold text-amber-700 hover:underline">Select</Link>
              </div>
            )}

            {/* Brand */}
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{String(t.brand_desc || "Tire")}</div>
            
            {/* Title */}
            <h1 className="-mt-1 text-2xl font-extrabold text-neutral-900 leading-tight">{title}</h1>
            
            {/* Category tagline */}
            <p className="-mt-1 text-sm text-neutral-600">{categoryTagline.tagline}</p>

            {/* Best For (compact) */}
            <BestForMicro 
              category={category as EnhancedTireCategory} 
              mileageWarranty={t.mileage_warranty ? Number(t.mileage_warranty) : null}
              isRunFlat={isRunFlatTire}
            />

            {/* Key spec chips + guides */}
            <div className="flex flex-wrap items-center gap-2">
              {(t.tire_size || t.simple_size) && (
                <span className="inline-flex items-center rounded-full bg-neutral-900 px-3 py-1 text-xs font-bold text-white">
                  {normalizeTireSize(t.tire_size || t.simple_size)}
                </span>
              )}
              {(t.tire_size || t.simple_size) && <TireSizeGuide variant="icon" />}
              {t.load_index && t.speed_rating && (
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                  {String(t.load_index)}{String(t.speed_rating)}
                </span>
              )}
              {category && (
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                  {category}
                  <TireTypesGuide variant="icon" />
                </span>
              )}
              {t.mileage_warranty && Number(t.mileage_warranty) >= 40000 && (
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                  {Math.round(Number(t.mileage_warranty)/1000)}K warranty
                </span>
              )}
            </div>

            {/* 1-2 quick benefit bullets */}
            {whyPoints.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-700">
                {whyPoints.map((point, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    <span className="text-green-600">✓</span>
                    <span>{point}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Price + CTA Block */}
            <TireBuyBox
              sku={safeSku}
              brand={String(t.brand_desc || "Tire")}
              model={title}
              size={String(t.tire_size || t.simple_size || "")}
              loadIndex={t.load_index ? String(t.load_index) : undefined}
              speedRating={t.speed_rating ? String(t.speed_rating) : undefined}
              imageUrl={enrichedImageUrl || undefined}
              unitPrice={displayPrice}
              vehicle={hasVehicle ? { year, make, model, trim, modification } : undefined}
              hasVehicle={hasVehicle}
              hasWarranty={t.mileage_warranty ? Number(t.mileage_warranty) > 0 : true}
              source="wheelpros"
              delivery={delivery}
            />

            {/* Real behavior-driven popularity signal */}
            <PopularityBadge signal={popularitySignal} />

            {/* Manufacturer rebate block */}
            {rebateMatch && (
              <RebatePDPBlockStatic match={rebateMatch} />
            )}

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
                sourceSku={safeSku}
              />
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            ROW 2: Supporting Cards (moved from right column)
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <WhyChooseThisTire 
            category={category as EnhancedTireCategory}
            mileageWarranty={t.mileage_warranty ? Number(t.mileage_warranty) : null}
            isRunFlat={isRunFlatTire}
            has3PMSF={has3PMSF}
          />
          <ComparisonContext 
            category={category as EnhancedTireCategory}
            mileageWarranty={t.mileage_warranty ? Number(t.mileage_warranty) : null}
          />
          <WhatHappensNext />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            ROW 3: Performance + Full Specs
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <PerformanceSection ratings={ratings} category={category} />
          <FullSpecs
            tireSize={t.tire_size ? String(t.tire_size) : null}
            rimDiameter={n(t.rim_diameter_in)}
            tireDiameter={n(t.tire_diameter_in)}
            sectionWidth={n(t.section_width)}
            aspectRatio={n(t.series)}
            construction={t.construction_type ? String(t.construction_type) : null}
            loadIndex={t.load_index ? String(t.load_index) : null}
            speedRating={t.speed_rating ? String(t.speed_rating) : null}
            mileageWarranty={t.mileage_warranty ? String(t.mileage_warranty) : null}
            utqg={utqgValue ? String(utqgValue) : null}
            treadDepth={n(t.tread_depth)}
            tireWeight={n(t.tire_weight)}
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            ROW 4: Trust & Support
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <WarrantySupport 
            mileageWarranty={t.mileage_warranty ? Number(t.mileage_warranty) : null}
            hasRoadHazard={true}
          />
          <PDPTrustBlock />
        </div>

        {/* Related tires */}
        {related.rows?.length ? (
          <section className="mt-10">
            <h2 className="text-lg font-extrabold text-neutral-900">More in this size</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.rows.slice(0, 4).map((r: any) => {
                const rp = priceFromRow(r);
                const name = cleanTireDisplayTitle(String(r.tire_description || r.tire_size || r.sku), r.brand_desc);
                return (
                  <Link key={r.sku} href={`/tires/${encodeURIComponent(String(r.sku))}`} className="group rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-300">
                    <div className="text-[11px] font-medium text-neutral-500">{String(r.brand_desc || "Tire")}</div>
                    <div className="mt-1 line-clamp-2 text-sm font-bold text-neutral-900 group-hover:underline">{name}</div>
                    {r.image_url && (
                      <img src={String(r.image_url)} alt={name} className="mt-3 h-24 w-full object-contain" loading="lazy" />
                    )}
                    <div className="mt-3 text-lg font-extrabold text-neutral-900">{rp != null ? fmtMoney(rp) : "Call"}</div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="mt-6 text-xs text-neutral-400">SKU: {safeSku}</div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white p-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold text-neutral-900">{displayPrice != null ? fmtMoney(displayPrice) : "Call"}</div>
            <div className="text-[11px] text-neutral-500">per tire</div>
          </div>
          <a href="#add-to-cart" className="flex-1 max-w-[200px] h-11 rounded-xl bg-[var(--brand-red)] px-4 flex items-center justify-center text-sm font-extrabold text-white">
            Add to Cart
          </a>
        </div>
      </div>
    </main>
  );
}
