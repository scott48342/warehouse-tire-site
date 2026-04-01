/**
 * AI Generation Prompts for Vehicle Visualizer Assets
 * 
 * These prompts are optimized for DALL-E 3 to produce consistent,
 * overlay-friendly vehicle images for wheel visualization.
 */

export type VehicleCategory = "muscle" | "truck" | "suv" | "sedan" | "sports" | "classic" | "compact";

interface PromptParams {
  year: number;
  make: string;
  model: string;
  category: VehicleCategory;
}

/**
 * Base requirements for all vehicle images:
 * - Perfect side profile (90 degrees)
 * - White seamless studio background
 * - Vehicle centered in frame
 * - Full body visible from bumper to bumper
 * - Dark/black empty wheel wells (no wheels)
 * - Wheel openings clearly visible and unobstructed
 * - Clean, flat studio lighting
 */
const BASE_REQUIREMENTS = `
perfect side profile view at exactly 90 degrees,
white seamless studio background,
vehicle centered in frame,
full body visible from front bumper to rear bumper,
dark black empty wheel wells with absolutely no wheels or tires visible,
wheel well openings clearly visible and unobstructed by any body panels,
clean flat professional automotive studio lighting,
no reflections on ground,
no shadows on background,
high resolution product photography style
`.trim().replace(/\n/g, " ");

/**
 * Category-specific style additions
 */
const CATEGORY_STYLES: Record<VehicleCategory, string> = {
  muscle: "dramatic muscle car stance, aggressive fender flares if applicable, classic American muscle aesthetic",
  truck: "proper truck proportions, bed fully visible, rugged stance",
  suv: "proper SUV proportions, higher ground clearance stance, all wheel wells clearly visible",
  sedan: "elegant sedan proportions, balanced stance",
  sports: "low aggressive sports car stance, aerodynamic profile",
  classic: "period-correct classic car styling, vintage aesthetic",
  compact: "proper compact car proportions, urban-friendly stance",
};

/**
 * Build the full generation prompt for a vehicle
 */
export function buildGenerationPrompt(params: PromptParams): string {
  const { year, make, model, category } = params;
  const categoryStyle = CATEGORY_STYLES[category] || CATEGORY_STYLES.sedan;

  return `Professional studio photograph of a ${year} ${make} ${model}, ${BASE_REQUIREMENTS}, ${categoryStyle}`;
}

/**
 * Build a slug from vehicle info
 */
export function buildSlug(year: number, make: string, model: string): string {
  return `${year}-${make}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Build display name from vehicle info
 */
export function buildDisplayName(year: number, make: string, model: string): string {
  return `${year} ${make} ${model}`;
}

/**
 * Default wheel position estimates by category
 * These are starting points - actual detection will refine them
 */
export const DEFAULT_POSITIONS: Record<VehicleCategory, { front: { top: number; left: number; size: number }; rear: { top: number; left: number; size: number } }> = {
  muscle: {
    front: { top: 72, left: 78, size: 95 },
    rear: { top: 72, left: 22, size: 95 },
  },
  truck: {
    front: { top: 68, left: 82, size: 100 },
    rear: { top: 68, left: 18, size: 100 },
  },
  suv: {
    front: { top: 70, left: 80, size: 90 },
    rear: { top: 70, left: 20, size: 90 },
  },
  sedan: {
    front: { top: 74, left: 76, size: 85 },
    rear: { top: 74, left: 24, size: 85 },
  },
  sports: {
    front: { top: 70, left: 75, size: 90 },
    rear: { top: 70, left: 25, size: 90 },
  },
  classic: {
    front: { top: 72, left: 78, size: 90 },
    rear: { top: 72, left: 22, size: 90 },
  },
  compact: {
    front: { top: 74, left: 74, size: 80 },
    rear: { top: 74, left: 26, size: 80 },
  },
};
