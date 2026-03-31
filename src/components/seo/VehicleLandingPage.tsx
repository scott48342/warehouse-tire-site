/**
 * Vehicle Landing Page Component
 * 
 * Shared component for wheels/tires/packages SEO pages
 * Now with real product counts and data-driven content
 */

import Link from "next/link";
import type { ProductType, ResolvedVehicle, FitmentFacts } from "@/lib/seo/types";
import {
  buildH1,
  buildIntroParagraph,
  buildFitmentFactItems,
  buildRelatedLinks,
  buildFAQItems,
  buildFAQJsonLd,
  buildProductListJsonLd,
  buildCanonicalUrl,
  formatCount,
} from "@/lib/seo";
import { FitmentFactsCard } from "./FitmentFactsCard";
import { RelatedLinks } from "./RelatedLinks";
import { FAQSection } from "./FAQSection";
import { ProductCountBadge } from "./ProductCountBadge";
import { PopularSizesSection } from "./PopularSizesSection";

interface Props {
  productType: ProductType;
  vehicle: ResolvedVehicle;
  fitment: FitmentFacts | null;
  counts: {
    wheels: number;
    tires: number;
    packages: number;
    hasFitment: boolean;
  };
  popularWheelSizes?: { diameter: number; count: number }[];
  popularBrands?: { brand: string; count: number }[];
}

const productLabels: Record<ProductType, { singular: string; plural: string; action: string }> = {
  wheels: { singular: "Wheel", plural: "Wheels", action: "Browse" },
  tires: { singular: "Tire", plural: "Tires", action: "Shop" },
  packages: { singular: "Package", plural: "Wheel & Tire Packages", action: "View" },
};

const browseUrls: Record<ProductType, string> = {
  wheels: "/wheels",
  tires: "/tires",
  packages: "/package",
};

