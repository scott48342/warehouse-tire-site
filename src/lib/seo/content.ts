/**
 * SEO Content Builders
 * 
 * Generate page content blocks from fitment data
 */

import type { ProductType, ResolvedVehicle, FitmentFacts } from "./types";
import { buildVehicleUrl } from "./slugs";

// ============================================================================
// H1 Generation
// ============================================================================

export function buildH1(
  productType: ProductType,
  vehicle: ResolvedVehicle
): string {
  const base = `${vehicle.year} ${vehicle.displayMake} ${vehicle.displayModel}`;
  const trim = vehicle.displayTrim ? ` ${vehicle.displayTrim}` : "";
  
  switch (productType) {
    case "wheels":
      return `${base}${trim} Wheels`;
    case "tires":
      return `${base}${trim} Tires`;
    case "packages":
      return `${base}${trim} Wheel & Tire Packages`;
  }
}

// ============================================================================
// Intro Paragraph
// ============================================================================

export function buildIntroParagraph(
  productType: ProductType,
  vehicle: ResolvedVehicle,
  fitment: FitmentFacts | null,
  resultCount: number
): string {
  const base = `${vehicle.year} ${vehicle.displayMake} ${vehicle.displayModel}`;
  const trim = vehicle.displayTrim ? ` ${vehicle.displayTrim}` : "";
  
  if (!fitment || !fitment.boltPattern) {
    switch (productType) {
      case "wheels":
        return `Looking for wheels for your ${base}${trim}? Browse our selection of custom and OEM-style wheels. Contact our team at (248) 332-4120 for fitment verification.`;
      case "tires":
        return `Find the perfect tires for your ${base}${trim}. Our experts can help you choose the right size and type for your driving needs.`;
      case "packages":
        return `Complete wheel and tire packages for your ${base}${trim}. Mounted, balanced, and ready for installation at our Rochester Hills location.`;
    }
  }
  
  const boltPattern = fitment.boltPattern;
  const hubBore = fitment.centerBoreMm ? `${fitment.centerBoreMm}mm hub bore` : null;
  
  switch (productType) {
    case "wheels":
      return `Shop ${resultCount > 0 ? `${resultCount}+ ` : ""}wheels that fit your ${base}${trim}. Your vehicle uses a ${boltPattern} bolt pattern${hubBore ? ` with a ${hubBore}` : ""}. Browse aftermarket and OEM-style options with guaranteed fitment.`;
    case "tires":
      const sizes = fitment.oemTireSizes.slice(0, 3).join(", ");
      return `Find tires for your ${base}${trim}. Factory tire sizes include ${sizes || "various options"}. We carry all-season, performance, and off-road options to match your driving style.`;
    case "packages":
      return `Save time and money with our wheel and tire packages for the ${base}${trim}. All packages are mounted, balanced, and include TPMS sensors. Professional installation available at our location.`;
  }
}

// ============================================================================
// Fitment Facts Block
// ============================================================================

export interface FitmentFactItem {
  label: string;
  value: string;
  icon?: string;
}

export function buildFitmentFactItems(
  fitment: FitmentFacts | null
): FitmentFactItem[] {
  if (!fitment) return [];
  
  const items: FitmentFactItem[] = [];
  
  if (fitment.boltPattern) {
    items.push({
      label: "Bolt Pattern",
      value: fitment.boltPattern,
      icon: "bolt",
    });
  }
  
  if (fitment.centerBoreMm) {
    items.push({
      label: "Hub Bore",
      value: `${fitment.centerBoreMm}mm`,
      icon: "circle",
    });
  }
  
  if (fitment.threadSize) {
    items.push({
      label: "Lug Thread",
      value: fitment.threadSize,
      icon: "wrench",
    });
  }
  
  if (fitment.seatType) {
    items.push({
      label: "Lug Seat",
      value: fitment.seatType,
      icon: "seat",
    });
  }
  
  if (fitment.oemWheelDiameters.length > 0) {
    const diameters = fitment.oemWheelDiameters;
    const value = diameters.length === 1
      ? `${diameters[0]}"`
      : `${diameters[0]}" - ${diameters[diameters.length - 1]}"`;
    items.push({
      label: "OEM Wheel Sizes",
      value,
      icon: "wheel",
    });
  }
  
  if (fitment.oemTireSizes.length > 0) {
    items.push({
      label: "OEM Tire Sizes",
      value: fitment.oemTireSizes.slice(0, 4).join(", "),
      icon: "tire",
    });
  }
  
  if (fitment.offsetRange) {
    items.push({
      label: "Offset Range",
      value: `${fitment.offsetRange.min}mm to ${fitment.offsetRange.max}mm`,
      icon: "ruler",
    });
  }
  
  if (fitment.hasStaggered) {
    items.push({
      label: "Staggered",
      value: "Available",
      icon: "layers",
    });
  }
  
  return items;
}

