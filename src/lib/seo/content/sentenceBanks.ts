/**
 * Sentence Banks for Content Variation
 * 
 * Provides rotating sentence variations to ensure uniqueness across pages.
 * Uses deterministic selection based on vehicle/page hash for consistency.
 * 
 * @created 2026-04-03
 */

import type { VehicleCategory } from "./vehiclePersonas";

// ============================================================================
// Types
// ============================================================================

export type PageType = "wheels" | "tires" | "packages";

export interface SentenceContext {
  pageType: PageType;
  category: VehicleCategory;
  year: string;
  make: string;
  model: string;
  trim?: string;
  boltPattern?: string;
  oemDiameter?: number;
  productCount?: number;
  supportsStaggered?: boolean;
  supportsLifted?: boolean;
}

// ============================================================================
// Hash Function for Deterministic Selection
// ============================================================================

/**
 * Simple hash function for deterministic sentence selection
 * Same input always produces same output
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Select from array using deterministic hash
 */
function selectFromBank<T>(bank: T[], seed: string): T {
  const index = hashString(seed) % bank.length;
  return bank[index];
}

// ============================================================================
// Hero Intro Sentence Banks
// ============================================================================

const HERO_INTROS_WHEELS: Record<VehicleCategory, string[]> = {
  "truck": [
    "Find the perfect wheels to match your {year} {make} {model}'s rugged capability.",
    "Upgrade your {year} {make} {model} with wheels built for work and adventure.",
    "Your {year} {make} {model} deserves wheels that can handle anything you throw at it.",
    "Transform your {year} {make} {model} with wheels engineered for trucks that work hard.",
  ],
  "full-size-suv": [
    "Elevate your {year} {make} {model} with premium wheels that match its commanding presence.",
    "Find wheels that complement your {year} {make} {model}'s bold, confident style.",
    "Your {year} {make} {model} deserves wheels as impressive as its capability.",
    "Upgrade your {year} {make} {model} with wheels designed for full-size SUV excellence.",
  ],
  "mid-size-suv": [
    "Discover wheels that enhance your {year} {make} {model}'s versatile style.",
    "Find the perfect balance of style and function for your {year} {make} {model}.",
    "Upgrade your {year} {make} {model} with wheels that match your active lifestyle.",
    "Your {year} {make} {model} deserves wheels that look great anywhere you go.",
  ],
  "compact-suv": [
    "Find stylish wheels that match your {year} {make} {model}'s modern design.",
    "Upgrade your {year} {make} {model} with wheels that turn heads.",
    "Discover wheels perfect for your {year} {make} {model}'s urban adventures.",
    "Your {year} {make} {model} deserves wheels as versatile as you are.",
  ],
  "off-road": [
    "Conquer any terrain with wheels built for your {year} {make} {model}.",
    "Your {year} {make} {model} was made for adventure—get wheels to match.",
    "Find trail-ready wheels engineered for your {year} {make} {model}.",
    "Upgrade your {year} {make} {model} with wheels that can handle the toughest trails.",
  ],
  "performance": [
    "Unlock your {year} {make} {model}'s full potential with performance-focused wheels.",
    "Find lightweight wheels that enhance your {year} {make} {model}'s handling.",
    "Your {year} {make} {model} deserves wheels engineered for performance.",
    "Upgrade your {year} {make} {model} with wheels that mean business.",
  ],
  "muscle": [
    "Give your {year} {make} {model} the aggressive stance it deserves.",
    "Find wheels that honor your {year} {make} {model}'s muscle car heritage.",
    "Your {year} {make} {model} deserves wheels as bold as its personality.",
    "Upgrade your {year} {make} {model} with wheels that demand attention.",
  ],
  "luxury": [
    "Elevate your {year} {make} {model} with wheels befitting its premium status.",
    "Find refined wheels that complement your {year} {make} {model}'s sophistication.",
    "Your {year} {make} {model} deserves wheels that match its elegant design.",
    "Discover premium wheels for your distinguished {year} {make} {model}.",
  ],
  "sedan": [
    "Find wheels that transform your {year} {make} {model}'s everyday style.",
    "Upgrade your {year} {make} {model} with wheels that stand out from the crowd.",
    "Your {year} {make} {model} deserves a fresh look with new wheels.",
    "Discover stylish wheels perfect for your {year} {make} {model}.",
  ],
  "sports-car": [
    "Maximize your {year} {make} {model}'s performance with track-ready wheels.",
    "Find lightweight wheels that sharpen your {year} {make} {model}'s reflexes.",
    "Your {year} {make} {model} deserves wheels built for speed and precision.",
    "Upgrade your {year} {make} {model} with wheels engineered for drivers.",
  ],
  "electric": [
    "Find efficient wheels designed for your {year} {make} {model}'s EV platform.",
    "Optimize your {year} {make} {model}'s range with aerodynamic wheels.",
    "Your {year} {make} {model} deserves wheels that maximize efficiency.",
    "Discover wheels engineered for electric vehicle performance.",
  ],
  "van": [
    "Find durable wheels built for your {year} {make} {model}'s daily demands.",
    "Upgrade your {year} {make} {model} with wheels that work as hard as you do.",
    "Your {year} {make} {model} deserves reliable wheels for every journey.",
    "Discover wheels designed for versatility and style.",
  ],
  "classic": [
    "Find period-correct wheels that honor your {year} {make} {model}'s heritage.",
    "Restore your {year} {make} {model} with wheels that capture its era.",
    "Your classic {make} {model} deserves wheels that tell its story.",
    "Discover timeless wheel designs for your vintage {make} {model}.",
  ],
};

