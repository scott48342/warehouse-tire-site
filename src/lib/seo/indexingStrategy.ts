/**
 * Dynamic SEO Indexing Strategy
 * 
 * Controls which pages get indexed by search engines based on content quality.
 * Does NOT remove pages or change routing - only controls meta robots and canonical tags.
 * 
 * @created 2026-04-03
 */

// ============================================================================
// Types
// ============================================================================

export interface PageIndexingData {
  // Page type
  pageType: "wheels" | "tires" | "packages" | "vehicle-landing" | "other";
  
  // Content metrics
  productCount: number;
  productsWithImages: number;
  
  // Vehicle info (if applicable)
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  modification?: string;
  
  // Page URL path
  path: string;
  
  // Is this a featured/homepage-linked page?
  isFeatured?: boolean;
  
  // Fitment confidence (if available)
  fitmentConfidence?: "high" | "medium" | "low" | "none";
}

export interface IndexingDecision {
  /** Should this page have noindex? */
  noindex: boolean;
  
  /** Reason for the decision */
  reason: string;
  
  /** Canonical URL (if different from current) */
  canonicalUrl?: string;
  
  /** Additional meta robots directives */
  additionalDirectives?: string[];
}

// ============================================================================
// High-Demand Vehicles (Always Index)
// ============================================================================

/**
 * Popular vehicle models that should always be indexed when they have content.
 * Based on US sales data and search volume.
 */
const HIGH_DEMAND_MODELS: Set<string> = new Set([
  // Trucks
  "f-150", "f150", "silverado", "sierra", "ram 1500", "ram 2500", "ram 3500",
  "tacoma", "tundra", "colorado", "canyon", "ranger", "frontier", "titan",
  "gladiator", "ridgeline", "maverick", "santa cruz",
  
  // SUVs
  "tahoe", "suburban", "yukon", "escalade", "expedition", "navigator",
  "4runner", "wrangler", "bronco", "defender", "grand cherokee", "cherokee",
  "highlander", "pilot", "telluride", "palisade", "atlas", "explorer",
  "rav4", "cr-v", "cx-5", "tucson", "sportage", "rogue", "forester",
  "outback", "crosstrek", "equinox", "traverse", "blazer",
  
  // Performance
  "mustang", "camaro", "challenger", "charger", "corvette", "supra",
  "wrx", "sti", "golf r", "civic type r", "civic si", "m3", "m4", "m5",
  "rs3", "rs5", "s4", "s5", "amg", "gt-r", "370z", "miata", "mx-5", "86", "brz",
  
  // Sedans/Popular
  "camry", "accord", "civic", "corolla", "altima", "sonata", "elantra",
  "mazda3", "mazda6", "jetta", "passat", "model 3", "model y", "model s",
  
  // Vans
  "sienna", "odyssey", "pacifica", "carnival",
]);

/**
 * Popular makes that generally have high search volume
 */
const HIGH_DEMAND_MAKES: Set<string> = new Set([
  "ford", "chevrolet", "chevy", "gmc", "ram", "dodge", "jeep",
  "toyota", "honda", "nissan", "subaru", "mazda",
  "bmw", "mercedes", "mercedes-benz", "audi", "porsche", "lexus",
  "tesla", "rivian",
]);

// ============================================================================
// Duplicate Detection (for Canonicals)
// ============================================================================

/**
 * Vehicle year ranges that should canonicalize to a primary year.
 * Maps model generations to their canonical year.
 */
