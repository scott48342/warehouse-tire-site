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

            {/* What's Included - placeholder for future enhancement */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="text-lg font-extrabold text-neutral-900 mb-2">💡 Professional Installation Recommended</h2>
              <p className="text-sm text-neutral-700">
                Lift kit installation requires specialized tools and expertise. We offer professional 
                installation at our Pontiac and Waterford locations.
              </p>
              <a
                href="tel:+12483324120"
                className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-amber-700 hover:underline"
              >
                <span>📞</span>
                <span>Call to schedule: 248-332-4120</span>
              </a>
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
