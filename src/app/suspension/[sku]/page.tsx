import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { SuspensionAddToCart } from "./SuspensionAddToCart";

// ============================================================================
// Types
// ============================================================================

interface SuspensionProduct {
  sku: string;
  productDesc: string;
  brand: string;
  productType: string | null;
  liftHeight: number | null;
  liftLevel: string | null;
  make: string;
  model: string;
  yearStart: number;
  yearEnd: number;
  msrp: number | null;
  mapPrice: number | null;
  imageUrl: string | null;
  inStock: boolean;
  inventory: number;
}

// ============================================================================
// Data Fetching
// ============================================================================

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function fetchSuspensionBySku(sku: string): Promise<SuspensionProduct | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/suspension/${encodeURIComponent(sku)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.product || null;
  } catch {
    return null;
  }
}

// ============================================================================
// Metadata
// ============================================================================

type PageProps = {
  params: Promise<{ sku: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sku } = await params;
  const product = await fetchSuspensionBySku(sku);
  
  if (!product) {
    return { title: "Product Not Found" };
  }

  const title = `${product.productDesc} | ${BRAND.name}`;
  const description = `${product.brand} ${product.productDesc}. ${product.liftHeight ? `${product.liftHeight}" lift` : "Suspension upgrade"} for ${product.yearStart}-${product.yearEnd} ${product.make} ${product.model}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: product.imageUrl ? [product.imageUrl] : undefined,
    },
  };
}

// ============================================================================
// Page Component
// ============================================================================

