/**
 * Fitment Staging Validation Rules
 * 
 * Checks applied to staged records before promotion to production.
 * Reuses logic from existing audit systems.
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ValidationCheck {
  name: string;
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: Record<string, any>;
}

export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
  flags: string[];
  confidence: 'high' | 'medium' | 'low' | 'unknown';
}

export interface StagedRecord {
  id: string;
  year: number;
  make: string;
  model: string;
  displayTrim?: string;
  boltPattern?: string;
  centerBoreMm?: number;
  threadSize?: string;
  offsetMinMm?: number;
  offsetMaxMm?: number;
  oemWheelSizes?: any[];
  oemTireSizes?: any[];
}

// ═══════════════════════════════════════════════════════════════════════════
// MINIMUM DIAMETER FLOORS (from HD templates)
// ═══════════════════════════════════════════════════════════════════════════

const MIN_DIAMETER_BY_MODEL: Record<string, number> = {
  // HD trucks
  "silverado-2500hd": 17, "silverado-2500-hd": 17,
  "silverado-3500hd": 17, "silverado-3500-hd": 17,
  "sierra-2500hd": 17, "sierra-2500-hd": 17,
  "sierra-3500hd": 17, "sierra-3500-hd": 17,
  "2500": 17, "3500": 17,
  "f-250": 17, "f-350": 17,
  
  // Light trucks
  "silverado-1500": 16, "sierra-1500": 16, "1500": 16,
  "f-150": 16, "ram-1500": 16,
  
  // Full-size SUV
  "tahoe": 17, "suburban": 17, "yukon": 17, "yukon-xl": 17,
  "escalade": 17, "escalade-esv": 17, "expedition": 17,
  
  // Default
  "default": 14,
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPECTED BOLT PATTERNS BY MAKE
// ═══════════════════════════════════════════════════════════════════════════

const EXPECTED_BOLT_PATTERNS: Record<string, string[]> = {
  chevrolet: ['6x139.7', '5x120', '5x127', '8x165.1', '8x180', '5x115', '5x110'],
  gmc: ['6x139.7', '5x120', '8x165.1', '8x180', '5x115'],
  ford: ['6x135', '5x114.3', '5x108', '8x170', '8x200', '5x120'],
  ram: ['5x139.7', '6x139.7', '8x165.1', '5x115'],
  dodge: ['5x139.7', '5x115', '5x114.3', '8x165.1'],
  toyota: ['6x139.7', '5x114.3', '5x150', '5x127'],
  honda: ['5x114.3', '5x120', '4x100', '5x100'],
  nissan: ['6x139.7', '5x114.3', '5x120'],
  jeep: ['5x127', '5x114.3', '5x139.7'],
};

// ═══════════════════════════════════════════════════════════════════════════
// GENERATION BOUNDARIES (prevent cross-gen contamination)
// ═══════════════════════════════════════════════════════════════════════════

const PLATFORM_GENERATIONS: Record<string, Record<string, [number, number][]>> = {
  chevrolet: {
    "silverado-1500": [[1999, 2006], [2007, 2013], [2014, 2018], [2019, 2027]],
    "silverado-2500hd": [[1999, 2006], [2007, 2014], [2015, 2019], [2020, 2027]],
    "tahoe": [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2027]],
    "suburban": [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2027]],
  },
  gmc: {
    "sierra-1500": [[1999, 2006], [2007, 2013], [2014, 2018], [2019, 2027]],
    "yukon": [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2027]],
  },
  ford: {
    "f-150": [[1997, 2003], [2004, 2008], [2009, 2014], [2015, 2020], [2021, 2027]],
    "f-250": [[1999, 2007], [2008, 2010], [2011, 2016], [2017, 2027]],
  },
  ram: {
    "1500": [[2002, 2008], [2009, 2018], [2019, 2027]],
    "2500": [[2003, 2009], [2010, 2018], [2019, 2027]],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check required fields are present
 */
export function checkRequiredFields(record: StagedRecord): ValidationCheck {
  const missing: string[] = [];
  
  if (!record.year || record.year < 1990 || record.year > 2030) {
    missing.push('year');
  }
  if (!record.make || record.make.trim().length === 0) {
    missing.push('make');
  }
  if (!record.model || record.model.trim().length === 0) {
    missing.push('model');
  }
  
  return {
    name: 'required_fields',
    passed: missing.length === 0,
    severity: missing.length > 0 ? 'error' : 'info',
    message: missing.length > 0 
      ? `Missing required fields: ${missing.join(', ')}`
      : 'All required fields present',
    details: { missing },
  };
}

