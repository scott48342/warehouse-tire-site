import Link from "next/link";
import pg from "pg";
import { BRAND } from "@/lib/brand";
import { ImageGallery } from "@/components/ImageGallery";
import { RecommendedFitmentCard } from "@/components/RecommendedFitmentCard";
import { AddTiresToCartButton } from "@/components/AddTiresToCartButton";
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
  const mapUsd0 = n(r?.map_usd);
  const msrpUsd0 = n(r?.msrp_usd);
  const mapUsd = mapUsd0 != null && mapUsd0 > 0.01 ? mapUsd0 : null;
  const msrpUsd = msrpUsd0 != null && msrpUsd0 > 0.01 ? msrpUsd0 : null;
  return mapUsd ?? (msrpUsd != null ? msrpUsd + 50 : null);
}

// ============================================================================
// TRUST STRIP
// ============================================================================

function TrustStrip({ hasVehicle }: { hasVehicle: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-[11px]">
      {hasVehicle && (
        <div className="flex items-center gap-1.5 rounded-lg bg-green-50 px-2.5 py-2 text-green-800">
          <span className="text-green-600">✓</span>
          <span className="font-semibold">Fitment Confirmed</span>
        </div>
      )}
      <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-2 text-blue-800">
        <span>🚚</span>
        <span className="font-semibold">Free Shipping</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-amber-800">
        <span>💰</span>
        <span className="font-semibold">Price Match</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg bg-purple-50 px-2.5 py-2 text-purple-800">
        <span>💳</span>
        <span className="font-semibold">Financing Available</span>
      </div>
    </div>
  );
}

// ============================================================================
// KEY SPECS BOX
// ============================================================================

interface KeySpecsProps {
  mileageWarranty: string | null;
  loadIndex: string | null;
  speedRating: string | null;
  rimDiameter: number | null;
  tireDiameter: number | null;
  sectionWidth: number | null;
  aspectRatio: number | null;
  construction: string | null;
  isRunFlatTire: boolean;
  has3PMSF: boolean;
  utqg?: string | null;
  treadDepth?: number | null;
}

