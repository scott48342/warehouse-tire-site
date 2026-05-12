/**
 * Tire Brand Logo URLs
 * Uses manufacturer official logos where available
 */

// Logo URLs from various CDNs and manufacturer sites
export const BRAND_LOGOS: Record<string, string> = {
  // Major tire brands
  michelin: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Michelin_logo.svg/200px-Michelin_logo.svg.png",
  goodyear: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Goodyear_Tire_%26_Rubber_Company_logo.svg/200px-Goodyear_Tire_%26_Rubber_Company_logo.svg.png",
  bridgestone: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Bridgestone_logo.svg/200px-Bridgestone_logo.svg.png",
  continental: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Continental_AG_logo.svg/200px-Continental_AG_logo.svg.png",
  pirelli: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Pirelli_logo.svg/200px-Pirelli_logo.svg.png",
  cooper: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Cooper_Tire_%26_Rubber_Company_Logo.svg/200px-Cooper_Tire_%26_Rubber_Company_Logo.svg.png",
  toyo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Toyo_Tires_logo.svg/200px-Toyo_Tires_logo.svg.png",
  yokohama: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Yokohama_Rubber_Company_Logo.svg/200px-Yokohama_Rubber_Company_Logo.svg.png",
  general: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/General_Tire_Logo.svg/200px-General_Tire_Logo.svg.png",
  firestone: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Firestone_Tire_and_Rubber_Company_logo.svg/200px-Firestone_Tire_and_Rubber_Company_logo.svg.png",
  bfgoodrich: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/BFGoodrich_logo.svg/200px-BFGoodrich_logo.svg.png",
  hankook: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Hankook_logo.svg/200px-Hankook_logo.svg.png",
  falken: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Falken_Tire_logo.svg/200px-Falken_Tire_logo.svg.png",
  nitto: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Nitto_Tire_logo.svg/200px-Nitto_Tire_logo.svg.png",
  kumho: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Kumho_Tire_logo.svg/200px-Kumho_Tire_logo.svg.png",
  dunlop: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Dunlop_Tyres_logo.svg/200px-Dunlop_Tyres_logo.svg.png",
  nexen: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Nexen_Tire_logo.svg/200px-Nexen_Tire_logo.svg.png",
  uniroyal: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Uniroyal_logo.svg/200px-Uniroyal_logo.svg.png",
};

/**
 * Get logo URL for a brand name (case-insensitive)
 */
export function getBrandLogoUrl(brand: string): string | null {
  const key = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
  return BRAND_LOGOS[key] || null;
}

/**
 * Get brand logo with fallback placeholder
 */
export function getBrandLogoWithFallback(brand: string): string {
  const logo = getBrandLogoUrl(brand);
  if (logo) return logo;
  
  // Generate a simple text-based placeholder using UI Avatars
  const initials = brand.slice(0, 2).toUpperCase();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(brand)}&background=random&color=fff&size=128&bold=true`;
}
