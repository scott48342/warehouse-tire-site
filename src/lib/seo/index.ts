export {
  getIndexingDecision,
  shouldNoIndex,
  getRobotsContent,
  buildPageIndexingData,
  seoIndexing,
  type PageIndexingData,
  type IndexingDecision,
} from "./indexingStrategy";

// Slug utilities
export {
  slugifyVehicle,
  parseVehicleSlug,
  type VehicleSlugParts,
} from "./slugifyVehicle";

// Vehicle lookup
export {
  getVehicleBySlug,
  formatVehicleName,
} from "./getVehicleBySlug";

// Vehicle data
export {
  getRelatedVehicles,
  getStaticVehicleParams,
} from "./vehicleData";

// Counts
export {
  formatCount,
} from "./counts";

// Content builders (from content.ts file)
export {
  buildH1,
  buildIntroParagraph,
  buildFitmentFactItems,
  buildRelatedLinks,
  buildFAQItems,
  buildFAQJsonLd,
  type FitmentFactItem,
  type RelatedLink,
  type FAQItem,
} from "./content";

// Metadata
export {
  buildProductListJsonLd,
} from "./metadata";

// URL/slug builders
export {
  buildCanonicalUrl,
} from "./slugs";

// Content generation (from content/ directory)
export {
  generatePageContent,
  shouldGenerateContent,
  getVehiclePersona,
  classifyVehicle,
  getFAQs,
  getFAQStructuredData,
  type PageContentInput,
  type GeneratedPageContent,
  type VehicleCategory,
  type VehiclePersona,
  type PageType,
} from "./content/index";
