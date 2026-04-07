/**
 * Wheel Finish Normalization
 * 
 * Converts raw WheelPros finish descriptions into display-friendly,
 * filterable values while preserving distinct finishes.
 * 
 * Uses fancy_finish_desc as primary source (has full detail),
 * falls back to abbreviated_finish_desc if needed.
 */

// ============================================================================
// FINISH CATEGORIES (for sorting and grouping)
// ============================================================================

export const FINISH_SORT_ORDER: Record<string, number> = {
  // Black family (most common for trucks/off-road)
  "Matte Black": 1,
  "Gloss Black": 2,
  "Satin Black": 3,
  "Black / Machined": 4,
  "Black / Milled": 5,
  "Blackout": 6,
  "Black": 7,
  
  // Chrome/Polished
  "Chrome": 10,
  "Polished": 11,
  "Chrome Plated": 12,
  
  // Bronze family
  "Matte Bronze": 20,
  "Gloss Bronze": 21,
  "Bronze": 22,
  "Burnt Bronze": 23,
  
  // Gunmetal family
  "Matte Gunmetal": 30,
  "Gloss Gunmetal": 31,
  "Gunmetal": 32,
  
  // Gray family
  "Matte Gray": 40,
  "Anthracite": 41,
  "Gray": 42,
  
  // Silver family
  "Silver": 50,
  "Hyper Silver": 51,
  "Silver / Machined": 52,
  
  // Other colors
  "Red": 60,
  "Blue": 61,
  "White": 62,
  "Gold": 63,
  "Green": 64,
  "Orange": 65,
  "Copper": 66,
  
  // Special
  "Machined": 70,
  "Brushed": 71,
  "Custom": 80,
  "Other": 99,
};

// ============================================================================
// NORMALIZATION RULES
// ============================================================================

/**
 * Normalize a finish description to a display-friendly value.
 * Preserves distinct finishes while grouping similar variations.
 * 
 * @param fancyFinish - fancy_finish_desc from WheelPros
 * @param abbreviatedFinish - abbreviated_finish_desc (fallback)
 * @returns Normalized display finish
 */
