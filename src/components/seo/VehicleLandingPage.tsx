/**
 * Vehicle Landing Page Component
 * 
 * Shared component for wheels/tires/packages SEO pages
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
} from "@/lib/seo";
import { FitmentFactsCard } from "./FitmentFactsCard";
import { RelatedLinks } from "./RelatedLinks";
import { FAQSection } from "./FAQSection";

interface Props {
  productType: ProductType;
  vehicle: ResolvedVehicle;
  fitment: FitmentFacts | null;
  resultCount?: number;
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

export function VehicleLandingPage({ productType, vehicle, fitment, resultCount = 1000 }: Props) {
  const labels = productLabels[productType];
  const hasResults = !!fitment?.boltPattern;
  
  // Build content
  const h1 = buildH1(productType, vehicle);
  const intro = buildIntroParagraph(productType, vehicle, fitment, hasResults ? resultCount : 0);
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
    resultCount: hasResults ? resultCount : 0,
    canonical,
  });
  const faqJsonLd = faqs.length > 0 ? buildFAQJsonLd(faqs) : null;
  
  // Build browse URL
  const browseUrl = `${browseUrls[productType]}?year=${vehicle.year}&make=${vehicle.make}&model=${vehicle.model}${vehicle.trim ? `&trim=${vehicle.trim}` : ""}`;
  
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
        
        {/* H1 */}
        <h1 className="mb-4 text-3xl font-bold text-neutral-900 sm:text-4xl">
          {h1}
        </h1>
        
        {/* Intro */}
        <p className="mb-8 max-w-3xl text-lg text-neutral-600">
          {intro}
        </p>
        
        {/* Fitment Facts */}
        {fitmentItems.length > 0 && (
          <div className="mb-8">
            <FitmentFactsCard items={fitmentItems} />
          </div>
        )}
        
        {/* CTA / Results Link */}
        {hasResults ? (
          <div className="mb-8">
            <Link
              href={browseUrl}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-red-700"
            >
              {labels.action} {vehicle.displayModel} {labels.plural}
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
