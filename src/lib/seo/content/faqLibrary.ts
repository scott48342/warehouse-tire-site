/**
 * FAQ Library for Vehicle Pages
 * 
 * Provides contextual FAQs based on vehicle type, page type, and fitment data.
 * Questions and answers are selected based on relevance to the specific vehicle.
 * 
 * @created 2026-04-03
 */

import type { VehicleCategory } from "./vehiclePersonas";
import type { PageType } from "./sentenceBanks";

// ============================================================================
// Types
// ============================================================================

export interface FAQ {
  question: string;
  answer: string;
}

export interface FAQContext {
  pageType: PageType;
  category: VehicleCategory;
  year: string;
  make: string;
  model: string;
  boltPattern?: string;
  oemDiameter?: number;
  supportsStaggered?: boolean;
  supportsLifted?: boolean;
}

// ============================================================================
// Universal FAQs (All Vehicles)
// ============================================================================

const UNIVERSAL_FAQS_WHEELS: FAQ[] = [
  {
    question: "How do I know these wheels will fit my {year} {make} {model}?",
    answer: "Every wheel we show is fitment-verified for your {year} {make} {model}. We check bolt pattern, center bore, offset, and clearance to ensure a proper fit. If there are any concerns, our team will contact you before shipping.",
  },
  {
    question: "What's included with wheel orders?",
    answer: "Wheels ship with center caps when applicable. Lug nuts, hub rings, and TPMS sensors are available as add-ons during checkout. We recommend adding these accessories for a complete installation.",
  },
  {
    question: "Can I upgrade to larger wheels on my {year} {make} {model}?",
    answer: "Yes, most vehicles can accommodate 1-2 inch diameter increases from stock. Our fitment system shows which sizes work for your {year} {make} {model} without rubbing or clearance issues.",
  },
  {
    question: "How long does shipping take?",
    answer: "Most orders ship within 1-2 business days. Delivery typically takes 3-7 business days depending on your location. Express shipping is available at checkout.",
  },
];

const UNIVERSAL_FAQS_TIRES: FAQ[] = [
  {
    question: "How do I choose the right tires for my {year} {make} {model}?",
    answer: "Start with your driving conditions: all-season for year-round versatility, summer for warm weather performance, or winter for snow and ice. We show sizes that fit your {year} {make} {model}'s wheels.",
  },
  {
    question: "Should I replace all four tires at once?",
    answer: "For optimal performance and safety, we recommend replacing all four tires together. This ensures even wear and consistent handling. At minimum, replace tires in pairs (both fronts or both rears).",
  },
  {
    question: "What's the difference between tire load ratings?",
    answer: "Load ratings indicate the maximum weight each tire can support. Your {year} {make} {model} requires a specific minimum load rating—we only show tires that meet or exceed your vehicle's requirements.",
  },
  {
    question: "Do you offer tire mounting and balancing?",
    answer: "Yes! When you order a wheel and tire package, we mount and balance everything before shipping. Your package arrives ready to bolt on.",
  },
];

const UNIVERSAL_FAQS_PACKAGES: FAQ[] = [
  {
    question: "What's included in a wheel and tire package?",
    answer: "Our packages include wheels, tires, and professional mounting and balancing. You can add lug nuts, hub rings, and TPMS sensors during checkout for a complete ready-to-install setup.",
  },
  {
    question: "Why buy a package instead of separate wheels and tires?",
    answer: "Packages save time and money—we ensure wheel and tire compatibility, mount and balance everything, and ship it ready to install. No trips to the tire shop needed.",
  },
  {
    question: "Can I customize my package?",
    answer: "Absolutely! Choose your preferred wheel style, then select from compatible tire options. You can adjust quantities and add accessories like TPMS sensors or lug nuts.",
  },
  {
    question: "Do packages include TPMS sensors?",
    answer: "TPMS sensors are available as an add-on. If your {year} {make} {model} has TPMS, we recommend adding sensors to your package for seamless installation.",
  },
];

// ============================================================================
// Category-Specific FAQs
// ============================================================================

const TRUCK_FAQS: FAQ[] = [
  {
    question: "Can I fit larger tires on my {year} {make} {model} without a lift?",
    answer: "Most trucks can accommodate slightly larger tires with proper wheel offset selection. For significantly bigger tires, a leveling kit or lift may be needed to prevent rubbing.",
  },
  {
    question: "What wheel width is best for my {year} {make} {model}?",
    answer: "Stock width works well for daily driving. Wider wheels (9-10 inches) provide a more aggressive look and better tire support for off-road use.",
  },
  {
    question: "Are these wheels rated for towing?",
    answer: "Yes, we only show wheels with load ratings appropriate for your {year} {make} {model}'s towing capacity. Heavy-duty options are available for maximum towing applications.",
  },
];

