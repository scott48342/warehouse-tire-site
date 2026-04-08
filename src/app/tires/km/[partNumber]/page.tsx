import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { getDisplayTrim } from "@/lib/vehicleDisplay";
import { cleanTireDisplayTitle, normalizeTireSize, cleanTireProductTitle } from "@/lib/productFormat";
import { ImageGallery } from "@/components/ImageGallery";
import { normalizeTreadCategory, type TreadCategory } from "@/lib/tires/normalization";
import { derivePerformanceRatings, type PerformanceRatings } from "@/lib/tires/tireSpecs";
import { PerformanceIndicators } from "@/components/PerformanceIndicators";
// PDP Conversion Enhancements (shared with main PDP)
import { 
  BestForMicro, 
  EnhancedTrustStrip, 
  WhyChooseThisTire,
  WhatHappensNext,
  type TireCategory as EnhancedTireCategory
} from "@/components/TirePDPEnhancements";
// Buying guides
import { TireSizeGuide, TireTypesGuide } from "@/components/BuyingGuides";
// TPMS contextual upsell
import { TPMSSuggestion } from "@/components/TPMSSuggestion";

export const runtime = "nodejs";

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function n(v: any): number | null {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function fmtMoney(v: number) {
  return `$${v.toFixed(2)}`;
}

// ============================================================================
// CATEGORY DETECTION FROM K&M DATA
// ============================================================================

function detectCategoryFromDescription(description: string): TreadCategory {
  const upper = description.toUpperCase();
  
  if (/\bM[\/\-]?T\b|\bMUD[\s\-]?TERRAIN\b|\bMUD[\s\-]?GRAPPLER\b/.test(upper)) return 'Mud-Terrain';
  if (/\bR[\/\-]?T\b|\bRUGGED[\s\-]?TERRAIN\b/.test(upper)) return 'Rugged-Terrain';
  if (/\bA[\/\-]?T\d*[A-Z]?\b|\bALL[\s\-]?TERRAIN\b|\bTERRA\s*TRAC\b|\bKO2\b|\bGRAPPLER\b/.test(upper) && !/MUD/.test(upper)) return 'All-Terrain';
  if (/\bH[\/\-]?T\d*[A-Z]?\d*\b|\bHIGHWAY\b|\bTOURING\b/.test(upper)) return 'Highway/Touring';
  if (/\bWINTER\b|\bBLIZZAK\b|\bSNOW\b|\bICE\b/.test(upper)) return 'Winter';
  if (/\bPERFORMANCE\b|\bSPORT\b|\bUHP\b/.test(upper)) return 'Performance';
  if (/\bSUMMER\b/.test(upper) && !/ALL/.test(upper)) return 'Summer';
  if (/\bALL[\s\-]?WEATHER\b/.test(upper)) return 'All-Weather';
  
  return 'All-Season';
}

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
// FULL SPECS COMPONENT (matching main PDP)
// ============================================================================

interface FullSpecsProps {
  tireSize: string | null;
  loadIndex: string | null;
  speedRating: string | null;
}

function FullSpecs(props: FullSpecsProps) {
  const rows: { label: string; value: string }[] = [];
  
  if (props.tireSize) rows.push({ label: "Size", value: props.tireSize });
  if (props.loadIndex) rows.push({ label: "Load Index", value: props.loadIndex });
  if (props.speedRating) rows.push({ label: "Speed Rating", value: props.speedRating });
  
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
// PERFORMANCE SECTION (matching main PDP)
// ============================================================================

function PerformanceSection({ 
  ratings, 
  category 
}: { 
  ratings: PerformanceRatings | null;
  category: TreadCategory | null;
}) {
  if (!ratings) return null;
  
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
// MAIN PAGE COMPONENT
// ============================================================================

export default async function KmTireDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ partNumber: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { partNumber } = await params;
  const sp = (await searchParams) || {};

  const safePart = String(partNumber || "").trim();
  const size = String((sp as any).size || "").trim();

  const year = String((sp as any).year || "");
  const make = String((sp as any).make || "");
  const model = String((sp as any).model || "");
  const trim = String((sp as any).trim || "");
  const modification = String((sp as any).modification || "");
  
  const displayTrim = getDisplayTrim({ trim });
  const hasVehicle = Boolean(year && make && model);

  const backQs = new URLSearchParams();
  if (year) backQs.set("year", year);
  if (make) backQs.set("make", make);
  if (model) backQs.set("model", model);
  if (trim) backQs.set("trim", trim);
  if (modification) backQs.set("modification", modification);
  if (size) backQs.set("size", size);

  if (!safePart) {
    return (
      <main className="bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">Part number required.</div>
          <div className="mt-4">
            <Link href={`/tires?${backQs.toString()}`} className="text-sm font-extrabold text-neutral-900 hover:underline">
              ← Back to tires
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!size) {
    return (
      <main className="bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Missing tire size context for KM tire detail. (Need ?size=215/55R17)
          </div>
          <div className="mt-4">
            <Link href="/tires" className="text-sm font-extrabold text-neutral-900 hover:underline">
              ← Back to tires
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Fetch from unified search API which includes admin image overrides
  const res = await fetch(
    `${getBaseUrl()}/api/tires/search?size=${encodeURIComponent(size)}&minQty=1`,
    { cache: "no-store" }
  );

  const data = res.ok ? await res.json() : { error: await res.text() };
  const items: any[] = Array.isArray((data as any)?.results) ? (data as any).results : [];

  const item = items.find(
    (t) => String(t?.partNumber || "").trim() === safePart || String(t?.mfgPartNumber || "").trim() === safePart
  );

  if (!item) {
    return (
      <main className="bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            KM Tire not found (PartNumber: {safePart}, Size: {size}).
          </div>
          <div className="mt-4">
            <Link href={`/tires?${backQs.toString()}`} className="text-sm font-extrabold text-neutral-900 hover:underline">
              ← Back to tires
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Extract tire data
  const brand = String(item.brand || "K&M");
  const descriptionRaw = String(item.description || "Tire");
  
  // Get image from unified API response (includes admin overrides)
  const enrichedImageUrl: string | null = item.imageUrl || null;
  const enrichedDisplayName: string | null = item.displayName || item.prettyName || null;

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEAN TITLE: Use the new cleanTireProductTitle() for K&M encoded titles
  // ═══════════════════════════════════════════════════════════════════════════
  const rawTitle = enrichedDisplayName || `${brand} ${descriptionRaw}`;
  const title = cleanTireProductTitle(rawTitle, brand);
  
  // Normalize the display size
  const normalizedSize = normalizeTireSize(size);
  
  // Detect category from description
  const category = detectCategoryFromDescription(descriptionRaw);
  const categoryTagline = getCategoryTagline(category);
  
  // Derive performance ratings based on category (since K&M doesn't have UTQG data)
  const ratings = derivePerformanceRatings(null, category, category === 'Winter' || category === 'All-Weather');
  
  // Extract load/speed from badges if available
  const loadIndex = item.badges?.loadIndex ? String(item.badges.loadIndex) : null;
  const speedRating = item.badges?.speedRating ? String(item.badges.speedRating) : null;
  
  // Calculate price and stock
  const cost = n(item.cost);
  const displayPrice = cost != null ? cost + 50 : null;
  const qPrimary = n(item?.quantity?.primary);
  const qAlt = n(item?.quantity?.alternate);
  const qNat = n(item?.quantity?.national);
  const totalQty = (qPrimary ?? 0) + (qAlt ?? 0) + (qNat ?? 0);
  const delivery = getDeliveryMessage(totalQty);

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Breadcrumb */}
        <Link href={`/tires?${backQs.toString()}`} className="text-sm font-extrabold text-neutral-900 hover:underline">
          ← Back to tires
        </Link>

        {/* ═══════════════════════════════════════════════════════════════════
            ROW 1: Hero - Image + Buy Box
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Left: Image */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">🔍</span>
              <span className="text-xs font-medium text-neutral-500">Click image to zoom</span>
            </div>
            <ImageGallery images={enrichedImageUrl ? [enrichedImageUrl] : []} alt={title} note="Image may vary by size" />
          </div>

          {/* Right: Buy Box */}
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
                <Link href={`/tires?${backQs.toString()}`} className="text-xs font-semibold text-green-700 hover:underline">
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
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{brand}</div>
            
            {/* Title */}
            <h1 className="-mt-1 text-2xl font-extrabold text-neutral-900 leading-tight">{title}</h1>
            
            {/* Category tagline */}
            <p className="-mt-1 text-sm text-neutral-600">{categoryTagline.tagline}</p>

            {/* Best For (compact) */}
            <BestForMicro 
              category={category as EnhancedTireCategory} 
              mileageWarranty={null}
              isRunFlat={false}
            />

            {/* Key spec chips + guides */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-neutral-900 px-3 py-1 text-xs font-bold text-white">
                {normalizedSize}
              </span>
              <TireSizeGuide variant="icon" />
              {loadIndex && speedRating && (
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                  {loadIndex}{speedRating}
                </span>
              )}
              {category && (
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                  {category}
                  <TireTypesGuide variant="icon" />
                </span>
              )}
            </div>

            {/* Price + CTA Block */}
            <div className="rounded-2xl border border-green-300 bg-gradient-to-br from-green-50/80 to-emerald-50/60 p-4 shadow-sm">
              {delivery.urgency && (
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700">
                  <span>⚡</span>
                  <span>{delivery.urgency}</span>
                </div>
              )}

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

              <div className={`mt-3 flex items-center gap-2 text-sm ${delivery.color}`}>
                <span className="text-base">{delivery.icon}</span>
                <span>{delivery.text}</span>
              </div>
              
              {/* CTA Buttons */}
              <div className="mt-4 grid gap-2">
                <a
                  href={BRAND.links.tel}
                  className="flex h-12 items-center justify-center rounded-xl bg-[var(--brand-red)] px-4 text-sm font-extrabold text-white hover:bg-red-700 transition-colors"
                >
                  Call for Quote
                </a>
                <Link
                  href="/schedule"
                  className="flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-extrabold text-neutral-900 hover:border-neutral-300 transition-colors"
                >
                  Schedule Install
                </Link>
              </div>
              
              {/* Trust strip */}
              <EnhancedTrustStrip hasVehicle={hasVehicle} hasWarranty={true} />
            </div>

            {/* TPMS contextual upsell - only for 2007+ vehicles */}
            <TPMSSuggestion
              vehicleYear={hasVehicle ? year : null}
              vehicleMake={hasVehicle ? make : null}
              vehicleModel={hasVehicle ? model : null}
              context="pdp"
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            ROW 2: Supporting Cards
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <WhyChooseThisTire 
            category={category as EnhancedTireCategory}
            mileageWarranty={null}
            isRunFlat={false}
            has3PMSF={category === 'Winter' || category === 'All-Weather'}
          />
          <PerformanceSection ratings={ratings} category={category} />
          <WhatHappensNext />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            ROW 3: Full Specs
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="mt-8 max-w-md">
          <FullSpecs
            tireSize={normalizedSize}
            loadIndex={loadIndex}
            speedRating={speedRating}
          />
        </div>
      </div>
    </main>
  );
}
