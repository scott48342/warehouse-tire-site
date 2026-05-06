/**
 * Known Data Gaps Registry
 * 
 * Vehicles that are expected to fail QA due to missing fitment data.
 * These are NOT regressions - they need data import, not code fixes.
 * 
 * Format:
 *   key: "year|make|model" or "year|make|model|trim"
 *   value: {
 *     reason: string,      // Why it's missing
 *     severity: string,    // original severity if not suppressed
 *     addedDate: string,   // When added to registry
 *     ticket: string,      // Optional: tracking ticket
 *     priority: string,    // 'tier-a' | 'tier-b' | 'tier-c'
 *   }
 * 
 * Priority Tiers:
 *   tier-a: Highest volume US performance vehicles (Mustang, Camaro, Challenger, Corvette)
 *   tier-b: German performance (BMW M, AMG, Audi RS, Porsche)
 *   tier-c: EV performance (Tesla Plaid, Rivian, Lucid)
 */

export const KNOWN_DATA_GAPS = {
  // ============================================================
  // TIER A — US PERFORMANCE (highest priority)
  // ============================================================
  
  // Dodge Challenger variants
  '2023|Dodge|Challenger|Hellcat': {
    reason: 'Missing staggered OEM fitment data',
    severity: 'critical',
    addedDate: '2026-05-06',
    priority: 'tier-a',
    expectedStaggered: true,
  },
  '2024|Dodge|Challenger|Hellcat': {
    reason: 'Missing staggered OEM fitment data',
    severity: 'critical',
    addedDate: '2026-05-06',
    priority: 'tier-a',
    expectedStaggered: true,
  },
  '2024|Dodge|Challenger|Widebody': {
    reason: 'Missing staggered OEM fitment data',
    severity: 'critical',
    addedDate: '2026-05-06',
    priority: 'tier-a',
    expectedStaggered: true,
  },
  '2024|Dodge|Challenger|R/T': {
    reason: 'Base R/T may need staggered verification',
    severity: 'high',
    addedDate: '2026-05-06',
    priority: 'tier-a',
    expectedStaggered: false, // Base R/T is often square
  },
  
  // Chevrolet Camaro variants
  '2024|Chevrolet|Camaro|1LE': {
    reason: 'Missing staggered OEM fitment data',
    severity: 'critical',
    addedDate: '2026-05-06',
    priority: 'tier-a',
    expectedStaggered: true,
  },
  '2024|Chevrolet|Camaro|SS': {
    reason: 'Need to verify staggered specs',
    severity: 'high',
    addedDate: '2026-05-06',
    priority: 'tier-a',
    expectedStaggered: true,
  },
  '2023|Chevrolet|Camaro|ZL1': {
    reason: 'Missing staggered OEM fitment data',
    severity: 'critical',
    addedDate: '2026-05-06',
    priority: 'tier-a',
    expectedStaggered: true,
  },
  
  // Chevrolet Corvette
  '2023|Chevrolet|Corvette|Stingray': {
    reason: 'Missing staggered OEM fitment data',
    severity: 'critical',
    addedDate: '2026-05-06',
    priority: 'tier-a',
    expectedStaggered: true,
  },
  
  // Ford Mustang variants
  '2023|Ford|Mustang|GT Performance Pack': {
    reason: 'Need staggered verification',
    severity: 'high',
    addedDate: '2026-05-06',
    priority: 'tier-a',
    expectedStaggered: true,
  },
  '2024|Ford|Mustang|Dark Horse': {
    reason: 'Need staggered verification',
    severity: 'high',
    addedDate: '2026-05-06',
    priority: 'tier-a',
    expectedStaggered: true,
  },
  
  // ============================================================
  // TIER B — GERMAN PERFORMANCE
  // ============================================================
  
  // Mercedes-AMG
  '2024|Mercedes-Benz|AMG C 63': {
    reason: 'Missing from vehicle_fitments entirely',
    severity: 'high',
    addedDate: '2026-05-06',
    priority: 'tier-b',
    expectedStaggered: true,
  },
  '2024|Mercedes-Benz|AMG E 63': {
    reason: 'Missing from vehicle_fitments entirely',
    severity: 'high',
    addedDate: '2026-05-06',
    priority: 'tier-b',
    expectedStaggered: true,
  },
  '2024|Mercedes-Benz|AMG GLE 63': {
    reason: 'Missing from vehicle_fitments entirely',
    severity: 'high',
    addedDate: '2026-05-06',
    priority: 'tier-b',
    expectedStaggered: true,
  },
  
  // Audi RS
  '2024|Audi|RS Q8': {
    reason: 'Missing from vehicle_fitments entirely',
    severity: 'high',
    addedDate: '2026-05-06',
    priority: 'tier-b',
    expectedStaggered: false,
  },
  
  // ============================================================
  // TIER C — EV PERFORMANCE
  // ============================================================
  
  // Tesla
  '2024|Tesla|Model S': {
    reason: 'Missing from vehicle_fitments entirely',
    severity: 'high',
    addedDate: '2026-05-06',
    priority: 'tier-c',
    expectedStaggered: true,
  },
  '2024|Tesla|Model 3': {
    reason: 'Missing from vehicle_fitments entirely',
    severity: 'high',
    addedDate: '2026-05-06',
    priority: 'tier-c',
    expectedStaggered: true, // Performance variants
  },
  '2024|Tesla|Model Y': {
    reason: 'Missing from vehicle_fitments entirely',
    severity: 'medium',
    addedDate: '2026-05-06',
    priority: 'tier-c',
    expectedStaggered: false, // Most are square
  },
  
  // ============================================================
  // OTHER KNOWN GAPS
  // ============================================================
  
  '2024|Land Rover|Defender': {
    reason: 'Missing from vehicle_fitments entirely',
    severity: 'medium',
    addedDate: '2026-05-06',
    priority: 'tier-c',
    expectedStaggered: false,
  },
  '2024|Hyundai|Elantra N': {
    reason: 'Missing from vehicle_fitments entirely',
    severity: 'medium',
    addedDate: '2026-05-06',
    priority: 'tier-c',
    expectedStaggered: false,
  },
  '2024|Volkswagen|Golf R': {
    reason: 'Missing from vehicle_fitments entirely',
    severity: 'medium',
    addedDate: '2026-05-06',
    priority: 'tier-c',
    expectedStaggered: false,
  },
};

