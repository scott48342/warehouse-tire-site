import Link from "next/link";
import pg from "pg";
import { BRAND } from "@/lib/brand";
import { ImageGallery } from "@/components/ImageGallery";
import { RecommendedFitmentCard } from "@/components/RecommendedFitmentCard";
import { AddTiresToCartButton } from "@/components/AddTiresToCartButton";
import { BackToTiresButton } from "@/components/BackToTiresButton";
import { extractDisplayTrim } from "@/lib/vehicleDisplay";
import { cleanTireDisplayTitle } from "@/lib/productFormat";
import { normalizeTreadCategory, isRunFlat, type TreadCategory } from "@/lib/tires/normalization";
import { derivePerformanceRatings, type PerformanceRatings } from "@/lib/tires/tireSpecs";
import { PerformanceIndicators } from "@/components/PerformanceIndicators";
import { PDPTrustBlock } from "@/components/StoreReviews";
// PDP Conversion Enhancements (2026-04-06)
import { 
  BestForMicro, 
  EnhancedTrustStrip, 
  ReviewSummary,
  WhyThisTireSection,
  WarrantySupport,
  FinalTrustReminder,
  ConfidenceBadge,
  CollapsibleSection,
  type TireCategory as EnhancedTireCategory
} from "@/components/TirePDPEnhancements";

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
// TRUST STRIP - Matches wheel PDP style
// ============================================================================

function TrustStrip({ hasVehicle }: { hasVehicle: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-green-700">
      <span>✓ Free shipping over $1,500</span>
      {hasVehicle && <span>✓ Guaranteed fit</span>}
      <span>✓ Expert support</span>
    </div>
  );
}

// ============================================================================
// QUICK SPECS - Inline, high-value only
// ============================================================================

interface QuickSpecsProps {
  mileageWarranty: string | null;
  category: TreadCategory | null;
  loadIndex: string | null;
  speedRating: string | null;
  isRunFlatTire: boolean;
  has3PMSF: boolean;
}

function QuickSpecs(props: QuickSpecsProps) {
  const items: string[] = [];
  
  // High-value specs only, in priority order
  if (props.mileageWarranty) {
    const miles = parseInt(props.mileageWarranty, 10);
    if (miles >= 1000) {
      items.push(`${Math.round(miles/1000)}K mi warranty`);
    }
  }
  if (props.category) {
    items.push(props.category);
  }
  if (props.loadIndex && props.speedRating) {
    items.push(`${props.loadIndex}${props.speedRating}`);
  }
  if (props.isRunFlatTire) {
    items.push("Run-Flat");
  }
  if (props.has3PMSF) {
    items.push("3PMSF ❄️");
  }
  
  if (items.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.slice(0, 4).map((item) => (
        <span key={item} className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
          {item}
        </span>
      ))}
    </div>
  );
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
// WHY THIS TIRE - Benefit-driven, conversational
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
  
  // Add warranty as value signal
  if (mileageWarranty) {
    const miles = parseInt(mileageWarranty, 10);
    if (miles >= 60000) {
      points.push(`${Math.round(miles/1000)}K mile warranty backs it up`);
    } else if (miles >= 40000) {
      points.push(`${Math.round(miles/1000)}K mile warranty included`);
    }
  }
  
  // Add special features
  if (isRunFlatTire) {
    points.push("Run-flat tech gets you home safely");
  } else if (has3PMSF) {
    points.push("3-peak rated for real winter grip");
  }
  
  return points.slice(0, 4); // Max 4 for persuasion without clutter
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
// ============================================================================

function getDeliveryMessage(qty: number): { text: string; color: string; icon: string; urgency: string | null } {
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
}