/**
 * Check wheel specs are present and valid
 */
export function checkWheelSpecs(record: StagedRecord): ValidationCheck {
  const issues: string[] = [];
  
  // Check OEM wheel sizes
  if (!record.oemWheelSizes || !Array.isArray(record.oemWheelSizes) || record.oemWheelSizes.length === 0) {
    issues.push('No OEM wheel sizes defined');
  } else {
    // Validate each wheel size
    for (const ws of record.oemWheelSizes) {
      if (!ws || typeof ws !== 'object') {
        issues.push('Invalid wheel size entry');
        continue;
      }
      const diameter = ws.diameter || ws.rim_diameter;
      const width = ws.width || ws.rim_width;
      
      if (!diameter || diameter < 14 || diameter > 26) {
        issues.push(`Invalid diameter: ${diameter}`);
      }
      if (!width || width < 5 || width > 14) {
        issues.push(`Invalid width: ${width}`);
      }
    }
  }
  
  // Check minimum diameter floor
  const modelLower = record.model.toLowerCase();
  const minDiameter = MIN_DIAMETER_BY_MODEL[modelLower] || MIN_DIAMETER_BY_MODEL['default'];
  
  if (record.oemWheelSizes && record.oemWheelSizes.length > 0) {
    const diameters = record.oemWheelSizes
      .map((ws: any) => ws.diameter || ws.rim_diameter)
      .filter((d: number) => d > 0);
    
    if (diameters.length > 0) {
      const minFound = Math.min(...diameters);
      if (minFound < minDiameter) {
        issues.push(`Min diameter ${minFound}" below floor ${minDiameter}" for ${record.model}`);
      }
    }
  }
  
  return {
    name: 'wheel_specs',
    passed: issues.length === 0,
    severity: issues.length > 0 ? 'error' : 'info',
    message: issues.length > 0 
      ? issues.join('; ')
      : 'Wheel specs valid',
    details: { issues },
  };
}

/**
 * Check tire specs are present
 */
export function checkTireSpecs(record: StagedRecord): ValidationCheck {
  if (!record.oemTireSizes || !Array.isArray(record.oemTireSizes) || record.oemTireSizes.length === 0) {
    return {
      name: 'tire_specs',
      passed: false,
      severity: 'warning',
      message: 'No OEM tire sizes defined',
    };
  }
  
  // Validate tire size format (basic check)
  const invalidSizes: string[] = [];
  for (const size of record.oemTireSizes) {
    if (typeof size !== 'string' || !size.match(/\d{2,3}\/\d{2}[RZ]?\d{2}/)) {
      invalidSizes.push(String(size));
    }
  }
  
  return {
    name: 'tire_specs',
    passed: invalidSizes.length === 0,
    severity: invalidSizes.length > 0 ? 'warning' : 'info',
    message: invalidSizes.length > 0 
      ? `Invalid tire sizes: ${invalidSizes.join(', ')}`
      : `${record.oemTireSizes.length} valid tire sizes`,
    details: { count: record.oemTireSizes.length, invalidSizes },
  };
}

/**
 * Check bolt pattern is expected for make
 */
export function checkBoltPattern(record: StagedRecord): ValidationCheck {
  if (!record.boltPattern) {
    return {
      name: 'bolt_pattern',
      passed: false,
      severity: 'warning',
      message: 'No bolt pattern defined',
    };
  }
  
  const expected = EXPECTED_BOLT_PATTERNS[record.make.toLowerCase()];
  if (expected && !expected.includes(record.boltPattern)) {
    return {
      name: 'bolt_pattern',
      passed: false,
      severity: 'warning',
      message: `Bolt pattern ${record.boltPattern} unexpected for ${record.make}`,
      details: { expected },
    };
  }
  
  return {
    name: 'bolt_pattern',
    passed: true,
    severity: 'info',
    message: `Bolt pattern ${record.boltPattern} valid for ${record.make}`,
  };
}

/**
 * Check center bore is reasonable
 */
