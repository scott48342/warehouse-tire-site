/**
 * Rear Wheel Configuration (SRW/DRW) Detection
 * 
 * Determines if a vehicle is DRW-capable and handles SRW/DRW routing.
 * Used to gate wheel and tire results for HD trucks.
 */

export type RearWheelConfig = 'srw' | 'drw';

// ═══════════════════════════════════════════════════════════════════════════
// DRW-CAPABLE MODELS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Models that can have DRW (Dually) configuration.
 * Only 3500-class trucks support dual rear wheels.
 */
const DRW_CAPABLE_MODELS: Array<{ make: string; modelPattern: RegExp }> = [
  // Chevrolet
  { make: 'chevrolet', modelPattern: /silverado.*3500/i },
  // GMC
  { make: 'gmc', modelPattern: /sierra.*3500/i },
  // Ford
  { make: 'ford', modelPattern: /f-?350/i },
  // Ram
  { make: 'ram', modelPattern: /3500/i },
  // Dodge (pre-2010)
  { make: 'dodge', modelPattern: /ram.*3500/i },
];

// ═══════════════════════════════════════════════════════════════════════════
// TRIM DETECTION PATTERNS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Trim patterns that indicate DRW (Dually)
 */
const DRW_TRIM_PATTERNS = [
  /\bDRW\b/i,
  /\bDually\b/i,
  /\bDual.?Rear.?Wheel/i,
  /\bChassis.?Cab\b/i,
];

/**
 * Trim patterns that indicate SRW (Single Rear Wheel)
 */
const SRW_TRIM_PATTERNS = [
  /\bSRW\b/i,
  /\bSingle.?Rear.?Wheel/i,
];

// ═══════════════════════════════════════════════════════════════════════════
// DETECTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a vehicle model is DRW-capable (can have dual rear wheels)
 */
export function isDRWCapable(make: string, model: string): boolean {
  if (!make || !model) return false;
  
  const makeLower = make.toLowerCase();
  
  return DRW_CAPABLE_MODELS.some(entry => 
    entry.make === makeLower && entry.modelPattern.test(model)
  );
}

/**
 * Check if vehicle needs rear wheel config selection before showing results.
 * Returns true if:
 * - Vehicle is DRW-capable AND
 * - Trim doesn't clearly indicate SRW or DRW
 */
export function needsRearWheelConfigSelection(
  make: string,
  model: string,
  trim?: string | null
): boolean {
  // Must be DRW-capable
  if (!isDRWCapable(make, model)) {
    return false;
  }
  
  // If trim clearly indicates SRW or DRW, no selection needed
  if (trim) {
    if (SRW_TRIM_PATTERNS.some(p => p.test(trim))) {
      return false; // Clearly SRW
    }
    if (DRW_TRIM_PATTERNS.some(p => p.test(trim))) {
      return false; // Clearly DRW
    }
  }
  
  // DRW-capable but trim doesn't specify - need user selection
  return true;
}

/**
 * Infer rear wheel config from trim if possible
 */
export function inferRearWheelConfig(trim?: string | null): RearWheelConfig | null {
  if (!trim) return null;
  
  // Check for explicit DRW indicators
  if (DRW_TRIM_PATTERNS.some(p => p.test(trim))) {
    return 'drw';
  }
  
  // Check for explicit SRW indicators
  if (SRW_TRIM_PATTERNS.some(p => p.test(trim))) {
    return 'srw';
  }
  
  return null;
}

/**
 * Get the effective rear wheel config for a vehicle.
 * Priority:
 * 1. Explicit user selection (from URL param)
 * 2. Inferred from trim
 * 3. null (needs selection)
 */
export function getEffectiveRearWheelConfig(
  make: string,
  model: string,
  trim?: string | null,
  userSelection?: RearWheelConfig | null
): RearWheelConfig | null {
  // If not DRW-capable, always SRW
  if (!isDRWCapable(make, model)) {
    return 'srw';
  }
  
  // User selection takes priority
  if (userSelection) {
    return userSelection;
  }
  
  // Try to infer from trim
  const inferred = inferRearWheelConfig(trim);
  if (inferred) {
    return inferred;
  }
  
  // Can't determine - needs user input
  return null;
}

/**
 * Validate that rearWheelConfig is set for DRW-capable vehicles.
 * Returns true if results can be shown, false if config is required but missing.
 */
export function canShowResults(
  make: string,
  model: string,
  trim?: string | null,
  rearWheelConfig?: RearWheelConfig | null
): boolean {
  const effective = getEffectiveRearWheelConfig(make, model, trim, rearWheelConfig);
  return effective !== null;
}

/**
 * Get display info for rear wheel config options
 */
export function getRearWheelConfigOptions(): Array<{
  value: RearWheelConfig;
  label: string;
  description: string;
}> {
  return [
    {
      value: 'srw',
      label: 'Single Rear Wheel (SRW)',
      description: 'Standard pickup configuration with single rear wheels',
    },
    {
      value: 'drw',
      label: 'Dual Rear Wheel (Dually)',
      description: 'Heavy-duty configuration with dual rear wheels',
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY PARAM HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse rearWheelConfig from URL search params
 */
export function parseRearWheelConfigParam(value: string | null): RearWheelConfig | null {
  if (value === 'srw' || value === 'drw') {
    return value;
  }
  return null;
}

/**
 * Build URL search params with rearWheelConfig
 */
export function buildRearWheelConfigParam(
  params: URLSearchParams,
  config: RearWheelConfig
): URLSearchParams {
  const newParams = new URLSearchParams(params);
  newParams.set('rearWheelConfig', config);
  return newParams;
}

export default {
  isDRWCapable,
  needsRearWheelConfigSelection,
  inferRearWheelConfig,
  getEffectiveRearWheelConfig,
  canShowResults,
  getRearWheelConfigOptions,
  parseRearWheelConfigParam,
  buildRearWheelConfigParam,
};
