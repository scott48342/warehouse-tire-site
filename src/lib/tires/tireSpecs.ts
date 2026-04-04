/**
 * Tire Specs Enrichment Service
 * 
 * Handles UTQG parsing, performance derivation, and spec enrichment.
 * Fields will populate once TireWeb enables TireLibrary enrichment.
 * 
 * UTQG Format: "620AB" = Treadwear 620, Traction A, Temperature B
 */

// ============================================================================
// TYPES
// ============================================================================

export interface UTQGRating {
  /** Raw UTQG string (e.g., "620AB") */
  raw: string;
  /** Treadwear rating (100-800+, higher = longer life) */
  treadwear: number | null;
  /** Traction rating (AA, A, B, C - grip on wet surfaces) */
  traction: 'AA' | 'A' | 'B' | 'C' | null;
  /** Temperature rating (A, B, C - heat dissipation) */
  temperature: 'A' | 'B' | 'C' | null;
}

export interface TireSpecs {
  /** UTQG breakdown */
  utqg: UTQGRating | null;
  /** Tread depth in 32nds of an inch (e.g., 10, 11, 12) */
  treadDepth: number | null;
  /** Overall diameter in inches (e.g., 31.9) */
  diameter: number | null;
  /** Tire weight in lbs */
  weight: number | null;
  /** Mileage warranty in miles */
  warranty: number | null;
  /** Load capacity in lbs */
  loadCapacity: number | null;
  /** Max PSI */
  maxPsi: number | null;
}

export interface PerformanceRatings {
  /** Overall score 1-10 (derived from all factors) */
  overall: number;
  /** Tread life score 1-10 (from UTQG treadwear) */
  treadLife: number;
  /** Wet traction score 1-10 (from UTQG traction) */
  wetTraction: number;
  /** Dry traction score 1-10 (derived from category + temp) */
  dryTraction: number;
  /** Comfort score 1-10 (derived from category) */
  comfort: number;
  /** Noise score 1-10 (derived from category + construction) */
  noise: number;
  /** Off-road capability 1-10 (derived from category) */
  offRoad: number;
  /** Winter performance 1-10 (derived from category + 3PMSF) */
  winter: number;
}

export type TreadCategory = 
  | 'All-Season'
  | 'All-Weather'
  | 'Summer'
  | 'Winter'
  | 'All-Terrain'
  | 'Mud-Terrain'
  | 'Highway/Touring'
  | 'Performance'
  | 'Rugged-Terrain'
  | 'Off-Road';

// ============================================================================
// UTQG PARSING
// ============================================================================

/**
 * Parse UTQG string into components
 * Formats: "620AB", "620 A B", "620/A/B", "Treadwear: 620 Traction: A Temperature: B"
 */
export function parseUTQG(utqg: string | null | undefined): UTQGRating | null {
  if (!utqg) return null;
  
  const raw = String(utqg).trim().toUpperCase();
  if (!raw) return null;
  
  // Try compact format: "620AB"
  const compactMatch = raw.match(/^(\d{2,3})([ABC]{0,2})$/);
  if (compactMatch) {
    const treadwear = parseInt(compactMatch[1], 10);
    const grades = compactMatch[2];
    return {
      raw,
      treadwear: treadwear || null,
      traction: grades.length >= 1 ? grades[0] as 'A' | 'B' | 'C' : null,
      temperature: grades.length >= 2 ? grades[1] as 'A' | 'B' | 'C' : null,
    };
  }
  
  // Try "620 A B" or "620/A/B" format
  const spacedMatch = raw.match(/(\d{2,3})\s*[\/\s]\s*([ABC]{1,2})\s*[\/\s]?\s*([ABC])?/);
  if (spacedMatch) {
    const treadwear = parseInt(spacedMatch[1], 10);
    const tractStr = spacedMatch[2];
    const tempStr = spacedMatch[3];
    
    // Handle "AA" traction rating
    let traction: 'AA' | 'A' | 'B' | 'C' | null = null;
    let temperature: 'A' | 'B' | 'C' | null = null;
    
    if (tractStr === 'AA') {
      traction = 'AA';
      temperature = tempStr as 'A' | 'B' | 'C' || null;
    } else if (tractStr.length === 2 && !tempStr) {
      traction = tractStr[0] as 'A' | 'B' | 'C';
      temperature = tractStr[1] as 'A' | 'B' | 'C';
    } else {
      traction = tractStr[0] as 'A' | 'B' | 'C';
      temperature = tempStr as 'A' | 'B' | 'C' || null;
    }
    
    return { raw, treadwear: treadwear || null, traction, temperature };
  }
  
  // Try verbose format
  const treadwearMatch = raw.match(/TREADWEAR[:\s]*(\d{2,3})/);
  const tractionMatch = raw.match(/TRACTION[:\s]*([ABC]{1,2})/);
  const tempMatch = raw.match(/TEMP(?:ERATURE)?[:\s]*([ABC])/);
  
  if (treadwearMatch || tractionMatch || tempMatch) {
    return {
      raw,
      treadwear: treadwearMatch ? parseInt(treadwearMatch[1], 10) : null,
      traction: tractionMatch ? tractionMatch[1] as 'AA' | 'A' | 'B' | 'C' : null,
      temperature: tempMatch ? tempMatch[1] as 'A' | 'B' | 'C' : null,
    };
  }
  
  // Just a number (treadwear only)
  const numOnly = raw.match(/^(\d{2,3})$/);
  if (numOnly) {
    return {
      raw,
      treadwear: parseInt(numOnly[1], 10),
      traction: null,
      temperature: null,
    };
  }
  
  return null;
}