/**
 * Check if a vehicle is a known data gap
 * @param {Object} vehicle - { year, make, model, trim }
 * @returns {Object|null} - Gap info or null if not a known gap
 */
export function isKnownDataGap(vehicle) {
  const { year, make, model, trim } = vehicle;
  
  // Try exact match with trim first
  const exactKey = `${year}|${make}|${model}|${trim}`;
  if (KNOWN_DATA_GAPS[exactKey]) {
    return { ...KNOWN_DATA_GAPS[exactKey], matchedKey: exactKey };
  }
  
  // Try without trim
  const baseKey = `${year}|${make}|${model}`;
  if (KNOWN_DATA_GAPS[baseKey]) {
    return { ...KNOWN_DATA_GAPS[baseKey], matchedKey: baseKey };
  }
  
  // Try fuzzy model match (e.g., "AMG C63" vs "AMG C 63")
  const normalizedModel = model.replace(/\s+/g, ' ').trim();
  for (const key of Object.keys(KNOWN_DATA_GAPS)) {
    const [gapYear, gapMake, gapModel, gapTrim] = key.split('|');
    const normalizedGapModel = gapModel?.replace(/\s+/g, ' ').trim();
    
    if (String(year) === gapYear && 
        make.toLowerCase() === gapMake?.toLowerCase() &&
        normalizedModel.toLowerCase() === normalizedGapModel?.toLowerCase()) {
      if (!gapTrim || (trim && trim.toLowerCase() === gapTrim.toLowerCase())) {
        return { ...KNOWN_DATA_GAPS[key], matchedKey: key };
      }
    }
  }
  
  return null;
}

/**
 * Get all gaps for a specific priority tier
 */
export function getGapsByTier(tier) {
  return Object.entries(KNOWN_DATA_GAPS)
    .filter(([_, gap]) => gap.priority === tier)
    .map(([key, gap]) => ({ key, ...gap }));
}

/**
 * Get summary stats
 */
export function getGapStats() {
  const gaps = Object.values(KNOWN_DATA_GAPS);
  return {
    total: gaps.length,
    byTier: {
      'tier-a': gaps.filter(g => g.priority === 'tier-a').length,
      'tier-b': gaps.filter(g => g.priority === 'tier-b').length,
      'tier-c': gaps.filter(g => g.priority === 'tier-c').length,
    },
    bySeverity: {
      critical: gaps.filter(g => g.severity === 'critical').length,
      high: gaps.filter(g => g.severity === 'high').length,
      medium: gaps.filter(g => g.severity === 'medium').length,
    },
    staggered: gaps.filter(g => g.expectedStaggered).length,
  };
}

export default {
  KNOWN_DATA_GAPS,
  isKnownDataGap,
  getGapsByTier,
  getGapStats,
};
