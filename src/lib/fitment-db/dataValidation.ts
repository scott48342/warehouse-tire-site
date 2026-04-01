/**
 * FITMENT DATA VALIDATION
 * 
 * Validation functions for wheel sizes, tire sizes, and fitment data.
 * Used to reject invalid formats and ensure data integrity.
 * 
 * All validation functions return { valid: boolean, error?: string }
 */

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalized?: any;
}

export interface WheelSizeObject {
  diameter: number;
  width?: number;
  offset?: number;
}

// ============================================================================
// Wheel Size Validation
// ============================================================================

/**
 * Valid wheel size formats:
 * - Object: { diameter: 18, width: 8 }
 * - String: "18x8", "18x8.5", "17x7.5J", "7.5Jx17"
 * - Range string: "17-20" (for arrays of supported sizes)
 */
export function validateWheelSize(size: unknown): ValidationResult {
  if (size === null || size === undefined) {
    return { valid: false, error: "wheel_size_null" };
  }

  // Object format
  if (typeof size === "object" && size !== null) {
    const obj = size as Record<string, unknown>;
    
    if (typeof obj.diameter === "number" && obj.diameter >= 12 && obj.diameter <= 30) {
      return { 
        valid: true, 
        normalized: {
          diameter: obj.diameter,
          width: typeof obj.width === "number" ? obj.width : undefined,
          offset: typeof obj.offset === "number" ? obj.offset : undefined,
        }
      };
    }
    return { valid: false, error: "wheel_size_object_missing_diameter" };
  }

  // String format
  if (typeof size === "string") {
    const s = size.trim();
    
    // Check for corruption
    if (s.includes("[object") || s === "undefined" || s === "null") {
      return { valid: false, error: "wheel_size_corrupted" };
    }

    // Format: "18x8" or "18x8.5"
    const match1 = s.match(/^(\d{2})x(\d+(?:\.\d+)?)$/i);
    if (match1) {
      const diameter = parseInt(match1[1], 10);
      const width = parseFloat(match1[2]);
      if (diameter >= 12 && diameter <= 30) {
        return { valid: true, normalized: { diameter, width } };
      }
    }

    // Format: "17x7.5J" or "7.5Jx17"
    const match2 = s.match(/^(\d{2})x(\d+(?:\.\d+)?)J$/i);
    if (match2) {
      const diameter = parseInt(match2[1], 10);
      const width = parseFloat(match2[2]);
      if (diameter >= 12 && diameter <= 30) {
        return { valid: true, normalized: { diameter, width } };
      }
    }

    const match3 = s.match(/^(\d+(?:\.\d+)?)Jx(\d{2})$/i);
    if (match3) {
      const width = parseFloat(match3[1]);
      const diameter = parseInt(match3[2], 10);
      if (diameter >= 12 && diameter <= 30) {
        return { valid: true, normalized: { diameter, width } };
      }
    }

    // Just diameter: "18" (for array items representing available sizes)
    const match4 = s.match(/^(\d{2})$/);
    if (match4) {
      const diameter = parseInt(match4[1], 10);
      if (diameter >= 12 && diameter <= 30) {
        return { valid: true, normalized: { diameter } };
      }
    }

    return { valid: false, error: `wheel_size_unrecognized_format: ${s}` };
  }

  return { valid: false, error: "wheel_size_invalid_type" };
}

/**
 * Validate an array of wheel sizes
 */
export function validateWheelSizeArray(sizes: unknown): ValidationResult {
  if (!Array.isArray(sizes)) {
    return { valid: false, error: "wheel_sizes_not_array" };
  }

  if (sizes.length === 0) {
    return { valid: false, error: "wheel_sizes_empty" };
  }

  const normalized: WheelSizeObject[] = [];
  
  for (let i = 0; i < sizes.length; i++) {
    const result = validateWheelSize(sizes[i]);
    if (!result.valid) {
      return { valid: false, error: `wheel_sizes[${i}]: ${result.error}` };
    }
    if (result.normalized) {
      normalized.push(result.normalized);
    }
  }

  return { valid: true, normalized };
}

// ============================================================================
// Tire Size Validation
// ============================================================================