// ============================================================================
// PERFORMANCE DERIVATION
// ============================================================================

/**
 * Derive performance ratings from UTQG + category
 * Returns 1-10 scores for various performance dimensions
 */
export function derivePerformanceRatings(
  utqg: UTQGRating | null,
  category: TreadCategory | null,
  has3PMSF: boolean = false,
): PerformanceRatings {
  // Base scores (neutral starting point)
  let treadLife = 5;
  let wetTraction = 5;
  let dryTraction = 5;
  let comfort = 5;
  let noise = 5;
  let offRoad = 3;
  let winter = 4;
  
  // ════════════════════════════════════════════════════════════════════════
  // UTQG-based scoring
  // ════════════════════════════════════════════════════════════════════════
  
  if (utqg?.treadwear) {
    // Treadwear 100-800+ → 1-10 score
    // 100-200 = 2-3, 300-400 = 5-6, 500-600 = 7-8, 700+ = 9-10
    if (utqg.treadwear >= 700) treadLife = 10;
    else if (utqg.treadwear >= 600) treadLife = 9;
    else if (utqg.treadwear >= 500) treadLife = 8;
    else if (utqg.treadwear >= 400) treadLife = 7;
    else if (utqg.treadwear >= 300) treadLife = 5;
    else if (utqg.treadwear >= 200) treadLife = 4;
    else treadLife = 3;
  }
  
  if (utqg?.traction) {
    // Traction AA/A/B/C → wet traction score
    switch (utqg.traction) {
      case 'AA': wetTraction = 10; break;
      case 'A': wetTraction = 8; break;
      case 'B': wetTraction = 6; break;
      case 'C': wetTraction = 4; break;
    }
  }
  
  if (utqg?.temperature) {
    // Temperature A/B/C affects dry traction and comfort
    switch (utqg.temperature) {
      case 'A': dryTraction = Math.max(dryTraction, 8); break;
      case 'B': dryTraction = Math.max(dryTraction, 6); break;
      case 'C': dryTraction = Math.max(dryTraction, 5); break;
    }
  }
  
  // ════════════════════════════════════════════════════════════════════════
  // Category-based adjustments
  // ════════════════════════════════════════════════════════════════════════
  
  switch (category) {
    case 'Performance':
    case 'Summer':
      dryTraction = Math.min(10, dryTraction + 2);
      wetTraction = Math.min(10, wetTraction + 1);
      comfort = Math.max(1, comfort - 1);
      noise = Math.max(1, noise - 1);
      offRoad = 1;
      winter = 2;
      break;
      
    case 'Highway/Touring':
      comfort = Math.min(10, comfort + 2);
      noise = Math.min(10, noise + 2);
      treadLife = Math.min(10, treadLife + 1);
      offRoad = 2;
      break;
      
    case 'All-Season':
      // Balanced, no major adjustments
      winter = has3PMSF ? 6 : 4;
      break;
      
    case 'All-Weather':
      winter = 7;
      wetTraction = Math.min(10, wetTraction + 1);
      break;
      
    case 'Winter':
      winter = 10;
      wetTraction = Math.min(10, wetTraction + 1);
      dryTraction = Math.max(1, dryTraction - 1);
      treadLife = Math.max(1, treadLife - 2);
      break;
      
    case 'All-Terrain':
      offRoad = 7;
      winter = has3PMSF ? 7 : 5;
      comfort = Math.max(1, comfort - 1);
      noise = Math.max(1, noise - 2);
      break;
      
    case 'Rugged-Terrain':
      offRoad = 8;
      winter = has3PMSF ? 6 : 5;
      comfort = Math.max(1, comfort - 2);
      noise = Math.max(1, noise - 2);
      break;
      
    case 'Mud-Terrain':
      offRoad = 10;
      winter = has3PMSF ? 5 : 4;
      comfort = Math.max(1, comfort - 3);
      noise = Math.max(1, noise - 4);
      treadLife = Math.max(1, treadLife - 1);
      break;
      
    case 'Off-Road':
      offRoad = 10;
      comfort = 2;
      noise = 2;
      treadLife = Math.max(1, treadLife - 2);
      break;
  }
  
  // 3PMSF badge bonus
  if (has3PMSF) {
    winter = Math.min(10, winter + 2);
  }
  
  // Calculate overall score (weighted average)
  const overall = Math.round(
    (treadLife * 0.20) +
    (wetTraction * 0.20) +
    (dryTraction * 0.15) +
    (comfort * 0.15) +
    (noise * 0.10) +
    (offRoad * 0.10) +
    (winter * 0.10)
  );
  
  return {
    overall: Math.max(1, Math.min(10, overall)),
    treadLife: Math.max(1, Math.min(10, treadLife)),
    wetTraction: Math.max(1, Math.min(10, wetTraction)),
    dryTraction: Math.max(1, Math.min(10, dryTraction)),
    comfort: Math.max(1, Math.min(10, comfort)),
    noise: Math.max(1, Math.min(10, noise)),
    offRoad: Math.max(1, Math.min(10, offRoad)),
    winter: Math.max(1, Math.min(10, winter)),
  };
}

