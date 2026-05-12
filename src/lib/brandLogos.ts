/**
 * Tire Brand Logo/Badge utilities
 * Uses brand colors for nice looking badges
 */

// Brand colors for styled badges
const BRAND_COLORS: Record<string, { bg: string; text: string }> = {
  michelin: { bg: "0033A0", text: "FFD100" },  // Blue + Yellow
  goodyear: { bg: "004B8D", text: "FFFFFF" },  // Blue
  bridgestone: { bg: "E60012", text: "FFFFFF" }, // Red
  continental: { bg: "F7941D", text: "000000" }, // Orange
  pirelli: { bg: "000000", text: "FFD100" },   // Black + Yellow
  cooper: { bg: "000000", text: "FFFFFF" },    // Black
  toyo: { bg: "E60012", text: "FFFFFF" },      // Red
  yokohama: { bg: "ED1C24", text: "FFFFFF" },  // Red
  general: { bg: "000000", text: "FFFFFF" },   // Black
  firestone: { bg: "CF202E", text: "FFFFFF" }, // Red
  bfgoodrich: { bg: "E31837", text: "FFFFFF" }, // Red
  hankook: { bg: "FF6600", text: "FFFFFF" },   // Orange
  falken: { bg: "003DA5", text: "FFFFFF" },    // Blue
  nitto: { bg: "000000", text: "FF0000" },     // Black + Red
  kumho: { bg: "E4002B", text: "FFFFFF" },     // Red
  dunlop: { bg: "FFD100", text: "000000" },    // Yellow
  nexen: { bg: "E30613", text: "FFFFFF" },     // Red
  uniroyal: { bg: "E4002B", text: "FFFFFF" },  // Red
  mastercraft: { bg: "1C1C1C", text: "FFFFFF" },
  sumitomo: { bg: "003366", text: "FFFFFF" },
  kenda: { bg: "E31937", text: "FFFFFF" },
  maxxis: { bg: "004B87", text: "FFFFFF" },
  achilles: { bg: "1B1B1B", text: "FFFFFF" },
  sailun: { bg: "E30613", text: "FFFFFF" },
  westlake: { bg: "004B8D", text: "FFFFFF" },
  kelly: { bg: "00843D", text: "FFFFFF" },     // Green
  fuzion: { bg: "5C068C", text: "FFFFFF" },    // Purple
  atturo: { bg: "E4002B", text: "FFFFFF" },
  milestar: { bg: "003DA5", text: "FFFFFF" },
  lexani: { bg: "C8A85C", text: "000000" },    // Gold
  lionhart: { bg: "C9A227", text: "000000" },  // Gold
};

// Default colors for unknown brands
const DEFAULT_COLORS = { bg: "525252", text: "FFFFFF" };

/**
 * Get brand colors (background and text)
 */
export function getBrandColors(brand: string): { bg: string; text: string } {
  const key = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
  return BRAND_COLORS[key] || DEFAULT_COLORS;
}

/**
 * Get logo URL for a brand name
 * Returns null - we use text badges instead
 */
export function getBrandLogoUrl(brand: string): string | null {
  return null; // We use styled text badges
}

/**
 * Get brand badge URL using UI Avatars with brand colors
 */
export function getBrandLogoWithFallback(brand: string): string {
  const colors = getBrandColors(brand);
  // Use first 1-2 letters as initials
  const initials = brand.replace(/[^A-Za-z0-9 ]/g, '').split(' ')[0].slice(0, 2).toUpperCase();
  
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${colors.bg}&color=${colors.text}&size=128&bold=true&font-size=0.5&format=svg`;
}

/**
 * Check if we have brand colors defined
 */
export function hasBrandLogo(brand: string): boolean {
  const key = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
  return key in BRAND_COLORS;
}