const YEAR_CONSOLIDATION: Record<string, Record<string, string>> = {
  // Ford F-150 (14th gen: 2021-2024)
  "ford:f-150": {
    "2021": "2023", "2022": "2023", "2024": "2023",
  },
  // Chevy Silverado 1500 (4th gen: 2019-2024)
  "chevrolet:silverado 1500": {
    "2019": "2023", "2020": "2023", "2021": "2023", "2022": "2023", "2024": "2023",
  },
  // Toyota Tacoma (3rd gen: 2016-2023)
  "toyota:tacoma": {
    "2016": "2022", "2017": "2022", "2018": "2022", "2019": "2022",
    "2020": "2022", "2021": "2022", "2023": "2022",
  },
  // Jeep Wrangler JL (2018+)
  "jeep:wrangler": {
    "2018": "2023", "2019": "2023", "2020": "2023", "2021": "2023",
    "2022": "2023", "2024": "2023",
  },
  // Ford Mustang (S550: 2015-2023)
  "ford:mustang": {
    "2015": "2022", "2016": "2022", "2017": "2022", "2018": "2022",
    "2019": "2022", "2020": "2022", "2021": "2022", "2023": "2022",
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize vehicle name for comparison
 */
function normalizeVehicleName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Check if a vehicle is high-demand (popular)
 */
function isHighDemandVehicle(make?: string, model?: string): boolean {
  const normMake = normalizeVehicleName(make || "");
  const normModel = normalizeVehicleName(model || "");
  
  // Check if make is popular
  if (HIGH_DEMAND_MAKES.has(normMake)) {
    // Check if model is in high-demand list
    if (HIGH_DEMAND_MODELS.has(normModel)) {
      return true;
    }
    
    // Also check partial matches (e.g., "f-150 raptor" contains "f-150")
    for (const popular of HIGH_DEMAND_MODELS) {
      if (normModel.includes(popular) || popular.includes(normModel)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Get canonical year for a vehicle (if year consolidation applies)
 */
function getCanonicalYear(year: string, make: string, model: string): string | null {
  const key = `${normalizeVehicleName(make)}:${normalizeVehicleName(model)}`;
  const yearMap = YEAR_CONSOLIDATION[key];
  
  if (yearMap && yearMap[year]) {
    return yearMap[year];
  }
  
  return null;
}

/**
 * Calculate image coverage percentage
 */
function getImageCoverage(productsWithImages: number, productCount: number): number {
  if (productCount === 0) return 0;
  return (productsWithImages / productCount) * 100;
}

// ============================================================================
// Main Indexing Decision Function
// ============================================================================

/**
 * Determine if a page should be noindexed and get canonical URL
 * 
 * @param data - Page data for indexing decision
 * @returns IndexingDecision with noindex flag, reason, and optional canonical
 */
export function getIndexingDecision(data: PageIndexingData): IndexingDecision {
  const {
    pageType,
    productCount,
    productsWithImages,
    year,
    make,
    model,
    trim,
    modification,
    path,
    isFeatured,
    fitmentConfidence,
  } = data;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RULE: Always index packages pages
  // ═══════════════════════════════════════════════════════════════════════════
  if (pageType === "packages" || path.startsWith("/packages/") || path.startsWith("/package/")) {
    return {
      noindex: false,
      reason: "Package pages are always indexed",
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RULE: Always index featured/homepage-linked pages
  // ═══════════════════════════════════════════════════════════════════════════
  if (isFeatured) {
    return {
      noindex: false,
      reason: "Featured page - always indexed",
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RULE: Noindex if product count < 6
  // ═══════════════════════════════════════════════════════════════════════════
  if (productCount < 6) {
    return {
      noindex: true,
      reason: `Low product count (${productCount} < 6)`,
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RULE: Noindex if majority of products have no images (< 50% coverage)
  // ═══════════════════════════════════════════════════════════════════════════
  const imageCoverage = getImageCoverage(productsWithImages, productCount);
  if (imageCoverage < 50) {
    return {
      noindex: true,
      reason: `Low image coverage (${imageCoverage.toFixed(0)}% < 50%)`,
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RULE: Noindex low-confidence fitment pages
  // ═══════════════════════════════════════════════════════════════════════════
  if (fitmentConfidence === "low" || fitmentConfidence === "none") {
    return {
      noindex: true,
      reason: `Low fitment confidence (${fitmentConfidence})`,
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Check for canonical consolidation (year-based duplicates)
  // ═══════════════════════════════════════════════════════════════════════════
  let canonicalUrl: string | undefined;
  
  if (year && make && model) {
    const canonicalYear = getCanonicalYear(year, make, model);
    
    if (canonicalYear && canonicalYear !== year) {
      // Build canonical URL with the canonical year
      const urlMake = encodeURIComponent(make.toLowerCase());
      const urlModel = encodeURIComponent(model.toLowerCase().replace(/\s+/g, "-"));
      
      if (pageType === "wheels") {
        canonicalUrl = `/wheels/v/${canonicalYear}-${urlMake}-${urlModel}`;
      } else if (pageType === "tires") {
        canonicalUrl = `/tires/v/${canonicalYear}-${urlMake}-${urlModel}`;
      }
      
      // Still index the page but point to canonical
      // (This helps with crawl budget while keeping the page accessible)
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RULE: Check if high-demand vehicle
  // ═══════════════════════════════════════════════════════════════════════════
  if (make && model) {
    const isHighDemand = isHighDemandVehicle(make, model);
    
    if (isHighDemand) {
      return {
        noindex: false,
        reason: "High-demand vehicle with sufficient products",
        canonicalUrl,
      };
    }
    
    // For non-high-demand vehicles, require more products
    if (productCount < 12) {
      return {
        noindex: true,
        reason: `Low-demand vehicle with insufficient products (${productCount} < 12)`,
        canonicalUrl,
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Default: Index if passes all checks
  // ═══════════════════════════════════════════════════════════════════════════
  return {
    noindex: false,
    reason: "Passes all indexing criteria",
    canonicalUrl,
  };
}

/**
 * Simple helper to check if page should be noindexed
 */
export function shouldNoIndex(data: PageIndexingData): boolean {
  return getIndexingDecision(data).noindex;
}

/**
 * Generate robots meta content string
 */
export function getRobotsContent(decision: IndexingDecision): string {
  const directives: string[] = [];
  
  if (decision.noindex) {
    directives.push("noindex");
    directives.push("follow"); // Still follow links even if noindex
  } else {
    directives.push("index");
    directives.push("follow");
  }
  
  if (decision.additionalDirectives) {
    directives.push(...decision.additionalDirectives);
  }
  
  return directives.join(", ");
}

/**
 * Build page indexing data from common page props
 */
export function buildPageIndexingData(params: {
  pageType: PageIndexingData["pageType"];
  products: Array<{ imageUrl?: string; price?: number }>;
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  modification?: string;
  path: string;
  isFeatured?: boolean;
  fitmentConfidence?: PageIndexingData["fitmentConfidence"];
}): PageIndexingData {
  const productsWithImages = params.products.filter(p => p.imageUrl).length;
  
  return {
    pageType: params.pageType,
    productCount: params.products.length,
    productsWithImages,
    year: params.year,
    make: params.make,
    model: params.model,
    trim: params.trim,
    modification: params.modification,
    path: params.path,
    isFeatured: params.isFeatured,
    fitmentConfidence: params.fitmentConfidence,
  };
}

// ============================================================================
// Exports
// ============================================================================

export const seoIndexing = {
  getIndexingDecision,
  shouldNoIndex,
  getRobotsContent,
  buildPageIndexingData,
  isHighDemandVehicle,
};

export default seoIndexing;