/**
 * Valid tire size formats:
 * - Standard: "225/45R17", "P265/70R17", "LT285/75R16"
 * - Vintage: "E70-14", "G78-15" (bias-ply)
 */
export function validateTireSize(size: unknown): ValidationResult {
  if (size === null || size === undefined) {
    return { valid: false, error: "tire_size_null" };
  }

  if (typeof size !== "string") {
    return { valid: false, error: "tire_size_not_string" };
  }

  const s = size.trim();

  // Check for corruption
  if (s.includes("[object") || s === "undefined" || s === "null") {
    return { valid: false, error: "tire_size_corrupted" };
  }

  // Standard format: "225/45R17", "P265/70R17", "LT285/75R16"
  const match1 = s.match(/^(P|LT)?(\d{3})\/(\d{2,3})(R|ZR)(\d{2})$/i);
  if (match1) {
    return { 
      valid: true, 
      normalized: {
        prefix: match1[1] || null,
        width: parseInt(match1[2], 10),
        aspectRatio: parseInt(match1[3], 10),
        construction: match1[4].toUpperCase(),
        diameter: parseInt(match1[5], 10),
      }
    };
  }

  // Vintage bias-ply: "E70-14", "G78-15"
  const match2 = s.match(/^([A-Z])(\d{2})-(\d{2})$/i);
  if (match2) {
    return { 
      valid: true, 
      normalized: {
        biasCode: match2[1].toUpperCase(),
        aspectCode: parseInt(match2[2], 10),
        diameter: parseInt(match2[3], 10),
        isBiasPly: true,
      }
    };
  }

  return { valid: false, error: `tire_size_unrecognized_format: ${s}` };
}

/**
 * Validate an array of tire sizes
 */
export function validateTireSizeArray(sizes: unknown): ValidationResult {
  if (!Array.isArray(sizes)) {
    return { valid: false, error: "tire_sizes_not_array" };
  }

  if (sizes.length === 0) {
    return { valid: false, error: "tire_sizes_empty" };
  }

  const normalized: any[] = [];
  
  for (let i = 0; i < sizes.length; i++) {
    const result = validateTireSize(sizes[i]);
    if (!result.valid) {
      return { valid: false, error: `tire_sizes[${i}]: ${result.error}` };
    }
    if (result.normalized) {
      normalized.push(result.normalized);
    }
  }

  return { valid: true, normalized };
}

// ============================================================================
// Bolt Pattern Validation
// ============================================================================

/**
 * Valid bolt patterns: "5x114.3", "6x139.7", "8x165.1"
 */
export function validateBoltPattern(pattern: unknown): ValidationResult {
  if (pattern === null || pattern === undefined) {
    return { valid: false, error: "bolt_pattern_null" };
  }

  if (typeof pattern !== "string") {
    return { valid: false, error: "bolt_pattern_not_string" };
  }

  const s = pattern.trim();
  const match = s.match(/^(\d+)x(\d+(?:\.\d+)?)$/);
  
  if (!match) {
    return { valid: false, error: `bolt_pattern_invalid_format: ${s}` };
  }

  const bolts = parseInt(match[1], 10);
  const pcd = parseFloat(match[2]);

  if (bolts < 3 || bolts > 10) {
    return { valid: false, error: `bolt_pattern_invalid_count: ${bolts}` };
  }

  if (pcd < 50 || pcd > 250) {
    return { valid: false, error: `bolt_pattern_invalid_pcd: ${pcd}` };
  }

  return { 
    valid: true, 
    normalized: { bolts, pcd, pattern: `${bolts}x${pcd}` }
  };
}

// ============================================================================
// Center Bore Validation
// ============================================================================

/**
 * Valid center bore: 50mm - 180mm
 */
export function validateCenterBore(cb: unknown): ValidationResult {
  if (cb === null || cb === undefined) {
    return { valid: false, error: "center_bore_null" };
  }

  let value: number;
  
  if (typeof cb === "number") {
    value = cb;
  } else if (typeof cb === "string") {
    // Handle "71.5mm" or "71.5" formats
    const match = cb.trim().match(/^(\d+(?:\.\d+)?)\s*(mm)?$/i);
    if (!match) {
      return { valid: false, error: `center_bore_invalid_format: ${cb}` };
    }
    value = parseFloat(match[1]);
  } else {
    return { valid: false, error: "center_bore_invalid_type" };
  }

  if (isNaN(value) || value < 50 || value > 180) {
    return { valid: false, error: `center_bore_out_of_range: ${value}` };
  }

  return { valid: true, normalized: value };
}