export function normalizeFinish(
  fancyFinish: string | null | undefined,
  abbreviatedFinish: string | null | undefined
): string {
  // Prefer fancy_finish_desc, fall back to abbreviated
  const raw = (fancyFinish || abbreviatedFinish || "").toUpperCase().trim();
  
  if (!raw) return "Other";
  
  // ========== BLACK FAMILY ==========
  
  // Matte Black (with variations)
  if (/^MATTE\s*BLACK(?:\s|$)/i.test(raw) && !raw.includes("MILLED") && !raw.includes("MACHINED")) {
    return "Matte Black";
  }
  
  // Satin Black (with variations)
  if (/^SATIN\s*BLACK(?:\s|$)/i.test(raw) && !raw.includes("MILLED") && !raw.includes("MACHINED")) {
    return "Satin Black";
  }
  
  // Gloss Black (plain, no machining/milling)
  if (/^GLOSS\s*BLACK$/i.test(raw)) {
    return "Gloss Black";
  }
  
  // Black with Machined/Milled face - these are distinct!
  if (raw.includes("BLACK") && (raw.includes("MACH") || raw.includes("MILL"))) {
    return "Black / Machined";
  }
  
  // Blackout
  if (raw.includes("BLACKOUT") || raw === "BLK-OUT") {
    return "Blackout";
  }
  
  // Plain black (after other checks)
  if (raw === "BLACK" || raw === "BLK" || /^GLOSS\s*BLACK/i.test(raw) || /^SATIN\s*BLACK/i.test(raw) || /^MATTE\s*BLACK/i.test(raw)) {
    // Gloss Black with anything else
    if (/^GLOSS\s*BLACK/i.test(raw)) return "Gloss Black";
    // Satin Black with anything else  
    if (/^SATIN\s*BLACK/i.test(raw)) return "Satin Black";
    // Matte Black with anything else
    if (/^MATTE\s*BLACK/i.test(raw)) return "Matte Black";
    return "Black";
  }
  
  // ========== CHROME/POLISHED ==========
  
  if (raw.includes("CHROME PLATED") || raw === "CHR-PLATED") {
    return "Chrome Plated";
  }
  
  if (raw.includes("CHROME") || raw === "CHR") {
    return "Chrome";
  }
  
  if (raw.includes("POLISHED") || raw.includes("POLISH") || raw === "HL-POLISH") {
    return "Polished";
  }
  
  // ========== BRONZE FAMILY ==========
  
  if (/MATTE\s*BRONZE/i.test(raw)) {
    return "Matte Bronze";
  }
  
  if (/GLOSS\s*BRONZE/i.test(raw)) {
    return "Gloss Bronze";
  }
  
  if (raw.includes("BURNT BRONZE")) {
    return "Burnt Bronze";
  }
  
  if (raw.includes("BRONZE") || raw === "BRNZ") {
    return "Bronze";
  }
  
  // ========== GUNMETAL FAMILY ==========
  
  if (/MATTE\s*GUNMETAL/i.test(raw) || raw.includes("MT-GNMTL")) {
    return "Matte Gunmetal";
  }
  
  if (/GLOSS\s*GUNMETAL/i.test(raw)) {
    return "Gloss Gunmetal";
  }
  
  if (raw.includes("GUNMETAL") || raw.includes("GUN METAL") || raw.includes("GNMTL")) {
    return "Gunmetal";
  }
  
  // ========== GRAY FAMILY ==========
  
  if (raw.includes("ANTHRACITE")) {
    return "Anthracite";
  }
  
  if (/MATTE\s*GRAY/i.test(raw) || /MATTE\s*GREY/i.test(raw)) {
    return "Matte Gray";
  }
  
  if (raw.includes("GRAY") || raw.includes("GREY") || raw === "GRY") {
    return "Gray";
  }
  
  // ========== SILVER FAMILY ==========
  
  if (raw.includes("HYPER SILVER")) {
    return "Hyper Silver";
  }
  
  if (raw.includes("SILVER") && (raw.includes("MACH") || raw.includes("FACE"))) {
    return "Silver / Machined";
  }
  
  if (raw.includes("SILVER") || raw === "SLV") {
    return "Silver";
  }
  
  // ========== OTHER COLORS ==========
  
  if (raw.includes("RED") || raw.includes("CANDY RED")) {
    return "Red";
  }
  
  if (raw.includes("BLUE") || raw.includes("METALLIC BLUE")) {
    return "Blue";
  }
  
  if (raw.includes("WHITE")) {
    return "White";
  }
  
  if (raw.includes("GOLD")) {
    return "Gold";
  }
  
  if (raw.includes("GREEN")) {
    return "Green";
  }
  
  if (raw.includes("ORANGE")) {
    return "Orange";
  }
  
  if (raw.includes("COPPER")) {
    return "Copper";
  }
  
  // ========== SPECIAL ==========
  
  if (raw.includes("BRUSHED")) {
    return "Brushed";
  }
  
  if (raw.includes("MACHINED") || raw === "MACH") {
    return "Machined";
  }
  
  if (raw.includes("CUSTOM")) {
    return "Custom";
  }
  
  // ========== FALLBACK ==========
  
  // If abbreviated has a value but fancy didn't match, use abbreviated
  if (abbreviatedFinish && abbreviatedFinish !== raw) {
    const abbr = abbreviatedFinish.toUpperCase().trim();
    if (abbr === "BLACK") return "Black";
    if (abbr === "CHROME") return "Chrome";
    if (abbr === "POLISHED" || abbr === "POLISH") return "Polished";
    if (abbr === "BRONZE") return "Bronze";
    if (abbr === "GUN METAL" || abbr === "GUNMETAL") return "Gunmetal";
    if (abbr === "GRAY") return "Gray";
    if (abbr === "SILVER") return "Silver";
    if (abbr === "MACHINED") return "Machined";
    if (abbr === "BRUSHED") return "Brushed";
    if (abbr === "RED") return "Red";
    if (abbr === "BLUE") return "Blue";
    if (abbr === "WHITE") return "White";
    if (abbr === "GOLD") return "Gold";
    if (abbr === "GREEN") return "Green";
    // Use the abbreviated value as-is but title-cased
    return titleCase(abbr);
  }
  
  return "Other";
}

/**
 * Convert string to Title Case
 */
function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Sort finish options by logical order (common first)
 */
export function sortFinishes(finishes: Array<{ value: string; count?: number }>): Array<{ value: string; count?: number }> {
  return finishes.sort((a, b) => {
    const orderA = FINISH_SORT_ORDER[a.value] ?? 98;
    const orderB = FINISH_SORT_ORDER[b.value] ?? 98;
    if (orderA !== orderB) return orderA - orderB;
    // Same order priority: sort by count (desc)
    return (b.count ?? 0) - (a.count ?? 0);
  });
}
