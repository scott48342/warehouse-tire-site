/**
 * Shared compare utilities - can be used by both server and client components.
 * Pure functions only, no React hooks or client-side APIs.
 */

// Re-export types from CompareContext (these are just type definitions, safe to share)
export type CompareItemType = "wheel" | "tire";

export type CompareItem = {
  id: string;
  type: CompareItemType;
  brand: string;
  model: string;
  finish?: string;
  imageUrl?: string;
  priceEach?: number;
  priceSet?: number;
  compareData: {
    // Wheel-specific
    diameter?: string;
    width?: string;
    offset?: string;
    boltPattern?: string;
    centerBore?: string;
    fitmentLevel?: string;
    stockStatus?: string;
    loadRating?: string;
    weight?: string;
    inventoryType?: string;
    // Tire-specific
    size?: string;
    aspectRatio?: string;
    loadIndex?: string;
    speedRating?: string;
    loadRange?: string;
    treadwear?: string;
    traction?: string;
    temperature?: string;
    category?: string;
    mileageWarranty?: string;
    is3PMSF?: boolean;
    isXL?: boolean;
    isRunFlat?: boolean;
    overallDiameter?: string;
    sectionWidth?: string;
    source?: string;
  };
  addedAt: number;
};

/**
 * Normalize a tire product into a CompareItem.
 * Extracts only the fields needed for comparison.
 */
export function normalizeTireForCompare(product: {
  sku?: string;
  partNumber?: string;
  mfgPartNumber?: string;
  brand?: string;
  model?: string;
  displayName?: string;
  imageUrl?: string;
  price?: number;
  size?: string;
  width?: string;
  aspectRatio?: string;
  diameter?: string;
  loadIndex?: string;
  speedRating?: string;
  loadRange?: string;
  treadwear?: string | number;
  traction?: string;
  temperature?: string;
  category?: string;
  mileageWarranty?: number;
  is3PMSF?: boolean;
  isXL?: boolean;
  isRunFlat?: boolean;
  overallDiameter?: string | number;
  sectionWidth?: string | number;
  stockQty?: number;
  source?: string;
}): CompareItem {
  const priceEach = typeof product.price === "number" ? product.price : undefined;
  const priceSet = priceEach !== undefined ? priceEach * 4 : undefined;

  // Determine stock status
  let stockStatus: string | undefined;
  if (typeof product.stockQty === "number" && product.stockQty > 0) {
    stockStatus = product.stockQty >= 20 ? "20+ in stock" : `${product.stockQty} in stock`;
  }

  // Format mileage warranty
  let mileageWarranty: string | undefined;
  if (typeof product.mileageWarranty === "number" && product.mileageWarranty > 0) {
    mileageWarranty = `${Math.round(product.mileageWarranty / 1000)}K miles`;
  }

  // Format treadwear
  let treadwear: string | undefined;
  if (product.treadwear !== undefined && product.treadwear !== null) {
    treadwear = String(product.treadwear);
  }

  // Format overall diameter
  let overallDiameter: string | undefined;
  if (product.overallDiameter !== undefined && product.overallDiameter !== null) {
    overallDiameter = `${product.overallDiameter}"`;
  }

  // Format section width
  let sectionWidth: string | undefined;
  if (product.sectionWidth !== undefined && product.sectionWidth !== null) {
    sectionWidth = `${product.sectionWidth}mm`;
  }

  // Determine ID - prefer mfgPartNumber, then partNumber, then sku
  const id = product.mfgPartNumber || product.partNumber || product.sku || `tire-${Date.now()}`;

  return {
    id,
    type: "tire",
    brand: product.brand || "Unknown",
    model: product.model || product.displayName || "Unknown",
    imageUrl: product.imageUrl,
    priceEach,
    priceSet,
    compareData: {
      size: product.size,
      width: product.width,
      aspectRatio: product.aspectRatio,
      diameter: product.diameter,
      loadIndex: product.loadIndex,
      speedRating: product.speedRating,
      loadRange: product.loadRange,
      treadwear,
      traction: product.traction,
      temperature: product.temperature,
      category: product.category,
      mileageWarranty,
      is3PMSF: product.is3PMSF,
      isXL: product.isXL,
      isRunFlat: product.isRunFlat,
      overallDiameter,
      sectionWidth,
      stockStatus,
      source: product.source,
    },
    addedAt: Date.now(),
  };
}
