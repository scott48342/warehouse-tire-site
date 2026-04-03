/**
 * Page Content Generator
 * 
 * Generates structured, vehicle-specific SEO content for vehicle pages.
 * Works with indexing strategy to only generate full content for index-worthy pages.
 * 
 * @created 2026-04-03
 */

import { getVehiclePersona, type VehicleCategory, type VehiclePersona } from "./vehiclePersonas";
import { getHeroIntro, getFitmentSentence, getStyleRecommendation, type PageType, type SentenceContext } from "./sentenceBanks";
import { getFAQs, getFAQStructuredData, type FAQ } from "./faqLibrary";
import { shouldNoIndex, buildPageIndexingData, type PageIndexingData } from "../indexingStrategy";

// ============================================================================
// Types
// ============================================================================

export interface FitmentData {
  boltPattern?: string;
  centerBoreMm?: number;
  oemDiameters?: number[];
  oemWidths?: number[];
  offsetRange?: [number, number];
  tireSizes?: string[];
  supportsStaggered?: boolean;
  supportsLifted?: boolean;
}

export interface PageContentInput {
  pageType: PageType;
  year: string;
  make: string;
  model: string;
  trim?: string;
  modification?: string;
  fitment?: FitmentData;
  productCount: number;
  productsWithImages: number;
  path: string;
  /** Force generate content even if page is noindexed */
  forceGenerate?: boolean;
}

export interface HeroBlock {
  headline: string;
  intro: string;
  subheadline?: string;
}

export interface FitmentBlock {
  title: string;
  description: string;
  specs: Array<{ label: string; value: string }>;
  note?: string;
}

export interface StyleBlock {
  title: string;
  description: string;
  recommendations: string[];
  tags?: string[];
}

export interface PackageBlock {
  title: string;
  description: string;
  benefits: string[];
  cta: string;
}

export interface FAQBlock {
  title: string;
  faqs: FAQ[];
  structuredData: object;
}

export interface InternalLinksBlock {
  title: string;
  links: Array<{ label: string; href: string; description?: string }>;
}

export interface GeneratedPageContent {
  /** Was content generated (false if page should be noindexed) */
  generated: boolean;
  
  /** Reason for generation decision */
  reason: string;
  
  /** Vehicle persona used */
  persona?: VehiclePersona;
  
  /** Content blocks (only present if generated=true) */
  heroBlock?: HeroBlock;
  fitmentBlock?: FitmentBlock;
  styleBlock?: StyleBlock;
  packageBlock?: PackageBlock;
  faqBlock?: FAQBlock;
  internalLinksBlock?: InternalLinksBlock;
  
  /** Meta information */
  meta?: {
    title: string;
    description: string;
    keywords: string[];
  };
}

// ============================================================================
// Content Generation Functions
// ============================================================================

function generateHeroBlock(
  pageType: PageType,
  persona: VehiclePersona,
  ctx: SentenceContext
): HeroBlock {
  const intro = getHeroIntro(ctx);
  
  const headlineMap: Record<PageType, string> = {
    wheels: `${ctx.year} ${ctx.make} ${ctx.model} Wheels`,
    tires: `${ctx.year} ${ctx.make} ${ctx.model} Tires`,
    packages: `${ctx.year} ${ctx.make} ${ctx.model} Wheel & Tire Packages`,
  };
  
  const subheadlineMap: Record<PageType, string> = {
    wheels: "Fitment-verified wheels ready to ship",
    tires: "Tires matched for your exact vehicle",
    packages: "Complete packages with mounting & balancing included",
  };
  
  return {
    headline: headlineMap[pageType],
    intro,
    subheadline: subheadlineMap[pageType],
  };
}

function generateFitmentBlock(
  ctx: SentenceContext,
  fitment?: FitmentData
): FitmentBlock {
  const description = getFitmentSentence(ctx);
  
  const specs: Array<{ label: string; value: string }> = [];
  
  if (fitment?.boltPattern) {
    specs.push({ label: "Bolt Pattern", value: fitment.boltPattern });
  }
  
  if (fitment?.centerBoreMm) {
    specs.push({ label: "Center Bore", value: `${fitment.centerBoreMm}mm` });
  }
  
  if (fitment?.oemDiameters?.length) {
    const sizes = fitment.oemDiameters.map(d => `${d}"`).join(", ");
    specs.push({ label: "OEM Wheel Sizes", value: sizes });
  }
  
  if (fitment?.offsetRange) {
    const [min, max] = fitment.offsetRange;
    specs.push({ label: "Offset Range", value: `${min}mm to ${max}mm` });
  }
  
  if (fitment?.tireSizes?.length) {
    specs.push({ label: "OEM Tire Sizes", value: fitment.tireSizes.slice(0, 3).join(", ") });
  }
  
  return {
    title: `${ctx.year} ${ctx.make} ${ctx.model} Fitment Specs`,
    description,
    specs,
    note: specs.length > 0 
      ? "All products shown are verified to fit these specifications."
      : "We verify fitment for every order before shipping.",
  };
}