export function checkCenterBore(record: StagedRecord): ValidationCheck {
  if (!record.centerBoreMm) {
    return {
      name: 'center_bore',
      passed: false,
      severity: 'warning',
      message: 'No center bore defined',
    };
  }
  
  // Most center bores are between 54mm and 131mm
  if (record.centerBoreMm < 54 || record.centerBoreMm > 131) {
    return {
      name: 'center_bore',
      passed: false,
      severity: 'warning',
      message: `Center bore ${record.centerBoreMm}mm outside typical range (54-131mm)`,
    };
  }
  
  return {
    name: 'center_bore',
    passed: true,
    severity: 'info',
    message: `Center bore ${record.centerBoreMm}mm valid`,
  };
}

/**
 * Check offset range is reasonable
 */
export function checkOffsetRange(record: StagedRecord): ValidationCheck {
  if (record.offsetMinMm == null || record.offsetMaxMm == null) {
    return {
      name: 'offset_range',
      passed: true, // Not required
      severity: 'info',
      message: 'No offset range defined',
    };
  }
  
  const spread = record.offsetMaxMm - record.offsetMinMm;
  
  if (spread > 40) {
    return {
      name: 'offset_range',
      passed: false,
      severity: 'warning',
      message: `Offset spread ${spread}mm is very broad (${record.offsetMinMm} to ${record.offsetMaxMm})`,
    };
  }
  
  if (record.offsetMinMm < -50 || record.offsetMaxMm > 70) {
    return {
      name: 'offset_range',
      passed: false,
      severity: 'warning',
      message: `Offset range ${record.offsetMinMm} to ${record.offsetMaxMm}mm outside typical bounds`,
    };
  }
  
  return {
    name: 'offset_range',
    passed: true,
    severity: 'info',
    message: `Offset range ${record.offsetMinMm} to ${record.offsetMaxMm}mm valid`,
  };
}

/**
 * Check for generation boundary violations (contamination prevention)
 */
export function checkGenerationBoundary(
  record: StagedRecord, 
  existingRecords?: StagedRecord[]
): ValidationCheck {
  const makeGens = PLATFORM_GENERATIONS[record.make.toLowerCase()];
  if (!makeGens) {
    return {
      name: 'generation_boundary',
      passed: true,
      severity: 'info',
      message: 'No generation data for this make',
    };
  }
  
  const modelGens = makeGens[record.model.toLowerCase()];
  if (!modelGens) {
    return {
      name: 'generation_boundary',
      passed: true,
      severity: 'info',
      message: 'No generation data for this model',
    };
  }
  
  // Find which generation this year belongs to
  let currentGen: [number, number] | null = null;
  for (const gen of modelGens) {
    if (record.year >= gen[0] && record.year <= gen[1]) {
      currentGen = gen;
      break;
    }
  }
  
  if (!currentGen) {
    return {
      name: 'generation_boundary',
      passed: false,
      severity: 'warning',
      message: `Year ${record.year} outside known generations for ${record.make} ${record.model}`,
    };
  }
  
  return {
    name: 'generation_boundary',
    passed: true,
    severity: 'info',
    message: `Year ${record.year} within generation ${currentGen[0]}-${currentGen[1]}`,
    details: { generation: currentGen },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN VALIDATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run all validation checks on a staged record
 */
export function validateStagedRecord(record: StagedRecord): ValidationResult {
  const checks: ValidationCheck[] = [
    checkRequiredFields(record),
    checkWheelSpecs(record),
    checkTireSpecs(record),
    checkBoltPattern(record),
    checkCenterBore(record),
    checkOffsetRange(record),
    checkGenerationBoundary(record),
  ];
  
  // Collect flags (failed checks)
  const flags = checks
    .filter(c => !c.passed && c.severity === 'error')
    .map(c => c.name);
  
  // Determine overall pass/fail
  const hasErrors = checks.some(c => !c.passed && c.severity === 'error');
  
  // Determine confidence
  const warnings = checks.filter(c => !c.passed && c.severity === 'warning').length;
  const confidence: 'high' | 'medium' | 'low' | 'unknown' = 
    hasErrors ? 'low' :
    warnings >= 3 ? 'low' :
    warnings >= 1 ? 'medium' : 'high';
  
  return {
    passed: !hasErrors,
    checks,
    flags,
    confidence,
  };
}

export default {
  validateStagedRecord,
  checkRequiredFields,
  checkWheelSpecs,
  checkTireSpecs,
  checkBoltPattern,
  checkCenterBore,
  checkOffsetRange,
  checkGenerationBoundary,
};
