/**
 * External Fitment Lookup Service
 * 
 * Last-resort lookup for vehicles not in WTD verified DB or curated fallback.
 * Uses Wheel-Size API with safety governor protection.
 * 
 * LOOKUP PRIORITY:
 * 1. WTD verified fitment DB (always first)
 * 2. Curated fallback profiles (hand-maintained)
 * 3. External API lookup (this service) <-- NEW
 * 4. Ask customer to verify
 * 
 * @created 2026-05-20
 */

import { governedCall, getGovernorState } from "../wheel-size/safetyGovernor";

// =============================================================================
// TYPES
// =============================================================================

export type ExternalLookupConfidence = "high" | "medium" | "low";

export interface ExternalLookupResult {
  success: boolean;
  confidence: ExternalLookupConfidence;
  source: "wheel_size_api" | "none";
  sourceName: string;
  
  fitment?: {
    boltPattern: string;
    boltPatternMetric?: string;
    centerBore?: number;
    threadSize?: string;
    tireSizes: string[];
    wheelDiameters: number[];
    wheelWidths?: number[];
    offsetRange?: { min: number; max: number };
  };
  
  messaging: {
    formatted: string;
    confidenceNote: string;
  };
  
  requiresCustomerVerification: boolean;
  
  // Metadata
  rawResponse?: unknown;
  lookupDurationMs?: number;
  cached?: boolean;
  blocked?: boolean;
  blockedReason?: string;
}

export interface ExternalLookupInput {
  year: number;
  make: string;
  model: string;
  trim?: string;
}

// =============================================================================
// WHEEL-SIZE API RESPONSE TYPES
// =============================================================================

interface WheelSizeModification {
  slug: string;
  name: string;
  trim: string;
  generation: {
    name: string;
    bodies: Array<{ title: string }>;
  };
  wheels: Array<{
    front: WheelSizeWheel;
    rear: WheelSizeWheel;
    showing_fp_only: boolean;
    is_stock: boolean;
  }>;
}

interface WheelSizeWheel {
  tire: string;           // e.g., "215/70R15"
  tire_pressure: { front: number; rear: number } | null;
  rim: string;            // e.g., "15x6"
  rim_offset: number;     // e.g., 45
  rim_info: {
    diameter: number;     // e.g., 15
    width: number;        // e.g., 6
    offset: number;       // e.g., 45
  };
  bolt_pattern: string;   // e.g., "5x115"
  center_bore: number;    // e.g., 70.3
  hardware: {
    type: string;         // e.g., "nut"
    thread_size: string;  // e.g., "M12 x 1.5"
  };
}

interface WheelSizeResponse {
  data: WheelSizeModification[];
}

// =============================================================================
// MAIN LOOKUP FUNCTION
// =============================================================================