// ============================================================================
// Thread Size Validation
// ============================================================================

/**
 * Valid thread sizes: "M12x1.5", "M14x1.5", "M14 x 1.5"
 */
export function validateThreadSize(thread: unknown): ValidationResult {
  if (thread === null || thread === undefined) {
    return { valid: false, error: "thread_size_null" };
  }

  if (typeof thread !== "string") {
    return { valid: false, error: "thread_size_not_string" };
  }

  const s = thread.trim();
  const match = s.match(/^M(\d+)\s*[xX]\s*(\d+(?:\.\d+)?)$/i);
  
  if (!match) {
    return { valid: false, error: `thread_size_invalid_format: ${s}` };
  }

  const diameter = parseInt(match[1], 10);
  const pitch = parseFloat(match[2]);

  return { 
    valid: true, 
    normalized: { diameter, pitch, thread: `M${diameter}x${pitch}` }
  };
}

// ============================================================================
// Complete Fitment Record Validation
// ============================================================================

export interface FitmentValidationResult {
  valid: boolean;
  errors: string[];
  classification: "A" | "B" | "C" | "D";
}

/**
 * Validate a complete fitment record for data integrity
 */
export function validateFitmentRecord(record: {
  year?: number;
  make?: string;
  model?: string;
  bolt_pattern?: string;
  center_bore_mm?: string | number;
  thread_size?: string;
  oem_wheel_sizes?: unknown;
  oem_tire_sizes?: unknown;
}): FitmentValidationResult {
  const errors: string[] = [];

  // Critical fields
  if (!record.year || record.year < 1900 || record.year > 2030) {
    errors.push("invalid_year");
  }
  if (!record.make || typeof record.make !== "string" || record.make.trim() === "") {
    errors.push("missing_make");
  }
  if (!record.model || typeof record.model !== "string" || record.model.trim() === "") {
    errors.push("missing_model");
  }

  const boltResult = validateBoltPattern(record.bolt_pattern);
  if (!boltResult.valid) errors.push(boltResult.error!);

  const cbResult = validateCenterBore(record.center_bore_mm);
  if (!cbResult.valid) errors.push(cbResult.error!);

  const threadResult = validateThreadSize(record.thread_size);
  if (!threadResult.valid) errors.push(threadResult.error!);

  // Non-critical but important
  let hasWheelSizes = false;
  let hasTireSizes = false;

  if (Array.isArray(record.oem_wheel_sizes) && record.oem_wheel_sizes.length > 0) {
    const wheelResult = validateWheelSizeArray(record.oem_wheel_sizes);
    if (wheelResult.valid) {
      hasWheelSizes = true;
    } else {
      errors.push(wheelResult.error!);
    }
  }

  if (Array.isArray(record.oem_tire_sizes) && record.oem_tire_sizes.length > 0) {
    const tireResult = validateTireSizeArray(record.oem_tire_sizes);
    if (tireResult.valid) {
      hasTireSizes = true;
    }
    // Tire size errors are non-critical
  }

  // Classify
  const criticalErrors = errors.filter(e => 
    e.includes("bolt_pattern") || 
    e.includes("center_bore") || 
    e.includes("invalid_year") ||
    e.includes("missing_make") ||
    e.includes("missing_model")
  );

  const hasCorruption = errors.some(e => e.includes("corrupted"));

  let classification: "A" | "B" | "C" | "D";
  if (hasCorruption || criticalErrors.length >= 3) {
    classification = "D";
  } else if (criticalErrors.length > 0) {
    classification = "C";
  } else if (errors.length > 0 || !hasWheelSizes || !hasTireSizes) {
    classification = "B";
  } else {
    classification = "A";
  }

  return {
    valid: classification === "A" || classification === "B",
    errors,
    classification,
  };
}