// ============================================================================
// Related Links
// ============================================================================

export interface RelatedLink {
  label: string;
  href: string;
}

export function buildRelatedLinks(
  productType: ProductType,
  vehicle: ResolvedVehicle
): RelatedLink[] {
  const links: RelatedLink[] = [];
  const { year, make, model, displayMake, displayModel } = vehicle;
  
  // Other product types for same vehicle
  if (productType !== "wheels") {
    links.push({
      label: `${displayModel} Wheels`,
      href: buildVehicleUrl("wheels", year, make, model),
    });
  }
  if (productType !== "tires") {
    links.push({
      label: `${displayModel} Tires`,
      href: buildVehicleUrl("tires", year, make, model),
    });
  }
  if (productType !== "packages") {
    links.push({
      label: `${displayModel} Packages`,
      href: buildVehicleUrl("packages", year, make, model),
    });
  }
  
  // Adjacent years
  const currentYear = new Date().getFullYear();
  if (year > 2000) {
    links.push({
      label: `${year - 1} ${displayModel}`,
      href: buildVehicleUrl(productType, year - 1, make, model),
    });
  }
  if (year < currentYear + 1) {
    links.push({
      label: `${year + 1} ${displayModel}`,
      href: buildVehicleUrl(productType, year + 1, make, model),
    });
  }
  
  return links;
}

// ============================================================================
// FAQ Content
// ============================================================================

export interface FAQItem {
  question: string;
  answer: string;
}

export function buildFAQItems(
  productType: ProductType,
  vehicle: ResolvedVehicle,
  fitment: FitmentFacts | null
): FAQItem[] {
  const base = `${vehicle.year} ${vehicle.displayMake} ${vehicle.displayModel}`;
  const faqs: FAQItem[] = [];
  
  // Bolt pattern FAQ
  if (fitment?.boltPattern) {
    faqs.push({
      question: `What is the bolt pattern for the ${base}?`,
      answer: `The ${base} uses a ${fitment.boltPattern} bolt pattern${
        fitment.centerBoreMm ? ` with a ${fitment.centerBoreMm}mm center bore` : ""
      }.`,
    });
  }
  
  // Tire size FAQ
  if (fitment?.oemTireSizes.length) {
    faqs.push({
      question: `What size tires fit the ${base}?`,
      answer: `Factory tire sizes for the ${base} include ${fitment.oemTireSizes.slice(0, 3).join(", ")}. Other sizes may fit depending on wheel specifications.`,
    });
  }
  
  // Wheel diameter FAQ
  if (fitment?.oemWheelDiameters.length) {
    const diameters = fitment.oemWheelDiameters;
    faqs.push({
      question: `What size wheels fit the ${base}?`,
      answer: `The ${base} can accommodate wheels from ${diameters[0]}" to ${diameters[diameters.length - 1]}" diameter from the factory. Aftermarket options may vary.`,
    });
  }
  
  // Product-specific FAQs
  switch (productType) {
    case "wheels":
      faqs.push({
        question: `Do you install wheels for the ${base}?`,
        answer: `Yes! We offer professional wheel installation at our Rochester Hills location. All installations include mounting, balancing, and TPMS service.`,
      });
      break;
    case "tires":
      faqs.push({
        question: `Do you offer tire installation for the ${base}?`,
        answer: `Absolutely. Our certified technicians provide complete tire installation including mounting, balancing, and proper torque specifications for your ${vehicle.displayMake}.`,
      });
      break;
    case "packages":
      faqs.push({
        question: `What's included in your wheel and tire packages?`,
        answer: `All packages include wheels, tires, mounting, balancing, and TPMS sensors. We ensure everything fits your ${base} perfectly before you leave.`,
      });
      break;
  }
  
  return faqs;
}

// ============================================================================
// JSON-LD for FAQs
// ============================================================================

export function buildFAQJsonLd(faqs: FAQItem[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(faq => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}