export function VehicleLandingPage({ 
  productType, 
  vehicle, 
  fitment, 
  counts,
  popularWheelSizes = [],
  popularBrands = [],
}: Props) {
  const labels = productLabels[productType];
  const hasResults = counts.hasFitment && getCountForType(counts, productType) > 0;
  const resultCount = getCountForType(counts, productType);
  
  // Build content
  const h1 = buildH1(productType, vehicle);
  const intro = buildIntroParagraph(productType, vehicle, fitment, resultCount);
  const fitmentItems = buildFitmentFactItems(fitment);
  const relatedLinks = buildRelatedLinks(productType, vehicle);
  const faqs = buildFAQItems(productType, vehicle, fitment);
  
  // Build JSON-LD
  const canonical = buildCanonicalUrl(productType, vehicle.year, vehicle.make, vehicle.model, vehicle.trim);
  const productListJsonLd = buildProductListJsonLd({
    vehicle,
    fitment,
    productType,
    hasResults,
    resultCount,
    canonical,
  });
  const faqJsonLd = faqs.length > 0 ? buildFAQJsonLd(faqs) : null;
  
  // Build browse URL
  const browseUrl = `${browseUrls[productType]}?year=${vehicle.year}&make=${vehicle.make}&model=${vehicle.model}${vehicle.trim ? `&trim=${vehicle.trim}` : ""}`;
  
  // Build SEO URL for internal linking
  const seoBaseUrl = `/${productType}/${vehicle.year}/${encodeURIComponent(vehicle.make)}/${encodeURIComponent(vehicle.model)}`;
  
  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productListJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-neutral-500">
          <Link href="/" className="hover:text-neutral-700">Home</Link>
          <span className="mx-2">/</span>
          <Link href={browseUrls[productType]} className="hover:text-neutral-700 capitalize">
            {labels.plural}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-neutral-900">
            {vehicle.year} {vehicle.displayMake} {vehicle.displayModel}
          </span>
        </nav>
        
        {/* H1 with Count Badge */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-neutral-900 sm:text-4xl">
            {h1}
          </h1>
          {hasResults && (
            <ProductCountBadge 
              count={resultCount} 
              productType={productType}
            />
          )}
        </div>
        
        {/* Intro */}
        <p className="mb-8 max-w-3xl text-lg text-neutral-600">
          {intro}
        </p>
        
        {/* Cross-linking to other product types */}
        {counts.hasFitment && (
          <div className="mb-8 flex flex-wrap gap-4">
            {productType !== "wheels" && counts.wheels > 0 && (
              <Link
                href={`/wheels/${vehicle.year}/${encodeURIComponent(vehicle.make)}/${encodeURIComponent(vehicle.model)}`}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                <span>🛞</span>
                <span>{formatCount(counts.wheels)} Wheels</span>
              </Link>
            )}
            {productType !== "tires" && counts.tires > 0 && (
              <Link
                href={`/tires/${vehicle.year}/${encodeURIComponent(vehicle.make)}/${encodeURIComponent(vehicle.model)}`}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                <span>🔘</span>
                <span>{formatCount(counts.tires)} Tires</span>
              </Link>
            )}
            {productType !== "packages" && counts.packages > 0 && (
              <Link
                href={`/packages/${vehicle.year}/${encodeURIComponent(vehicle.make)}/${encodeURIComponent(vehicle.model)}`}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                <span>📦</span>
                <span>{formatCount(counts.packages)} Packages</span>
              </Link>
            )}
          </div>
        )}
        
        {/* Fitment Facts */}
        {fitmentItems.length > 0 && (
          <div className="mb-8">
            <FitmentFactsCard items={fitmentItems} />
          </div>
        )}
        
        {/* Popular Sizes Section (data-driven) */}
        {productType === "wheels" && popularWheelSizes.length > 0 && (
          <PopularSizesSection 
            title={`Popular Wheel Sizes for ${vehicle.year} ${vehicle.displayMake} ${vehicle.displayModel}`}
            sizes={popularWheelSizes}
            vehicle={vehicle}
          />
        )}
        
        {/* Popular Brands Section (data-driven) */}
        {productType === "wheels" && popularBrands.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-neutral-900">
              Top Wheel Brands for {vehicle.displayMake}
            </h2>
            <div className="flex flex-wrap gap-2">
              {popularBrands.slice(0, 6).map(({ brand, count }) => (
                <Link
                  key={brand}
                  href={`${browseUrl}&brand_cd=${encodeURIComponent(brand)}`}
                  className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-red-200 hover:bg-red-50"
                >
                  {brand}
                </Link>
              ))}
            </div>
          </div>
        )}
        
        {/* Common Tire Sizes (data-driven) */}
        {productType === "tires" && fitment?.oemTireSizes && fitment.oemTireSizes.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-neutral-900">
              Factory Tire Sizes for {vehicle.year} {vehicle.displayMake} {vehicle.displayModel}
            </h2>
            <div className="flex flex-wrap gap-2">
              {fitment.oemTireSizes.slice(0, 6).map((size) => (
                <Link
                  key={size}
                  href={`/tires?year=${vehicle.year}&make=${vehicle.make}&model=${vehicle.model}&size=${encodeURIComponent(size)}`}
                  className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-red-200 hover:bg-red-50"
                >
                  {size}
                </Link>
              ))}
            </div>
          </div>
        )}
        
        {/* CTA / Results Link */}
        {hasResults ? (
          <div className="mb-8">
            <Link
              href={browseUrl}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-red-700"
            >
              {labels.action} {formatCount(resultCount)} {vehicle.displayModel} {labels.plural}
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
        
        {/* Related Links */}
        <RelatedLinks links={relatedLinks} title="Shop More" />
        
        {/* FAQs */}
        <FAQSection faqs={faqs} />
        
        {/* Bottom CTA */}
        <div className="mt-12 rounded-lg bg-neutral-900 p-8 text-center">
          <h2 className="mb-3 text-2xl font-bold text-white">
            Need Help Finding the Right {labels.plural}?
          </h2>
          <p className="mb-6 text-neutral-300">
            Our experts are ready to help you find the perfect fit for your {vehicle.displayMake}.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="tel:+12483324120"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-neutral-900"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              (248) 332-4120
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

function getCountForType(counts: Props["counts"], type: ProductType): number {
  switch (type) {
    case "wheels": return counts.wheels;
    case "tires": return counts.tires;
    case "packages": return counts.packages;
    default: return 0;
  }
}
