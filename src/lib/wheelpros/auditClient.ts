/**
 * WheelPros Wheel Fitment Audit Client
 * 
 * READ-ONLY audit layer to validate/compare WTD canonical fitment data
 * against WheelPros vehicle-aware wheel search API.
 * 
 * NO DB writes, NO runtime changes.
 * For audit/validation purposes only.
 * 
 * Uses /products/v1/search/wheel endpoint with bolt pattern search.
 * Auth: /auth/v1/authorize (same as Order API)
 */

// ============================================================================
// TYPES
// ============================================================================

export interface WheelProsVehicleQuery {
  year: number;
  make: string;
  model: string;
  subModel?: string;
  /** Bolt pattern to search (used instead of YMM) */
  boltPattern?: string;
}

export interface WheelProsWheelSpec {
  sku?: string;
  boltPattern?: string;
  centerbore?: number;
  diameter?: number;
  width?: number;
  offset?: number;
  brand?: string;
  styleName?: string;
}

export interface WheelProsFitmentAuditResult {
  vehicle: WheelProsVehicleQuery;
  queried: boolean;
  searchedBoltPattern?: string;
  error?: string;
  
  // Raw response
  totalWheels: number;
  rawSample?: any[]; // First 3 wheels for debugging
  
  // Aggregated specs from results
  uniqueBoltPatterns: string[];
  uniqueCenterbores: number[];
  uniqueDiameters: number[];
  uniqueWidths: number[];
  uniqueOffsets: { min: number; max: number } | null;
  
  // Lifted/staggered detection
  hasStaggeredResults: boolean;
  hasLiftedResults: boolean;
  
  // Facets from API
  facets?: {
    boltPatterns?: Array<{ value: string; count: number }>;
    centerbores?: Array<{ value: string; count: number }>;
    diameters?: Array<{ value: string; count: number }>;
    widths?: Array<{ value: string; count: number }>;
    offsets?: Array<{ value: string; count: number }>;
  };
  
  // Timing
  apiResponseMs: number;
}

// ============================================================================
// AUTH
// ============================================================================

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAuditToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.token;
  }

  const userName = process.env.WHEELPROS_USERNAME;
  const password = process.env.WHEELPROS_PASSWORD;
  
  if (!userName || !password) {
    throw new Error("Missing WHEELPROS_USERNAME or WHEELPROS_PASSWORD");
  }

  const authUrl = "https://api.wheelpros.com/auth/v1/authorize";
  
  const res = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ userName, password }),
  });
  
  if (!res.ok) {
    throw new Error(`WheelPros auth failed: HTTP ${res.status}`);
  }
  
  const data = await res.json();
  const token = data?.accessToken || data?.token;
  
  if (!token) {
    throw new Error("WheelPros auth: missing token in response");
  }

  tokenCache = { 
    token: String(token), 
    expiresAt: now + 3600 * 1000 // 1 hour
  };
  
  return tokenCache.token;
}

// ============================================================================
// API TYPES (actual response structure)
// ============================================================================

interface WheelProsSearchResponse {
  results: Array<{
    sku: string;
    title?: string;
    brand?: {
      code?: string;
      description?: string;
    };
    properties?: {
      model?: string;
      offset?: string;
      boltPattern?: string;
      finish?: string;
      width?: string;
      diameter?: string;
      centerbore?: string;
    };
    prices?: {
      msrp?: Array<{ currencyAmount?: string }>;
      map?: Array<{ currencyAmount?: string }>;
    };
    images?: Array<{ imageUrlMedium?: string }>;
  }>;
  totalCount: number;
  page: number;
  pageSize: number;
  facets?: {
    bolt_pattern_metric?: { buckets: Array<{ value: string; count: number }> };
    centerbore?: { buckets: Array<{ value: string; count: number }> };
    wheel_diameter?: { buckets: Array<{ value: string; count: number }> };
    width?: { buckets: Array<{ value: string; count: number }> };
    offset?: { buckets: Array<{ value: string; count: number }> };
  };
}

// ============================================================================
// AUDIT QUERY FUNCTION
// ============================================================================

/**
 * Query WheelPros API for wheel fitment data by bolt pattern.
 * 
 * Note: Vehicle YMM search returns 400 errors for most vehicles,
 * so we use bolt pattern search instead (which is what fitment-search does).
 */
