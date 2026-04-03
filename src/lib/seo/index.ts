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
