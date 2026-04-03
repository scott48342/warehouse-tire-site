/**
 * SEO Content Generation Module
 * 
 * Provides scalable, vehicle-specific content generation for product pages.
 */

export {
  generatePageContent,
  shouldGenerateContent,
  pageContentGenerator,
  type PageContentInput,
  type GeneratedPageContent,
  type HeroBlock,
  type FitmentBlock,
  type StyleBlock,
  type PackageBlock,
  type FAQBlock,
  type InternalLinksBlock,
  type FitmentData,
} from "./pageContentGenerator";

export {
  getVehiclePersona,
  classifyVehicle,
  vehiclePersonas,
  type VehicleCategory,
  type VehiclePersona,
} from "./vehiclePersonas";

export {
  getHeroIntro,
  getFitmentSentence,
  getStyleRecommendation,
  sentenceBanks,
  type PageType,
  type SentenceContext,
} from "./sentenceBanks";

export {
  getFAQs,
  getFAQStructuredData,
  faqLibrary,
  type FAQ,
  type FAQContext,
} from "./faqLibrary";
