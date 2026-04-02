/**
 * SEO Landing Page: Packages by Vehicle
 * 
 * Route: /packages/for/[vehicleSlug]
 * Example: /packages/for/2024-ford-f-150
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import {
  getVehicleBySlug,
  formatVehicleName,
  getRelatedVehicles,
  slugifyVehicle,
} from "@/lib/seo";
import { getTopVehiclesForSEO } from "@/lib/seo/staticParams";
import {
  getAllCountsByFitment,
  getPopularWheelSizes,
  formatCount,
} from "@/lib/seo/counts";
import { getFitmentFacts } from "@/lib/seo/fitment";
import { VehicleTrimSelector } from "@/components/VehicleTrimSelector";
import { RecommendedPackages } from "@/components/packages/RecommendedPackages";

const BASE_URL = "https://shop.warehousetiredirect.com";

export const revalidate = 86400;

// Force dynamic rendering to avoid build-time DB access
// Pages will be generated on first request and cached via ISR
export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  // Skip static generation during Vercel build - rely on ISR instead
  if (process.env.VERCEL_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build') {
    console.log("[packages/for] Build time - skipping static params generation");
    return [];
  }
  
  try {
    const vehicles = await getTopVehiclesForSEO(400);
    return vehicles.map((v) => ({
      vehicleSlug: slugifyVehicle({ year: String(v.year), make: v.make, model: v.model }),
    }));
  } catch (err) {
    console.error("[packages/for] Error generating static params:", err);
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ vehicleSlug: string }>;
}): Promise<Metadata> {
  const { vehicleSlug } = await params;
  const vehicle = await getVehicleBySlug(vehicleSlug);
  
  if (!vehicle) {
    return { title: "Not Found", robots: { index: false, follow: false } };
  }
  
  const vehicleName = formatVehicleName(vehicle);
  const canonicalUrl = `${BASE_URL}/packages/for/${vehicleSlug}`;
  
  const counts = await getAllCountsByFitment(
    Number(vehicle.year),
    vehicle.make,
    vehicle.model
  );
  
  const hasResults = counts.hasFitment && counts.packages > 0;
  const ogImageUrl = `/api/og?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&type=packages`;
  
  return {
    title: hasResults
      ? `${vehicleName} Wheel & Tire Packages | Warehouse Tire Direct`
      : `${vehicleName} Packages | Warehouse Tire Direct`,
    description: `Complete wheel and tire packages for your ${vehicleName}. Mounted, balanced, and ready to install. Save time and money with our package deals.`,
    alternates: { canonical: canonicalUrl },
    robots: hasResults ? undefined : { index: false, follow: true },
    openGraph: {
      title: `Wheel & Tire Packages for ${vehicleName}`,
      description: `Save on wheel and tire packages for your ${vehicleName}. Mounted, balanced, and ready to install.`,
      url: canonicalUrl,
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
  };
}

export default async function PackagesForVehiclePage({
  params,
}: {
  params: Promise<{ vehicleSlug: string }>;
}) {
  const { vehicleSlug } = await params;
  const vehicle = await getVehicleBySlug(vehicleSlug);
  
  if (!vehicle) {
    notFound();
  }
  
  const vehicleName = formatVehicleName(vehicle);
  const year = Number(vehicle.year);
  const make = vehicle.make;
  const model = vehicle.model;
  
  const [counts, popularSizes, fitment, relatedVehicles] = await Promise.all([
    getAllCountsByFitment(year, make, model),
    getPopularWheelSizes(year, make, model),
    getFitmentFacts({
      year,
      make,
      model,
      trim: null,
      displayMake: make,
      displayModel: model,
      displayTrim: null,
    }),
    getRelatedVehicles(vehicle.year, vehicle.make, vehicle.model),
  ]);
  
  const hasResults = counts.hasFitment && counts.packages > 0;
  const browseUrl = `/package?year=${year}&make=${make}&model=${model}`;
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${vehicleName} Wheel & Tire Packages`,
    url: `${BASE_URL}/packages/for/${vehicleSlug}`,
    numberOfItems: counts.packages,
  };
  
  return (
    <>
      <Script
        id="structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-6 text-sm text-neutral-500">
          <Link href="/" className="hover:text-neutral-700">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/package" className="hover:text-neutral-700">Packages</Link>
          <span className="mx-2">/</span>
          <span className="text-neutral-900">{vehicleName}</span>
        </nav>
        
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-neutral-900 sm:text-4xl">
            {vehicleName} Wheel & Tire Packages
          </h1>
          {hasResults && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
              ✓ {formatCount(counts.packages)} packages available
            </span>
          )}
        </div>
        
        <p className="mb-8 max-w-3xl text-lg text-neutral-600">
          Save time and money with our wheel and tire packages for the {vehicleName}. 
          All packages are mounted, balanced, and include TPMS sensors. 
          Professional installation available at our Rochester Hills location.
        </p>
        
        {/* Cross-links */}
        <div className="mb-8 flex flex-wrap gap-4">
          {counts.wheels > 0 && (
            <Link
              href={`/wheels/for/${vehicleSlug}`}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300"
            >
              🛞 {formatCount(counts.wheels)} Wheels
            </Link>
          )}
          {counts.tires > 0 && (
            <Link
              href={`/tires/for/${vehicleSlug}`}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300"
            >
              🔘 {formatCount(counts.tires)} Tires
            </Link>
          )}
        </div>
        
        {/* Recommended Packages - Main attraction for this page */}
        <div className="mb-8">
          <RecommendedPackages
            year={year}
            make={make}
            model={model}
            maxPackages={6}
            showTitle={false}
          />
        </div>
        
        {/* Package Benefits */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-2 text-2xl">🔧</div>
            <h3 className="font-semibold text-neutral-900">Mounted & Balanced</h3>
            <p className="text-sm text-neutral-600">
              Wheels and tires professionally assembled and ready to install
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-2 text-2xl">📡</div>
            <h3 className="font-semibold text-neutral-900">TPMS Included</h3>
            <p className="text-sm text-neutral-600">
              Tire pressure monitoring sensors included and programmed
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-2 text-2xl">✓</div>
            <h3 className="font-semibold text-neutral-900">Verified Fitment</h3>
            <p className="text-sm text-neutral-600">
              Every package verified to fit your {vehicle.make} {vehicle.model}
            </p>
          </div>
        </div>
        
        {/* Popular Sizes */}
        {popularSizes.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-neutral-900">
              Available Package Sizes
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {popularSizes.map(({ diameter, count }) => (
                <Link
                  key={diameter}
                  href={`/wheels?year=${year}&make=${make}&model=${model}&diameter=${diameter}&package=1`}
                  className="group rounded-lg border border-neutral-200 bg-white p-4 text-center transition hover:border-red-200"
                >
                  <div className="text-2xl font-bold text-neutral-900">{diameter}&quot;</div>
                  <div className="text-sm text-neutral-500">{count} wheel options</div>
                </Link>
              ))}
            </div>
          </div>
        )}
        
        {/* CTA */}
        {hasResults ? (
          <div className="mb-8">
            <Link
              href={browseUrl}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-red-700"
            >
              Build Your Package
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        ) : (
          <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-6">
            <p className="text-amber-700">
              We&apos;re still building packages for this vehicle.
              <Link href="/schedule" className="ml-1 font-medium underline">Contact us</Link> for a custom quote.
            </p>
          </div>
        )}
        
        {/* Trim Selector */}
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">
            Select Your Trim for Best Results
          </h2>
          <VehicleTrimSelector
            year={String(vehicle.year)}
            make={vehicle.make}
            model={vehicle.model}
            productType="packages"
          />
        </div>
        
        {/* Related Vehicles */}
        {relatedVehicles.length > 0 && (
          <div className="mb-8 border-t border-neutral-200 pt-8">
            <h2 className="mb-4 text-xl font-semibold text-neutral-900">Related Vehicles</h2>
            <div className="flex flex-wrap gap-3">
              {relatedVehicles.map((rv) => (
                <Link
                  key={slugifyVehicle(rv)}
                  href={`/packages/for/${slugifyVehicle(rv)}`}
                  className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-red-200"
                >
                  {rv.year} {rv.make} {rv.model}
                </Link>
              ))}
            </div>
          </div>
        )}
        
        {/* Bottom CTA */}
        <div className="mt-12 rounded-lg bg-neutral-900 p-8 text-center">
          <h2 className="mb-3 text-2xl font-bold text-white">
            Need Help Building Your Package?
          </h2>
          <p className="mb-6 text-neutral-300">
            Our experts can help you find the perfect wheel and tire combination.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="tel:+12483324120"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-neutral-900"
            >
              📞 (248) 332-4120
            </Link>
            <Link
              href="/schedule"
              className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-white px-6 py-3 font-semibold text-white"
            >
              Schedule Appointment
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