function KeySpecsBox(props: KeySpecsProps) {
  const specs: { label: string; value: string; icon?: string }[] = [];
  
  if (props.mileageWarranty) {
    specs.push({ label: "Mileage Warranty", value: `${props.mileageWarranty} mi`, icon: "📏" });
  }
  if (props.utqg) {
    specs.push({ label: "UTQG", value: props.utqg, icon: "📊" });
  }
  if (props.treadDepth) {
    specs.push({ label: "Tread Depth", value: `${props.treadDepth}/32"`, icon: "📐" });
  }
  if (props.tireDiameter) {
    specs.push({ label: "Overall Diameter", value: `${props.tireDiameter}"`, icon: "⭕" });
  }
  if (props.loadIndex) {
    specs.push({ label: "Load Index", value: props.loadIndex, icon: "⚖️" });
  }
  if (props.speedRating) {
    specs.push({ label: "Speed Rating", value: props.speedRating, icon: "🏎️" });
  }
  if (props.isRunFlatTire) {
    specs.push({ label: "Run-Flat", value: "Yes", icon: "🛡️" });
  }
  if (props.has3PMSF) {
    specs.push({ label: "3PMSF", value: "Severe Snow Rated", icon: "❄️" });
  }
  if (props.rimDiameter) {
    specs.push({ label: "Wheel Diameter", value: `${props.rimDiameter}"`, icon: "🔵" });
  }
  if (props.sectionWidth) {
    specs.push({ label: "Section Width", value: `${props.sectionWidth}mm`, icon: "↔️" });
  }
  if (props.aspectRatio) {
    specs.push({ label: "Aspect Ratio", value: `${props.aspectRatio}`, icon: "📐" });
  }
  if (props.construction) {
    specs.push({ label: "Construction", value: props.construction, icon: "🔧" });
  }

  if (specs.length === 0) return null;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="text-xs font-extrabold text-neutral-900 mb-3">Key Specifications</div>
      <div className="grid grid-cols-2 gap-2">
        {specs.map((spec) => (
          <div key={spec.label} className="flex items-center gap-2 rounded-lg bg-neutral-50 px-2.5 py-2">
            {spec.icon && <span className="text-sm">{spec.icon}</span>}
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-neutral-500 truncate">{spec.label}</div>
              <div className="text-xs font-bold text-neutral-900 truncate">{spec.value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// WHY THIS TIRE SECTION
// ============================================================================

function getWhyThisTirePoints(
  category: TreadCategory | null,
  mileageWarranty: string | null,
  construction: string | null,
  isRunFlatTire: boolean,
  has3PMSF: boolean,
  speedRating: string | null,
): string[] {
  const points: string[] = [];
  
  // Category-specific value props
  switch (category) {
    case 'All-Season':
      points.push("Year-round versatility in dry, wet, and light snow conditions");
      points.push("Balanced ride comfort and handling for daily driving");
      break;
    case 'All-Weather':
      points.push("True all-season capability with enhanced winter performance");
      points.push("3-Peak Mountain Snowflake rated for severe snow conditions");
      break;
    case 'All-Terrain':
      points.push("Go anywhere confidence - from highway to trail");
      points.push("Aggressive tread for off-road grip, quiet enough for daily driving");
      break;
    case 'Mud-Terrain':
      points.push("Maximum off-road traction in mud, rock, and loose terrain");
      points.push("Self-cleaning tread design ejects debris for consistent grip");
      break;
    case 'Highway/Touring':
      points.push("Smooth, quiet ride engineered for highway comfort");
      points.push("Low rolling resistance for improved fuel efficiency");
      break;
    case 'Performance':
      points.push("High-speed stability and precise handling response");
      points.push("Enhanced grip in dry and wet conditions for spirited driving");
      break;
    case 'Summer':
      points.push("Maximum dry and wet grip for warm weather performance");
      points.push("Responsive handling and shorter braking distances");
      break;
    case 'Winter':
      points.push("Specialized compound stays flexible in freezing temperatures");
      points.push("Deep sipes and biting edges for ice and snow traction");
      break;
    case 'Rugged-Terrain':
      points.push("Hybrid design balances on-road comfort with off-road capability");
      points.push("Durable sidewalls resist punctures and trail damage");
      break;
    default:
      points.push("Quality tire engineered for reliable performance");
      break;
  }
  
  // Add warranty point if available
  if (mileageWarranty) {
    const miles = parseInt(mileageWarranty, 10);
    if (miles >= 80000) {
      points.push(`Exceptional ${Math.round(miles/1000)}K mile warranty - built to last`);
    } else if (miles >= 60000) {
      points.push(`Long-lasting ${Math.round(miles/1000)}K mile treadwear warranty`);
    } else if (miles >= 40000) {
      points.push(`${Math.round(miles/1000)}K mile warranty for peace of mind`);
    }
  }
  
  // Construction point
  if (construction) {
    points.push(`${construction} construction for durability and stability`);
  }
  
  // Run-flat
  if (isRunFlatTire) {
    points.push("Run-flat technology lets you drive safely to a service location");
  }
  
  // 3PMSF
  if (has3PMSF && category !== 'All-Weather' && category !== 'Winter') {
    points.push("3-Peak Mountain Snowflake rated for severe snow performance");
  }
  
  // High speed rating
  if (speedRating) {
    const highSpeedRatings = ['W', 'Y', 'Z', '(Y)'];
    if (highSpeedRatings.some(r => speedRating.toUpperCase().includes(r))) {
      points.push("High-speed rated for performance driving confidence");
    }
  }
  
  // Always add fitment guarantee
  points.push("Fitment verified and installation scheduling included");
  
  return points.slice(0, 5); // Max 5 points
}

// ============================================================================
// PERFORMANCE SECTION
// ============================================================================

function PerformanceSection({ 
  ratings, 
  category 
}: { 
  ratings: PerformanceRatings | null;
  category: TreadCategory | null;
}) {
  if (!ratings) return null;
  
  // Choose relevant ratings based on category
  let showRatings: ('treadLife' | 'wetTraction' | 'dryTraction' | 'comfort' | 'noise' | 'offRoad' | 'winter')[];
  
  switch (category) {
    case 'All-Terrain':
    case 'Mud-Terrain':
    case 'Rugged-Terrain':
    case 'Off-Road':
      showRatings = ['offRoad', 'treadLife', 'wetTraction', 'comfort'];
      break;
    case 'Winter':
      showRatings = ['winter', 'wetTraction', 'treadLife', 'comfort'];
      break;
    case 'Performance':
    case 'Summer':
      showRatings = ['dryTraction', 'wetTraction', 'comfort', 'noise'];
      break;
    case 'Highway/Touring':
      showRatings = ['comfort', 'noise', 'treadLife', 'wetTraction'];
      break;
    default:
      showRatings = ['treadLife', 'wetTraction', 'comfort', 'winter'];
  }
  
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-extrabold text-neutral-900">Performance Ratings</div>
        <div className="flex items-center gap-1">
          <span className="text-lg font-extrabold text-neutral-900">{ratings.overall}</span>
          <span className="text-[10px] text-neutral-500">/10</span>
        </div>
      </div>
      <PerformanceIndicators 
        ratings={ratings} 
        show={showRatings}
        compact={false}
        showLabels={true}
        showValues={true}
      />
      <p className="mt-3 text-[10px] text-neutral-400">
        Ratings derived from tire specifications and category
      </p>
    </div>
  );
}

// ============================================================================
// BADGE COMPONENT
// ============================================================================

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-extrabold text-neutral-900">
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
  const vehicleLabel = [year, make, model, displayTrim].filter(Boolean).join(" ");
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
          const displayPrice = typeof tire.cost === "number" ? tire.cost : null;
          const rawTitle = tire.displayName || tire.prettyName || tire.description || tire.model || safeSku;
          const title = cleanTireDisplayTitle(rawTitle, tire.brand);
          
          const category = normalizeTreadCategory(tire.badges?.terrain, tire.description);
          const isRunFlatTire = isRunFlat(null, tire.description, null);
          const has3PMSF = /3PMSF|3-PEAK|MOUNTAIN.*SNOWFLAKE/i.test(tire.description || '');
          
          const ratings = derivePerformanceRatings(null, category, has3PMSF);
          const whyPoints = getWhyThisTirePoints(
            category,
            tire.badges?.warrantyMiles ? String(tire.badges.warrantyMiles) : null,
            null,
            isRunFlatTire,
            has3PMSF,
            tire.badges?.speedRating
          );
          
          const badges: string[] = [];
          if (tire.size) badges.push(String(tire.size));
          if (category) badges.push(category);
          if (tire.badges?.warrantyMiles) badges.push(`${tire.badges.warrantyMiles} mi warranty`);
          
          const q = tire.quantity || {};
          const totalQty = (q.primary || 0) + (q.alternate || 0) + (q.national || 0);
          
          return (
            <main className="bg-neutral-50">
              <div className="mx-auto max-w-6xl px-4 py-10">
                <div className="flex items-center justify-between gap-3">
                  <Link href="/tires" className="text-sm font-extrabold text-neutral-900 hover:underline">
                    ← Back to tires
                  </Link>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
                  {/* Left column - Image */}
                  <div className="grid gap-4">
                    <div className="rounded-3xl border border-neutral-200 bg-white p-6">
                      <div className="flex items-center justify-center min-h-[320px]">
                        {tire.imageUrl ? (
                          <img src={tire.imageUrl} alt={title} className="max-h-80 w-auto object-contain" />
                        ) : (
                          <div className="flex h-64 w-64 items-center justify-center rounded-2xl bg-neutral-100">
                            <span className="text-6xl">🛞</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Performance Section */}
                    <PerformanceSection ratings={ratings} category={category} />
                  </div>

                  {/* Right column - Buy box */}
                  <div className="lg:sticky lg:top-6 space-y-4">
                    {/* Vehicle Fitment */}
                    {hasVehicle ? (
                      <div>
                        <RecommendedFitmentCard fitment={{ year, make, model, trim, modification }} />
                        <div className="mt-2">
                          <Link
                            href={`/tires?${new URLSearchParams({ year, make, model, trim, modification }).toString()}`}
                            className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-xs font-extrabold text-neutral-900 hover:border-neutral-300"
                          >
                            Change vehicle
                          </Link>
                        </div>
                      </div>
                    ) : null}

                    {/* Main Buy Box */}
                    <div className="rounded-3xl border border-neutral-200 bg-white p-6">
                      <p className="text-sm font-semibold text-neutral-600">{tire.brand || "Tire"}</p>
                      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">{title}</h1>
                      
                      <div className="mt-3 flex flex-wrap gap-2">
                        {badges.map((b, i) => <Badge key={i}>{b}</Badge>)}
                        {isRunFlatTire && <Badge>🛡️ Run-Flat</Badge>}
                        {has3PMSF && <Badge>❄️ 3PMSF</Badge>}
                      </div>

                      {/* Price */}
                      <div className="mt-5">
                        {displayPrice != null ? (
                          <>
                            <div className="text-3xl font-extrabold text-neutral-900">{fmtMoney(displayPrice)}</div>
                            <div className="text-xs text-neutral-600">
                              per tire • Set of 4: <span className="font-bold">{fmtMoney(displayPrice * 4)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="text-xl font-bold text-neutral-700">Call for pricing</div>
                        )}
                      </div>

                      {/* Stock */}
                      <div className="mt-3 text-sm">
                        {totalQty > 0 ? (
                          <span className="text-green-700">✓ {totalQty} in stock • Ships 1-2 days</span>
                        ) : (
                          <span className="text-amber-700">📦 Available to order • Ships 1-2 weeks</span>
                        )}
                      </div>

                      {/* Trust Strip */}
                      <div className="mt-4">
                        <TrustStrip hasVehicle={hasVehicle} />
                      </div>

                      {/* Add to Cart */}
                      {displayPrice != null && (
                        <div className="mt-5">
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
                    </div>

                    {/* Why This Tire */}
                    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                      <div className="text-xs font-extrabold text-neutral-900">Why This Tire</div>
                      <ul className="mt-2 space-y-1.5">
                        {whyPoints.map((point, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                            <span className="text-green-600 mt-0.5">✓</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Key Specs */}
                    <KeySpecsBox
                      mileageWarranty={tire.badges?.warrantyMiles ? String(tire.badges.warrantyMiles) : null}
                      loadIndex={tire.badges?.loadIndex ? String(tire.badges.loadIndex) : null}
                      speedRating={tire.badges?.speedRating ? String(tire.badges.speedRating) : null}
                      rimDiameter={null}
                      tireDiameter={null}
                      sectionWidth={null}
                      aspectRatio={null}
                      construction={null}
                      isRunFlatTire={isRunFlatTire}
                      has3PMSF={has3PMSF}
                    />

                    <div className="text-xs text-neutral-500">Part / SKU: {safeSku}</div>
                  </div>
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
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Tire not found (SKU: {safeSku}).
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
          limit 8
        `,
        values: [String(t.simple_size || ""), safeSku],
      })
    : { rows: [] as any[] };

  if (!t) {
    return (
      <main className="bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Tire not found (SKU: {safeSku}).
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

  const displayPrice = priceFromRow(t);
  
  // Normalize category and detect features
  const category = normalizeTreadCategory(t.terrain, t.tire_description);
  const isRunFlatTire = isRunFlat(null, t.tire_description, null);
  const has3PMSF = /3PMSF|3-PEAK|MOUNTAIN.*SNOWFLAKE/i.test(t.tire_description || '');
  
  // Derive performance ratings from category (no UTQG yet)
  const ratings = derivePerformanceRatings(null, category, has3PMSF);
  
  // Generate "Why This Tire" points
  const whyPoints = getWhyThisTirePoints(
    category,
    t.mileage_warranty ? String(t.mileage_warranty) : null,
    t.construction_type ? String(t.construction_type) : null,
    isRunFlatTire,
    has3PMSF,
    t.speed_rating ? String(t.speed_rating) : null
  );

  // Enrich with tire asset image if needed
  let enrichedImageUrl: string | null = t.image_url || null;
  if (!enrichedImageUrl) {
    const description = String(t.tire_description || "").trim();
    if (description) {
      try {
        const assetRes = await fetch(`${getBaseUrl()}/api/assets/tire?km=${encodeURIComponent(description)}`, {
          cache: "no-store"
        });
        if (assetRes.ok) {
          const assetData = (await assetRes.json()) as { results?: TireAsset[] };
          const asset = Array.isArray(assetData?.results) ? assetData.results[0] : null;
          if (asset?.image_url) {
            enrichedImageUrl = asset.image_url;
          }
        }
      } catch (err) {
        console.error("[tire-detail] Asset lookup failed:", err);
      }
    }
  }

  const rawTitle = String(t.tire_description || t.tire_size || t.simple_size || t.sku);
  const title = cleanTireDisplayTitle(rawTitle, t.brand_desc);

  const badges: string[] = [];
  if (t.tire_size) badges.push(String(t.tire_size));
  if (category) badges.push(category);
  if (t.mileage_warranty) badges.push(`${t.mileage_warranty} mi warranty`);

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <Link href="/tires" className="text-sm font-extrabold text-neutral-900 hover:underline">
            ← Back to tires
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
          {/* Left column - Image & Performance */}
          <div className="grid gap-4">
            <div className="rounded-3xl border border-neutral-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-neutral-600">Product photo</div>
                <div className="text-[11px] text-neutral-500">Click to zoom</div>
              </div>
              <ImageGallery images={enrichedImageUrl ? [String(enrichedImageUrl)] : []} alt={title} note="Image may vary by size" />
            </div>

            {/* Performance Section - only show if we have meaningful ratings */}
            <PerformanceSection ratings={ratings} category={category} />
          </div>

          {/* Right column - Buy box */}
          <div className="lg:sticky lg:top-6 space-y-4">
            {/* Vehicle Fitment */}
            {hasVehicle ? (
              <div>
                <RecommendedFitmentCard fitment={{ year, make, model, trim, modification }} />
                <div className="mt-2">
                  <Link
                    href={`/tires?${new URLSearchParams({ year, make, model, trim, modification }).toString()}`}
                    className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-xs font-extrabold text-neutral-900 hover:border-neutral-300"
                  >
                    Change vehicle
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-neutral-200 bg-white p-3">
                <div className="text-[11px] font-semibold text-neutral-600">Vehicle</div>
                <div className="mt-0.5 text-sm font-extrabold text-neutral-900">Select vehicle to verify fitment</div>
                <div className="mt-2">
                  <Link
                    href={`/tires?${new URLSearchParams({ year, make, model, trim, modification }).toString()}`}
                    className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-xs font-extrabold text-neutral-900 hover:border-neutral-300"
                  >
                    Select vehicle
                  </Link>
                </div>
              </div>
            )}

            {/* Main Buy Box */}
            <div className="rounded-3xl border border-neutral-200 bg-white p-6">
              <div className="text-sm font-semibold text-neutral-600">{String(t.brand_desc || "Tire")}</div>
              <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">{title}</h1>

              {badges.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {badges.slice(0, 4).map((b) => <Badge key={b}>{b}</Badge>)}
                  {isRunFlatTire && <Badge>🛡️ Run-Flat</Badge>}
                  {has3PMSF && <Badge>❄️ 3PMSF</Badge>}
                </div>
              ) : null}

              {/* Price */}
              <div className="mt-5">
                <div className="text-3xl font-extrabold text-neutral-900">
                  {displayPrice != null ? fmtMoney(displayPrice) : "Call for price"}
                </div>
                {displayPrice != null && (
                  <div className="text-xs text-neutral-600">
                    per tire • Set of 4: <span className="font-bold">{fmtMoney(displayPrice * 4)}</span>
                  </div>
                )}
              </div>

              {/* Stock */}
              <div className="mt-3 text-sm">
                {Number(t.qoh) >= 4 ? (
                  <span className="text-green-700">✓ {t.qoh} in stock • Ships 1-2 days</span>
                ) : Number(t.qoh) > 0 ? (
                  <span className="text-amber-700">⚠️ Only {t.qoh} left • Ships 1-2 days</span>
                ) : (
                  <span className="text-amber-700">📦 Available to order • Ships 1-2 weeks</span>
                )}
              </div>

              {/* Trust Strip */}
              <div className="mt-4">
                <TrustStrip hasVehicle={hasVehicle} />
              </div>

              {/* Add to Cart */}
              <div id="add-to-cart" className="mt-5">
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
            </div>

            {/* Why This Tire */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-xs font-extrabold text-neutral-900">Why This Tire</div>
              <ul className="mt-2 space-y-1.5">
                {whyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Key Specs */}
            <KeySpecsBox
              mileageWarranty={t.mileage_warranty ? String(t.mileage_warranty) : null}
              loadIndex={t.load_index ? String(t.load_index) : null}
              speedRating={t.speed_rating ? String(t.speed_rating) : null}
              rimDiameter={n(t.rim_diameter_in)}
              tireDiameter={n(t.tire_diameter_in)}
              sectionWidth={n(t.section_width)}
              aspectRatio={n(t.series)}
              construction={t.construction_type ? String(t.construction_type) : null}
              isRunFlatTire={isRunFlatTire}
              has3PMSF={has3PMSF}
            />

            <div className="text-xs text-neutral-500">Part / SKU: {safeSku}</div>
          </div>
        </div>

        {/* Related Tires */}
        {related.rows?.length ? (
          <section className="mt-10">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-lg font-extrabold text-neutral-900">More options in this size</h2>
              <Link href="/tires" className="text-xs font-extrabold text-neutral-900 hover:underline">
                Browse all tires
              </Link>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.rows.slice(0, 8).map((r: any) => {
                const rp = priceFromRow(r);
                const name = String(r.tire_description || r.tire_size || r.simple_size || r.sku);
                return (
                  <Link
                    key={r.sku}
                    href={`/tires/${encodeURIComponent(String(r.sku))}`}
                    className="group rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-300"
                  >
                    <div className="text-[11px] font-semibold text-neutral-600">{String(r.brand_desc || "Tire")}</div>
                    <div className="mt-1 line-clamp-2 text-sm font-extrabold text-neutral-900 group-hover:underline">
                      {name}
                    </div>

                    <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
                      {r.image_url ? (
                        <img
                          src={String(r.image_url)}
                          alt={name}
                          className="h-28 w-full bg-white object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div className="p-3 text-xs text-neutral-700">Image coming soon</div>
                      )}
                    </div>

                    <div className="mt-3 text-lg font-extrabold text-neutral-900">
                      {rp != null ? fmtMoney(rp) : "Call for price"}
                    </div>
                    <div className="text-[11px] text-neutral-600">each</div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Mobile sticky CTA */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-1">
            <div>
              <div className="text-sm font-extrabold text-neutral-900">{displayPrice != null ? fmtMoney(displayPrice) : "Call for price"}</div>
              <div className="text-[11px] text-neutral-600">Per tire • Set of 4</div>
            </div>
            <a
              href="#add-to-cart"
              className="h-10 rounded-xl bg-[var(--brand-red)] px-4 py-2 text-center text-sm font-extrabold text-white"
            >
              Add to Cart
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
