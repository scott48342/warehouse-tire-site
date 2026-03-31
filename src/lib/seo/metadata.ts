/**
 * SEO Metadata Builder
 * 
 * Generates Next.js Metadata for SEO pages
 */

import type { Metadata } from "next";
import type { SEOPageData, ProductType, ResolvedVehicle, FitmentFacts } from "./types";
import { buildCanonicalUrl } from "./slugs";

// ============================================================================
// Title Templates
// ============================================================================

const titleTemplates: Record<ProductType, (v: ResolvedVehicle, hasResults: boolean) => string> = {
  wheels: (v, hasResults) => {
    const base = `${v.year} ${v.displayMake} ${v.displayModel}`;
    const trim = v.displayTrim ? ` ${v.displayTrim}` : "";
    if (!hasResults) {
      return `${base}${trim} Wheels | Warehouse Tire Direct`;
    }
    return `${base}${trim} Wheels - Custom & OEM Options | Warehouse Tire Direct`;
  },
  tires: (v, hasResults) => {
    const base = `${v.year} ${v.displayMake} ${v.displayModel}`;
    const trim = v.displayTrim ? ` ${v.displayTrim}` : "";
    if (!hasResults) {
      return `${base}${trim} Tires | Warehouse Tire Direct`;
    }
    return `${base}${trim} Tires - All Seasons & Performance | Warehouse Tire Direct`;
  },
  packages: (v, hasResults) => {
    const base = `${v.year} ${v.displayMake} ${v.displayModel}`;
    const trim = v.displayTrim ? ` ${v.displayTrim}` : "";
    if (!hasResults) {
      return `${base}${trim} Wheel & Tire Packages | Warehouse Tire Direct`;
    }
    return `${base}${trim} Wheel & Tire Packages - Ready to Install | Warehouse Tire Direct`;
  },
};

// ============================================================================
// Description Templates
// ============================================================================

function buildDescription(
  productType: ProductType,
  vehicle: ResolvedVehicle,
  fitment: FitmentFacts | null,
  resultCount: number
): string {
  const base = `${vehicle.year} ${vehicle.displayMake} ${vehicle.displayModel}`;
  const trim = vehicle.displayTrim ? ` ${vehicle.displayTrim}` : "";
  
  // No fitment data
  if (!fitment || !fitment.boltPattern) {
    switch (productType) {
      case "wheels":
        return `Shop wheels for your ${base}${trim}. Contact us for fitment verification and professional installation in Southeast Michigan.`;
      case "tires":
        return `Find the right tires for your ${base}${trim}. Expert recommendations and installation available.`;
      case "packages":
        return `Complete wheel and tire packages for your ${base}${trim}. Professional installation included.`;
    }
  }
  
  // Build fitment snippet
  const fitmentSnippet: string[] = [];
  if (fitment.boltPattern) fitmentSnippet.push(fitment.boltPattern);
  if (fitment.oemWheelDiameters.length > 0) {
    const diameters = [...new Set(fitment.oemWheelDiameters)].sort((a, b) => a - b);
    if (diameters.length === 1) {
      fitmentSnippet.push(`${diameters[0]}" wheels`);
    } else {
      fitmentSnippet.push(`${diameters[0]}-${diameters[diameters.length - 1]}" wheels`);
    }
  }
  
  const fitmentStr = fitmentSnippet.length > 0 ? ` (${fitmentSnippet.join(", ")})` : "";
  
  switch (productType) {
    case "wheels":
      if (resultCount > 0) {
        return `Shop ${resultCount}+ wheels that fit your ${base}${trim}${fitmentStr}. Browse custom and OEM-style options with verified fitment. Professional installation in Southeast Michigan.`;
      }
      return `Find wheels for your ${base}${trim}${fitmentStr}. Verified fitment data and professional installation available.`;
    
    case "tires":
      if (fitment.oemTireSizes.length > 0) {
        const sizes = fitment.oemTireSizes.slice(0, 2).join(", ");
        return `Shop tires for your ${base}${trim}. Factory sizes include ${sizes}. Expert recommendations and professional installation.`;
      }
      return `Find the perfect tires for your ${base}${trim}. OEM and performance options with professional installation.`;
    
    case "packages":
      return `Complete wheel and tire packages for your ${base}${trim}${fitmentStr}. Mounted, balanced, and ready to install. Save time and money with our package deals.`;
  }
}

// ============================================================================
// Main Metadata Builder
// ============================================================================

export function buildSEOMetadata(data: SEOPageData): Metadata {
  const { vehicle, fitment, productType, hasResults, resultCount, canonical } = data;
  
  const title = titleTemplates[productType](vehicle, hasResults);
  const description = buildDescription(productType, vehicle, fitment, resultCount);
  
  // Keywords based on vehicle and product type
  const keywords = buildKeywords(productType, vehicle, fitment);
  
  const metadata: Metadata = {
    title,
    description,
    keywords,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Warehouse Tire Direct",
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
  
  // noindex pages with no results or invalid fitment
  if (!hasResults || !fitment?.boltPattern) {
    metadata.robots = {
      index: false,
      follow: true,
    };
  }
  
  return metadata;
}

function buildKeywords(
  productType: ProductType,
  vehicle: ResolvedVehicle,
  fitment: FitmentFacts | null
): string {
  const parts = [
    `${vehicle.year} ${vehicle.displayMake} ${vehicle.displayModel}`,
    vehicle.displayMake,
    vehicle.displayModel,
  ];
  
  if (vehicle.displayTrim) {
    parts.push(`${vehicle.displayModel} ${vehicle.displayTrim}`);
  }
  
  switch (productType) {
    case "wheels":
      parts.push("wheels", "rims", "custom wheels", "aftermarket wheels");
      break;
    case "tires":
      parts.push("tires", "all season tires", "performance tires");
      break;
    case "packages":
      parts.push("wheel and tire packages", "tire packages", "mounted wheels");
      break;
  }
  
  if (fitment?.boltPattern) {
    parts.push(fitment.boltPattern, `${fitment.boltPattern} wheels`);
  }
  
  return parts.join(", ");
}

// ============================================================================
// Structured Data (JSON-LD)
// ============================================================================

export function buildProductListJsonLd(data: SEOPageData): object {
  const { vehicle, productType, resultCount, canonical } = data;
  
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${vehicle.year} ${vehicle.displayMake} ${vehicle.displayModel} ${
      productType.charAt(0).toUpperCase() + productType.slice(1)
    }`,
    description: `Browse ${productType} for the ${vehicle.year} ${vehicle.displayMake} ${vehicle.displayModel}`,
    url: canonical,
    numberOfItems: resultCount,
    provider: {
      "@type": "LocalBusiness",
      name: "Warehouse Tire Direct",
      address: {
        "@type": "PostalAddress",
        streetAddress: "1949 Star Batt Dr",
        addressLocality: "Rochester Hills",
        addressRegion: "MI",
        postalCode: "48309",
        addressCountry: "US",
      },
      telephone: "+1-248-332-4120",
    },
  };
}
