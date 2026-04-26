/**
 * Fitment Certification Rules
 * 
 * Deterministic validation rules for fitment records.
 * This is the canonical rule set - any change here affects all certification.
 */

import type { FitmentRecord, CertificationError, WheelSpec } from './types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getWheelDiameters(wheels: WheelSpec[]): number[] {
  if (!Array.isArray(wheels)) return [];
  return wheels.map(w => w.diameter).filter(d => typeof d === 'number' && d > 0);
}

function getTireDiameters(tires: string[]): number[] {
  if (!Array.isArray(tires)) return [];
  return tires.map(t => {
    const m = String(t).match(/R(\d+)/i);
    return m ? parseInt(m[1]) : 0;
  }).filter(d => d > 0);
}

function getWheelWidths(wheels: WheelSpec[]): number[] {
  if (!Array.isArray(wheels)) return [];
  return wheels.map(w => w.width).filter(w => typeof w === 'number' && w > 0);
}

// ============================================================================
// VALIDATION RULES
// ============================================================================

/**
 * Rule: Bolt pattern must exist
 */
export function validateBoltPattern(record: FitmentRecord): CertificationError | null {
  if (!record.bolt_pattern || record.bolt_pattern.trim() === '') {
    return {
      type: 'MISSING_BOLT_PATTERN',
      message: 'Missing bolt pattern',
    };
  }
  return null;
}

/**
 * Rule: Must have at least one wheel size
 */
export function validateWheelSizes(record: FitmentRecord): CertificationError | null {
  const wheels = record.oem_wheel_sizes || [];
  if (wheels.length === 0) {
    return {
      type: 'MISSING_WHEEL_SIZES',
      message: 'No OEM wheel sizes defined',
    };
  }
  
  const diameters = getWheelDiameters(wheels);
  if (diameters.length === 0) {
    return {
      type: 'INVALID_DIAMETER',
      message: 'Could not extract wheel diameters from wheel specs',
    };
  }
  
  return null;
}

/**
 * Rule: Must have at least one tire size
 */
export function validateTireSizes(record: FitmentRecord): CertificationError | null {
  const tires = record.oem_tire_sizes || [];
  if (tires.length === 0) {
    return {
      type: 'MISSING_TIRE_SIZES',
      message: 'No OEM tire sizes defined',
    };
  }
  return null;
}

/**
 * Rule: Tire diameters must match wheel diameters
 */
export function validateDiameterMatch(record: FitmentRecord): CertificationError | null {
  const wheels = record.oem_wheel_sizes || [];
  const tires = record.oem_tire_sizes || [];
  
  if (wheels.length === 0 || tires.length === 0) return null; // Handled by other rules
  
  const wheelDiams = new Set(getWheelDiameters(wheels));
  const tireDiams = getTireDiameters(tires);
  
  if (wheelDiams.size === 0 || tireDiams.length === 0) return null;
  
  const mismatched = tireDiams.filter(d => !wheelDiams.has(d));
  const matchRatio = (tireDiams.length - mismatched.length) / tireDiams.length;
  
  // Allow if at least 50% of tires match wheels
  if (matchRatio < 0.5) {
    return {
      type: 'DATA_MISMATCH',
      message: `Tire diameters don't match wheel diameters`,
      details: {
        wheelDiameters: [...wheelDiams],
        tireDiameters: [...new Set(tireDiams)],
        matchRatio,
      },
    };
  }
  
  return null;
}

/**
 * Rule: Wheel diameter spread should be reasonable (max 6" range for OEM)
 */
export function validateWheelSpread(record: FitmentRecord): CertificationError | null {
  const wheels = record.oem_wheel_sizes || [];
  const diameters = getWheelDiameters(wheels);
  
  if (diameters.length < 2) return null;
  
  const min = Math.min(...diameters);
  const max = Math.max(...diameters);
  const spread = max - min;
  
  if (spread > 6) {
    return {
      type: 'WHEEL_SPREAD',
      message: `Wheel diameter spread too large: ${min}" to ${max}" (${spread}" spread)`,
      details: { min, max, spread },
    };
  }
  
  return null;
}

