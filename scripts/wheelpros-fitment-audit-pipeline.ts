/**
 * WheelPros Wheel Fitment Validation Pipeline
 * 
 * Uses WheelPros product data to validate WTD canonical fitment.
 * NO DB writes. Audit output only.
 * 
 * Flow:
 * 1. Query WTD canonical specs for each vehicle
 * 2. Search WheelPros by bolt pattern
 * 3. Classify each wheel (bolt, hub, offset, width, diameter)
 * 4. Identify systematic WTD issues
 * 5. Output audit JSON + summary
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
  
  // Derived ranges
  wheelDiameterMin: number | null;
  wheelDiameterMax: number | null;
  wheelWidthMin: number | null;
  wheelWidthMax: number | null;
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
  backspacingIn: number | null;
  
  finish: string;
  msrp: number | null;
  map: number | null;
  imageUrl: string | null;
  inStock: boolean;
  loadRating: string | null;
}

// Classification enums
type BoltMatch = "BOLT_MATCH" | "BOLT_MISMATCH" | "BOLT_UNKNOWN";
type HubStatus = "HUB_SAFE" | "HUB_RISK" | "HUB_UNKNOWN";
type OffsetStatus = "OFFSET_SAFE" | "OFFSET_AGGRESSIVE" | "OFFSET_EXTREME" | "OFFSET_UNKNOWN";
type WidthStatus = "WIDTH_SAFE" | "WIDTH_AGGRESSIVE" | "WIDTH_EXTREME" | "WIDTH_UNKNOWN";
type DiameterStatus = "DIAMETER_SAFE" | "DIAMETER_AGGRESSIVE" | "DIAMETER_EXTREME" | "DIAMETER_UNKNOWN";

interface WheelClassification {
  wheel: WheelProsWheel;
  
  bolt: BoltMatch;
  hub: HubStatus;
  offset: OffsetStatus;
  width: WidthStatus;
  diameter: DiameterStatus;
  
  // Detailed metrics
  hubDeltaMm: number | null;       // wheel CB - vehicle CB
  offsetDeltaMm: number | null;    // distance from OEM range
  widthDeltaIn: number | null;     // distance from OEM widths
  diameterDeltaIn: number | null;  // distance from OEM diameters
  
  // Overall status
  overallSafe: boolean;
  overallPlausible: boolean;
  rejectionReasons: string[];
}

interface WTDIssue {
  type: "offset_too_strict" | "width_too_strict" | "diameter_too_strict" | 
        "bolt_pattern_mismatch" | "center_bore_mismatch" | "no_products";
  severity: "low" | "medium" | "high";
  description: string;
  evidence: {
    wtdValue: any;
    wheelProsValue: any;
    affectedWheels: number;
    examples: string[];
  };
}

interface VehicleAuditResult {
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string;
  };
  
  wtdSpecs: WTDCanonicalSpecs;
  queriedBoltPattern: string;
  apiResponseMs: number;
  
  // Counts
  totalWheelsQueried: number;
  
  classifications: {
    boltMatch: number;
    boltMismatch: number;
    hubSafe: number;
    hubRisk: number;
    offsetSafe: number;
    offsetAggressive: number;
    offsetExtreme: number;
    widthSafe: number;
    widthAggressive: number;
    widthExtreme: number;
    diameterSafe: number;
    diameterAggressive: number;
    diameterExtreme: number;
  };
  
  // Overall categories
  cleanMatches: number;          // All SAFE
  aggressiveAftermarket: number; // Plausible but outside OEM
  unsafeProducts: number;        // HUB_RISK or multiple EXTREME
  manualReviewNeeded: number;    // Ambiguous
  
  // Detected WTD issues
  wtdIssues: WTDIssue[];
  
  // Sample wheels by category
  sampleCleanMatches: WheelClassification[];
  sampleAggressive: WheelClassification[];
  sampleUnsafe: WheelClassification[];
  sampleManualReview: WheelClassification[];
}

interface FullAuditResult {
  auditDate: string;
  totalVehicles: number;
  
  summary: {
    totalWheelsAudited: number;
    totalCleanMatches: number;
    totalAggressiveAftermarket: number;
    totalUnsafe: number;
    totalManualReview: number;
    
    topWTDIssues: Array<{
      vehicle: string;
      issue: WTDIssue;
    }>;
  };
  
  vehicles: VehicleAuditResult[];
}

// ============================================================================
// AUTH
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
  
  const result = await pool.query(
    `SELECT * FROM vehicle_fitments 
     WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) = LOWER($3)
     LIMIT 20`,
    [year, make, model]
  );
  
  if (result.rows.length === 0) return null;
  
  const row = trim
    ? result.rows.find((r: any) => r.display_trim?.toLowerCase().includes(trim.toLowerCase())) || result.rows[0]
    : result.rows[0];
  
  const oemWheelDiameters: number[] = [];
  const oemWheelWidths: number[] = [];
  const oemOffsets: number[] = [];
  
  const wheelSizes = (row.oem_wheel_sizes || []) as any[];
  for (const w of wheelSizes) {
    if (w.diameter) oemWheelDiameters.push(w.diameter);
    if (w.width) oemWheelWidths.push(w.width);
    if (w.offset) oemOffsets.push(w.offset);
  }
  
  const uniqueDiameters = [...new Set(oemWheelDiameters)];
  const uniqueWidths = [...new Set(oemWheelWidths)];
  
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
    oemWheelDiameters: uniqueDiameters,
    oemWheelWidths: uniqueWidths,
    oemOffsets: [...new Set(oemOffsets)],
    wheelDiameterMin: uniqueDiameters.length ? Math.min(...uniqueDiameters) : null,
    wheelDiameterMax: uniqueDiameters.length ? Math.max(...uniqueDiameters) : null,
    wheelWidthMin: uniqueWidths.length ? Math.min(...uniqueWidths) : null,
    wheelWidthMax: uniqueWidths.length ? Math.max(...uniqueWidths) : null,
  };
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
      backspacing?: string;
      loadRating?: string;
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
  maxPages: number = 10
): Promise<{ wheels: WheelProsWheel[]; totalCount: number; apiMs: number }> {
  const startMs = Date.now();
  const pageSize = 100;
  
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
        backspacingIn: props.backspacing ? parseFloat(props.backspacing) : null,
        finish: props.finish || "",
        msrp: r.prices?.msrp?.[0]?.currencyAmount 
          ? parseFloat(r.prices.msrp[0].currencyAmount) : null,
        map: r.prices?.map?.[0]?.currencyAmount
          ? parseFloat(r.prices.map[0].currencyAmount) : null,
        imageUrl: r.images?.[0]?.imageUrlMedium || null,
        inStock: r.availability?.available ?? true,
        loadRating: props.loadRating || null,
      });
    }
    
    if ((data.results?.length || 0) < pageSize || allWheels.length >= totalCount) {
      break;
    }
    page++;
    await new Promise(r => setTimeout(r, 100));
  }
  
  return { wheels: allWheels, totalCount, apiMs: Date.now() - startMs };
}

// ============================================================================
// CLASSIFICATION LOGIC
// ============================================================================

function normalizeBoltPattern(bp: string): string {
  return bp.toLowerCase().replace(/\s/g, "").replace(/[×-]/g, "x");
}

function classifyWheel(wheel: WheelProsWheel, specs: WTDCanonicalSpecs): WheelClassification {
  const rejectionReasons: string[] = [];
  
  // 1. Bolt pattern classification
  let bolt: BoltMatch = "BOLT_UNKNOWN";
  if (specs.boltPattern) {
    const normalizedVehicleBp = normalizeBoltPattern(specs.boltPattern);
    const matches = wheel.boltPatterns.some(wp => 
      normalizeBoltPattern(wp) === normalizedVehicleBp
    );
    bolt = matches ? "BOLT_MATCH" : "BOLT_MISMATCH";
    if (!matches) {
      rejectionReasons.push(`Bolt pattern: vehicle=${specs.boltPattern}, wheel=${wheel.boltPattern}`);
    }
  }
  
  // 2. Hub/center bore classification
  let hub: HubStatus = "HUB_UNKNOWN";
  let hubDeltaMm: number | null = null;
  if (specs.centerBoreMm != null && wheel.centerboreMm != null) {
    hubDeltaMm = wheel.centerboreMm - specs.centerBoreMm;
    // Wheel CB must be >= vehicle CB (hub-centric), allow 0.5mm tolerance
    hub = wheel.centerboreMm >= specs.centerBoreMm - 0.5 ? "HUB_SAFE" : "HUB_RISK";
    if (hub === "HUB_RISK") {
      rejectionReasons.push(`Center bore: wheel=${wheel.centerboreMm}mm < vehicle=${specs.centerBoreMm}mm`);
    }
  }
  
  // 3. Offset classification
  let offset: OffsetStatus = "OFFSET_UNKNOWN";
  let offsetDeltaMm: number | null = null;
  if (specs.offsetMinMm != null && specs.offsetMaxMm != null && wheel.offsetMm != null) {
    const withinRange = wheel.offsetMm >= specs.offsetMinMm - 5 && 
                        wheel.offsetMm <= specs.offsetMaxMm + 5;
    if (withinRange) {
      offset = "OFFSET_SAFE";
      offsetDeltaMm = 0;
    } else {
      const distFromRange = wheel.offsetMm < specs.offsetMinMm 
        ? specs.offsetMinMm - wheel.offsetMm 
        : wheel.offsetMm - specs.offsetMaxMm;
      offsetDeltaMm = distFromRange;
      
      if (distFromRange <= 15) {
        offset = "OFFSET_AGGRESSIVE";
      } else {
        offset = "OFFSET_EXTREME";
        rejectionReasons.push(`Offset extreme: wheel=${wheel.offsetMm}mm vs OEM=${specs.offsetMinMm}-${specs.offsetMaxMm}mm`);
      }
    }
  }
  
  // 4. Width classification
  let width: WidthStatus = "WIDTH_UNKNOWN";
  let widthDeltaIn: number | null = null;
  if (specs.oemWheelWidths.length > 0 && wheel.widthIn != null) {
    const minOem = Math.min(...specs.oemWheelWidths);
    const maxOem = Math.max(...specs.oemWheelWidths);
    
    if (wheel.widthIn >= minOem - 0.5 && wheel.widthIn <= maxOem + 0.5) {
      width = "WIDTH_SAFE";
      widthDeltaIn = 0;
    } else {
      const dist = wheel.widthIn < minOem 
        ? minOem - wheel.widthIn 
        : wheel.widthIn - maxOem;
      widthDeltaIn = dist;
      
      if (dist <= 1.5) {
        width = "WIDTH_AGGRESSIVE";
      } else {
        width = "WIDTH_EXTREME";
      }
    }
  }
  
  // 5. Diameter classification
  let diameter: DiameterStatus = "DIAMETER_UNKNOWN";
  let diameterDeltaIn: number | null = null;
  if (specs.oemWheelDiameters.length > 0 && wheel.diameterIn != null) {
    const minOem = Math.min(...specs.oemWheelDiameters);
    const maxOem = Math.max(...specs.oemWheelDiameters);
    
    // Allow +/- 2" from OEM for aftermarket
    if (wheel.diameterIn >= minOem - 1 && wheel.diameterIn <= maxOem + 2) {
      if (specs.oemWheelDiameters.includes(wheel.diameterIn)) {
        diameter = "DIAMETER_SAFE";
        diameterDeltaIn = 0;
      } else {
        diameter = "DIAMETER_AGGRESSIVE";
        diameterDeltaIn = wheel.diameterIn < minOem 
          ? minOem - wheel.diameterIn 
          : wheel.diameterIn - maxOem;
      }
    } else {
      diameter = "DIAMETER_EXTREME";
      diameterDeltaIn = wheel.diameterIn < minOem 
        ? minOem - wheel.diameterIn 
        : wheel.diameterIn - maxOem;
    }
  }
  
  // Overall status
  const overallSafe = bolt === "BOLT_MATCH" && 
                      hub === "HUB_SAFE" &&
                      (offset === "OFFSET_SAFE" || offset === "OFFSET_UNKNOWN") &&
                      (width === "WIDTH_SAFE" || width === "WIDTH_UNKNOWN") &&
                      (diameter === "DIAMETER_SAFE" || diameter === "DIAMETER_UNKNOWN");
  
  const overallPlausible = bolt === "BOLT_MATCH" && 
                           hub !== "HUB_RISK" &&
                           offset !== "OFFSET_EXTREME" &&
                           width !== "WIDTH_EXTREME" &&
                           diameter !== "DIAMETER_EXTREME";
  
  return {
    wheel,
    bolt,
    hub,
    offset,
    width,
    diameter,
    hubDeltaMm,
    offsetDeltaMm,
    widthDeltaIn,
    diameterDeltaIn,
    overallSafe,
    overallPlausible,
    rejectionReasons,
  };
}

// ============================================================================
// WTD ISSUE DETECTION
// ============================================================================

function detectWTDIssues(
  specs: WTDCanonicalSpecs,
  classifications: WheelClassification[]
): WTDIssue[] {
  const issues: WTDIssue[] = [];
  
  const matchingBolt = classifications.filter(c => c.bolt === "BOLT_MATCH");
  const hubSafe = matchingBolt.filter(c => c.hub === "HUB_SAFE" || c.hub === "HUB_UNKNOWN");
  
  // 1. Offset too strict?
  const offsetAggressive = hubSafe.filter(c => c.offset === "OFFSET_AGGRESSIVE");
  if (offsetAggressive.length > 50 && specs.offsetMinMm != null && specs.offsetMaxMm != null) {
    // Many wheels just outside range suggests WTD might be too strict
    const offsets = offsetAggressive
      .map(c => c.wheel.offsetMm)
      .filter((o): o is number => o != null);
    
    const avgOffset = offsets.reduce((a, b) => a + b, 0) / offsets.length;
    const wtdMid = (specs.offsetMinMm + specs.offsetMaxMm) / 2;
    
    if (Math.abs(avgOffset - wtdMid) < 20) {
      issues.push({
        type: "offset_too_strict",
        severity: offsetAggressive.length > 200 ? "high" : "medium",
        description: `${offsetAggressive.length} wheels just outside WTD offset range (${specs.offsetMinMm}-${specs.offsetMaxMm}mm)`,
        evidence: {
          wtdValue: { min: specs.offsetMinMm, max: specs.offsetMaxMm },
          wheelProsValue: { avgOffset: Math.round(avgOffset), count: offsetAggressive.length },
          affectedWheels: offsetAggressive.length,
          examples: offsetAggressive.slice(0, 5).map(c => 
            `${c.wheel.sku}: ${c.wheel.offsetMm}mm`
          ),
        },
      });
    }
  }
  
  // 2. Width too strict?
  const widthAggressive = hubSafe.filter(c => c.width === "WIDTH_AGGRESSIVE");
  if (widthAggressive.length > 50 && specs.oemWheelWidths.length > 0) {
    issues.push({
      type: "width_too_strict",
      severity: widthAggressive.length > 200 ? "high" : "medium",
      description: `${widthAggressive.length} wheels just outside WTD width range`,
      evidence: {
        wtdValue: specs.oemWheelWidths,
        wheelProsValue: [...new Set(widthAggressive.map(c => c.wheel.widthIn))].sort(),
        affectedWheels: widthAggressive.length,
        examples: widthAggressive.slice(0, 5).map(c => 
          `${c.wheel.sku}: ${c.wheel.widthIn}"`
        ),
      },
    });
  }
  
  // 3. Diameter too strict?
  const diameterAggressive = hubSafe.filter(c => c.diameter === "DIAMETER_AGGRESSIVE");
  if (diameterAggressive.length > 100) {
    const diameters = [...new Set(diameterAggressive.map(c => c.wheel.diameterIn))].sort();
    issues.push({
      type: "diameter_too_strict",
      severity: diameterAggressive.length > 300 ? "high" : "medium",
      description: `${diameterAggressive.length} wheels with non-OEM diameters`,
      evidence: {
        wtdValue: specs.oemWheelDiameters,
        wheelProsValue: diameters,
        affectedWheels: diameterAggressive.length,
        examples: diameterAggressive.slice(0, 5).map(c => 
          `${c.wheel.sku}: ${c.wheel.diameterIn}"`
        ),
      },
    });
  }
  
  // 4. Center bore mismatch?
  const hubRisk = matchingBolt.filter(c => c.hub === "HUB_RISK");
  if (hubRisk.length > 100 && specs.centerBoreMm != null) {
    const cbs = hubRisk
      .map(c => c.wheel.centerboreMm)
      .filter((cb): cb is number => cb != null);
    const avgCb = cbs.reduce((a, b) => a + b, 0) / cbs.length;
    
    // If most "risky" wheels are very close, WTD CB might be wrong
    if (avgCb > specs.centerBoreMm - 5) {
      issues.push({
        type: "center_bore_mismatch",
        severity: "medium",
        description: `${hubRisk.length} wheels marked HUB_RISK but close to vehicle CB`,
        evidence: {
          wtdValue: specs.centerBoreMm,
          wheelProsValue: Math.round(avgCb * 10) / 10,
          affectedWheels: hubRisk.length,
          examples: hubRisk.slice(0, 5).map(c => 
            `${c.wheel.sku}: ${c.wheel.centerboreMm}mm`
          ),
        },
      });
    }
  }
  
  // 5. Bolt pattern mismatch? (Most wheels don't match)
  const mismatchRate = 1 - (matchingBolt.length / classifications.length);
  if (mismatchRate > 0.3 && classifications.length > 100) {
    const bpCounts: Record<string, number> = {};
    for (const c of classifications) {
      bpCounts[c.wheel.boltPattern] = (bpCounts[c.wheel.boltPattern] || 0) + 1;
    }
    const topBps = Object.entries(bpCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    issues.push({
      type: "bolt_pattern_mismatch",
      severity: mismatchRate > 0.5 ? "high" : "low",
      description: `${Math.round(mismatchRate * 100)}% of wheels don't match WTD bolt pattern`,
      evidence: {
        wtdValue: specs.boltPattern,
        wheelProsValue: topBps.map(([bp, count]) => `${bp} (${count})`),
        affectedWheels: classifications.length - matchingBolt.length,
        examples: classifications.filter(c => c.bolt === "BOLT_MISMATCH")
          .slice(0, 5)
          .map(c => `${c.wheel.sku}: ${c.wheel.boltPattern}`),
      },
    });
  }
  
  return issues;
}

// ============================================================================
// VEHICLE AUDIT
// ============================================================================

async function auditVehicle(
  year: number,
  make: string,
  model: string,
  trim?: string
): Promise<VehicleAuditResult | null> {
  console.log(`\n🔍 Auditing: ${year} ${make} ${model}${trim ? ` (${trim})` : ""}`);
  
  const specs = await resolveWTDCanonical(year, make, model, trim);
  if (!specs) {
    console.log(`  ❌ No WTD fitment data`);
    return null;
  }
  
  if (!specs.boltPattern) {
    console.log(`  ❌ No bolt pattern`);
    return null;
  }
  
  console.log(`  📋 WTD: ${specs.boltPattern}, CB=${specs.centerBoreMm}mm, Offset=${specs.offsetMinMm}-${specs.offsetMaxMm}mm`);
  console.log(`  📋 Widths: ${specs.oemWheelWidths.join(", ")}" | Diameters: ${specs.oemWheelDiameters.join(", ")}"`);
  
  const { wheels, totalCount, apiMs } = await queryWheelProsByBoltPattern(specs.boltPattern);
  console.log(`  📦 Retrieved ${wheels.length}/${totalCount} wheels (${apiMs}ms)`);
  
  // Classify all wheels
  const classifications = wheels.map(w => classifyWheel(w, specs));
  
  // Count classifications
  const counts = {
    boltMatch: classifications.filter(c => c.bolt === "BOLT_MATCH").length,
    boltMismatch: classifications.filter(c => c.bolt === "BOLT_MISMATCH").length,
    hubSafe: classifications.filter(c => c.hub === "HUB_SAFE").length,
    hubRisk: classifications.filter(c => c.hub === "HUB_RISK").length,
    offsetSafe: classifications.filter(c => c.offset === "OFFSET_SAFE").length,
    offsetAggressive: classifications.filter(c => c.offset === "OFFSET_AGGRESSIVE").length,
    offsetExtreme: classifications.filter(c => c.offset === "OFFSET_EXTREME").length,
    widthSafe: classifications.filter(c => c.width === "WIDTH_SAFE").length,
    widthAggressive: classifications.filter(c => c.width === "WIDTH_AGGRESSIVE").length,
    widthExtreme: classifications.filter(c => c.width === "WIDTH_EXTREME").length,
    diameterSafe: classifications.filter(c => c.diameter === "DIAMETER_SAFE").length,
    diameterAggressive: classifications.filter(c => c.diameter === "DIAMETER_AGGRESSIVE").length,
    diameterExtreme: classifications.filter(c => c.diameter === "DIAMETER_EXTREME").length,
  };
  
  // Categorize wheels
  const cleanMatches = classifications.filter(c => c.overallSafe);
  const aggressiveAftermarket = classifications.filter(c => 
    !c.overallSafe && c.overallPlausible
  );
  const unsafeProducts = classifications.filter(c => 
    c.hub === "HUB_RISK" || 
    (c.offset === "OFFSET_EXTREME" && c.width === "WIDTH_EXTREME")
  );
  const manualReview = classifications.filter(c => 
    !c.overallSafe && !c.overallPlausible && 
    c.hub !== "HUB_RISK" &&
    c.bolt === "BOLT_MATCH"
  );
  
  // Detect WTD issues
  const wtdIssues = detectWTDIssues(specs, classifications);
  
  console.log(`  ✅ Clean: ${cleanMatches.length} | ⚠️ Aggressive: ${aggressiveAftermarket.length} | ❌ Unsafe: ${unsafeProducts.length} | ❓ Review: ${manualReview.length}`);
  if (wtdIssues.length > 0) {
    console.log(`  🔧 WTD Issues: ${wtdIssues.map(i => i.type).join(", ")}`);
  }
  
  return {
    vehicle: { year, make, model, trim },
    wtdSpecs: specs,
    queriedBoltPattern: specs.boltPattern,
    apiResponseMs: apiMs,
    totalWheelsQueried: wheels.length,
    classifications: counts,
    cleanMatches: cleanMatches.length,
    aggressiveAftermarket: aggressiveAftermarket.length,
    unsafeProducts: unsafeProducts.length,
    manualReviewNeeded: manualReview.length,
    wtdIssues,
    sampleCleanMatches: cleanMatches.slice(0, 10),
    sampleAggressive: aggressiveAftermarket.slice(0, 10),
    sampleUnsafe: unsafeProducts.slice(0, 10),
    sampleManualReview: manualReview.slice(0, 10),
  };
}

// ============================================================================
// MAIN
// ============================================================================

const AUDIT_VEHICLES = [
  { year: 2024, make: "Ford", model: "F-150" },
  { year: 2024, make: "Toyota", model: "Tacoma" },
  { year: 2024, make: "Jeep", model: "Wrangler" },
  { year: 2024, make: "Chevrolet", model: "Corvette" },
  { year: 2024, make: "BMW", model: "M3" },
  { year: 2024, make: "Ram", model: "3500" },
  { year: 2024, make: "Chevrolet", model: "Silverado 1500" },
  { year: 2024, make: "Toyota", model: "Camry" },
  { year: 2024, make: "Honda", model: "Accord" },
  { year: 2024, make: "Tesla", model: "Model S" },
];

async function main() {
  console.log("🔧 WheelPros Fitment Validation Pipeline");
  console.log("========================================");
  console.log("Mode: AUDIT ONLY (no DB writes)\n");
  
  const results: VehicleAuditResult[] = [];
  const allIssues: Array<{ vehicle: string; issue: WTDIssue }> = [];
  
  for (const v of AUDIT_VEHICLES) {
    try {
      const result = await auditVehicle(v.year, v.make, v.model);
      if (result) {
        results.push(result);
        for (const issue of result.wtdIssues) {
          allIssues.push({
            vehicle: `${v.year} ${v.make} ${v.model}`,
            issue,
          });
        }
      }
    } catch (err) {
      console.error(`  ⚠️ Error: ${err}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Sort issues by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  allIssues.sort((a, b) => 
    severityOrder[a.issue.severity] - severityOrder[b.issue.severity]
  );
  
  // Build full result
  const fullResult: FullAuditResult = {
    auditDate: new Date().toISOString(),
    totalVehicles: results.length,
    summary: {
      totalWheelsAudited: results.reduce((sum, r) => sum + r.totalWheelsQueried, 0),
      totalCleanMatches: results.reduce((sum, r) => sum + r.cleanMatches, 0),
      totalAggressiveAftermarket: results.reduce((sum, r) => sum + r.aggressiveAftermarket, 0),
      totalUnsafe: results.reduce((sum, r) => sum + r.unsafeProducts, 0),
      totalManualReview: results.reduce((sum, r) => sum + r.manualReviewNeeded, 0),
      topWTDIssues: allIssues.slice(0, 20),
    },
    vehicles: results,
  };
  
  // Write results
  const outDir = path.join(__dirname, "wheelpros-audit-results");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  const outPath = path.join(outDir, "fitment-validation-pipeline.json");
  fs.writeFileSync(outPath, JSON.stringify(fullResult, null, 2));
  
  console.log(`\n📁 Full results: ${outPath}`);
  
  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("📊 AUDIT SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total Vehicles: ${results.length}`);
  console.log(`Total Wheels Audited: ${fullResult.summary.totalWheelsAudited}`);
  console.log(`Clean Matches: ${fullResult.summary.totalCleanMatches}`);
  console.log(`Aggressive Aftermarket: ${fullResult.summary.totalAggressiveAftermarket}`);
  console.log(`Unsafe Products: ${fullResult.summary.totalUnsafe}`);
  console.log(`Manual Review Needed: ${fullResult.summary.totalManualReview}`);
  
  if (allIssues.length > 0) {
    console.log("\n🔧 TOP WTD ISSUES:");
    console.log("-".repeat(80));
    for (const { vehicle, issue } of allIssues.slice(0, 10)) {
      console.log(`  [${issue.severity.toUpperCase()}] ${vehicle}: ${issue.type}`);
      console.log(`    ${issue.description}`);
    }
  }
  
  // Per-vehicle summary table
  console.log("\n📋 PER-VEHICLE SUMMARY:");
  console.log("-".repeat(100));
  console.log(
    "Vehicle".padEnd(35) +
    "Clean".padStart(8) +
    "Aggr".padStart(8) +
    "Unsafe".padStart(8) +
    "Review".padStart(8) +
    "Issues".padStart(10)
  );
  console.log("-".repeat(100));
  
  for (const r of results) {
    const name = `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}`.slice(0, 33);
    console.log(
      name.padEnd(35) +
      String(r.cleanMatches).padStart(8) +
      String(r.aggressiveAftermarket).padStart(8) +
      String(r.unsafeProducts).padStart(8) +
      String(r.manualReviewNeeded).padStart(8) +
      String(r.wtdIssues.length).padStart(10)
    );
  }
  console.log("-".repeat(100));
}

main()
  .catch(console.error)
  .finally(() => pool.end());
