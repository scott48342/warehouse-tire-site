export {
  getIndexingDecision,
  shouldNoIndex,
  getRobotsContent,
  buildPageIndexingData,
  seoIndexing,
  type PageIndexingData,
  type IndexingDecision,
} from "./indexingStrategy";

// Content generation
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
} from "./content";