function generateStyleBlock(
  pageType: PageType,
  persona: VehiclePersona,
  ctx: SentenceContext
): StyleBlock {
  const recommendation = getStyleRecommendation(ctx);
  
  const titleMap: Record<PageType, string> = {
    wheels: `Popular Wheel Styles for ${persona.displayCategory}s`,
    tires: `Tire Recommendations for ${persona.displayCategory}s`,
    packages: `Popular Package Builds for ${persona.displayCategory}s`,
  };
  
  const recommendations = [recommendation];
  
  // Add persona-specific recommendations
  if (pageType === "wheels") {
    recommendations.push(persona.wheelStyle);
  } else if (pageType === "tires") {
    recommendations.push(persona.tireStyle);
  }
  
  // Add mod suggestions
  if (persona.commonMods.length > 0 && pageType === "packages") {
    recommendations.push(`Common mods: ${persona.commonMods.slice(0, 2).join(", ")}`);
  }
  
  return {
    title: titleMap[pageType],
    description: `Explore options curated for ${persona.displayCategory.toLowerCase()} vehicles like yours.`,
    recommendations,
    tags: persona.keywords.slice(0, 5),
  };
}

function generatePackageBlock(
  persona: VehiclePersona,
  ctx: SentenceContext
): PackageBlock {
  const benefits = [
    "Professional mounting & balancing included",
    "Guaranteed fitment for your vehicle",
    "Ships ready to install",
    "Expert support included",
  ];
  
  // Add persona-specific benefits
  if (persona.supportsLifted) {
    benefits.push("Lifted truck packages available");
  }
  
  if (persona.supportsStaggered) {
    benefits.push("Staggered setups for optimal handling");
  }
  
  return {
    title: "Why Buy a Package?",
    description: `Get everything your ${ctx.year} ${ctx.make} ${ctx.model} needs in one convenient order.`,
    benefits: benefits.slice(0, 5),
    cta: "Build Your Package",
  };
}

function generateFAQBlock(
  pageType: PageType,
  persona: VehiclePersona,
  ctx: SentenceContext
): FAQBlock {
  const faqs = getFAQs({
    pageType,
    category: persona.category,
    year: ctx.year,
    make: ctx.make,
    model: ctx.model,
    boltPattern: ctx.boltPattern,
    oemDiameter: ctx.oemDiameter,
    supportsStaggered: ctx.supportsStaggered,
    supportsLifted: ctx.supportsLifted,
  }, 4);
  
  return {
    title: `${ctx.year} ${ctx.make} ${ctx.model} FAQ`,
    faqs,
    structuredData: getFAQStructuredData(faqs),
  };
}

function generateInternalLinksBlock(
  pageType: PageType,
  ctx: SentenceContext,
  persona: VehiclePersona
): InternalLinksBlock {
  const vehicleSlug = `${ctx.year}-${ctx.make.toLowerCase()}-${ctx.model.toLowerCase().replace(/\s+/g, "-")}`;
  
  const links: Array<{ label: string; href: string; description?: string }> = [];
  
  // Cross-link to other page types
  if (pageType !== "wheels") {
    links.push({
      label: `${ctx.year} ${ctx.make} ${ctx.model} Wheels`,
      href: `/wheels/v/${vehicleSlug}`,
      description: "Browse compatible wheels",
    });
  }
  
  if (pageType !== "tires") {
    links.push({
      label: `${ctx.year} ${ctx.make} ${ctx.model} Tires`,
      href: `/tires/v/${vehicleSlug}`,
      description: "Find the right tires",
    });
  }
  
  if (pageType !== "packages") {
    links.push({
      label: `${ctx.year} ${ctx.make} ${ctx.model} Packages`,
      href: `/packages/for/${vehicleSlug}`,
      description: "Complete wheel & tire packages",
    });
  }
  
  // Add category-specific links
  if (persona.supportsLifted && pageType === "wheels") {
    links.push({
      label: "Lifted Truck Wheels",
      href: "/wheels?category=truck&lifted=true",
      description: "Wheels for lifted applications",
    });
  }
  
  // Add make-based browse links
  links.push({
    label: `More ${ctx.make} Wheels`,
    href: `/wheels?make=${encodeURIComponent(ctx.make)}`,
    description: `Browse all ${ctx.make} fitments`,
  });
  
  return {
    title: "Related Pages",
    links: links.slice(0, 5),
  };
}

