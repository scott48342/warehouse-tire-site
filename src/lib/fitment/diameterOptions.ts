/**
 * Build Fitment Diameter Options
 * 
 * Server-safe utility for building wheel diameter options.
 * Used by both server components (wheels page) and client components (chips).
 */

export interface DiameterOption {
  diameter: number;
  label: string;
  isStock: boolean;
  isUpsize: boolean;
  hasInventory?: boolean;
  count?: number;
}

export interface BuildDiameterOptionsParams {
  /** Is this a classic vehicle? */
  isClassicVehicle: boolean;
  /** Stock wheel diameter(s) */
  stockDiameters?: number[];
  /** Classic upsize range (e.g., [15, 20]) */
  classicUpsizeRange?: [number, number];
  /** OEM wheel sizes from fitment profile */
  oemWheelSizes?: Array<{ diameter?: number }>;
  /** Inventory facets with counts */
  inventoryFacets?: Array<{ value: string; count?: number }>;
}

export function buildDiameterOptions({
  isClassicVehicle,
  stockDiameters = [],
  classicUpsizeRange,
  oemWheelSizes = [],
  inventoryFacets = [],
}: BuildDiameterOptionsParams): DiameterOption[] {
  const options = new Map<number, DiameterOption>();
  
  // Build inventory lookup
  const inventoryCounts = new Map<number, number>();
  for (const facet of inventoryFacets) {
    const dia = Math.round(parseFloat(facet.value));
    if (Number.isFinite(dia)) {
      inventoryCounts.set(dia, facet.count ?? 0);
    }
  }
  
  if (isClassicVehicle) {
    // Classic vehicle: stock + upsize range
    const stockSet = new Set(stockDiameters);
    const [minDia, maxDia] = classicUpsizeRange || [15, 20];
    
    for (let dia = minDia; dia <= maxDia; dia++) {
      const isStock = stockSet.has(dia);
      const count = inventoryCounts.get(dia);
      
      options.set(dia, {
        diameter: dia,
        label: `${dia}"`,
        isStock,
        isUpsize: !isStock,
        hasInventory: count !== undefined ? count > 0 : undefined,
        count,
      });
    }
    
    // Also add stock diameter if outside range
    for (const dia of stockDiameters) {
      if (!options.has(dia)) {
        const count = inventoryCounts.get(dia);
        options.set(dia, {
          diameter: dia,
          label: `${dia}"`,
          isStock: true,
          isUpsize: false,
          hasInventory: count !== undefined ? count > 0 : undefined,
          count,
        });
      }
    }
  } else {
    // Modern vehicle: OEM sizes only
    const oemDiameters = new Set<number>();
    
    for (const size of oemWheelSizes) {
      if (size.diameter && Number.isFinite(size.diameter)) {
        oemDiameters.add(Math.round(size.diameter));
      }
    }
    
    // Also add stock diameters
    for (const dia of stockDiameters) {
      oemDiameters.add(dia);
    }
    
    // If no OEM data, use inventory facets as fallback
    if (oemDiameters.size === 0) {
      for (const dia of inventoryCounts.keys()) {
        oemDiameters.add(dia);
      }
    }
    
    for (const dia of oemDiameters) {
      const count = inventoryCounts.get(dia);
      const isStock = stockDiameters.includes(dia);
      
      options.set(dia, {
        diameter: dia,
        label: `${dia}"`,
        isStock,
        isUpsize: false,
        hasInventory: count !== undefined ? count > 0 : undefined,
        count,
      });
    }
  }
  
  return Array.from(options.values());
}