function FullSpecs(props: FullSpecsProps) {
  const rows: { label: string; value: string }[] = [];
  
  if (props.tireSize) rows.push({ label: "Size", value: props.tireSize });
  if (props.loadIndex) rows.push({ label: "Load Index", value: props.loadIndex });
  if (props.speedRating) rows.push({ label: "Speed Rating", value: props.speedRating });
  if (props.mileageWarranty) rows.push({ label: "Mileage Warranty", value: `${props.mileageWarranty} miles` });
  if (props.rimDiameter) rows.push({ label: "Wheel Diameter", value: `${props.rimDiameter}"` });
  if (props.tireDiameter) rows.push({ label: "Overall Diameter", value: `${props.tireDiameter}"` });
  if (props.sectionWidth) rows.push({ label: "Section Width", value: `${props.sectionWidth}mm` });
  if (props.aspectRatio) rows.push({ label: "Aspect Ratio", value: `${props.aspectRatio}` });
  if (props.construction) rows.push({ label: "Construction", value: props.construction });
  
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

// ============================================================================
// BADGE COMPONENT
// ============================================================================

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-neutral-800">
      {children}
    </span>
  );
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
          // Use retail price (sellPrice/MAP) only if it's actually higher than cost
          // When sellPrice = buyPrice (no real markup), apply $50 margin
          const cost = typeof tire.cost === "number" && tire.cost > 0 ? tire.cost : null;
          const price = typeof tire.price === "number" && tire.price > 0 ? tire.price : null;
          const displayPrice = (price && cost && price > cost)
            ? price // Real retail markup from supplier
            : cost
              ? cost + 50 // Apply $50 margin (consistent with listing)
              : null;
          const rawTitle = tire.displayName || tire.prettyName || tire.description || tire.model || safeSku;
          const title = cleanTireDisplayTitle(rawTitle, tire.brand);
          
          const category = normalizeTreadCategory(tire.badges?.terrain, tire.description);
          const isRunFlatTire = isRunFlat(null, tire.description, null);
          const has3PMSF = /3PMSF|3-PEAK|MOUNTAIN.*SNOWFLAKE/i.test(tire.description || '');
          
          const ratings = derivePerformanceRatings(null, category, has3PMSF);
          const whyPoints = getWhyThisTirePoints(category, tire.badges?.warrantyMiles ? String(tire.badges.warrantyMiles) : null, isRunFlatTire, has3PMSF);
          const categoryTagline = getCategoryTagline(category);
          
          const q = tire.quantity || {};
          const totalQty = (q.primary || 0) + (q.alternate || 0) + (q.national || 0);
          const delivery = getDeliveryMessage(totalQty);
          const confidenceSignal = getConfidenceSignal(totalQty, category);
          
          return (
            <main className="bg-neutral-50">
              <div className="mx-auto max-w-6xl px-4 py-8">
                {/* Breadcrumb */}
                <BackToTiresButton />

                <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">
                  {/* Left: Image - Clean with zoom hint */}
                  <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🔍</span>
                        <span className="text-xs font-medium text-neutral-500">Click image to zoom</span>
                      </div>
                    </div>
                    <ImageGallery images={tire.imageUrl ? [tire.imageUrl] : []} alt={title} />
                  </div>

                  {/* Right: Buy Box - Matches wheel PDP conversion structure */}
                  <div className="lg:sticky lg:top-6 space-y-4">
                    {/* Compact fitment bar */}
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

                    {/* ═══════════════════════════════════════════════════════════════════
                        ABOVE THE FOLD: Title → Specs → Price → CTA
                        ═══════════════════════════════════════════════════════════════════ */}
                    
                    {/* Brand */}
                    <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{tire.brand || "Tire"}</div>
                    
                    {/* Title */}
                    <h1 className="-mt-2 text-2xl font-extrabold text-neutral-900 leading-tight">{title}</h1>
                    
                    {/* Category tagline */}
                    <p className="-mt-2 text-sm text-neutral-600">{categoryTagline.tagline}</p>

                    {/* ENHANCEMENT: Best For Micro Section */}
                    <BestForMicro 
                      category={category as EnhancedTireCategory} 
                      mileageWarranty={tire.badges?.warrantyMiles ? Number(tire.badges.warrantyMiles) : null}
                      isRunFlat={isRunFlatTire}
                    />

                    {/* ENHANCEMENT: Review Summary (placeholder) */}
                    <ReviewSummary rating={null} reviewCount={null} showPlaceholder={true} />

                    {/* Key spec chips */}
                    <div className="flex flex-wrap items-center gap-2">
                      {(tire.size || size) && (
                        <span className="inline-flex items-center rounded-full bg-neutral-900 px-3 py-1 text-xs font-bold text-white">
                          {tire.size || size}
                        </span>
                      )}
                      {tire.badges?.loadIndex && tire.badges?.speedRating && (
                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                          {String(tire.badges.loadIndex)}{String(tire.badges.speedRating)}
                        </span>
                      )}
                      {category && (
                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                          {category}
                        </span>
                      )}
                      {tire.badges?.warrantyMiles && Number(tire.badges.warrantyMiles) >= 40000 && (
                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                          {Math.round(Number(tire.badges.warrantyMiles)/1000)}K warranty
                        </span>
                      )}
                    </div>

                    {/* Key benefits - above the fold */}
                    {whyPoints.length > 0 && (
                      <div className="flex flex-wrap gap-2 text-sm text-neutral-700">
                        {whyPoints.slice(0, 2).map((point, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5">
                            <span className="text-green-600">✓</span>
                            <span>{point}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Price + CTA Block - THE CONVERSION ZONE */}
                    <div id="add-to-cart" className="rounded-2xl border border-green-300 bg-gradient-to-br from-green-50/80 to-emerald-50/60 p-4 shadow-sm">
                      {/* Urgency banner */}
                      {delivery.urgency && (
                        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700">
                          <span>⚡</span>
                          <span>{delivery.urgency}</span>
                        </div>
                      )}

                      {/* Price */}
                      <div className="flex items-baseline gap-2">
                        {displayPrice != null ? (
                          <>
                            <div className="text-3xl font-extrabold text-neutral-900">{fmtMoney(displayPrice)}</div>
                            <div className="text-sm text-neutral-500">per tire</div>
                          </>
                        ) : (
                          <div className="text-xl font-bold text-neutral-700">Call for pricing</div>
                        )}
                      </div>
                      {displayPrice != null && (
                        <div className="mt-1 text-sm text-neutral-600">
                          Set of 4: <span className="font-bold text-green-700">{fmtMoney(displayPrice * 4)}</span>
                        </div>
                      )}

                      {/* Delivery */}
                      <div className={`mt-3 flex items-center gap-2 text-sm ${delivery.color}`}>
                        <span className="text-base">{delivery.icon}</span>
                        <span>{delivery.text}</span>
                      </div>
                      
                      {/* Primary CTA */}
                      {displayPrice != null && (
                        <div className="mt-4">
                          <AddTiresToCartButton
                            sku={tire.partNumber || safeSku}
                            brand={tire.brand || "Tire"}
                            model={title}
                            size={tire.size || size}
                            unitPrice={displayPrice}
                            imageUrl={tire.imageUrl}
                            source={tire.rawSource || tire.source || "tireweb"}
                            variant="primary"
                          />
                        </div>
                      )}
                      
                      {/* Confidence line */}
                      <div className="mt-3 text-center text-sm font-medium text-green-800">
                        Guaranteed fit • Ships fast
                      </div>
                      
                      {/* ENHANCEMENT: Enhanced Trust Strip */}
                      <EnhancedTrustStrip 
                        hasVehicle={hasVehicle} 
                        hasWarranty={tire.badges?.warrantyMiles ? Number(tire.badges.warrantyMiles) > 0 : true} 
                      />
                    </div>

                    {/* ENHANCEMENT: Confidence Badge (popularity signal) */}
                    <ConfidenceBadge message={confidenceSignal} />

                    {/* ═══════════════════════════════════════════════════════════════════
                        BELOW THE FOLD: Additional benefits (if any)
                        ═══════════════════════════════════════════════════════════════════ */}
                    
                    {/* Additional benefits - show remaining points not shown above */}
                    {whyPoints.length > 2 && (
                      <div className="rounded-xl bg-gradient-to-br from-neutral-50 to-white border border-neutral-100 px-4 py-3">
                        <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-2">More to Love</div>
                        <ul className="space-y-2">
                          {whyPoints.slice(2).map((point, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-800">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs mt-0.5">✓</span>
                              <span className="leading-snug">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* ENHANCEMENT: Final Trust Reminder */}
                    <FinalTrustReminder hasVehicle={hasVehicle} />
                    
                    {/* Store Reviews - Social Proof */}
                    <PDPTrustBlock />
                  </div>
                </div>

                {/* Below the fold: Performance + Full specs */}
                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                  <PerformanceSection ratings={ratings} category={category} />
                  <FullSpecs
                    tireSize={tire.size}
                    rimDiameter={null}
                    tireDiameter={null}
                    sectionWidth={null}
                    aspectRatio={null}
                    construction={null}
                    loadIndex={tire.badges?.loadIndex ? String(tire.badges.loadIndex) : null}
                    speedRating={tire.badges?.speedRating ? String(tire.badges.speedRating) : null}
                    mileageWarranty={tire.badges?.warrantyMiles ? String(tire.badges.warrantyMiles) : null}
                  />
                </div>

                {/* ENHANCEMENT: Warranty & Support Section */}
                <div className="mt-6">
                  <WarrantySupport 
                    mileageWarranty={tire.badges?.warrantyMiles ? Number(tire.badges.warrantyMiles) : null}
                    hasRoadHazard={true}
                  />
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
        coalesce(i.qoh, 0) as qoh
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
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">Tire not found.</div>
          <div className="mt-4">
            <BackToTiresButton className="text-sm font-semibold text-neutral-900 hover:underline" />
          </div>
        </div>
      </main>
    );
  }

  const displayPrice = priceFromRow(t);
  
  // Normalize category and detect features
  const category = normalizeTreadCategory(t.terrain, t.tire_description);
  const isRunFlatTire = isRunFlat(null, t.tire_description, null);
  const has3PMSF = /3PMSF|3-PEAK|MOUNTAIN.*SNOWFLAKE/i.test(t.tire_description || '');
  
  const ratings = derivePerformanceRatings(null, category, has3PMSF);
  const whyPoints = getWhyThisTirePoints(category, t.mileage_warranty ? String(t.mileage_warranty) : null, isRunFlatTire, has3PMSF);
  const categoryTagline = getCategoryTagline(category);
  const totalQty = Number(t.qoh) || 0;
  const delivery = getDeliveryMessage(totalQty);
  const confidenceSignal = getConfidenceSignal(totalQty, category);

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
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Breadcrumb */}
        <BackToTiresButton />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Left: Image - Clean with zoom hint */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔍</span>
                <span className="text-xs font-medium text-neutral-500">Click image to zoom</span>
              </div>
            </div>
            <ImageGallery images={enrichedImageUrl ? [String(enrichedImageUrl)] : []} alt={title} />
          </div>

          {/* Right: Buy Box - Matches wheel PDP conversion structure */}
          <div className="lg:sticky lg:top-6 space-y-4">
            {/* Compact fitment bar */}
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

            {/* ═══════════════════════════════════════════════════════════════════
                ABOVE THE FOLD: Title → Specs → Price → CTA
                ═══════════════════════════════════════════════════════════════════ */}
            
            {/* Brand */}
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{String(t.brand_desc || "Tire")}</div>
            
            {/* Title */}
            <h1 className="-mt-2 text-2xl font-extrabold text-neutral-900 leading-tight">{title}</h1>
            
            {/* Category tagline */}
            <p className="-mt-2 text-sm text-neutral-600">{categoryTagline.tagline}</p>

            {/* ENHANCEMENT: Best For Micro Section */}
            <BestForMicro 
              category={category as EnhancedTireCategory} 
              mileageWarranty={t.mileage_warranty ? Number(t.mileage_warranty) : null}
              isRunFlat={isRunFlatTire}
            />

            {/* ENHANCEMENT: Review Summary (placeholder) */}
            <ReviewSummary rating={null} reviewCount={null} showPlaceholder={true} />

            {/* Key spec chips - size, load, speed */}
            <div className="flex flex-wrap items-center gap-2">
              {(t.tire_size || t.simple_size) && (
                <span className="inline-flex items-center rounded-full bg-neutral-900 px-3 py-1 text-xs font-bold text-white">
                  {String(t.tire_size || t.simple_size)}
                </span>
              )}
              {t.load_index && t.speed_rating && (
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                  {String(t.load_index)}{String(t.speed_rating)}
                </span>
              )}
              {category && (
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                  {category}
                </span>
              )}
              {t.mileage_warranty && Number(t.mileage_warranty) >= 40000 && (
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                  {Math.round(Number(t.mileage_warranty)/1000)}K warranty
                </span>
              )}
            </div>

            {/* Key benefits - above the fold */}
            {whyPoints.length > 0 && (
              <div className="flex flex-wrap gap-2 text-sm text-neutral-700">
                {whyPoints.slice(0, 2).map((point, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    <span className="text-green-600">✓</span>
                    <span>{point}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Price + CTA Block - THE CONVERSION ZONE */}
            <div id="add-to-cart" className="rounded-2xl border border-green-300 bg-gradient-to-br from-green-50/80 to-emerald-50/60 p-4 shadow-sm">
              {/* Urgency banner */}
              {delivery.urgency && (
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700">
                  <span>⚡</span>
                  <span>{delivery.urgency}</span>
                </div>
              )}

              {/* Price */}
              <div className="flex items-baseline gap-2">
                {displayPrice != null ? (
                  <>
                    <div className="text-3xl font-extrabold text-neutral-900">{fmtMoney(displayPrice)}</div>
                    <div className="text-sm text-neutral-500">per tire</div>
                  </>
                ) : (
                  <div className="text-xl font-bold text-neutral-700">Call for pricing</div>
                )}
              </div>
              {displayPrice != null && (
                <div className="mt-1 text-sm text-neutral-600">
                  Set of 4: <span className="font-bold text-green-700">{fmtMoney(displayPrice * 4)}</span>
                </div>
              )}

              {/* Delivery */}
              <div className={`mt-3 flex items-center gap-2 text-sm ${delivery.color}`}>
                <span className="text-base">{delivery.icon}</span>
                <span>{delivery.text}</span>
              </div>
              
              {/* Primary CTA */}
              <div className="mt-4">
                <AddTiresToCartButton
                  sku={safeSku}
                  brand={String(t.brand_desc || "Tire")}
                  model={title}
                  size={String(t.tire_size || t.simple_size || "")}
                  loadIndex={t.load_index ? String(t.load_index) : undefined}
                  speedRating={t.speed_rating ? String(t.speed_rating) : undefined}
                  imageUrl={enrichedImageUrl || undefined}
                  unitPrice={displayPrice ?? 0}
                  vehicle={hasVehicle ? { year, make, model, trim, modification } : undefined}
                  quantity={4}
                />
              </div>
              
              {/* Confidence line */}
              <div className="mt-3 text-center text-sm font-medium text-green-800">
                Guaranteed fit • Ships fast
              </div>
              
              {/* ENHANCEMENT: Enhanced Trust Strip */}
              <EnhancedTrustStrip 
                hasVehicle={hasVehicle} 
                hasWarranty={t.mileage_warranty ? Number(t.mileage_warranty) > 0 : true} 
              />
            </div>

            {/* ENHANCEMENT: Confidence Badge (popularity signal) */}
            <ConfidenceBadge message={confidenceSignal} />

            {/* ═══════════════════════════════════════════════════════════════════
                BELOW THE FOLD: Additional benefits (if any)
                ═══════════════════════════════════════════════════════════════════ */}
            
            {/* Additional benefits - show remaining points not shown above */}
            {whyPoints.length > 2 && (
              <div className="rounded-xl bg-gradient-to-br from-neutral-50 to-white border border-neutral-100 px-4 py-3">
                <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-2">More to Love</div>
                <ul className="space-y-2">
                  {whyPoints.slice(2).map((point, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-800">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs mt-0.5">✓</span>
                      <span className="leading-snug">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* ENHANCEMENT: Final Trust Reminder */}
            <FinalTrustReminder hasVehicle={hasVehicle} />
            
            {/* Store Reviews - Social Proof */}
            <PDPTrustBlock />
          </div>
        </div>

        {/* Below the fold: Performance + Full specs */}
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
          />
        </div>

        {/* ENHANCEMENT: Warranty & Support Section */}
        <div className="mt-6">
          <WarrantySupport 
            mileageWarranty={t.mileage_warranty ? Number(t.mileage_warranty) : null}
            hasRoadHazard={true}
          />
        </div>

        {/* Related tires - limit to 4 */}
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
