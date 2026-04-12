/**
 * HD Truck Wheel Fitment Templates
 * 
 * Platform-based wheel specifications for Heavy Duty trucks (2500/3500 class).
 * Replaces inheritance-based approach to prevent cross-generation contamination.
 * 
 * KEY RULES:
 * - SRW (Single Rear Wheel) and DRW (Dual Rear Wheel) have different specs
 * - Bolt pattern changes must be tracked by generation
 * - Templates are authoritative - no inheritance fallback
 * 
 * SOURCES:
 * - OEM wheel specifications
 * - Verified aftermarket fitment data
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface WheelSpec {
  diameter: number;
  width: number;
  offset?: number;
}

export interface WheelRange {
  diameterMin: number;
  diameterMax: number;
  widthMin: number;
  widthMax: number;
  offsetMin: number;
  offsetMax: number;
}

export interface HdTemplate {
  platformId: string;
  name: string;
  makes: string[];
  models: string[];
  yearStart: number;
  yearEnd: number;
  
  // Hardware specs
  boltPattern: string;
  centerBoreMm: number;
  threadSize: string;
  seatType: 'conical' | 'ball' | 'flat';
  
  // SRW (Single Rear Wheel) specs
  srw: {
    oemSizes: WheelSpec[];
    fitmentRange: WheelRange;
  };
  
  // DRW (Dual Rear Wheel) specs - only for 3500 class
  drw?: {
    oemSizes: WheelSpec[];
    fitmentRange: WheelRange;
  };
}

export interface PlatformMatch {
  platformId: string;
  template: HdTemplate;
  wheelType: 'srw' | 'drw';
  confidence: 'high' | 'medium' | 'low';
}

// ═══════════════════════════════════════════════════════════════════════════
// GM HD TEMPLATES (Silverado/Sierra 2500HD/3500HD)
// ═══════════════════════════════════════════════════════════════════════════

const GM_HD_GEN1: HdTemplate = {
  platformId: 'gm_hd_gen1_1999_2006',
  name: 'GM HD Gen 1 (GMT800)',
  makes: ['chevrolet', 'gmc'],
  models: ['silverado-2500hd', 'silverado-2500-hd', 'silverado-3500', 'silverado-3500hd', 'silverado-3500-hd',
           'sierra-2500hd', 'sierra-2500-hd', 'sierra-3500', 'sierra-3500hd', 'sierra-3500-hd'],
  yearStart: 1999,
  yearEnd: 2006,
  
  boltPattern: '8x165.1',
  centerBoreMm: 116.7,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  
  srw: {
    oemSizes: [
      { diameter: 16, width: 6.5, offset: 28 },
      { diameter: 17, width: 7.5, offset: 28 },
    ],
    fitmentRange: {
      diameterMin: 16,
      diameterMax: 22,
      widthMin: 6.5,
      widthMax: 10,
      offsetMin: -12,
      offsetMax: 44,
    },
  },
  
  drw: {
    oemSizes: [
      { diameter: 16, width: 6, offset: 102 },
    ],
    fitmentRange: {
      diameterMin: 16,
      diameterMax: 20,
      widthMin: 6,
      widthMax: 8.25,
      offsetMin: 97,
      offsetMax: 140,
    },
  },
};

const GM_HD_GEN2: HdTemplate = {
  platformId: 'gm_hd_gen2_2007_2010',
  name: 'GM HD Gen 2 (GMT900)',
  makes: ['chevrolet', 'gmc'],
  models: ['silverado-2500hd', 'silverado-2500-hd', 'silverado-3500hd', 'silverado-3500-hd',
           'sierra-2500hd', 'sierra-2500-hd', 'sierra-3500hd', 'sierra-3500-hd'],
  yearStart: 2007,
  yearEnd: 2010,
  
  boltPattern: '8x165.1',
  centerBoreMm: 116.7,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  
  srw: {
    oemSizes: [
      { diameter: 17, width: 7.5, offset: 28 },
      { diameter: 18, width: 8, offset: 35 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 24,
      widthMin: 7.5,
      widthMax: 12,
      offsetMin: -25,
      offsetMax: 44,
    },
  },
  
  drw: {
    oemSizes: [
      { diameter: 17, width: 6, offset: 102 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 22,
      widthMin: 6,
      widthMax: 8.25,
      offsetMin: 97,
      offsetMax: 140,
    },
  },
};

const GM_HD_GEN3: HdTemplate = {
  platformId: 'gm_hd_gen3_2011_2019',
  name: 'GM HD Gen 3 (K2XX)',
  makes: ['chevrolet', 'gmc'],
  models: ['silverado-2500hd', 'silverado-2500-hd', 'silverado-3500hd', 'silverado-3500-hd',
           'sierra-2500hd', 'sierra-2500-hd', 'sierra-3500hd', 'sierra-3500-hd'],
  yearStart: 2011,
  yearEnd: 2019,
  
  // Bolt pattern changed to 8x180 in 2011
  boltPattern: '8x180',
  centerBoreMm: 124.1,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  
  srw: {
    oemSizes: [
      { diameter: 17, width: 7.5, offset: 28 },
      { diameter: 18, width: 8, offset: 44 },
      { diameter: 20, width: 8, offset: 44 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 26,
      widthMin: 7.5,
      widthMax: 14,
      offsetMin: -44,
      offsetMax: 55,
    },
  },
  
  drw: {
    oemSizes: [
      { diameter: 17, width: 6.5, offset: 102 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 22,
      widthMin: 6,
      widthMax: 8.25,
      offsetMin: 97,
      offsetMax: 145,
    },
  },
};

const GM_HD_GEN4: HdTemplate = {
  platformId: 'gm_hd_gen4_2020_plus',
  name: 'GM HD Gen 4 (T1XX)',
  makes: ['chevrolet', 'gmc'],
  models: ['silverado-2500hd', 'silverado-2500-hd', 'silverado-3500hd', 'silverado-3500-hd',
           'sierra-2500hd', 'sierra-2500-hd', 'sierra-3500hd', 'sierra-3500-hd'],
  yearStart: 2020,
  yearEnd: 2030, // Future-proof
  
  boltPattern: '8x180',
  centerBoreMm: 124.1,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  
  srw: {
    oemSizes: [
      { diameter: 17, width: 7.5, offset: 28 },
      { diameter: 18, width: 8, offset: 44 },
      { diameter: 20, width: 8.5, offset: 47 },
      { diameter: 22, width: 9, offset: 47 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 26,
      widthMin: 7.5,
      widthMax: 14,
      offsetMin: -44,
      offsetMax: 60,
    },
  },
  
  drw: {
    oemSizes: [
      { diameter: 17, width: 6.5, offset: 102 },
      { diameter: 20, width: 7.5, offset: 108 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 24,
      widthMin: 6,
      widthMax: 8.25,
      offsetMin: 97,
      offsetMax: 150,
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// RAM HD TEMPLATES (2500/3500)
// ═══════════════════════════════════════════════════════════════════════════

const DODGE_RAM_HD_GEN3: HdTemplate = {
  platformId: 'dodge_ram_hd_gen3_2003_2009',
  name: 'Dodge Ram HD Gen 3 (DR/DH)',
  makes: ['dodge'],
  models: ['ram-2500', 'ram-3500'],
  yearStart: 2003,
  yearEnd: 2009,
  
  boltPattern: '8x165.1',
  centerBoreMm: 121.3,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  
  srw: {
    oemSizes: [
      { diameter: 17, width: 7.5, offset: 25 },
      { diameter: 17, width: 8, offset: 25 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 22,
      widthMin: 7.5,
      widthMax: 12,
      offsetMin: -25,
      offsetMax: 45,
    },
  },
  
  drw: {
    oemSizes: [
      { diameter: 17, width: 6, offset: 102 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 20,
      widthMin: 6,
      widthMax: 8.25,
      offsetMin: 97,
      offsetMax: 140,
    },
  },
};

const RAM_HD_GEN4: HdTemplate = {
  platformId: 'ram_hd_gen4_2010_2018',
  name: 'Ram HD Gen 4 (D2)',
  makes: ['ram'],
  models: ['2500', '3500'],
  yearStart: 2010,
  yearEnd: 2018,
  
  boltPattern: '8x165.1',
  centerBoreMm: 121.3,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  
  srw: {
    oemSizes: [
      { diameter: 17, width: 8, offset: 25 },
      { diameter: 18, width: 8, offset: 25 },
      { diameter: 20, width: 8, offset: 25 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 24,
      widthMin: 8,
      widthMax: 14,
      offsetMin: -44,
      offsetMax: 50,
    },
  },
  
  drw: {
    oemSizes: [
      { diameter: 17, width: 6, offset: 102 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 22,
      widthMin: 6,
      widthMax: 8.25,
      offsetMin: 97,
      offsetMax: 145,
    },
  },
};

const RAM_HD_GEN5: HdTemplate = {
  platformId: 'ram_hd_gen5_2019_plus',
  name: 'Ram HD Gen 5 (DT)',
  makes: ['ram'],
  models: ['2500', '3500'],
  yearStart: 2019,
  yearEnd: 2030,
  
  boltPattern: '8x165.1',
  centerBoreMm: 121.3,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  
  srw: {
    oemSizes: [
      { diameter: 17, width: 8, offset: 25 },
      { diameter: 18, width: 8, offset: 25 },
      { diameter: 20, width: 8, offset: 25 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 26,
      widthMin: 8,
      widthMax: 14,
      offsetMin: -44,
      offsetMax: 55,
    },
  },
  
  drw: {
    oemSizes: [
      { diameter: 17, width: 6.5, offset: 102 },
      { diameter: 20, width: 7.5, offset: 115 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 24,
      widthMin: 6,
      widthMax: 8.25,
      offsetMin: 97,
      offsetMax: 150,
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// FORD SUPER DUTY TEMPLATES (F-250/F-350)
// ═══════════════════════════════════════════════════════════════════════════

const FORD_SD_GEN1: HdTemplate = {
  platformId: 'ford_sd_gen1_1999_2007',
  name: 'Ford Super Duty Gen 1 (P2)',
  makes: ['ford'],
  models: ['f-250', 'f-350'],
  yearStart: 1999,
  yearEnd: 2007,
  
  boltPattern: '8x170',
  centerBoreMm: 124.9,
  threadSize: 'M14x2',
  seatType: 'conical',
  
  srw: {
    oemSizes: [
      { diameter: 17, width: 7.5, offset: 40 },
      { diameter: 18, width: 8, offset: 40 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 22,
      widthMin: 7.5,
      widthMax: 12,
      offsetMin: -12,
      offsetMax: 55,
    },
  },
  
  drw: {
    oemSizes: [
      { diameter: 17, width: 6.5, offset: 117 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 20,
      widthMin: 6,
      widthMax: 8.25,
      offsetMin: 110,
      offsetMax: 145,
    },
  },
};

const FORD_SD_GEN2: HdTemplate = {
  platformId: 'ford_sd_gen2_2008_2010',
  name: 'Ford Super Duty Gen 2 (P2B)',
  makes: ['ford'],
  models: ['f-250', 'f-350'],
  yearStart: 2008,
  yearEnd: 2010,
  
  boltPattern: '8x170',
  centerBoreMm: 124.9,
  threadSize: 'M14x2',
  seatType: 'conical',
  
  srw: {
    oemSizes: [
      { diameter: 17, width: 7.5, offset: 40 },
      { diameter: 18, width: 8, offset: 40 },
      { diameter: 20, width: 8, offset: 40 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 24,
      widthMin: 7.5,
      widthMax: 14,
      offsetMin: -25,
      offsetMax: 55,
    },
  },
  
  drw: {
    oemSizes: [
      { diameter: 17, width: 6.5, offset: 120 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 22,
      widthMin: 6,
      widthMax: 8.25,
      offsetMin: 110,
      offsetMax: 150,
    },
  },
};

const FORD_SD_GEN3: HdTemplate = {
  platformId: 'ford_sd_gen3_2011_2016',
  name: 'Ford Super Duty Gen 3 (P473)',
  makes: ['ford'],
  models: ['f-250', 'f-350'],
  yearStart: 2011,
  yearEnd: 2016,
  
  boltPattern: '8x170',
  centerBoreMm: 124.9,
  threadSize: 'M14x1.5',  // Changed from M14x2 in 2011
  seatType: 'conical',
  
  srw: {
    oemSizes: [
      { diameter: 17, width: 7.5, offset: 40 },
      { diameter: 18, width: 8, offset: 44 },
      { diameter: 20, width: 8, offset: 44 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 26,
      widthMin: 7.5,
      widthMax: 14,
      offsetMin: -44,
      offsetMax: 60,
    },
  },
  
  drw: {
    oemSizes: [
      { diameter: 17, width: 6.5, offset: 120 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 22,
      widthMin: 6,
      widthMax: 8.25,
      offsetMin: 110,
      offsetMax: 150,
    },
  },
};

const FORD_SD_GEN4: HdTemplate = {
  platformId: 'ford_sd_gen4_2017_plus',
  name: 'Ford Super Duty Gen 4 (P558)',
  makes: ['ford'],
  models: ['f-250', 'f-350'],
  yearStart: 2017,
  yearEnd: 2030,
  
  boltPattern: '8x170',
  centerBoreMm: 124.9,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  
  srw: {
    oemSizes: [
      { diameter: 17, width: 7.5, offset: 40 },
      { diameter: 18, width: 8, offset: 44 },
      { diameter: 20, width: 8, offset: 44 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 26,
      widthMin: 7.5,
      widthMax: 14,
      offsetMin: -44,
      offsetMax: 60,
    },
  },
  
  drw: {
    oemSizes: [
      { diameter: 17, width: 6.5, offset: 120 },
      { diameter: 20, width: 8, offset: 130 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 24,
      widthMin: 6,
      widthMax: 8.25,
      offsetMin: 110,
      offsetMax: 155,
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// NISSAN TITAN XD TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════

const NISSAN_TITAN_XD: HdTemplate = {
  platformId: 'nissan_titan_xd_2016_plus',
  name: 'Nissan Titan XD',
  makes: ['nissan'],
  models: ['titan-xd'],
  yearStart: 2016,
  yearEnd: 2030,
  
  // Not a true 8-lug HD; uses same as regular Titan
  boltPattern: '6x139.7',
  centerBoreMm: 78.1,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  
  srw: {
    oemSizes: [
      { diameter: 17, width: 7.5, offset: 25 },
      { diameter: 18, width: 8, offset: 25 },
      { diameter: 20, width: 8, offset: 25 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 24,
      widthMin: 7.5,
      widthMax: 12,
      offsetMin: -25,
      offsetMax: 45,
    },
  },
  // No DRW option for Titan XD
};

// ═══════════════════════════════════════════════════════════════════════════
// FORD F-350 DRW SPECIFIC (8x200 bolt pattern)
// ═══════════════════════════════════════════════════════════════════════════

const FORD_F350_DRW_GEN4: HdTemplate = {
  platformId: 'ford_f350_drw_gen4_2005_plus',
  name: 'Ford F-350 DRW (8x200)',
  makes: ['ford'],
  models: ['f-350'],
  yearStart: 2005,
  yearEnd: 2030,
  
  // Special 8x200 bolt pattern for DRW-specific models
  boltPattern: '8x200',
  centerBoreMm: 142.1,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  
  srw: {
    // This template is DRW-only
    oemSizes: [],
    fitmentRange: {
      diameterMin: 0,
      diameterMax: 0,
      widthMin: 0,
      widthMax: 0,
      offsetMin: 0,
      offsetMax: 0,
    },
  },
  
  drw: {
    oemSizes: [
      { diameter: 17, width: 6.5, offset: 136 },
      { diameter: 19.5, width: 6, offset: 143 },
    ],
    fitmentRange: {
      diameterMin: 17,
      diameterMax: 24,
      widthMin: 6,
      widthMax: 8.25,
      offsetMin: 130,
      offsetMax: 165,
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

export const HD_TEMPLATES: HdTemplate[] = [
  // GM HD
  GM_HD_GEN1,
  GM_HD_GEN2,
  GM_HD_GEN3,
  GM_HD_GEN4,
  
  // Dodge/Ram HD
  DODGE_RAM_HD_GEN3,
  RAM_HD_GEN4,
  RAM_HD_GEN5,
  
  // Ford Super Duty
  FORD_SD_GEN1,
  FORD_SD_GEN2,
  FORD_SD_GEN3,
  FORD_SD_GEN4,
  FORD_F350_DRW_GEN4,
  
  // Nissan
  NISSAN_TITAN_XD,
];

// ═══════════════════════════════════════════════════════════════════════════
// DRW DETECTION PATTERNS
// ═══════════════════════════════════════════════════════════════════════════

const DRW_TRIM_PATTERNS = [
  /\bDRW\b/i,
  /\bDually\b/i,
  /\bDual.?Rear.?Wheel/i,
  /\b3500.*Chassis/i,
  /\b350.*Chassis/i,
];

export function isDRW(model: string, trim?: string): boolean {
  // 3500 class models can be DRW
  if (!model.match(/3500|350/i)) {
    return false;
  }
  
  // Check trim for DRW indicators
  if (trim) {
    for (const pattern of DRW_TRIM_PATTERNS) {
      if (pattern.test(trim)) {
        return true;
      }
    }
  }
  
  // Default: 3500 without DRW indicators is SRW
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM MAPPING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize model name for matching
 */