const HERO_INTROS_TIRES: Record<VehicleCategory, string[]> = {
  "truck": [
    "Get the grip and durability your {year} {make} {model} needs for work and play.",
    "Find tires built to handle everything your {year} {make} {model} can throw at them.",
    "Your {year} {make} {model} deserves tires as capable as its powertrain.",
    "Upgrade your {year} {make} {model} with tires engineered for trucks.",
  ],
  "full-size-suv": [
    "Find premium tires that deliver the comfort and capability your {year} {make} {model} deserves.",
    "Your {year} {make} {model} needs tires that match its refined power.",
    "Discover tires built for your {year} {make} {model}'s commanding performance.",
    "Upgrade your {year} {make} {model} with tires designed for full-size SUV excellence.",
  ],
  "mid-size-suv": [
    "Find versatile tires perfect for your {year} {make} {model}'s active lifestyle.",
    "Your {year} {make} {model} deserves tires that handle every road with confidence.",
    "Discover tires that balance comfort and capability for your {year} {make} {model}.",
    "Upgrade your {year} {make} {model} with tires built for real-world performance.",
  ],
  "compact-suv": [
    "Find efficient tires that enhance your {year} {make} {model}'s daily drive.",
    "Your {year} {make} {model} deserves tires that maximize comfort and efficiency.",
    "Discover all-season tires perfect for your {year} {make} {model}.",
    "Upgrade your {year} {make} {model} with tires built for urban adventures.",
  ],
  "off-road": [
    "Conquer any terrain with tires built for your {year} {make} {model}.",
    "Your {year} {make} {model} needs tires as adventurous as you are.",
    "Find trail-rated tires engineered for your {year} {make} {model}.",
    "Upgrade your {year} {make} {model} with tires that fear no trail.",
  ],
  "performance": [
    "Unlock maximum grip for your {year} {make} {model} with performance tires.",
    "Your {year} {make} {model} deserves tires that can keep up with its power.",
    "Find tires that sharpen your {year} {make} {model}'s handling response.",
    "Upgrade your {year} {make} {model} with tires engineered for drivers.",
  ],
  "muscle": [
    "Put your {year} {make} {model}'s power to the pavement with the right tires.",
    "Your {year} {make} {model} needs tires that can handle its muscle.",
    "Find tires that give your {year} {make} {model} the grip it deserves.",
    "Upgrade your {year} {make} {model} with tires built for performance.",
  ],
  "luxury": [
    "Find premium tires that complement your {year} {make} {model}'s refined ride.",
    "Your {year} {make} {model} deserves tires as sophisticated as its engineering.",
    "Discover touring tires perfect for your {year} {make} {model}'s luxury experience.",
    "Upgrade your {year} {make} {model} with tires that prioritize comfort.",
  ],
  "sedan": [
    "Find reliable tires that enhance your {year} {make} {model}'s daily commute.",
    "Your {year} {make} {model} deserves tires built for real-world performance.",
    "Discover all-season tires perfect for your {year} {make} {model}.",
    "Upgrade your {year} {make} {model} with tires that deliver confidence.",
  ],
  "sports-car": [
    "Maximize grip and control for your {year} {make} {model} with track-ready tires.",
    "Your {year} {make} {model} deserves tires engineered for precision.",
    "Find summer tires that unleash your {year} {make} {model}'s full potential.",
    "Upgrade your {year} {make} {model} with tires built for enthusiasts.",
  ],
  "electric": [
    "Find EV-optimized tires designed for your {year} {make} {model}.",
    "Your {year} {make} {model} deserves tires that maximize range and performance.",
    "Discover low rolling resistance tires for your {year} {make} {model}.",
    "Upgrade your {year} {make} {model} with tires engineered for electric vehicles.",
  ],
  "van": [
    "Find load-rated tires built for your {year} {make} {model}'s demands.",
    "Your {year} {make} {model} needs tires that work as hard as you do.",
    "Discover durable tires perfect for your {year} {make} {model}.",
    "Upgrade your {year} {make} {model} with tires designed for reliability.",
  ],
  "classic": [
    "Find period-correct tires that complement your {year} {make} {model}.",
    "Your classic {make} {model} deserves tires that honor its heritage.",
    "Discover tires that capture your {year} {make} {model}'s era.",
    "Upgrade your vintage {make} {model} with authentic tire styles.",
  ],
};