const OFF_ROAD_FAQS: FAQ[] = [
  {
    question: "What wheels are best for serious off-road use?",
    answer: "Look for wheels with high load ratings and durable construction. Beadlock or simulated beadlock designs help maintain tire bead seal at low pressures.",
  },
  {
    question: "Should I get all-terrain or mud-terrain tires?",
    answer: "All-terrain tires offer the best balance of on-road comfort and off-road capability. Mud-terrain tires excel in extreme conditions but are noisier on pavement.",
  },
  {
    question: "What offset is best for off-road use?",
    answer: "Negative offset (like -12 to -18) pushes wheels outward for a wider stance and better stability. This also provides more clearance for larger brake upgrades.",
  },
];

const PERFORMANCE_FAQS: FAQ[] = [
  {
    question: "Are lightweight wheels worth it for my {year} {make} {model}?",
    answer: "Absolutely. Reducing unsprung weight improves acceleration, braking, and handling. Forged wheels offer the best strength-to-weight ratio for performance applications.",
  },
  {
    question: "What's a staggered wheel setup?",
    answer: "Staggered means wider wheels/tires in the rear than the front. This optimizes rear grip and is common on rear-wheel drive performance cars for better traction.",
  },
  {
    question: "Should I get summer or all-season tires?",
    answer: "Summer tires provide significantly better grip in warm weather and on track. All-seasons are better if you need year-round capability in varying conditions.",
  },
];

const LUXURY_FAQS: FAQ[] = [
  {
    question: "Will aftermarket wheels affect my {year} {make} {model}'s ride quality?",
    answer: "Quality aftermarket wheels maintain ride quality when properly fitted. Avoid extremely large diameter upgrades that require low-profile tires, as this can impact comfort.",
  },
  {
    question: "Do you have OEM-style wheels for my {year} {make} {model}?",
    answer: "Yes, we offer OEM-replica and OEM-plus styles that match factory aesthetics while providing fresh options. These maintain your vehicle's refined appearance.",
  },
  {
    question: "Are run-flat tires available?",
    answer: "Yes, we offer run-flat options for vehicles equipped with them. Run-flats allow continued driving after a puncture, eliminating the need for a spare.",
  },
];

const ELECTRIC_FAQS: FAQ[] = [
  {
    question: "Do wheel and tire choices affect EV range?",
    answer: "Yes, aerodynamic wheels and low rolling resistance tires can improve range. Larger, heavier wheels may reduce range slightly but offer style benefits.",
  },
  {
    question: "Are there special considerations for EV tires?",
    answer: "EVs are heavier and produce instant torque. Look for tires with higher load ratings and compounds designed for EV characteristics.",
  },
  {
    question: "Will aftermarket wheels affect my EV's efficiency?",
    answer: "Aero-designed wheels optimize efficiency. Standard wheels may slightly reduce range but typically the difference is minimal for daily driving.",
  },
];

// ============================================================================
// FAQ Selection Logic
// ============================================================================

function interpolateFAQ(faq: FAQ, ctx: FAQContext): FAQ {
  return {
    question: faq.question
      .replace(/\{year\}/g, ctx.year)
      .replace(/\{make\}/g, ctx.make)
      .replace(/\{model\}/g, ctx.model),
    answer: faq.answer
      .replace(/\{year\}/g, ctx.year)
      .replace(/\{make\}/g, ctx.make)
      .replace(/\{model\}/g, ctx.model)
      .replace(/\{boltPattern\}/g, ctx.boltPattern || "standard")
      .replace(/\{oemDiameter\}/g, String(ctx.oemDiameter || "factory")),
  };
}

/**
 * Get relevant FAQs for a vehicle page
 */
export function getFAQs(ctx: FAQContext, maxCount: number = 4): FAQ[] {
  const faqs: FAQ[] = [];
  
  // Get universal FAQs for page type
  const universalBank = ctx.pageType === "wheels"
    ? UNIVERSAL_FAQS_WHEELS
    : ctx.pageType === "tires"
      ? UNIVERSAL_FAQS_TIRES
      : UNIVERSAL_FAQS_PACKAGES;
  
  // Add universal FAQs (first 2)
  faqs.push(...universalBank.slice(0, 2));
  
  // Add category-specific FAQs
  let categoryFAQs: FAQ[] = [];
  
  switch (ctx.category) {
    case "truck":
    case "full-size-suv":
      categoryFAQs = TRUCK_FAQS;
      break;
    case "off-road":
      categoryFAQs = OFF_ROAD_FAQS;
      break;
    case "performance":
    case "muscle":
    case "sports-car":
      categoryFAQs = PERFORMANCE_FAQS;
      break;
    case "luxury":
      categoryFAQs = LUXURY_FAQS;
      break;
    case "electric":
      categoryFAQs = ELECTRIC_FAQS;
      break;
  }
  
  // Add 1-2 category FAQs
  faqs.push(...categoryFAQs.slice(0, 2));
  
  // Interpolate and limit
  return faqs.slice(0, maxCount).map(faq => interpolateFAQ(faq, ctx));
}

// ============================================================================
// Structured Data Generation
// ============================================================================

/**
 * Generate FAQ structured data (JSON-LD)
 */
export function getFAQStructuredData(faqs: FAQ[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer,
      },
    })),
  };
}

// ============================================================================
// Exports
// ============================================================================

export const faqLibrary = {
  getFAQs,
  getFAQStructuredData,
};

export default faqLibrary;
