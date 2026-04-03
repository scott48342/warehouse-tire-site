/**
 * Wheel Listing Deduplication Utility
 * 
 * Groups wheels by size/spec, merging finishes into a single card.
 * Wheels with different sizes remain as separate cards.
 * 
 * Grouping Key:
 * - brand (normalized)
 * - style/model (normalized)
 * - diameter
 * - width
 * - bolt pattern
 * - offset
 * - center bore
 * 
 * @created 2026-04-03
 */

// ============================================================================
// Types
// ============================================================================

export interface WheelVariantInput {
  sku?: string;
  brand?: string;
  brandCode?: string;
  model?: string;
  finish?: string;
  diameter?: string;
  width?: string;
  offset?: string;
  boltPattern?: string;
  centerbore?: string;
  imageUrl?: string;
  price?: number;
  stockQty?: number;
  inventoryType?: string;
  styleKey?: string;
  fitmentClass?: "surefit" | "specfit" | "extended";
  pair?: {
    staggered: boolean;
    front: { sku: string; diameter?: string; width?: string; offset?: string };
    rear?: { sku: string; diameter?: string; width?: string; offset?: string };
  };
}

export interface FinishOption {
  finish: string;
  sku: string;
  imageUrl?: string;
  price?: number;
  stockQty?: number;
  inventoryType?: string;
  pair?: WheelVariantInput["pair"];
}

export interface GroupedWheel {
  // Representative wheel data
  sku: string;
  brand?: string;
  brandCode?: string;
  model?: string;
  diameter?: string;
  width?: string;
  offset?: string;
  boltPattern?: string;
  centerbore?: string;
  imageUrl?: string;
  price?: number;
  stockQty?: number;
  inventoryType?: string;
  styleKey?: string;
  fitmentClass?: "surefit" | "specfit" | "extended";
  pair?: WheelVariantInput["pair"];
  
  // Selected finish (for display)
  selectedFinish?: string;
  
  // All finish options for this size/spec
  finishOptions: FinishOption[];
  
  // Legacy field for backward compat
  finishThumbs?: FinishOption[];
  
  // Count of variants merged
  variantCount: number;
}

// ============================================================================
// Normalization Helpers
// ============================================================================

/**
 * Normalize string for grouping key (lowercase, trim, collapse whitespace)
 */
function normalizeString(s: string | undefined | null): string {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Normalize numeric value (parse to number, round to 1 decimal)
 */
function normalizeNumeric(s: string | undefined | null): string {
  const n = parseFloat(String(s || "").trim());
  if (!Number.isFinite(n)) return "";
  // Round to 1 decimal for consistent grouping (17.0, 17.5, etc.)
  return n.toFixed(1);
}

/**
 * Normalize bolt pattern (e.g., "5x114.3" → "5x114.3")
 */
function normalizeBoltPattern(s: string | undefined | null): string {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/×/g, "x"); // Replace multiplication sign with x
}

/**
 * Normalize finish label for deduplication
 * Near-identical finishes should merge (e.g., "Matte Black" vs "MATTE BLACK" vs "matte black")
 */
function normalizeFinish(s: string | undefined | null): string {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    // Common abbreviations
    .replace(/\bblk\b/g, "black")
    .replace(/\bwht\b/g, "white")
    .replace(/\bgry\b/g, "gray")
    .replace(/\bgrey\b/g, "gray")
    .replace(/\bmach\b/g, "machined")
    .replace(/\bpol\b/g, "polished")
    .replace(/\bchr\b/g, "chrome");
}

// ============================================================================
// Grouping Key Generation
// ============================================================================

/**
 * Generate grouping key from wheel specs
 * Same key = merge into one card with finish options
 * Different key = separate cards
 */
function generateGroupingKey(wheel: WheelVariantInput): string {
  const parts = [
    normalizeString(wheel.brandCode || wheel.brand),
    normalizeString(wheel.model),
    normalizeNumeric(wheel.diameter),
    normalizeNumeric(wheel.width),
    normalizeBoltPattern(wheel.boltPattern),
    normalizeNumeric(wheel.offset),
    normalizeNumeric(wheel.centerbore),
  ];
  
  return parts.join("|");
}

// ============================================================================
// Finish Selection Priority
// ============================================================================

/**
 * Score a finish option for default selection
 * Higher score = better default choice
 * 
 * Priority:
 * 1. Has image (most important)
 * 2. In stock (stockQty > 0 or inventoryType = ST/BW/NW)
 * 3. Lowest price
 */
function scoreFinishOption(opt: FinishOption): number {
  let score = 0;
  
  // +1000 if has image
  if (opt.imageUrl && opt.imageUrl.trim()) {
    score += 1000;
  }
  
  // +500 if in stock
  const inStockTypes = ["ST", "BW", "NW"];
  if (opt.stockQty && opt.stockQty > 0) {
    score += 500;
  } else if (opt.inventoryType && inStockTypes.includes(opt.inventoryType.toUpperCase())) {
    score += 500;
  }
  
  // +0-100 based on price (lower is better)
  // Max price bonus at $0, decreasing to 0 at $2000+
  if (typeof opt.price === "number" && opt.price > 0) {
    const priceBonus = Math.max(0, 100 - (opt.price / 20));
    score += priceBonus;
  }
  
  return score;
}

/**
 * Select the best default finish from options
 */
function selectDefaultFinish(options: FinishOption[]): FinishOption | undefined {
  if (!options.length) return undefined;
  
  return options.reduce((best, current) => {
    const bestScore = scoreFinishOption(best);
    const currentScore = scoreFinishOption(current);
    return currentScore > bestScore ? current : best;
  });
}