export async function lookupExternalFitment(
  input: ExternalLookupInput
): Promise<ExternalLookupResult> {
  const startTime = Date.now();
  const { year, make, model, trim } = input;
  const vehicleStr = `${year} ${make} ${model}${trim ? ` ${trim}` : ""}`;
  
  console.log(`[external-fitment] Looking up: ${vehicleStr}`);
  
  // Check if API is available
  const state = await getGovernorState();
  if (state.killSwitchActive) {
    console.warn(`[external-fitment] Kill switch active: ${state.killSwitchReason}`);
    return createFailureResult("Wheel-Size API temporarily unavailable", startTime);
  }
  
  // Build API call
  const baseUrl = "https://api.wheel-size.com/v2";
  const apiKey = process.env.WHEEL_SIZE_API_KEY;
  
  if (!apiKey) {
    console.warn("[external-fitment] No API key configured");
    return createFailureResult("External lookup not configured", startTime);
  }
  
  const params: Record<string, string> = {
    user_key: apiKey,
    year: String(year),
    make: make,
    model: model,
  };
  
  if (trim) {
    params.trim = trim;
  }
  
  // Make governed API call
  const result = await governedCall<WheelSizeResponse>({
    endpoint: "/modifications",
    params,
    vehicle: vehicleStr,
    fetcher: async () => {
      const url = `${baseUrl}/modifications/?${new URLSearchParams(params)}`;
      return fetch(url);
    },
  });
  
  const durationMs = Date.now() - startTime;
  
  // Handle blocked/error
  if (result.blocked) {
    console.warn(`[external-fitment] Blocked: ${result.blockedReason}`);
    return {
      success: false,
      confidence: "low",
      source: "none",
      sourceName: "Wheel-Size API (blocked)",
      messaging: {
        formatted: `I couldn't look up the ${vehicleStr} right now.`,
        confidenceNote: "External lookup unavailable",
      },
      requiresCustomerVerification: true,
      lookupDurationMs: durationMs,
      blocked: true,
      blockedReason: result.blockedReason,
    };
  }
  
  if (!result.success || !result.data) {
    console.warn(`[external-fitment] API error: ${result.error}`);
    return createFailureResult(result.error || "API error", startTime);
  }
  
  // Parse response
  const modifications = result.data.data;
  
  if (!modifications || modifications.length === 0) {
    console.log(`[external-fitment] No data found for ${vehicleStr}`);
    return createFailureResult("Vehicle not found in external database", startTime);
  }
  
  // Extract fitment data from all modifications
  const fitmentData = extractFitmentData(modifications, vehicleStr);
  
  if (!fitmentData) {
    console.log(`[external-fitment] Could not extract fitment from response`);
    return createFailureResult("Could not parse fitment data", startTime);
  }
  
  // Determine confidence based on data quality
  const confidence = determineConfidence(fitmentData, modifications);
  
  console.log(`[external-fitment] Success: ${vehicleStr}, confidence: ${confidence}`);
  
  return {
    success: true,
    confidence,
    source: "wheel_size_api",
    sourceName: "Wheel-Size.com",
    fitment: fitmentData,
    messaging: {
      formatted: buildFormattedMessage(vehicleStr, fitmentData, confidence),
      confidenceNote: confidence === "high" 
        ? "This is OEM reference data from Wheel-Size.com"
        : confidence === "medium"
        ? "This appears to match your vehicle, but verify the tire size on your door sticker to be sure"
        : "This is approximate data - please verify your tire size",
    },
    requiresCustomerVerification: confidence !== "high",
    rawResponse: result.data,
    lookupDurationMs: durationMs,
    cached: result.cached,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createFailureResult(reason: string, startTime: number): ExternalLookupResult {
  return {
    success: false,
    confidence: "low",
    source: "none",
    sourceName: "None",
    messaging: {
      formatted: "I couldn't find this vehicle in my external reference databases.",
      confidenceNote: reason,
    },
    requiresCustomerVerification: true,
    lookupDurationMs: Date.now() - startTime,
  };
}

function extractFitmentData(
  modifications: WheelSizeModification[],
  vehicleStr: string
): ExternalLookupResult["fitment"] | null {
  // Collect all unique specs across modifications
  const boltPatterns = new Set<string>();
  const centerBores = new Set<number>();
  const threadSizes = new Set<string>();
  const tireSizes = new Set<string>();
  const wheelDiameters = new Set<number>();
  const wheelWidths = new Set<number>();
  const offsets: number[] = [];
  
  for (const mod of modifications) {
    // Skip modifications with no wheel data (wheels might be 0, undefined, or empty array)
    if (!mod.wheels || !Array.isArray(mod.wheels) || mod.wheels.length === 0) {
      continue;
    }
    
    for (const wheelSet of mod.wheels) {
      // Prefer stock wheels for OEM data
      const wheel = wheelSet.front;
      
      if (wheel.bolt_pattern) {
        boltPatterns.add(wheel.bolt_pattern);
      }
      if (wheel.center_bore) {
        centerBores.add(wheel.center_bore);
      }
      if (wheel.hardware?.thread_size) {
        // Normalize thread size: "M12 x 1.5" -> "12x1.5"
        const threadSize = wheel.hardware.thread_size
          .replace(/^M/, "")
          .replace(/\s+x\s+/, "x");
        threadSizes.add(threadSize);
      }
      if (wheel.tire) {
        tireSizes.add(wheel.tire);
      }
      if (wheel.rim_info?.diameter) {
        wheelDiameters.add(wheel.rim_info.diameter);
      }
      if (wheel.rim_info?.width) {
        wheelWidths.add(wheel.rim_info.width);
      }
      if (wheel.rim_info?.offset !== undefined) {
        offsets.push(wheel.rim_info.offset);
      }
      
      // Also check rear wheel if different (staggered)
      if (wheelSet.rear && wheelSet.rear.tire !== wheel.tire) {
        tireSizes.add(wheelSet.rear.tire);
        if (wheelSet.rear.rim_info?.diameter) {
          wheelDiameters.add(wheelSet.rear.rim_info.diameter);
        }
        if (wheelSet.rear.rim_info?.width) {
          wheelWidths.add(wheelSet.rear.rim_info.width);
        }
        if (wheelSet.rear.rim_info?.offset !== undefined) {
          offsets.push(wheelSet.rear.rim_info.offset);
        }
      }
    }
  }
  
  // Must have at least bolt pattern and tire size
  if (boltPatterns.size === 0 || tireSizes.size === 0) {
    return null;
  }
  
  // Use most common bolt pattern (should usually be just one)
  const boltPattern = Array.from(boltPatterns)[0];
  
  // Calculate offset range
  let offsetRange: { min: number; max: number } | undefined;
  if (offsets.length > 0) {
    offsetRange = {
      min: Math.min(...offsets),
      max: Math.max(...offsets),
    };
  }
  
  return {
    boltPattern,
    boltPatternMetric: boltPattern, // Already in metric format from API
    centerBore: centerBores.size > 0 ? Array.from(centerBores)[0] : undefined,
    threadSize: threadSizes.size > 0 ? Array.from(threadSizes)[0] : undefined,
    tireSizes: Array.from(tireSizes).sort(),
    wheelDiameters: Array.from(wheelDiameters).sort((a, b) => a - b),
    wheelWidths: wheelWidths.size > 0 ? Array.from(wheelWidths).sort((a, b) => a - b) : undefined,
    offsetRange,
  };
}

function determineConfidence(
  fitment: NonNullable<ExternalLookupResult["fitment"]>,
  modifications: WheelSizeModification[]
): ExternalLookupConfidence {
  // High confidence if we have complete data
  if (
    fitment.boltPattern &&
    fitment.centerBore &&
    fitment.tireSizes.length > 0 &&
    fitment.wheelDiameters.length > 0
  ) {
    return "high";
  }
  
  // Medium confidence if we have basic data
  if (fitment.boltPattern && fitment.tireSizes.length > 0) {
    return "medium";
  }
  
  // Low confidence otherwise
  return "low";
}

function buildFormattedMessage(
  vehicleStr: string,
  fitment: NonNullable<ExternalLookupResult["fitment"]>,
  confidence: ExternalLookupConfidence
): string {
  const lines: string[] = [];
  
  if (confidence === "high") {
    lines.push(`I found OEM reference data for the ${vehicleStr}:`);
  } else {
    lines.push(`I found some reference data for the ${vehicleStr}:`);
  }
  
  lines.push("");
  lines.push(`• Bolt Pattern: ${fitment.boltPattern}`);
  
  if (fitment.centerBore) {
    lines.push(`• Hub Bore: ${fitment.centerBore}mm`);
  }
  
  if (fitment.tireSizes.length > 0) {
    lines.push(`• OEM Tire Sizes: ${fitment.tireSizes.join(", ")}`);
  }
  
  if (fitment.wheelDiameters.length > 0) {
    lines.push(`• OEM Wheel Sizes: ${fitment.wheelDiameters.join('", ')}"`);
  }
  
  if (confidence !== "high") {
    lines.push("");
    lines.push("⚠️ Please verify the tire size on your door sticker to confirm.");
  }
  
  return lines.join("\n");
}

// =============================================================================
// ADMIN/DIAGNOSTIC FUNCTIONS
// =============================================================================

export async function getExternalLookupStatus(): Promise<{
  available: boolean;
  apiKeyConfigured: boolean;
  governorState: Awaited<ReturnType<typeof getGovernorState>>;
}> {
  const state = await getGovernorState();
  
  return {
    available: !state.killSwitchActive && !!process.env.WHEEL_SIZE_API_KEY,
    apiKeyConfigured: !!process.env.WHEEL_SIZE_API_KEY,
    governorState: state,
  };
}