function generateMeta(
  pageType: PageType,
  persona: VehiclePersona,
  ctx: SentenceContext,
  productCount: number
): { title: string; description: string; keywords: string[] } {
  const titleMap: Record<PageType, string> = {
    wheels: `${ctx.year} ${ctx.make} ${ctx.model} Wheels | Shop ${productCount}+ Options`,
    tires: `${ctx.year} ${ctx.make} ${ctx.model} Tires | Fitment Guaranteed`,
    packages: `${ctx.year} ${ctx.make} ${ctx.model} Wheel & Tire Packages | Complete Setups`,
  };
  
  const descMap: Record<PageType, string> = {
    wheels: `Shop wheels for your ${ctx.year} ${ctx.make} ${ctx.model}. ${productCount}+ fitment-verified options. Free shipping. Expert support.`,
    tires: `Find the perfect tires for your ${ctx.year} ${ctx.make} ${ctx.model}. All sizes guaranteed to fit. Shop now with free shipping.`,
    packages: `Complete wheel and tire packages for the ${ctx.year} ${ctx.make} ${ctx.model}. Mounted, balanced, and ready to install.`,
  };
  
  const keywords = [
    `${ctx.year} ${ctx.make} ${ctx.model} ${pageType}`,
    `${ctx.make} ${ctx.model} ${pageType}`,
    ...persona.keywords,
    `${ctx.make} ${pageType}`,
    persona.displayCategory.toLowerCase(),
  ];
  
  return {
    title: titleMap[pageType],
    description: descMap[pageType],
    keywords: keywords.slice(0, 10),
  };
}

// ============================================================================
// Main Generator Function
// ============================================================================

/**
 * Generate page content for a vehicle page
 * 
 * @param input - Page content input parameters
 * @returns Generated content blocks (or empty if page should be noindexed)
 */
export function generatePageContent(input: PageContentInput): GeneratedPageContent {
  const {
    pageType,
    year,
    make,
    model,
    trim,
    modification,
    fitment,
    productCount,
    productsWithImages,
    path,
    forceGenerate,
  } = input;
  
  // Check if page should be indexed
  const indexingData = buildPageIndexingData({
    pageType,
    products: Array(productCount).fill({ imageUrl: productsWithImages > 0 ? "placeholder" : undefined }),
    year,
    make,
    model,
    trim,
    modification,
    path,
  });
  
  const isNoIndex = shouldNoIndex(indexingData);
  
  // Don't generate content for noindexed pages unless forced
  if (isNoIndex && !forceGenerate) {
    return {
      generated: false,
      reason: "Page is noindexed - content not generated to save resources",
    };
  }
  
  // Get vehicle persona
  const persona = getVehiclePersona(make, model);
  
  // Build sentence context
  const ctx: SentenceContext = {
    pageType,
    category: persona.category,
    year,
    make,
    model,
    trim,
    boltPattern: fitment?.boltPattern,
    oemDiameter: fitment?.oemDiameters?.[0],
    productCount,
    supportsStaggered: fitment?.supportsStaggered || persona.supportsStaggered,
    supportsLifted: fitment?.supportsLifted || persona.supportsLifted,
  };
  
  // Generate all blocks
  const heroBlock = generateHeroBlock(pageType, persona, ctx);
  const fitmentBlock = generateFitmentBlock(ctx, fitment);
  const styleBlock = generateStyleBlock(pageType, persona, ctx);
  const packageBlock = generatePackageBlock(persona, ctx);
  const faqBlock = generateFAQBlock(pageType, persona, ctx);
  const internalLinksBlock = generateInternalLinksBlock(pageType, ctx, persona);
  const meta = generateMeta(pageType, persona, ctx, productCount);
  
  return {
    generated: true,
    reason: forceGenerate 
      ? "Content forced for noindexed page" 
      : "Page passes indexing criteria",
    persona,
    heroBlock,
    fitmentBlock,
    styleBlock,
    packageBlock,
    faqBlock,
    internalLinksBlock,
    meta,
  };
}

/**
 * Check if page should have full SEO content generated
 */
export function shouldGenerateContent(input: Omit<PageContentInput, "forceGenerate">): boolean {
  const indexingData = buildPageIndexingData({
    pageType: input.pageType,
    products: Array(input.productCount).fill({ 
      imageUrl: input.productsWithImages > 0 ? "placeholder" : undefined 
    }),
    year: input.year,
    make: input.make,
    model: input.model,
    trim: input.trim,
    modification: input.modification,
    path: input.path,
  });
  
  return !shouldNoIndex(indexingData);
}

// ============================================================================
// Exports
// ============================================================================

export const pageContentGenerator = {
  generatePageContent,
  shouldGenerateContent,
};

export default pageContentGenerator;
