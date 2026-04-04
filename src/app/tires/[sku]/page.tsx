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
// TRUST STRIP - Compact inline row
// ============================================================================

function TrustStrip({ hasVehicle }: { hasVehicle: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-600">
      {hasVehicle && (
        <span className="inline-flex items-center gap-1 text-green-700">
          <span>✓</span> Fits your vehicle
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <span>🚚</span> Free shipping
      </span>
      <span className="inline-flex items-center gap-1">
        <span>💰</span> Price match
      </span>
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
// WHY THIS TIRE - 3 bullets max, benefit-driven
// ============================================================================

function getWhyThisTirePoints(
  category: TreadCategory | null,
  mileageWarranty: string | null,
  isRunFlatTire: boolean,
  has3PMSF: boolean,
): string[] {
  const points: string[] = [];
  
  // One category-specific benefit
  switch (category) {
    case 'All-Season':
      points.push("Reliable grip in rain, dry roads, and light snow");
      break;
    case 'All-Weather':
      points.push("Year-round performance with winter capability");
      break;
    case 'All-Terrain':
      points.push("On-road comfort meets off-road capability");
      break;
    case 'Mud-Terrain':
      points.push("Maximum traction in mud, rock, and loose terrain");
      break;
    case 'Highway/Touring':
      points.push("Smooth, quiet ride optimized for highway miles");
      break;
    case 'Performance':
      points.push("Precise handling and responsive cornering");
      break;
    case 'Summer':
      points.push("Maximum grip in warm weather conditions");
      break;
    case 'Winter':
      points.push("Engineered for ice, snow, and freezing temps");
      break;
    case 'Rugged-Terrain':
      points.push("Tough sidewalls for trail protection");
      break;
    default:
      points.push("Quality tire with reliable performance");
  }
  
  // Add warranty benefit if significant
  if (mileageWarranty) {
    const miles = parseInt(mileageWarranty, 10);
    if (miles >= 60000) {
      points.push(`Backed by ${Math.round(miles/1000)}K mile warranty`);
    }
  }
  
  // Add special features
  if (isRunFlatTire) {
    points.push("Drive safely to service even with a flat");
  } else if (has3PMSF) {
    points.push("Certified for severe snow conditions");
  }
  
  return points.slice(0, 3); // Max 3
}

// ============================================================================
// DELIVERY MESSAGE - Confident and specific
// ============================================================================

function getDeliveryMessage(qty: number): { text: string; color: string; icon: string } {
  if (qty >= 8) {
    return { text: "In stock · Ships tomorrow", color: "text-green-700 font-semibold", icon: "🚀" };
  } else if (qty >= 4) {
    return { text: "In stock · Ships in 1-2 days", color: "text-green-700 font-semibold", icon: "📦" };
  } else if (qty > 0) {
    return { text: `Only ${qty} left · Ships in 1-2 days`, color: "text-amber-700 font-semibold", icon: "⚡" };
  } else {
    return { text: "Available to order · Ships in 1-2 weeks", color: "text-amber-600", icon: "📋" };
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
          
          const q = tire.quantity || {};
          const totalQty = (q.primary || 0) + (q.alternate || 0) + (q.national || 0);
          const delivery = getDeliveryMessage(totalQty);
          
          return (
            <main className="bg-neutral-50">
              <div className="mx-auto max-w-6xl px-4 py-8">
                {/* Breadcrumb */}
                <BackToTiresButton />

                <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">
                  {/* Left: Image */}
                  <div className="rounded-3xl border border-neutral-200 bg-white p-3">
                    <ImageGallery images={tire.imageUrl ? [tire.imageUrl] : []} alt={title} />
                  </div>

                  {/* Right: Buy Box */}
                  <div className="space-y-4">
                    {/* Vehicle confirmation */}
                    {hasVehicle && (
                      <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-green-800">
                            ✓ Fits {year} {make} {model}
                          </span>
                          <Link href={`/tires?${new URLSearchParams({ year, make, model, trim, modification }).toString()}`} className="text-xs text-green-700 hover:underline">
                            Change
                          </Link>
                        </div>
                      </div>
                    )}

                    {/* Main buy box card - elevated decision area */}
                    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-lg shadow-neutral-200/50 ring-1 ring-neutral-100">
                      {/* Brand */}
                      <p className="text-sm font-medium text-neutral-500">{tire.brand || "Tire"}</p>
                      
                      {/* Title */}
                      <h1 className="mt-1 text-xl font-extrabold tracking-tight text-neutral-900">{title}</h1>
                      
                      {/* Quick specs */}
                      <div className="mt-2">
                        <QuickSpecs
                          mileageWarranty={tire.badges?.warrantyMiles ? String(tire.badges.warrantyMiles) : null}
                          category={category}
                          loadIndex={tire.badges?.loadIndex ? String(tire.badges.loadIndex) : null}
                          speedRating={tire.badges?.speedRating ? String(tire.badges.speedRating) : null}
                          isRunFlatTire={isRunFlatTire}
                          has3PMSF={has3PMSF}
                        />
                      </div>

                      {/* Price - DOMINANT */}
                      <div className="mt-4 pt-4 border-t border-neutral-100">
                        {displayPrice != null ? (
                          <>
                            <div className="text-3xl font-extrabold text-neutral-900">{fmtMoney(displayPrice)}</div>
                            <div className="text-sm text-neutral-500">
                              per tire · <span className="font-semibold text-neutral-700">{fmtMoney(displayPrice * 4)} for 4</span>
                            </div>
                          </>
                        ) : (
                          <div className="text-xl font-bold text-neutral-700">Call for pricing</div>
                        )}
                      </div>

                      {/* Delivery - confident and emphasized */}
                      <div className={`mt-3 flex items-center gap-2 text-sm ${delivery.color}`}>
                        <span className="text-base">{delivery.icon}</span>
                        <span>{delivery.text}</span>
                      </div>

                      {/* CTA - DOMINANT */}
                      {displayPrice != null && (
                        <div id="add-to-cart" className="mt-4">
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

                      {/* Trust strip - subtle, below CTA */}
                      <div className="mt-3 pt-3 border-t border-neutral-100">
                        <TrustStrip hasVehicle={hasVehicle} />
                      </div>
                    </div>

                    {/* Why this tire - benefit-driven with subtle styling */}
                    {whyPoints.length > 0 && (
                      <div className="rounded-xl bg-gradient-to-br from-neutral-50 to-white border border-neutral-100 px-4 py-3">
                        <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-2">Why This Tire</div>
                        <ul className="space-y-2">
                          {whyPoints.map((point, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-800">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs mt-0.5">✓</span>
                              <span className="leading-snug">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
  const delivery = getDeliveryMessage(Number(t.qoh) || 0);

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
          {/* Left: Image */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-3">
            <ImageGallery images={enrichedImageUrl ? [String(enrichedImageUrl)] : []} alt={title} />
          </div>

          {/* Right: Buy Box */}
          <div className="space-y-4">
            {/* Vehicle confirmation */}
            {hasVehicle ? (
              <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-green-800">
                    ✓ Fits {year} {make} {model}
                  </span>
                  <Link href={`/tires?${new URLSearchParams({ year, make, model, trim, modification }).toString()}`} className="text-xs text-green-700 hover:underline">
                    Change
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Select vehicle to confirm fit</span>
                  <Link href="/tires" className="text-xs font-semibold text-neutral-900 hover:underline">Select</Link>
                </div>
              </div>
            )}

            {/* Main buy box card */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              {/* Brand */}
              <p className="text-sm font-medium text-neutral-500">{String(t.brand_desc || "Tire")}</p>
              
              {/* Title */}
              <h1 className="mt-1 text-xl font-extrabold tracking-tight text-neutral-900">{title}</h1>
              
              {/* Quick specs */}
              <div className="mt-2">
                <QuickSpecs
                  mileageWarranty={t.mileage_warranty ? String(t.mileage_warranty) : null}
                  category={category}
                  loadIndex={t.load_index ? String(t.load_index) : null}
                  speedRating={t.speed_rating ? String(t.speed_rating) : null}
                  isRunFlatTire={isRunFlatTire}
                  has3PMSF={has3PMSF}
                />
              </div>

              {/* Price - DOMINANT */}
              <div className="mt-4 pt-4 border-t border-neutral-100">
                {displayPrice != null ? (
                  <>
                    <div className="text-3xl font-extrabold text-neutral-900">{fmtMoney(displayPrice)}</div>
                    <div className="text-sm text-neutral-500">
                      per tire · <span className="font-semibold text-neutral-700">{fmtMoney(displayPrice * 4)} for 4</span>
                    </div>
                  </>
                ) : (
                  <div className="text-xl font-bold text-neutral-700">Call for pricing</div>
                )}
              </div>

              {/* Delivery - confident */}
              <div className={`mt-2 text-sm font-medium ${delivery.color}`}>
                {delivery.text}
              </div>

              {/* CTA - DOMINANT */}
              <div id="add-to-cart" className="mt-4">
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

              {/* Trust strip - subtle, below CTA */}
              <div className="mt-3 pt-3 border-t border-neutral-100">
                <TrustStrip hasVehicle={hasVehicle} />
              </div>
            </div>

            {/* Why this tire - compact */}
            {whyPoints.length > 0 && (
              <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
                <ul className="space-y-1">
                  {whyPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