export async function queryWheelProsFitment(
  vehicle: WheelProsVehicleQuery
): Promise<WheelProsFitmentAuditResult> {
  const startMs = Date.now();
  
  if (!vehicle.boltPattern) {
    return {
      vehicle,
      queried: false,
      error: "No bolt pattern provided - cannot query WheelPros",
      totalWheels: 0,
      uniqueBoltPatterns: [],
      uniqueCenterbores: [],
      uniqueDiameters: [],
      uniqueWidths: [],
      uniqueOffsets: null,
      hasStaggeredResults: false,
      hasLiftedResults: false,
      apiResponseMs: 0,
    };
  }
  
  try {
    const token = await getAuditToken();
    
    // Build search URL
    const searchUrl = new URL("https://api.wheelpros.com/products/v1/search/wheel");
    searchUrl.searchParams.set("boltPattern", vehicle.boltPattern);
    searchUrl.searchParams.set("pageSize", "50");
    searchUrl.searchParams.set("fields", "price");
    
    const res = await fetch(searchUrl.toString(), {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
    });
    
    const apiResponseMs = Date.now() - startMs;
    
    if (!res.ok) {
      const errorText = await res.text();
      return {
        vehicle,
        queried: false,
        searchedBoltPattern: vehicle.boltPattern,
        error: `HTTP ${res.status}: ${errorText.slice(0, 200)}`,
        totalWheels: 0,
        uniqueBoltPatterns: [],
        uniqueCenterbores: [],
        uniqueDiameters: [],
        uniqueWidths: [],
        uniqueOffsets: null,
        hasStaggeredResults: false,
        hasLiftedResults: false,
        apiResponseMs,
      };
    }
    
    const data: WheelProsSearchResponse = await res.json();
    const wheels = data.results || [];
    
    // Extract unique specs from results
    const boltPatterns = new Set<string>();
    const centerbores = new Set<number>();
    const diameters = new Set<number>();
    const widths = new Set<number>();
    const offsets: number[] = [];
    
    for (const wheel of wheels) {
      const props = wheel.properties || {};
      
      if (props.boltPattern) boltPatterns.add(props.boltPattern);
      if (props.centerbore) {
        const cb = parseFloat(props.centerbore);
        if (!isNaN(cb)) centerbores.add(cb);
      }
      if (props.diameter) {
        const d = parseFloat(props.diameter);
        if (!isNaN(d)) diameters.add(d);
      }
      if (props.width) {
        const w = parseFloat(props.width);
        if (!isNaN(w)) widths.add(w);
      }
      if (props.offset) {
        const o = parseFloat(props.offset);
        if (!isNaN(o)) offsets.push(o);
      }
    }
    
    // Also extract from facets if available
    if (data.facets?.bolt_pattern_metric?.buckets) {
      for (const b of data.facets.bolt_pattern_metric.buckets) {
        boltPatterns.add(b.value);
      }
    }
    if (data.facets?.centerbore?.buckets) {
      for (const b of data.facets.centerbore.buckets) {
        const cb = parseFloat(b.value);
        if (!isNaN(cb) && cb < 500) centerbores.add(cb); // Filter out 999.00 placeholder
      }
    }
    if (data.facets?.wheel_diameter?.buckets) {
      for (const b of data.facets.wheel_diameter.buckets) {
        const d = parseFloat(b.value);
        if (!isNaN(d)) diameters.add(d);
      }
    }
    if (data.facets?.width?.buckets) {
      for (const b of data.facets.width.buckets) {
        const w = parseFloat(b.value);
        if (!isNaN(w)) widths.add(w);
      }
    }
    if (data.facets?.offset?.buckets) {
      for (const b of data.facets.offset.buckets) {
        const o = parseFloat(b.value);
        if (!isNaN(o)) offsets.push(o);
      }
    }
    
    // Calculate offset range
    const uniqueOffsetValues = [...new Set(offsets)];
    const offsetRange = uniqueOffsetValues.length > 0 
      ? { min: Math.min(...uniqueOffsetValues), max: Math.max(...uniqueOffsetValues) }
      : null;
    
    // Build raw sample
    const rawSample = wheels.slice(0, 3).map(w => ({
      sku: w.sku,
      brand: w.brand?.description,
      title: w.title,
      ...w.properties,
      msrp: w.prices?.msrp?.[0]?.currencyAmount,
    }));
    
    return {
      vehicle,
      queried: true,
      searchedBoltPattern: vehicle.boltPattern,
      totalWheels: data.totalCount || wheels.length,
      rawSample,
      
      uniqueBoltPatterns: Array.from(boltPatterns).sort(),
      uniqueCenterbores: Array.from(centerbores).sort((a, b) => a - b),
      uniqueDiameters: Array.from(diameters).sort((a, b) => a - b),
      uniqueWidths: Array.from(widths).sort((a, b) => a - b),
      uniqueOffsets: offsetRange,
      
      hasStaggeredResults: false, // Cannot detect from bolt pattern search
      hasLiftedResults: false,
      
      facets: data.facets ? {
        boltPatterns: data.facets.bolt_pattern_metric?.buckets,
        centerbores: data.facets.centerbore?.buckets,
        diameters: data.facets.wheel_diameter?.buckets,
        widths: data.facets.width?.buckets,
        offsets: data.facets.offset?.buckets,
      } : undefined,
      
      apiResponseMs,
    };
    
  } catch (err: any) {
    return {
      vehicle,
      queried: false,
      searchedBoltPattern: vehicle.boltPattern,
      error: err?.message || String(err),
      totalWheels: 0,
      uniqueBoltPatterns: [],
      uniqueCenterbores: [],
      uniqueDiameters: [],
      uniqueWidths: [],
      uniqueOffsets: null,
      hasStaggeredResults: false,
      hasLiftedResults: false,
      apiResponseMs: Date.now() - startMs,
    };
  }
}