const HERO_INTROS_PACKAGES: Record<VehicleCategory, string[]> = {
  "truck": [
    "Get a complete wheel and tire package built for your {year} {make} {model}.",
    "Transform your {year} {make} {model} with a matched wheel and tire setup.",
    "Everything your {year} {make} {model} needs in one complete package.",
    "Upgrade your {year} {make} {model} the smart way—wheels, tires, and hardware.",
  ],
  "full-size-suv": [
    "Complete your {year} {make} {model} upgrade with a matched wheel and tire package.",
    "Get the perfect wheel and tire combination for your {year} {make} {model}.",
    "Transform your {year} {make} {model} with a complete package deal.",
    "Everything you need for your {year} {make} {model}—wheels, tires, and more.",
  ],
  "mid-size-suv": [
    "Upgrade your {year} {make} {model} with a complete wheel and tire package.",
    "Get matched wheels and tires perfect for your {year} {make} {model}.",
    "Transform your {year} {make} {model} with an all-in-one package.",
    "Complete your {year} {make} {model} upgrade the easy way.",
  ],
  "compact-suv": [
    "Find the perfect wheel and tire package for your {year} {make} {model}.",
    "Upgrade your {year} {make} {model} with a complete matched setup.",
    "Everything your {year} {make} {model} needs in one convenient package.",
    "Transform your {year} {make} {model} style with a wheel and tire package.",
  ],
  "off-road": [
    "Build the ultimate trail setup for your {year} {make} {model}.",
    "Get a complete off-road package for your {year} {make} {model}.",
    "Transform your {year} {make} {model} with a trail-ready wheel and tire package.",
    "Everything you need to take your {year} {make} {model} anywhere.",
  ],
  "performance": [
    "Build the ultimate performance setup for your {year} {make} {model}.",
    "Get a complete track-ready package for your {year} {make} {model}.",
    "Transform your {year} {make} {model} with a matched performance package.",
    "Wheels, tires, and hardware—everything your {year} {make} {model} needs.",
  ],
  "muscle": [
    "Complete your {year} {make} {model}'s look with a matched package.",
    "Get the aggressive stance your {year} {make} {model} deserves.",
    "Transform your {year} {make} {model} with a complete wheel and tire setup.",
    "Everything you need to make your {year} {make} {model} stand out.",
  ],
  "luxury": [
    "Elevate your {year} {make} {model} with a premium wheel and tire package.",
    "Get a refined wheel and tire combination for your {year} {make} {model}.",
    "Complete your {year} {make} {model} upgrade with a matched premium package.",
    "Everything your distinguished {year} {make} {model} needs.",
  ],
  "sedan": [
    "Upgrade your {year} {make} {model} with a complete wheel and tire package.",
    "Get matched wheels and tires perfect for your {year} {make} {model}.",
    "Transform your {year} {make} {model} style with one easy package.",
    "Complete your {year} {make} {model} upgrade the convenient way.",
  ],
  "sports-car": [
    "Build the ultimate setup for your {year} {make} {model}.",
    "Get a complete performance package for your {year} {make} {model}.",
    "Transform your {year} {make} {model} with matched performance wheels and tires.",
    "Everything you need to maximize your {year} {make} {model}'s potential.",
  ],
  "electric": [
    "Optimize your {year} {make} {model} with a complete EV wheel and tire package.",
    "Get an efficient wheel and tire combination for your {year} {make} {model}.",
    "Complete your {year} {make} {model} upgrade with an EV-optimized package.",
    "Everything your {year} {make} {model} needs for range and style.",
  ],
  "van": [
    "Upgrade your {year} {make} {model} with a complete durable package.",
    "Get reliable wheels and tires matched for your {year} {make} {model}.",
    "Everything your hard-working {year} {make} {model} needs.",
    "Complete your {year} {make} {model} upgrade with one convenient package.",
  ],
  "classic": [
    "Restore your {year} {make} {model} with a period-correct wheel and tire package.",
    "Get an authentic wheel and tire combination for your {year} {make} {model}.",
    "Complete your {year} {make} {model} restoration with matched components.",
    "Everything your classic {make} {model} needs to shine.",
  ],
};

