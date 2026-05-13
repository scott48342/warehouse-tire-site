/**
 * WheelPros Wheel Validator
 * 
 * Uses WTD canonical fitment as source of truth, validates WheelPros products
 * against vehicle specs. NO DB writes, audit output only.
 * 
 * Flow:
 * 1. Resolve WTD canonical specs for vehicle (bolt pattern, center bore, offset range, wheel sizes)
 * 2. Query WheelPros by bolt pattern
 * 3. Validate each wheel: bolt pattern exact match, center bore >= vehicle, classify offset/width
 * 4. Output audit: valid wheels, rejected wheels, distributions, expansion opportunities
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import pg from "pg";
const { Pool } = pg;
import * as fs from "fs";
import * as path from "path";

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// ============================================================================
// TYPES
// ============================================================================

interface WTDCanonicalSpecs {
  year: number;
  make: string;
  model: string;
  trim?: string;
  source: "config" | "legacy";
  
  boltPattern: string | null;
  centerBoreMm: number | null;
  offsetMinMm: number | null;
  offsetMaxMm: number | null;
  
  oemWheelDiameters: number[];
  oemWheelWidths: number[];
  oemOffsets: number[];
}

interface WheelProsWheel {
  sku: string;
  brand: string;
  model: string;
  title: string;
  
  boltPattern: string;
  boltPatterns: string[]; // For dual-drill
  centerboreMm: number | null;
  diameterIn: number | null;
  widthIn: number | null;
  offsetMm: number | null;
  
  finish: string;
  msrp: number | null;
  map: number | null;
  imageUrl: string | null;
  
  inStock: boolean;
}

type OffsetClass = "oem-safe" | "aggressive" | "extreme" | "unknown";
type WidthClass = "oem-safe" | "aggressive" | "extreme" | "unknown";

interface WheelValidationResult {
  wheel: WheelProsWheel;
  valid: boolean;
  
  // Validation checks
  boltPatternMatch: boolean;
  centerBoreOk: boolean; // Wheel CB >= vehicle CB (hub-centric)
  centerBoreDelta: number | null; // Wheel CB - Vehicle CB
  
  offsetClass: OffsetClass;
  offsetDelta: number | null; // Distance from OEM range
  
  widthClass: WidthClass;
  widthDelta: number | null; // Distance from OEM widths
  
  rejectionReasons: string[];
}

interface ValidationAuditResult {
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string;
  };
  
  wtdSpecs: WTDCanonicalSpecs;
  queriedBoltPattern: string;
  
  summary: {
    totalQueried: number;
    totalValid: number;
    totalRejected: number;
    rejectedByBoltPattern: number;
    rejectedByCenterBore: number;
    validOemSafe: number;
    validAggressive: number;
    validExtreme: number;
  };
  
  // Distributions
  offsetDistribution: {
    oemSafe: number[];
    aggressive: number[];
    extreme: number[];
  };
  widthDistribution: {
    oemSafe: number[];
    aggressive: number[];
    extreme: number[];
  };
  
  // Sample results
  validWheels: WheelValidationResult[];
  rejectedWheels: WheelValidationResult[];
  
  // Expansion analysis
  expansion: {
    wheelProsHasButWtdBlocks: {
      offsetsTooAggressive: number;
      widthsTooWide: number;
      diametersMissing: number[];
    };
    missingLikelySafe: {
      count: number;
      examples: string[];
    };
  };
  
  apiResponseMs: number;
}

// ============================================================================
// AUTH (same as auditClient)
// ============================================================================

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getWheelProsToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.token;
  }

  const userName = process.env.WHEELPROS_USERNAME;
  const password = process.env.WHEELPROS_PASSWORD;
  
  if (!userName || !password) {
    throw new Error("Missing WHEELPROS_USERNAME or WHEELPROS_PASSWORD");
  }

  const res = await fetch("https://api.wheelpros.com/auth/v1/authorize", {
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

  tokenCache = { token: String(token), expiresAt: now + 3600 * 1000 };
  return tokenCache.token;
}

// ============================================================================
// WTD CANONICAL LOOKUP
// ============================================================================

async function resolveWTDCanonical(
  year: number, 
  make: string, 
  model: string, 
  trim?: string
): Promise<WTDCanonicalSpecs | null> {
  
  // Use legacy table (has bolt pattern, center bore, offsets)
  const legacyResult = await pool.query(
    `SELECT * FROM vehicle_fitments 
     WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) = LOWER($3)
     LIMIT 10`,
    [year, make, model]
  );
  
  if (legacyResult.rows.length > 0) {
    const row = trim
      ? legacyResult.rows.find((r: any) => r.display_trim?.toLowerCase() === trim.toLowerCase()) || legacyResult.rows[0]
      : legacyResult.rows[0];
    
    const oemWheelDiameters: number[] = [];
    const oemWheelWidths: number[] = [];
    const oemOffsets: number[] = [];
    
    const wheelSizes = (row.oem_wheel_sizes || []) as any[];
    for (const w of wheelSizes) {
      if (w.diameter) oemWheelDiameters.push(w.diameter);
      if (w.width) oemWheelWidths.push(w.width);
      if (w.offset) oemOffsets.push(w.offset);
    }
    
    return {
      year,
      make,
      model,
      trim: row.display_trim || undefined,
      source: "legacy",
      boltPattern: row.bolt_pattern || null,
      centerBoreMm: row.center_bore_mm ? parseFloat(String(row.center_bore_mm)) : null,
      offsetMinMm: row.offset_min_mm ? parseFloat(String(row.offset_min_mm)) : 
                   (oemOffsets.length ? Math.min(...oemOffsets) : null),
      offsetMaxMm: row.offset_max_mm ? parseFloat(String(row.offset_max_mm)) : 
                   (oemOffsets.length ? Math.max(...oemOffsets) : null),
      oemWheelDiameters: [...new Set(oemWheelDiameters)],
      oemWheelWidths: [...new Set(oemWheelWidths)],
      oemOffsets: [...new Set(oemOffsets)],
    };
  }
  
  return null;
}

// ============================================================================
// WHEELPROS QUERY
// ============================================================================

interface WheelProsSearchResponse {
  results: Array<{
    sku: string;
    title?: string;
    brand?: { code?: string; description?: string };
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
    availability?: { available?: boolean };
  }>;
  totalCount: number;
  page: number;
  pageSize: number;
}

async function queryWheelProsByBoltPattern(
  boltPattern: string,
  options?: {
    diameter?: number;
    minWidth?: number;
    maxWidth?: number;
    pageSize?: number;
    maxPages?: number;
  }
): Promise<{ wheels: WheelProsWheel[]; totalCount: number; apiMs: number }> {
  const startMs = Date.now();
  const pageSize = options?.pageSize || 100;
  const maxPages = options?.maxPages || 10; // Cap at 1000 wheels
  
  const token = await getWheelProsToken();
  const allWheels: WheelProsWheel[] = [];
  let totalCount = 0;
  let page = 1;
  
  while (page <= maxPages) {
    const url = new URL("https://api.wheelpros.com/products/v1/search/wheel");
    url.searchParams.set("boltPattern", boltPattern);
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("page", String(page));
    url.searchParams.set("fields", "price,availability");
    
    if (options?.diameter) {
      url.searchParams.set("diameter", String(options.diameter));
    }
    
    const res = await fetch(url.toString(), {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
    });
    
    if (!res.ok) {
      console.error(`WheelPros API error: HTTP ${res.status}`);
      break;
    }
    
    const data: WheelProsSearchResponse = await res.json();
    totalCount = data.totalCount || 0;
    
    for (const r of data.results || []) {
      const props = r.properties || {};
      
      // Parse bolt patterns (handle dual-drill)
      const rawBp = props.boltPattern || "";
      const boltPatterns = rawBp.split("/").map(p => p.trim().toUpperCase());
      
      allWheels.push({
        sku: r.sku,
        brand: r.brand?.description || r.brand?.code || "",
        model: props.model || "",
        title: r.title || "",
        boltPattern: rawBp,
        boltPatterns,
        centerboreMm: props.centerbore ? parseFloat(props.centerbore) : null,
        diameterIn: props.diameter ? parseFloat(props.diameter) : null,
        widthIn: props.width ? parseFloat(props.width) : null,
        offsetMm: props.offset ? parseFloat(props.offset) : null,
        finish: props.finish || "",
        msrp: r.prices?.msrp?.[0]?.currencyAmount 
          ? parseFloat(r.prices.msrp[0].currencyAmount) : null,
        map: r.prices?.map?.[0]?.currencyAmount
          ? parseFloat(r.prices.map[0].currencyAmount) : null,
        imageUrl: r.images?.[0]?.imageUrlMedium || null,
        inStock: r.availability?.available ?? true,
      });
    }
    
    // Check if more pages
    if ((data.results?.length || 0) < pageSize || allWheels.length >= totalCount) {
      break;
    }
    page++;
    
    // Small delay between pages
    await new Promise(r => setTimeout(r, 100));
  }
  
  return {
    wheels: allWheels,
    totalCount,
    apiMs: Date.now() - startMs,
  };
}

// ============================================================================
// VALIDATION LOGIC
// ============================================================================

function normalizeBoltPattern(bp: string): string {
  return bp.toLowerCase().replace(/\s/g, "").replace(/[×-]/g, "x");
}

function classifyOffset(
  wheelOffset: number,
  oemMin: number | null,
  oemMax: number | null
): { class: OffsetClass; delta: number | null } {
  if (oemMin == null || oemMax == null) {
    return { class: "unknown", delta: null };
  }
  
  // OEM-safe: within OEM range ±5mm
  if (wheelOffset >= oemMin - 5 && wheelOffset <= oemMax + 5) {
    return { class: "oem-safe", delta: 0 };
  }
  
  // Aggressive: 6-15mm outside OEM range
  const distFromOem = wheelOffset < oemMin 
    ? oemMin - wheelOffset 
    : wheelOffset - oemMax;
  
  if (distFromOem <= 15) {
    return { class: "aggressive", delta: distFromOem };
  }
  
  // Extreme: >15mm outside OEM range
  return { class: "extreme", delta: distFromOem };
}

function classifyWidth(
  wheelWidth: number,
  oemWidths: number[]
): { class: WidthClass; delta: number | null } {
  if (oemWidths.length === 0) {
    return { class: "unknown", delta: null };
  }
  
  const maxOem = Math.max(...oemWidths);
  const minOem = Math.min(...oemWidths);
  
  // OEM-safe: within OEM range ±0.5"
  if (wheelWidth >= minOem - 0.5 && wheelWidth <= maxOem + 0.5) {
    return { class: "oem-safe", delta: 0 };
  }
  
  // Aggressive: 0.5-1.5" outside OEM
  const distFromOem = wheelWidth < minOem 
    ? minOem - wheelWidth 
    : wheelWidth - maxOem;
  
  if (distFromOem <= 1.5) {
    return { class: "aggressive", delta: distFromOem };
  }
  
  // Extreme: >1.5" outside OEM
  return { class: "extreme", delta: distFromOem };
}

function validateWheel(
  wheel: WheelProsWheel,
  specs: WTDCanonicalSpecs
): WheelValidationResult {
  const rejectionReasons: string[] = [];
  
  // 1. Bolt pattern - exact match required
  const normalizedVehicleBp = specs.boltPattern 
    ? normalizeBoltPattern(specs.boltPattern) : null;
  
  let boltPatternMatch = false;
  if (normalizedVehicleBp) {
    boltPatternMatch = wheel.boltPatterns.some(wp => 
      normalizeBoltPattern(wp) === normalizedVehicleBp
    );
  }
  
  if (!boltPatternMatch && specs.boltPattern) {
    rejectionReasons.push(`Bolt pattern mismatch: vehicle=${specs.boltPattern}, wheel=${wheel.boltPattern}`);
  }
  
  // 2. Center bore - wheel must be >= vehicle (hub-centric)
  let centerBoreOk = true;
  let centerBoreDelta: number | null = null;
  
  if (specs.centerBoreMm != null && wheel.centerboreMm != null) {
    centerBoreDelta = wheel.centerboreMm - specs.centerBoreMm;
    // Wheel center bore must be >= vehicle center bore (or very close)
    // Allow 0.5mm tolerance for rounding
    centerBoreOk = wheel.centerboreMm >= specs.centerBoreMm - 0.5;
    
    if (!centerBoreOk) {
      rejectionReasons.push(
        `Center bore too small: wheel=${wheel.centerboreMm}mm < vehicle=${specs.centerBoreMm}mm`
      );
    }
  }
  
  // 3. Classify offset
  const offsetResult = wheel.offsetMm != null
    ? classifyOffset(wheel.offsetMm, specs.offsetMinMm, specs.offsetMaxMm)
    : { class: "unknown" as OffsetClass, delta: null };
  
  // 4. Classify width
  const widthResult = wheel.widthIn != null
    ? classifyWidth(wheel.widthIn, specs.oemWheelWidths)
    : { class: "unknown" as WidthClass, delta: null };
  
  // Valid if: bolt pattern matches AND center bore is OK
  const valid = boltPatternMatch && centerBoreOk;
  
  return {
    wheel,
    valid,
    boltPatternMatch,
    centerBoreOk,
    centerBoreDelta,
    offsetClass: offsetResult.class,
    offsetDelta: offsetResult.delta,
    widthClass: widthResult.class,
    widthDelta: widthResult.delta,
    rejectionReasons,
  };
}

// ============================================================================
// MAIN AUDIT FUNCTION
// ============================================================================

async function runValidationAudit(
  year: number,
  make: string,
  model: string,
  trim?: string
): Promise<ValidationAuditResult | null> {
  
  console.log(`\n🔍 Validating: ${year} ${make} ${model}${trim ? ` (${trim})` : ""}`);
  
  // 1. Resolve WTD canonical specs
  const wtdSpecs = await resolveWTDCanonical(year, make, model, trim);
  
  if (!wtdSpecs) {
    console.log(`  ❌ No WTD fitment data found`);
    return null;
  }
  
  if (!wtdSpecs.boltPattern) {
    console.log(`  ❌ No bolt pattern in WTD data`);
    return null;
  }
  
  console.log(`  📋 WTD specs (${wtdSpecs.source}): ${wtdSpecs.boltPattern}, CB=${wtdSpecs.centerBoreMm}mm`);
  console.log(`  📋 Offset range: ${wtdSpecs.offsetMinMm} to ${wtdSpecs.offsetMaxMm}mm`);
  console.log(`  📋 OEM widths: ${wtdSpecs.oemWheelWidths.join(", ")}" | Diameters: ${wtdSpecs.oemWheelDiameters.join(", ")}"`);
  
  // 2. Query WheelPros by bolt pattern
  console.log(`  🌐 Querying WheelPros by bolt pattern: ${wtdSpecs.boltPattern}`);
  
  const { wheels, totalCount, apiMs } = await queryWheelProsByBoltPattern(
    wtdSpecs.boltPattern,
    { pageSize: 100, maxPages: 10 }
  );
  
  console.log(`  📦 Retrieved ${wheels.length} of ${totalCount} wheels (${apiMs}ms)`);
  
  // 3. Validate each wheel
  const validResults: WheelValidationResult[] = [];
  const rejectedResults: WheelValidationResult[] = [];
  
  let rejectedByBoltPattern = 0;
  let rejectedByCenterBore = 0;
  let validOemSafe = 0;
  let validAggressive = 0;
  let validExtreme = 0;
  
  const offsetDistribution = {
    oemSafe: [] as number[],
    aggressive: [] as number[],
    extreme: [] as number[],
  };
  const widthDistribution = {
    oemSafe: [] as number[],
    aggressive: [] as number[],
    extreme: [] as number[],
  };
  
  for (const wheel of wheels) {
    const result = validateWheel(wheel, wtdSpecs);
    
    if (result.valid) {
      validResults.push(result);
      
      // Track distributions
      if (wheel.offsetMm != null) {
        if (result.offsetClass === "oem-safe") offsetDistribution.oemSafe.push(wheel.offsetMm);
        else if (result.offsetClass === "aggressive") offsetDistribution.aggressive.push(wheel.offsetMm);
        else if (result.offsetClass === "extreme") offsetDistribution.extreme.push(wheel.offsetMm);
      }
      if (wheel.widthIn != null) {
        if (result.widthClass === "oem-safe") widthDistribution.oemSafe.push(wheel.widthIn);
        else if (result.widthClass === "aggressive") widthDistribution.aggressive.push(wheel.widthIn);
        else if (result.widthClass === "extreme") widthDistribution.extreme.push(wheel.widthIn);
      }
      
      // Count by safety class
      if (result.offsetClass === "oem-safe" && result.widthClass === "oem-safe") {
        validOemSafe++;
      } else if (result.offsetClass === "extreme" || result.widthClass === "extreme") {
        validExtreme++;
      } else {
        validAggressive++;
      }
    } else {
      rejectedResults.push(result);
      if (!result.boltPatternMatch) rejectedByBoltPattern++;
      if (!result.centerBoreOk) rejectedByCenterBore++;
    }
  }
  
  // 4. Expansion analysis
  const uniqueWpDiameters = [...new Set(wheels.map(w => w.diameterIn).filter((d): d is number => d != null))];
  const missingDiameters = uniqueWpDiameters.filter(d => !wtdSpecs.oemWheelDiameters.includes(d));
  
  // Count wheels blocked by overly strict WTD filters
  const blockedByOffset = validResults.filter(r => 
    r.offsetClass === "aggressive" || r.offsetClass === "extreme"
  ).length;
  const blockedByWidth = validResults.filter(r =>
    r.widthClass === "aggressive" || r.widthClass === "extreme"
  ).length;
  
  console.log(`  ✅ Valid: ${validResults.length} | ❌ Rejected: ${rejectedResults.length}`);
  console.log(`  📊 OEM-safe: ${validOemSafe} | Aggressive: ${validAggressive} | Extreme: ${validExtreme}`);
  
  return {
    vehicle: { year, make, model, trim },
    wtdSpecs,
    queriedBoltPattern: wtdSpecs.boltPattern,
    
    summary: {
      totalQueried: wheels.length,
      totalValid: validResults.length,
      totalRejected: rejectedResults.length,
      rejectedByBoltPattern,
      rejectedByCenterBore,
      validOemSafe,
      validAggressive,
      validExtreme,
    },
    
    offsetDistribution,
    widthDistribution,
    
    // Sample results (limit to 50 each)
    validWheels: validResults.slice(0, 50),
    rejectedWheels: rejectedResults.slice(0, 50),
    
    expansion: {
      wheelProsHasButWtdBlocks: {
        offsetsTooAggressive: blockedByOffset,
        widthsTooWide: blockedByWidth,
        diametersMissing: missingDiameters,
      },
      missingLikelySafe: {
        count: 0, // TODO: Cross-reference with WTD blocked products
        examples: [],
      },
    },
    
    apiResponseMs: apiMs,
  };
}

// ============================================================================
// CLI
// ============================================================================

const TEST_VEHICLES = [
  { year: 2024, make: "Ford", model: "F-150" },
  { year: 2024, make: "Chevrolet", model: "Silverado 1500" },
  { year: 2024, make: "Toyota", model: "Tacoma" },
  { year: 2024, make: "Jeep", model: "Wrangler" },
  { year: 2024, make: "Ford", model: "Mustang", trim: "GT" },
  { year: 2024, make: "Chevrolet", model: "Corvette" },
  { year: 2024, make: "Ram", model: "1500" },
  { year: 2024, make: "BMW", model: "M3" },
  { year: 2024, make: "Tesla", model: "Model 3" },
  { year: 2024, make: "Honda", model: "Civic" },
];

async function main() {
  console.log("🔧 WheelPros Wheel Validator");
  console.log("============================");
  console.log("Using WTD canonical fitment as source of truth.");
  console.log("WheelPros used for product validation and expansion analysis.\n");
  
  const results: ValidationAuditResult[] = [];
  
  for (const v of TEST_VEHICLES) {
    try {
      const result = await runValidationAudit(v.year, v.make, v.model, v.trim);
      if (result) {
        results.push(result);
      }
    } catch (err) {
      console.error(`  ⚠️ Error: ${err}`);
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Write results
  const outDir = path.join(__dirname, "wheelpros-audit-results");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  const outPath = path.join(outDir, "wheel-validation-audit.json");
  fs.writeFileSync(outPath, JSON.stringify({
    auditDate: new Date().toISOString(),
    totalVehicles: results.length,
    summary: {
      totalWheelsValidated: results.reduce((sum, r) => sum + r.summary.totalQueried, 0),
      totalValid: results.reduce((sum, r) => sum + r.summary.totalValid, 0),
      totalRejected: results.reduce((sum, r) => sum + r.summary.totalRejected, 0),
      avgValidRate: results.length > 0 
        ? (results.reduce((sum, r) => sum + r.summary.totalValid / r.summary.totalQueried, 0) / results.length * 100).toFixed(1) + "%"
        : "N/A",
    },
    results,
  }, null, 2));
  
  console.log(`\n📁 Results written to: ${outPath}`);
  
  // Summary table
  console.log("\n📊 Summary Table:");
  console.log("─".repeat(100));
  console.log(
    "Vehicle".padEnd(35) +
    "Valid".padStart(8) +
    "Rejected".padStart(10) +
    "OEM-Safe".padStart(10) +
    "Aggressive".padStart(12) +
    "Extreme".padStart(10) +
    "CB Reject".padStart(10)
  );
  console.log("─".repeat(100));
  
  for (const r of results) {
    const name = `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}`.slice(0, 33);
    console.log(
      name.padEnd(35) +
      String(r.summary.totalValid).padStart(8) +
      String(r.summary.totalRejected).padStart(10) +
      String(r.summary.validOemSafe).padStart(10) +
      String(r.summary.validAggressive).padStart(12) +
      String(r.summary.validExtreme).padStart(10) +
      String(r.summary.rejectedByCenterBore).padStart(10)
    );
  }
  console.log("─".repeat(100));
}

main()
  .catch(console.error)
  .finally(() => pool.end());