// ============================================================================
// WTD COMPARISON TYPES
// ============================================================================

export interface WTDFitmentData {
  modificationId?: string;
  displayTrim?: string;
  boltPattern: string | null;
  centerBoreMm: number | null;
  offsetMinMm: number | null;
  offsetMaxMm: number | null;
  oemWheelSizes: Array<{
    diameter?: number;
    width?: number;
    offset?: number;
  }>;
  oemTireSizes: string[];
  source: string;
}

export interface FitmentComparisonResult {
  vehicle: WheelProsVehicleQuery;
  
  // Data sources
  wheelPros: WheelProsFitmentAuditResult;
  wtd: WTDFitmentData | null;
  
  // Comparison results
  comparison: {
    boltPatternMatch: "match" | "mismatch" | "missing_wtd" | "missing_wheelpros";
    boltPatternDetails?: string;
    
    centerBoreMatch: "match" | "close" | "mismatch" | "missing_wtd" | "missing_wheelpros";
    centerBoreDetails?: string;
    
    offsetRangeMatch: "match" | "overlap" | "mismatch" | "missing_wtd" | "missing_wheelpros";
    offsetRangeDetails?: string;
    
    diameterMatch: "match" | "partial" | "mismatch" | "missing_wtd" | "missing_wheelpros";
    diameterDetails?: string;
    
    widthMatch: "match" | "partial" | "mismatch" | "missing_wtd" | "missing_wheelpros";
    widthDetails?: string;
    
    staggeredNote: string | null;
    liftedNote: string | null;
    
    overallAssessment: "✅ Good Match" | "⚠️ Minor Differences" | "❌ Significant Mismatch" | "❓ Insufficient Data";
  };
}

// ============================================================================
// COMPARISON FUNCTION
// ============================================================================

/**
 * Compare WheelPros API results with WTD canonical fitment data.
 * Returns detailed comparison for audit purposes.
 */