// ============================================================================
// ENRICHMENT HELPERS
// ============================================================================

/**
 * Parse tread depth from various formats
 * "12/32", "12", "10.5/32" → number in 32nds
 */
export function parseTreadDepth(depth: string | number | null | undefined): number | null {
  if (depth == null) return null;
  
  if (typeof depth === 'number') {
    return depth > 0 && depth <= 32 ? depth : null;
  }
  
  const str = String(depth).trim();
  
  // "12/32" or "12/32""
  const fractionMatch = str.match(/^(\d+(?:\.\d+)?)\s*\/\s*32/);
  if (fractionMatch) {
    return parseFloat(fractionMatch[1]);
  }
  
  // Just a number
  const num = parseFloat(str);
  if (!isNaN(num) && num > 0 && num <= 32) {
    return num;
  }
  
  return null;
}

/**
 * Format tread depth for display
 */
export function formatTreadDepth(depth: number | null): string | null {
  if (depth == null) return null;
  return `${depth}/32"`;
}

/**
 * Get tread life estimate in miles from UTQG treadwear
 * Based on industry standard: treadwear 100 ≈ 20,000 miles
 */
export function estimateTreadLifeMiles(treadwear: number | null): number | null {
  if (!treadwear || treadwear < 100) return null;
  // Conservative estimate: treadwear × 200
  return treadwear * 200;
}

/**
 * Format UTQG for display
 */
export function formatUTQG(utqg: UTQGRating | null): string | null {
  if (!utqg) return null;
  
  const parts: string[] = [];
  if (utqg.treadwear) parts.push(String(utqg.treadwear));
  if (utqg.traction) parts.push(utqg.traction);
  if (utqg.temperature) parts.push(utqg.temperature);
  
  return parts.length > 0 ? parts.join(' ') : null;
}

// ============================================================================
// STOCK & AVAILABILITY
// ============================================================================

export interface StockInfo {
  /** Total quantity across all warehouses */
  total: number;
  /** Primary warehouse quantity */
  primary: number;
  /** Alternate warehouse quantity */
  alternate: number;
  /** National distribution quantity */
  national: number;
  /** Availability status */
  status: 'in-stock' | 'low-stock' | 'special-order' | 'out-of-stock';
  /** Display message */
  message: string;
  /** Estimated delivery days (business days) */
  deliveryDays: number | null;
}

/**
 * Calculate stock info and messaging
 */
export function getStockInfo(
  quantity: { primary?: number; alternate?: number; national?: number } | undefined,
): StockInfo {
  const primary = quantity?.primary || 0;
  const alternate = quantity?.alternate || 0;
  const national = quantity?.national || 0;
  const total = primary + alternate + national;
  
  let status: StockInfo['status'];
  let message: string;
  let deliveryDays: number | null;
  
  if (total >= 20) {
    status = 'in-stock';
    message = `${total} in stock`;
    deliveryDays = primary >= 4 ? 2 : alternate >= 4 ? 4 : 6;
  } else if (total >= 8) {
    status = 'in-stock';
    message = `${total} in stock`;
    deliveryDays = primary >= 4 ? 2 : 5;
  } else if (total >= 4) {
    status = 'low-stock';
    message = `Only ${total} left`;
    deliveryDays = 5;
  } else if (total > 0) {
    status = 'low-stock';
    message = `${total} available`;
    deliveryDays = 7;
  } else {
    status = 'special-order';
    message = 'Special order';
    deliveryDays = 14;
  }
  
  return { total, primary, alternate, national, status, message, deliveryDays };
}

/**
 * Format delivery estimate
 */
export function formatDeliveryEstimate(days: number | null): string | null {
  if (days == null) return null;
  
  if (days <= 2) return 'Ships in 1-2 days';
  if (days <= 4) return 'Ships in 3-4 days';
  if (days <= 7) return 'Ships in 5-7 days';
  return 'Ships in 1-2 weeks';
}
