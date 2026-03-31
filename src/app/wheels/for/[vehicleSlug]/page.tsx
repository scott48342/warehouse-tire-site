/**
 * SEO Landing Page: Wheels by Vehicle
 * 
 * Route: /wheels/for/[vehicleSlug]
 * Example: /wheels/for/2024-ford-f-150
 * 
 * Features:
 * - Real product counts from database
 * - Data-driven content (popular sizes, brands)
 * - 400+ prerendered vehicles
 * - noindex for vehicles without inventory
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
  getPopularBrands,
  formatCount,
} from "@/lib/seo/counts";
import { getFitmentFacts } from "@/lib/seo/fitment";
import { VehicleTrimSelector } from "@/components/VehicleTrimSelector";
import { RecommendedPackages } from "@/components/packages/RecommendedPackages";

const BASE_URL = "https://shop.warehousetiredirect.com";

export const revalidate = 86400; // Daily ISR

// Pre-build top vehicles
export async function generateStaticParams() {
  const vehicles = await getTopVehiclesForSEO(400);
  return vehicles.map((v) => ({
    vehicleSlug: slugifyVehicle({ year: String(v.year), make: v.make, model: v.model }),
  }));
}

// Metadata
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
  const canonicalUrl = `${BASE_URL}/wheels/for/${vehicleSlug}`;
  
  // Get counts for metadata
  const counts = await getAllCountsByFitment(
    Number(vehicle.year),
    vehicle.make,
    vehicle.model
  );
  
  const hasResults = counts.hasFitment && counts.wheels > 0;
  
  const ogImageUrl = `/api/og?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&type=wheels`;
  
  return {
    title: hasResults
      ? `${vehicleName} Wheels - ${formatCount(counts.wheels)} Options | Warehouse Tire Direct`
      : `${vehicleName} Wheels | Warehouse Tire Direct`,
    description: hasResults
      ? `Shop ${formatCount(counts.wheels)} wheels that fit your ${vehicleName}. Browse custom and OEM-style options with verified fitment. Professional installation in Southeast Michigan.`
      : `Find wheels for your ${vehicleName}. Contact us for fitment verification and professional installation.`,
    alternates: { canonical: canonicalUrl },
    robots: hasResults ? undefined : { index: false, follow: true },
    openGraph: {
      title: `Wheels for ${vehicleName}`,
      description: `Find the perfect wheels for your ${vehicleName}. Fitment-verified options.`,
      url: canonicalUrl,
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Wheels for ${vehicleName}`,
      images: [ogImageUrl],
    },
  };
}

export default async function WheelsForVehiclePage({
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
  
  // Fetch all data in parallel
  const [counts, popularSizes, popularBrands, fitment, relatedVehicles] = await Promise.all([
    getAllCountsByFitment(year, make, model),
    getPopularWheelSizes(year, make, model),
    getPopularBrands(year, make, model),
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
  
  const hasResults = counts.hasFitment && counts.wheels > 0;
  const browseUrl = `/wheels?year=${year}&make=${make}&model=${model}`;
  
  // Structured data
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${vehicleName} Wheels`,
    description: `Browse wheels for the ${vehicleName}`,
    url: `${BASE_URL}/wheels/for/${vehicleSlug}`,
    numberOfItems: counts.wheels,
    provider: {
      "@type": "LocalBusiness",
      name: "Warehouse Tire Direct",
      telephone: "+1-248-332-4120",
    },
  };
  
  return (
    <>
      <Script
        id="structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-neutral-500">
          <Link href="/" className="hover:text-neutral-700">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/wheels" className="hover:text-neutral-700">Wheels</Link>
          <span className="mx-2">/</span>
          <span className="text-neutral-900">{vehicleName}</span>
        </nav>
        
        {/* H1 with Count Badge */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-neutral-900 sm:text-4xl">
            {vehicleName} Wheels
          </h1>
          {hasResults && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
              ✓ {formatCount(counts.wheels)} wheels available
            </span>
          )}
        </div>
        
        {/* Intro */}
        <p className="mb-8 max-w-3xl text-lg text-neutral-600">
          {hasResults
            ? `Shop ${formatCount(counts.wheels)} wheels that fit your ${vehicleName}. ${fitment?.boltPattern ? `Your vehicle uses a ${fitment.boltPattern} bolt pattern.` : ""} Browse aftermarket and OEM-style options with guaranteed fitment.`
            : `Looking for wheels for your ${vehicleName}? Contact our team at (248) 332-4120 for fitment verification.`}
        </p>
        
        {/* Recommended Packages - Package-first experience */}
        {hasResults && (
          <div className="mb-8">
            <RecommendedPackages
              year={year}
              make={make}
              model={model}
              maxPackages={4}
              showTitle={true}
            />
          </div>
        )}
        
        {/* Cross-links */}
        <div className="mb-8 flex flex-wrap gap-4">
          {counts.tires > 0 && (
            <Link
              href={`/tires/for/${vehicleSlug}`}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300"
            >
              🔘 {formatCount(counts.tires)} Tires
            </Link>
          )}
          {counts.packages > 0 && (
            <Link
              href={`/packages/for/${vehicleSlug}`}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300"
            >
              📦 {formatCount(counts.packages)} Packages
            </Link>
          )}
        </div>
        
        {/* Fitment Facts */}
        {fitment?.boltPattern && (
          <div className="mb-8 rounded-lg border border-neutral-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-neutral-900">
              {vehicleName} Wheel Specifications
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <div className="text-sm text-neutral-500">Bolt Pattern</div>
                <div className="font-medium text-neutral-900">{fitment.boltPattern}</div>
              </div>
              {fitment.centerBoreMm && (
                <div>
                  <div className="text-sm text-neutral-500">Hub Bore</div>
                  <div className="font-medium text-neutral-900">{fitment.centerBoreMm}mm</div>
                </div>
              )}
              {fitment.threadSize && (
                <div>
                  <div className="text-sm text-neutral-500">Lug Thread</div>
                  <div className="font-medium text-neutral-900">{fitment.threadSize}</div>
                </div>
              )}
              {fitment.oemWheelDiameters.length > 0 && (
                <div>
                  <div className="text-sm text-neutral-500">OEM Sizes</div>
                  <div className="font-medium text-neutral-900">
                    {fitment.oemWheelDiameters.join(", ")}&quot;
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Popular Sizes */}
        {popularSizes.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-neutral-900">
              Popular Wheel Sizes for {vehicleName}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {popularSizes.map(({ diameter, count }) => (
                <Link
                  key={diameter}
                  href={`${browseUrl}&diameter=${diameter}`}
                  className="group rounded-lg border border-neutral-200 bg-white p-4 text-center transition hover:border-red-200 hover:shadow-sm"
                >
                  <div className="text-2xl font-bold text-neutral-900">{diameter}&quot;</div>
                  <div className="text-sm text-neutral-500">{count} options</div>
                </Link>
              ))}
            </div>
          </div>
        )}
        
        {/* Popular Brands */}
        {popularBrands.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-neutral-900">
              Top Wheel Brands
            </h2>
            <div className="flex flex-wrap gap-2">
              {popularBrands.slice(0, 8).map(({ brand }) => (
                <Link
                  key={brand}
                  href={`${browseUrl}&brand_cd=${encodeURIComponent(brand)}`}
                  className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-red-200"
                >
                  {brand}
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
              Browse {formatCount(counts.wheels)} Wheels
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        ) : (
          <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-6">
            <h2 className="mb-2 font-semibold text-amber-900">Fitment Data Coming Soon</h2>
            <p className="text-amber-700">
              We&apos;re still building our database for this vehicle.
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
            productType="wheels"
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
                  href={`/wheels/for/${slugifyVehicle(rv)}`}
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
            Need Help Finding the Right Wheels?
          </h2>
          <p className="mb-6 text-neutral-300">
            Our experts are ready to help you find the perfect fit for your {vehicle.make}.
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