export function compareFitmentData(
  wheelPros: WheelProsFitmentAuditResult,
  wtd: WTDFitmentData | null
): FitmentComparisonResult {
  const comparison: FitmentComparisonResult["comparison"] = {
    boltPatternMatch: "missing_wheelpros",
    centerBoreMatch: "missing_wheelpros",
    offsetRangeMatch: "missing_wheelpros",
    diameterMatch: "missing_wheelpros",
    widthMatch: "missing_wheelpros",
    staggeredNote: null,
    liftedNote: null,
    overallAssessment: "❓ Insufficient Data",
  };
  
  if (!wheelPros.queried || wheelPros.error) {
    return { vehicle: wheelPros.vehicle, wheelPros, wtd, comparison };
  }
  
  // Bolt pattern comparison
  if (!wtd?.boltPattern) {
    comparison.boltPatternMatch = "missing_wtd";
    comparison.boltPatternDetails = `WheelPros has: ${wheelPros.uniqueBoltPatterns.join(", ") || "none"}`;
  } else if (wheelPros.uniqueBoltPatterns.length === 0) {
    comparison.boltPatternMatch = "missing_wheelpros";
    comparison.boltPatternDetails = `WTD has: ${wtd.boltPattern}`;
  } else {
    const wtdBp = normalizeBoltPattern(wtd.boltPattern);
    const wpBps = wheelPros.uniqueBoltPatterns.map(normalizeBoltPattern);
    
    // Check if WTD pattern matches any WheelPros pattern (including dual-drill)
    const hasMatch = wpBps.some(wpBp => {
      // Handle dual-drill patterns like "6X135/6X139.7"
      const wpParts = wpBp.split("/").map(p => p.trim().toLowerCase());
      return wpParts.includes(wtdBp) || wpBp === wtdBp;
    });
    
    if (hasMatch) {
      comparison.boltPatternMatch = "match";
      comparison.boltPatternDetails = `WTD (${wtd.boltPattern}) found in WheelPros: ${wheelPros.uniqueBoltPatterns.join(", ")}`;
    } else {
      comparison.boltPatternMatch = "mismatch";
      comparison.boltPatternDetails = `WTD: ${wtd.boltPattern} vs WheelPros: ${wheelPros.uniqueBoltPatterns.join(", ")}`;
    }
  }
  
  // Center bore comparison
  if (wtd?.centerBoreMm == null) {
    comparison.centerBoreMatch = "missing_wtd";
    comparison.centerBoreDetails = wheelPros.uniqueCenterbores.length > 0 
      ? `WheelPros has: ${wheelPros.uniqueCenterbores.join(", ")}mm`
      : "No data in either source";
  } else if (wheelPros.uniqueCenterbores.length === 0) {
    comparison.centerBoreMatch = "missing_wheelpros";
    comparison.centerBoreDetails = `WTD has: ${wtd.centerBoreMm}mm`;
  } else {
    const wtdCb = wtd.centerBoreMm;
    const wpCbs = wheelPros.uniqueCenterbores;
    
    // Check for exact or close match (within 0.5mm)
    const exactMatch = wpCbs.some(cb => Math.abs(cb - wtdCb) < 0.1);
    const closeMatch = wpCbs.some(cb => Math.abs(cb - wtdCb) <= 1.0);
    
    if (exactMatch) {
      comparison.centerBoreMatch = "match";
      comparison.centerBoreDetails = `Both have: ${wtdCb}mm`;
    } else if (closeMatch) {
      comparison.centerBoreMatch = "close";
      const closest = wpCbs.reduce((a, b) => Math.abs(b - wtdCb) < Math.abs(a - wtdCb) ? b : a);
      comparison.centerBoreDetails = `WTD: ${wtdCb}mm, WheelPros closest: ${closest}mm (within 1mm)`;
    } else {
      comparison.centerBoreMatch = "mismatch";
      comparison.centerBoreDetails = `WTD: ${wtdCb}mm vs WheelPros: ${wpCbs.join(", ")}mm`;
    }
  }
  
  // Offset range comparison
  if (wtd?.offsetMinMm == null || wtd?.offsetMaxMm == null) {
    comparison.offsetRangeMatch = "missing_wtd";
    comparison.offsetRangeDetails = wheelPros.uniqueOffsets 
      ? `WheelPros range: ${wheelPros.uniqueOffsets.min} to ${wheelPros.uniqueOffsets.max}mm`
      : "No offset data in either source";
  } else if (!wheelPros.uniqueOffsets) {
    comparison.offsetRangeMatch = "missing_wheelpros";
    comparison.offsetRangeDetails = `WTD range: ${wtd.offsetMinMm} to ${wtd.offsetMaxMm}mm`;
  } else {
    const wtdMin = wtd.offsetMinMm;
    const wtdMax = wtd.offsetMaxMm;
    const wpMin = wheelPros.uniqueOffsets.min;
    const wpMax = wheelPros.uniqueOffsets.max;
    
    // Check overlap
    const hasOverlap = wpMin <= wtdMax && wpMax >= wtdMin;
    const isContained = wpMin >= wtdMin - 5 && wpMax <= wtdMax + 5; // Allow 5mm tolerance
    
    if (isContained) {
      comparison.offsetRangeMatch = "match";
      comparison.offsetRangeDetails = `WheelPros (${wpMin} to ${wpMax}mm) within WTD range (${wtdMin} to ${wtdMax}mm)`;
    } else if (hasOverlap) {
      comparison.offsetRangeMatch = "overlap";
      comparison.offsetRangeDetails = `Partial overlap: WTD (${wtdMin} to ${wtdMax}mm), WheelPros (${wpMin} to ${wpMax}mm)`;
    } else {
      comparison.offsetRangeMatch = "mismatch";
      comparison.offsetRangeDetails = `No overlap: WTD (${wtdMin} to ${wtdMax}mm) vs WheelPros (${wpMin} to ${wpMax}mm)`;
    }
  }
  
  // Diameter comparison
  const wtdDiameters = wtd?.oemWheelSizes
    ?.map(ws => ws.diameter)
    .filter((d): d is number => d != null) || [];
  
  if (wtdDiameters.length === 0) {
    comparison.diameterMatch = "missing_wtd";
    comparison.diameterDetails = `WheelPros has: ${wheelPros.uniqueDiameters.join(", ")}"`;
  } else if (wheelPros.uniqueDiameters.length === 0) {
    comparison.diameterMatch = "missing_wheelpros";
    comparison.diameterDetails = `WTD has: ${wtdDiameters.join(", ")}"`;
  } else {
    const overlap = wtdDiameters.filter(d => wheelPros.uniqueDiameters.includes(d));
    if (overlap.length === wtdDiameters.length) {
      comparison.diameterMatch = "match";
      comparison.diameterDetails = `All WTD diameters (${wtdDiameters.join(", ")}") in WheelPros`;
    } else if (overlap.length > 0) {
      comparison.diameterMatch = "partial";
      comparison.diameterDetails = `Overlap: ${overlap.join(", ")}". WTD-only: ${wtdDiameters.filter(d => !overlap.includes(d)).join(", ") || "none"}`;
    } else {
      comparison.diameterMatch = "mismatch";
      comparison.diameterDetails = `WTD: ${wtdDiameters.join(", ")}" vs WheelPros: ${wheelPros.uniqueDiameters.join(", ")}"`;
    }
  }
  
  // Width comparison
  const wtdWidths = wtd?.oemWheelSizes
    ?.map(ws => ws.width)
    .filter((w): w is number => w != null) || [];
  
  if (wtdWidths.length === 0) {
    comparison.widthMatch = "missing_wtd";
    comparison.widthDetails = `WheelPros has: ${wheelPros.uniqueWidths.join(", ")}"`;
  } else if (wheelPros.uniqueWidths.length === 0) {
    comparison.widthMatch = "missing_wheelpros";
    comparison.widthDetails = `WTD has: ${wtdWidths.join(", ")}"`;
  } else {
    const overlap = wtdWidths.filter(w => wheelPros.uniqueWidths.includes(w));
    if (overlap.length === wtdWidths.length) {
      comparison.widthMatch = "match";
      comparison.widthDetails = `All WTD widths (${wtdWidths.join(", ")}") in WheelPros`;
    } else if (overlap.length > 0) {
      comparison.widthMatch = "partial";
      comparison.widthDetails = `Overlap: ${overlap.join(", ")}". WTD-only: ${wtdWidths.filter(w => !overlap.includes(w)).join(", ") || "none"}`;
    } else {
      comparison.widthMatch = "mismatch";
      comparison.widthDetails = `WTD: ${wtdWidths.join(", ")}" vs WheelPros: ${wheelPros.uniqueWidths.join(", ")}"`;
    }
  }
  
  // Staggered/lifted notes
  if (wheelPros.hasStaggeredResults) {
    comparison.staggeredNote = "📋 WheelPros returned staggered fitment results";
  }
  if (wheelPros.hasLiftedResults) {
    comparison.liftedNote = "📋 WheelPros returned lifted fitment results";
  }
  
  // Overall assessment
  const matchCount = [
    comparison.boltPatternMatch === "match",
    comparison.centerBoreMatch === "match" || comparison.centerBoreMatch === "close",
    comparison.offsetRangeMatch === "match" || comparison.offsetRangeMatch === "overlap",
    comparison.diameterMatch === "match" || comparison.diameterMatch === "partial",
    comparison.widthMatch === "match" || comparison.widthMatch === "partial",
  ].filter(Boolean).length;
  
  const mismatchCount = [
    comparison.boltPatternMatch === "mismatch",
    comparison.centerBoreMatch === "mismatch",
    comparison.offsetRangeMatch === "mismatch",
    comparison.diameterMatch === "mismatch",
    comparison.widthMatch === "mismatch",
  ].filter(Boolean).length;
  
  if (mismatchCount >= 2 || comparison.boltPatternMatch === "mismatch") {
    comparison.overallAssessment = "❌ Significant Mismatch";
  } else if (matchCount >= 4) {
    comparison.overallAssessment = "✅ Good Match";
  } else if (matchCount >= 2) {
    comparison.overallAssessment = "⚠️ Minor Differences";
  } else {
    comparison.overallAssessment = "❓ Insufficient Data";
  }
  
  return {
    vehicle: wheelPros.vehicle,
    wheelPros,
    wtd,
    comparison,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function normalizeBoltPattern(bp: string): string {
  return bp.toLowerCase().replace(/\s/g, "").replace(/[×-]/g, "x");
}