export default async function SuspensionPDPPage({ params, searchParams }: PageProps) {
  const { sku } = await params;
  const sp = await searchParams;
  
  const product = await fetchSuspensionBySku(sku);
  
  if (!product) {
    notFound();
  }

  const price = product.msrp || product.mapPrice;
  const yearRange = product.yearStart === product.yearEnd
    ? String(product.yearStart)
    : `${product.yearStart}-${product.yearEnd}`;

  // Vehicle context from URL params
  const vehicleContext = sp.year && sp.make && sp.model
    ? { year: String(sp.year), make: String(sp.make), model: String(sp.model) }
    : null;

  return (
    <main className="bg-neutral-50 min-h-screen">
      {/* Breadcrumbs */}
      <nav className="mx-auto max-w-6xl px-4 py-4">
        <ol className="flex items-center gap-2 text-sm text-neutral-500">
          <li>
            <Link href="/" className="hover:text-neutral-900">Home</Link>
          </li>
          <li>/</li>
          <li>
            <Link href="/suspension" className="hover:text-neutral-900">Lift Kits</Link>
          </li>
          <li>/</li>
          <li className="text-neutral-900 font-medium truncate max-w-[200px]">{product.brand}</li>
        </ol>
      </nav>

      <div className="mx-auto max-w-6xl px-4 pb-12">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left: Image */}
          <div className="space-y-4">
            <div className="aspect-square rounded-2xl border border-neutral-200 bg-white overflow-hidden">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.productDesc}
                  className="w-full h-full object-contain p-8"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-300">
                  <span className="text-8xl">🔧</span>
                </div>
              )}
            </div>
            
            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
                <div className="text-lg">🚚</div>
                <div className="text-xs font-semibold text-neutral-700">Free Shipping</div>
                <div className="text-xs text-neutral-500">Over $1,500</div>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
                <div className="text-lg">✅</div>
                <div className="text-xs font-semibold text-neutral-700">Guaranteed Fit</div>
                <div className="text-xs text-neutral-500">For your vehicle</div>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
                <div className="text-lg">🔧</div>
                <div className="text-xs font-semibold text-neutral-700">Install Available</div>
                <div className="text-xs text-neutral-500">Pontiac & Waterford</div>
              </div>
            </div>
          </div>

          {/* Right: Details */}
          <div className="space-y-6">
            {/* Brand */}
            <div className="text-sm font-semibold text-purple-600">{product.brand}</div>
            
            {/* Title */}
            <h1 className="text-2xl font-extrabold text-neutral-900 md:text-3xl">
              {product.productDesc}
            </h1>

            {/* SKU */}
            <div className="text-sm text-neutral-500">SKU: {product.sku}</div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {product.liftHeight && (
                <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700">
                  {product.liftHeight}" Lift
                </span>
              )}
              {product.liftLevel && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
                  {product.liftLevel === "leveled" ? "Leveling Kit" : `${product.liftLevel.replace("in", '"')} Lift`}
                </span>
              )}
              {product.inStock ? (
                <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                  ✓ In Stock
                </span>
              ) : (
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm font-semibold text-neutral-600">
                  Ships in 3-5 days
                </span>
              )}
            </div>

            {/* Vehicle Fitment */}
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="text-xs font-semibold text-neutral-500 mb-1">FITS</div>
              <div className="text-lg font-bold text-neutral-900">
                {yearRange} {product.make} {product.model}
              </div>
            </div>

            {/* Generated Description */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="text-lg font-extrabold text-neutral-900 mb-3">Description</h2>
              <div className="space-y-3 text-sm text-neutral-700 leading-relaxed">
                <p>
                  Upgrade your {yearRange} {product.make} {product.model} with this {product.brand} 
                  {product.liftHeight ? ` ${product.liftHeight}" lift kit` : ' suspension system'}. 
                  {product.productType?.toLowerCase().includes('level') 
                    ? ' This leveling kit raises the front of your truck to match the rear, giving you a more aggressive stance and allowing for larger tire fitment.'
                    : product.liftHeight && product.liftHeight >= 6
                      ? ' This complete lift system provides maximum ground clearance for serious off-road capability while maintaining a smooth on-road ride quality.'
                      : product.liftHeight && product.liftHeight >= 4
                        ? ' This lift system offers the perfect balance of increased ground clearance for off-road adventures while keeping a comfortable daily driving experience.'
                        : ' Engineered for a precise fit and optimal performance.'}
                </p>
                {product.brand && (
                  <p>
                    <strong>{product.brand}</strong> is known for quality suspension components 
                    that are designed to OEM specifications for bolt-on installation. Each kit is 
                    engineered specifically for your vehicle's suspension geometry.
                  </p>
                )}
                <p className="text-neutral-600">
                  {product.liftHeight && product.liftHeight >= 4 
                    ? 'After installation, you\'ll have room for larger tires to complete the look and improve off-road traction. '
                    : ''}
                  Professional installation is recommended to ensure proper alignment and ride quality.
                </p>
              </div>
            </div>

            {/* Price & Add to Cart */}
            <div className="rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white p-6">
              {price ? (
                <>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-extrabold text-neutral-900">
                      ${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {product.msrp && product.mapPrice && product.msrp > product.mapPrice && (
                      <span className="text-lg text-neutral-400 line-through">
                        ${product.msrp.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                  
                  <SuspensionAddToCart product={product} vehicleContext={vehicleContext} />
                </>
              ) : (
                <div>
                  <div className="text-lg font-semibold text-neutral-700">Call for Pricing</div>
                  <a
                    href="tel:+12483324120"
                    className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-lg font-extrabold text-white hover:bg-amber-600 transition-colors"
                  >
                    <span>📞</span>
                    <span>Call 248-332-4120</span>
                  </a>
                </div>
              )}
            </div>

            {/* Key Features */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="text-lg font-extrabold text-neutral-900 mb-3">Key Features</h2>
              <ul className="space-y-2 text-sm text-neutral-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Direct bolt-on installation — no permanent modifications required</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Engineered specifically for {product.yearStart === product.yearEnd ? product.yearStart : `${product.yearStart}-${product.yearEnd}`} {product.make} {product.model}</span>
                </li>
                {product.liftHeight && product.liftHeight >= 2 && (
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Allows fitment of larger tires for improved ground clearance</span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Maintains factory ride quality and handling characteristics</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Compatible with factory wheels and aftermarket upgrades</span>
                </li>
                {product.brand?.toLowerCase().includes('readylift') && (
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>ReadyLift limited lifetime warranty included</span>
                  </li>
                )}
              </ul>
            </div>

            {/* Specs */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="text-lg font-extrabold text-neutral-900 mb-4">Specifications</h2>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-semibold text-neutral-500">Brand</dt>
                  <dd className="text-sm font-bold text-neutral-900">{product.brand}</dd>
                </div>
                {product.liftHeight && (
                  <div>
                    <dt className="text-xs font-semibold text-neutral-500">Lift Height</dt>
                    <dd className="text-sm font-bold text-neutral-900">{product.liftHeight}"</dd>
                  </div>
                )}
                {product.productType && (
                  <div>
                    <dt className="text-xs font-semibold text-neutral-500">Type</dt>
                    <dd className="text-sm font-bold text-neutral-900">{product.productType}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-semibold text-neutral-500">Fits</dt>
                  <dd className="text-sm font-bold text-neutral-900">{yearRange} {product.make} {product.model}</dd>
                </div>
              </dl>
            </div>

            {/* Tire Fitment Guide */}
            {product.liftHeight && product.liftHeight >= 2 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                <h2 className="text-lg font-extrabold text-neutral-900 mb-2">🛞 Recommended Tire Sizes</h2>
                <p className="text-sm text-neutral-700 mb-3">
                  With a {product.liftHeight}" lift, your {product.make} {product.model} can typically accommodate:
                </p>
                <ul className="text-sm text-neutral-700 space-y-1">
                  {product.liftHeight <= 2.5 && (
                    <>
                      <li>• 33" tires (275/70R18 or 285/65R18)</li>
                      <li>• 20" wheels with aggressive +18 to 0 offset</li>
                    </>
                  )}
                  {product.liftHeight > 2.5 && product.liftHeight <= 4.5 && (
                    <>
                      <li>• 33-35" tires (35x12.50R20 or 305/55R20)</li>
                      <li>• 20" wheels with -12 to -24 offset</li>
                    </>
                  )}
                  {product.liftHeight > 4.5 && product.liftHeight <= 7 && (
                    <>
                      <li>• 35-37" tires (37x12.50R20 or 35x12.50R22)</li>
                      <li>• 20-22" wheels with -18 to -44 offset</li>
                    </>
                  )}
                  {product.liftHeight > 7 && (
                    <>
                      <li>• 37-40" tires (37x13.50R20 or larger)</li>
                      <li>• 20-24" wheels with aggressive offset</li>
                    </>
                  )}
                </ul>
                <p className="text-xs text-neutral-500 mt-2">
                  *Actual fitment depends on wheel offset and may require trimming. Contact us for personalized recommendations.
                </p>
              </div>
            )}

            {/* Professional Installation */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="text-lg font-extrabold text-neutral-900 mb-2">🔧 Professional Installation Available</h2>
              <p className="text-sm text-neutral-700">
                Lift kit installation requires specialized tools, alignment equipment, and expertise. 
                Our certified technicians at Pontiac and Waterford can install your lift kit and 
                ensure proper alignment for the best ride quality.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <a
                  href="tel:+12483324120"
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 transition-colors"
                >
                  <span>📞</span>
                  <span>Call 248-332-4120</span>
                </a>
                <span className="inline-flex items-center text-sm text-neutral-600">
                  or visit us in Pontiac or Waterford
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Continue Shopping */}
        <div className="mt-12 text-center">
          <Link
            href="/suspension"
            className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-neutral-900"
          >
            <span>←</span>
            <span>Back to Lift Kits</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