function normalizeModel(model: string): string {
  return model.toLowerCase()
    .replace(/-hd$/i, 'hd')
    .replace(/^ram-/, '');
}

/**
 * Get HD platform for a vehicle
 */
export function getHdPlatform(
  year: number,
  make: string,
  model: string,
  trim?: string
): PlatformMatch | null {
  const makeLower = make.toLowerCase();
  const modelNorm = normalizeModel(model);
  
  // Check if this is an HD truck
  const isHD = modelNorm.match(/2500|3500/) ||
               modelNorm.match(/f-?250|f-?350/) ||
               modelNorm === 'titan-xd';
  
  if (!isHD) {
    return null;
  }
  
  // Find matching template
  for (const template of HD_TEMPLATES) {
    // Check make
    if (!template.makes.includes(makeLower)) continue;
    
    // Check model
    const modelMatch = template.models.some(m => 
      normalizeModel(m) === modelNorm ||
      modelNorm.includes(normalizeModel(m))
    );
    if (!modelMatch) continue;
    
    // Check year
    if (year < template.yearStart || year > template.yearEnd) continue;
    
    // Determine SRW vs DRW
    const wheelType = isDRW(model, trim) ? 'drw' : 'srw';
    
    // Check if template supports this wheel type
    if (wheelType === 'drw' && !template.drw) {
      continue;
    }
    
    // Special case: Ford F-350 DRW with 8x200 (Chassis Cab only)
    if (makeLower === 'ford' && modelNorm.includes('350') && template.boltPattern === '8x200') {
      // Only match 8x200 template for Chassis Cab DRW
      const isChassisCab = trim?.match(/Chassis/i);
      if (!isChassisCab) {
        continue; // Skip 8x200 template for non-Chassis Cab
      }
    }
    
    // Calculate confidence
    const confidence: 'high' | 'medium' | 'low' = 
      template.makes.length === 1 && template.models.length <= 2 ? 'high' :
      template.yearEnd - template.yearStart <= 5 ? 'high' : 'medium';
    
    return {
      platformId: template.platformId,
      template,
      wheelType,
      confidence,
    };
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE APPLICATION
// ═══════════════════════════════════════════════════════════════════════════

export interface AppliedFitment {
  boltPattern: string;
  centerBoreMm: number;
  threadSize: string;
  seatType: string;
  oemWheelSizes: WheelSpec[];
  offsetMinMm: number;
  offsetMaxMm: number;
  diameterMin: number;
  diameterMax: number;
  widthMin: number;
  widthMax: number;
  templateId: string;
  wheelType: 'srw' | 'drw';
}

/**
 * Apply HD template to get fitment data
 */
export function applyHdTemplate(
  match: PlatformMatch
): AppliedFitment {
  const { template, wheelType } = match;
  const specs = wheelType === 'drw' && template.drw ? template.drw : template.srw;
  
  return {
    boltPattern: template.boltPattern,
    centerBoreMm: template.centerBoreMm,
    threadSize: template.threadSize,
    seatType: template.seatType,
    oemWheelSizes: specs.oemSizes,
    offsetMinMm: specs.fitmentRange.offsetMin,
    offsetMaxMm: specs.fitmentRange.offsetMax,
    diameterMin: specs.fitmentRange.diameterMin,
    diameterMax: specs.fitmentRange.diameterMax,
    widthMin: specs.fitmentRange.widthMin,
    widthMax: specs.fitmentRange.widthMax,
    templateId: template.platformId,
    wheelType,
  };
}

/**
 * Convert applied fitment to database format
 */
export function fitmentToDbFormat(fitment: AppliedFitment): {
  bolt_pattern: string;
  center_bore_mm: number;
  thread_size: string;
  seat_type: string;
  oem_wheel_sizes: object[];
  offset_min_mm: number;
  offset_max_mm: number;
} {
  return {
    bolt_pattern: fitment.boltPattern,
    center_bore_mm: fitment.centerBoreMm,
    thread_size: fitment.threadSize,
    seat_type: fitment.seatType,
    oem_wheel_sizes: fitment.oemWheelSizes.map(ws => ({
      diameter: ws.diameter,
      width: ws.width,
      offset: ws.offset,
    })),
    offset_min_mm: fitment.offsetMinMm,
    offset_max_mm: fitment.offsetMaxMm,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a platform match before applying
 */
export function validatePlatformMatch(
  year: number,
  make: string,
  model: string,
  trim: string | undefined,
  match: PlatformMatch
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check year bounds
  if (year < match.template.yearStart || year > match.template.yearEnd) {
    errors.push(`Year ${year} outside template range ${match.template.yearStart}-${match.template.yearEnd}`);
  }
  
  // Check make
  if (!match.template.makes.includes(make.toLowerCase())) {
    errors.push(`Make '${make}' not in template makes: ${match.template.makes.join(', ')}`);
  }
  
  // Check DRW support
  if (match.wheelType === 'drw' && !match.template.drw) {
    errors.push(`Template ${match.platformId} does not support DRW`);
  }
  
  // Check for potential DRW misclassification
  if (match.wheelType === 'srw' && model.match(/3500|350/i) && !trim) {
    warnings.push('3500-class without trim may be DRW');
  }
  
  // Low confidence warning
  if (match.confidence === 'low') {
    warnings.push('Low confidence match - verify manually');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default {
  HD_TEMPLATES,
  getHdPlatform,
  applyHdTemplate,
  fitmentToDbFormat,
  validatePlatformMatch,
  isDRW,
};