// ============================================================================
// Main Grouping Function
// ============================================================================

/**
 * Group wheels by size/spec, merging finishes
 * 
 * @param wheels - Array of wheel variants to group
 * @returns Array of grouped wheels (one per unique size/spec)
 */
export function groupWheelsBySpec(wheels: WheelVariantInput[]): GroupedWheel[] {
  const groups = new Map<string, WheelVariantInput[]>();
  const ungrouped: WheelVariantInput[] = [];
  
  // Step 1: Bucket wheels by grouping key
  for (const wheel of wheels) {
    if (!wheel.sku) {
      ungrouped.push(wheel);
      continue;
    }
    
    const key = generateGroupingKey(wheel);
    
    // If key is mostly empty, don't group (missing critical data)
    const keyParts = key.split("|");
    const hasEnoughData = keyParts.filter(p => p.trim()).length >= 3; // Need at least brand + model + diameter
    
    if (!hasEnoughData) {
      ungrouped.push(wheel);
      continue;
    }
    
    const bucket = groups.get(key) || [];
    bucket.push(wheel);
    groups.set(key, bucket);
  }
  
  // Step 2: Convert buckets to grouped wheels
  const result: GroupedWheel[] = [];
  
  for (const [key, variants] of groups.entries()) {
    // Build finish options, deduplicating by normalized finish name
    const finishMap = new Map<string, FinishOption>();
    
    for (const v of variants) {
      const normalizedFinish = normalizeFinish(v.finish);
      const displayFinish = String(v.finish || "").trim();
      
      if (!displayFinish) continue;
      
      // Keep the first occurrence of each normalized finish (or update if better)
      const existing = finishMap.get(normalizedFinish);
      
      if (!existing) {
        finishMap.set(normalizedFinish, {
          finish: displayFinish,
          sku: v.sku || "",
          imageUrl: v.imageUrl,
          price: v.price,
          stockQty: v.stockQty,
          inventoryType: v.inventoryType,
          pair: v.pair,
        });
      } else {
        // Prefer variant with image
        if (!existing.imageUrl && v.imageUrl) {
          finishMap.set(normalizedFinish, {
            ...existing,
            imageUrl: v.imageUrl,
            sku: v.sku || existing.sku,
          });
        }
      }
    }
    
    const finishOptions = Array.from(finishMap.values());
    
    // Select best default finish
    const defaultFinish = selectDefaultFinish(finishOptions);
    
    // Find representative variant (prefer one matching default finish, or first with image)
    const representative = defaultFinish
      ? variants.find(v => v.sku === defaultFinish.sku)
      : variants.find(v => v.imageUrl) || variants[0];
    
    if (!representative) continue;
    
    // Determine best fitmentClass (surefit > specfit > extended)
    const fitmentPriority = (fc: string | undefined) => {
      if (fc === "surefit") return 0;
      if (fc === "specfit") return 1;
      if (fc === "extended") return 2;
      return 3;
    };
    
    const bestFitmentClass = variants.reduce((best, v) => {
      if (!best) return v.fitmentClass;
      if (fitmentPriority(v.fitmentClass) < fitmentPriority(best)) return v.fitmentClass;
      return best;
    }, undefined as WheelVariantInput["fitmentClass"]);
    
    result.push({
      sku: defaultFinish?.sku || representative.sku || "",
      brand: representative.brand,
      brandCode: representative.brandCode,
      model: representative.model,
      diameter: representative.diameter,
      width: representative.width,
      offset: representative.offset,
      boltPattern: representative.boltPattern,
      centerbore: representative.centerbore,
      imageUrl: defaultFinish?.imageUrl || representative.imageUrl,
      price: defaultFinish?.price ?? representative.price,
      stockQty: defaultFinish?.stockQty ?? representative.stockQty,
      inventoryType: defaultFinish?.inventoryType ?? representative.inventoryType,
      styleKey: representative.styleKey,
      fitmentClass: bestFitmentClass,
      pair: defaultFinish?.pair || representative.pair,
      selectedFinish: defaultFinish?.finish,
      finishOptions,
      finishThumbs: finishOptions, // Legacy compat
      variantCount: variants.length,
    });
  }
  
  // Add ungrouped items as singles
  for (const w of ungrouped) {
    const finishOption: FinishOption | undefined = w.finish ? {
      finish: w.finish,
      sku: w.sku || "",
      imageUrl: w.imageUrl,
      price: w.price,
      stockQty: w.stockQty,
      inventoryType: w.inventoryType,
      pair: w.pair,
    } : undefined;
    
    result.push({
      sku: w.sku || "",
      brand: w.brand,
      brandCode: w.brandCode,
      model: w.model,
      diameter: w.diameter,
      width: w.width,
      offset: w.offset,
      boltPattern: w.boltPattern,
      centerbore: w.centerbore,
      imageUrl: w.imageUrl,
      price: w.price,
      stockQty: w.stockQty,
      inventoryType: w.inventoryType,
      styleKey: w.styleKey,
      fitmentClass: w.fitmentClass,
      pair: w.pair,
      selectedFinish: w.finish,
      finishOptions: finishOption ? [finishOption] : [],
      finishThumbs: finishOption ? [finishOption] : [],
      variantCount: 1,
    });
  }
  
  return result;
}

// ============================================================================
// Exports
// ============================================================================

export default groupWheelsBySpec;