/**
 * Rule: Too many wheel options indicates contamination (soup)
 */
export function validateWheelSoup(record: FitmentRecord): CertificationError | null {
  const wheels = record.oem_wheel_sizes || [];
  const stockWheels = wheels.filter(w => w.isStock !== false);
  
  // More than 8 stock wheel options is suspicious
  if (stockWheels.length > 8) {
    return {
      type: 'WHEEL_SOUP',
      message: `Too many wheel options (${stockWheels.length})`,
      details: { count: stockWheels.length },
    };
  }
  
  return null;
}

/**
 * Rule: Too many tire options indicates contamination (soup)
 */
export function validateTireSoup(record: FitmentRecord): CertificationError | null {
  const tires = record.oem_tire_sizes || [];
  
  // More than 10 tire options is suspicious
  if (tires.length > 10) {
    return {
      type: 'TIRE_SOUP',
      message: `Too many tire options (${tires.length})`,
      details: { count: tires.length },
    };
  }
  
  return null;
}

/**
 * Rule: Check for modern tires on classic vehicles
 */
export function validateEraAppropriate(record: FitmentRecord): CertificationError | null {
  const year = record.year;
  const tires = record.oem_tire_sizes || [];
  const tireDiams = getTireDiameters(tires);
  
  if (tireDiams.length === 0) return null;
  
  const maxTireDiam = Math.max(...tireDiams);
  
  // Pre-1985: max 16"
  if (year < 1985 && maxTireDiam > 16) {
    return {
      type: 'MODERN_TIRES_ON_CLASSIC',
      message: `R${maxTireDiam} tires unlikely on ${year} vehicle`,
      details: { year, maxTireDiam },
    };
  }
  
  // Pre-1995: max 18"
  if (year < 1995 && maxTireDiam > 18) {
    return {
      type: 'MODERN_TIRES_ON_CLASSIC',
      message: `R${maxTireDiam} tires unlikely on ${year} vehicle`,
      details: { year, maxTireDiam },
    };
  }
  
  return null;
}

/**
 * Rule: Check for aftermarket wheel contamination
 */
export function validateAftermarketWheels(record: FitmentRecord): CertificationError | null {
  const year = record.year;
  const wheels = record.oem_wheel_sizes || [];
  const diameters = getWheelDiameters(wheels);
  
  if (diameters.length === 0) return null;
  
  const maxDiam = Math.max(...diameters);
  
  // Era-based max OEM wheel sizes
  let maxOEM = 22;
  if (year < 1990) maxOEM = 16;
  else if (year < 2000) maxOEM = 18;
  else if (year < 2010) maxOEM = 20;
  else if (year < 2015) maxOEM = 22;
  else maxOEM = 24;
  
  if (maxDiam > maxOEM) {
    return {
      type: 'AFTERMARKET_WHEEL',
      message: `${maxDiam}" wheels exceed era-appropriate OEM max (${maxOEM}")`,
      details: { year, maxDiam, maxOEM },
    };
  }
  
  return null;
}

// ============================================================================
// MAIN CERTIFICATION FUNCTION
// ============================================================================

/**
 * Run all certification rules against a fitment record.
 * Returns array of errors (empty = certified).
 */
export function certifyRecord(record: FitmentRecord): CertificationError[] {
  const errors: CertificationError[] = [];
  
  // Run all rules
  const rules = [
    validateBoltPattern,
    validateWheelSizes,
    validateTireSizes,
    validateDiameterMatch,
    validateWheelSpread,
    validateWheelSoup,
    validateTireSoup,
    validateEraAppropriate,
    validateAftermarketWheels,
  ];
  
  for (const rule of rules) {
    const error = rule(record);
    if (error) {
      errors.push(error);
    }
  }
  
  return errors;
}