// ============================================================================
// Fitment Block Sentence Banks
// ============================================================================

const FITMENT_SENTENCES = [
  "Your {year} {make} {model} uses a {boltPattern} bolt pattern with factory {oemDiameter}-inch wheels.",
  "Factory specs for the {year} {make} {model}: {boltPattern} bolt pattern, {oemDiameter}\" stock wheels.",
  "The {year} {make} {model} comes with {boltPattern} lug pattern and {oemDiameter}-inch OEM wheels.",
  "OEM fitment for your {year} {make} {model}: {boltPattern}, {oemDiameter}\" diameter.",
];

const FITMENT_SENTENCES_NO_OEM = [
  "We verify every wheel fits your {year} {make} {model} before shipping.",
  "All wheels shown are fitment-verified for the {year} {make} {model}.",
  "Every option is compatible with your {year} {make} {model}.",
  "Guaranteed fitment for your {year} {make} {model}—no guesswork needed.",
];

// ============================================================================
// Style/Recommendation Sentence Banks
// ============================================================================

const STYLE_RECOMMENDATIONS: Record<VehicleCategory, string[]> = {
  "truck": [
    "Popular choices include aggressive off-road designs and classic truck styles.",
    "Truck owners love bold black wheels and rugged all-terrain designs.",
    "Consider bigger wheels for a more commanding stance on the road.",
  ],
  "full-size-suv": [
    "Full-size SUV owners often choose bold chrome or black finishes.",
    "Popular upgrades include 22-inch wheels for a more imposing presence.",
    "Consider premium designs that match your SUV's commanding style.",
  ],
  "mid-size-suv": [
    "Sport-styled wheels are popular for mid-size SUV upgrades.",
    "Many owners choose all-terrain capable wheels for versatility.",
    "Consider upgrading to larger diameters for improved curb appeal.",
  ],
  "compact-suv": [
    "Modern spoke designs are popular for compact SUV upgrades.",
    "Many owners choose sport-styled wheels for a more dynamic look.",
    "Black and machined finishes are trending for compact SUVs.",
  ],
  "off-road": [
    "Beadlock-style wheels and aggressive designs are essential for trails.",
    "Consider wheels with higher load ratings for demanding off-road use.",
    "Method, Fuel, and KMC are popular choices for serious off-roaders.",
  ],
  "performance": [
    "Lightweight forged wheels can improve both handling and acceleration.",
    "Many enthusiasts choose track-focused designs for spirited driving.",
    "Consider staggered setups for improved handling balance.",
  ],
  "muscle": [
    "Classic 5-spoke and modern muscle designs honor heritage while adding style.",
    "Staggered fitments with wider rear wheels enhance the aggressive stance.",
    "Deep-dish and concave styles complement muscle car proportions.",
  ],
  "luxury": [
    "Multi-spoke and intricate designs complement luxury aesthetics.",
    "Many owners choose subtle upgrades that enhance without overwhelming.",
    "Premium finishes like polished and two-tone add sophistication.",
  ],
  "sedan": [
    "Sport-styled wheels add character without compromising comfort.",
    "Popular choices include 18-19 inch upgrades from factory sizes.",
    "Black and gunmetal finishes add subtle aggression to sedans.",
  ],
  "sports-car": [
    "Lightweight wheels are essential for maintaining sharp handling.",
    "Forged wheels offer the best strength-to-weight ratio for track use.",
    "Staggered setups optimize grip distribution for performance driving.",
  ],
  "electric": [
    "Aerodynamic wheel designs can improve range by reducing drag.",
    "Lightweight options help offset battery weight for better handling.",
    "EV-specific designs balance efficiency with modern styling.",
  ],
  "van": [
    "Load-rated wheels are essential for vehicles that haul frequently.",
    "Durable finishes resist the wear of daily commercial use.",
    "Many owners upgrade to stylish options that hide brake dust well.",
  ],
  "classic": [
    "Period-correct styles honor your vehicle's original design language.",
    "Pro-touring builds often use modern wheels with classic aesthetics.",
    "Vintage-inspired designs maintain authenticity while improving performance.",
  ],
};

// ============================================================================
// Main Export Functions
// ============================================================================

/**
 * Get hero intro sentence for page
 */
export function getHeroIntro(ctx: SentenceContext): string {
  const banks = ctx.pageType === "wheels" 
    ? HERO_INTROS_WHEELS 
    : ctx.pageType === "tires"
      ? HERO_INTROS_TIRES
      : HERO_INTROS_PACKAGES;
  
  const bank = banks[ctx.category] || banks["sedan"];
  const seed = `${ctx.pageType}:${ctx.year}:${ctx.make}:${ctx.model}`;
  const template = selectFromBank(bank, seed);
  
  return template
    .replace(/\{year\}/g, ctx.year)
    .replace(/\{make\}/g, ctx.make)
    .replace(/\{model\}/g, ctx.model)
    .replace(/\{trim\}/g, ctx.trim || "");
}

/**
 * Get fitment block sentence
 */
export function getFitmentSentence(ctx: SentenceContext): string {
  const hasFitmentData = ctx.boltPattern && ctx.oemDiameter;
  const bank = hasFitmentData ? FITMENT_SENTENCES : FITMENT_SENTENCES_NO_OEM;
  const seed = `fitment:${ctx.year}:${ctx.make}:${ctx.model}`;
  const template = selectFromBank(bank, seed);
  
  return template
    .replace(/\{year\}/g, ctx.year)
    .replace(/\{make\}/g, ctx.make)
    .replace(/\{model\}/g, ctx.model)
    .replace(/\{boltPattern\}/g, ctx.boltPattern || "")
    .replace(/\{oemDiameter\}/g, String(ctx.oemDiameter || ""));
}

/**
 * Get style recommendation sentence
 */
export function getStyleRecommendation(ctx: SentenceContext): string {
  const bank = STYLE_RECOMMENDATIONS[ctx.category] || STYLE_RECOMMENDATIONS["sedan"];
  const seed = `style:${ctx.year}:${ctx.make}:${ctx.model}`;
  return selectFromBank(bank, seed);
}

// ============================================================================
// Exports
// ============================================================================

export const sentenceBanks = {
  getHeroIntro,
  getFitmentSentence,
  getStyleRecommendation,
  selectFromBank,
};

export default sentenceBanks;
