/**
 * USAF Tire Size Normalization
 * 
 * Handles various tire size formats and extracts metadata:
 * - P-prefix: P235/55R19 → 235/55R19
 * - RF/runflat: P235/55RF19 → 235/55R19 + runFlat=true
 * - ZR notation: 245/35ZR19 → 245/35R19 + speedCategory="ZR"
 * - LT suffix: LT275/70R18/E → LT275/70R18 + loadRange="E"
 * - Flotation: 37x12.50R17LT/C → flotation format + loadRange="C"
 */

export interface NormalizedTireSize {
  /** Normalized size string for comparison (e.g., "235/55R19") */
  normalized: string;
  /** Original size string */
  original: string;
  /** Width in mm */
  width: number;
  /** Aspect ratio */
  aspect: number;
  /** Rim diameter in inches */
  rim: number;
  /** Is LT (light truck) */
  isLT: boolean;
  /** Is P (passenger) - stripped for comparison */
  isP: boolean;
  /** Is runflat (RF suffix) */
  runFlat: boolean;
  /** Speed category (ZR, Y, W, etc.) */
  speedCategory: string | null;
  /** Load range (C, D, E, etc.) */
  loadRange: string | null;
  /** Load index */
  loadIndex: string | null;
  /** Is flotation format (e.g., 37x12.50R17) */
  isFlotation: boolean;
  /** Flotation diameter (if flotation) */
  flotationDiameter: number | null;
  /** Flotation width (if flotation) */
  flotationWidth: number | null;
}

/**
 * Parse and normalize a tire size string
 */
export function normalizeTireSize(size: string): NormalizedTireSize | null {
  if (!size || typeof size !== "string") return null;
  
  const original = size.trim();
  const s = original.toUpperCase();
  
  // Try flotation format first: 37x12.50R17LT/C
  const flotMatch = s.match(/^(\d{2,3})x(\d{1,2}\.?\d*)R?(\d{2})(LT)?(?:\/([A-Z]))?$/i);
  if (flotMatch) {
    const [, diameter, width, rim, lt, loadRange] = flotMatch;
    return {
      original,
      normalized: `${diameter}x${width}R${rim}`,
      width: 0, // Not applicable for flotation
      aspect: 0,
      rim: parseInt(rim),
      isLT: !!lt,
      isP: false,
      runFlat: false,
      speedCategory: null,
      loadRange: loadRange || null,
      loadIndex: null,
      isFlotation: true,
      flotationDiameter: parseFloat(diameter),
      flotationWidth: parseFloat(width),
    };
  }
  
  // Standard format: P?LT?(\d{3})/(\d{2,3})(ZR|R|RF)?(\d{2})(?:/([A-Z]))?
  // Examples: P235/55R19, LT275/70R18/E, 245/35ZR19, P235/55RF19
  const stdMatch = s.match(
    /^(P)?(LT)?(\d{3})\/(\d{2,3})(ZR|RF|R)?(\d{2})(?:\/([A-Z]))?(?:\s*(\d{2,3})([A-Z])?)?$/i
  );
  
  if (stdMatch) {
    const [, pPrefix, ltPrefix, width, aspect, construction, rim, loadRange, loadIndex, speedRating] = stdMatch;
    
    const isRunFlat = construction === "RF";
    const isZR = construction === "ZR";
    
    // Normalize: remove P prefix, convert RF/ZR to R, keep LT
    const ltStr = ltPrefix || "";
    const normalized = `${ltStr}${width}/${aspect}R${rim}`;
    
    return {
      original,
      normalized,
      width: parseInt(width),
      aspect: parseInt(aspect),
      rim: parseInt(rim),
      isLT: !!ltPrefix,
      isP: !!pPrefix,
      runFlat: isRunFlat,
      speedCategory: isZR ? "ZR" : (speedRating || null),
      loadRange: loadRange || null,
      loadIndex: loadIndex || null,
      isFlotation: false,
      flotationDiameter: null,
      flotationWidth: null,
    };
  }
  
  // Fallback: try simpler patterns
  const simpleMatch = s.match(/^(P)?(LT)?(\d{3})\/(\d{2,3})R?(\d{2})/i);
  if (simpleMatch) {
    const [, pPrefix, ltPrefix, width, aspect, rim] = simpleMatch;
    const ltStr = ltPrefix || "";
    return {
      original,
      normalized: `${ltStr}${width}/${aspect}R${rim}`,
      width: parseInt(width),
      aspect: parseInt(aspect),
      rim: parseInt(rim),
      isLT: !!ltPrefix,
      isP: !!pPrefix,
      runFlat: false,
      speedCategory: null,
      loadRange: null,
      loadIndex: null,
      isFlotation: false,
      flotationDiameter: null,
      flotationWidth: null,
    };
  }
  
  return null;
}

/**
 * Compare two tire sizes for equivalence
 * Returns true if they represent the same tire (ignoring P prefix, RF notation, etc.)
 */
export function sizesAreEquivalent(size1: string, size2: string): boolean {
  const n1 = normalizeTireSize(size1);
  const n2 = normalizeTireSize(size2);
  
  if (!n1 || !n2) return false;
  
  return n1.normalized === n2.normalized;
}

/**
 * Find equivalent sizes between two arrays
 */
export function findEquivalentSizes(
  wtdSizes: string[],
  usafSizes: string[]
): {
  common: Array<{ wtd: string; usaf: string; normalized: string }>;
  wtdOnly: string[];
  usafOnly: string[];
} {
  const wtdNormalized = wtdSizes.map(s => ({ original: s, parsed: normalizeTireSize(s) }));
  const usafNormalized = usafSizes.map(s => ({ original: s, parsed: normalizeTireSize(s) }));
  
  const common: Array<{ wtd: string; usaf: string; normalized: string }> = [];
  const matchedWtd = new Set<number>();
  const matchedUsaf = new Set<number>();
  
  for (let i = 0; i < wtdNormalized.length; i++) {
    const wtd = wtdNormalized[i];
    if (!wtd.parsed) continue;
    
    for (let j = 0; j < usafNormalized.length; j++) {
      if (matchedUsaf.has(j)) continue;
      const usaf = usafNormalized[j];
      if (!usaf.parsed) continue;
      
      if (wtd.parsed.normalized === usaf.parsed.normalized) {
        common.push({
          wtd: wtd.original,
          usaf: usaf.original,
          normalized: wtd.parsed.normalized,
        });
        matchedWtd.add(i);
        matchedUsaf.add(j);
        break;
      }
    }
  }
  
  const wtdOnly = wtdNormalized
    .filter((_, i) => !matchedWtd.has(i))
    .map(w => w.original);
  
  const usafOnly = usafNormalized
    .filter((_, j) => !matchedUsaf.has(j))
    .map(u => u.original);
  
  return { common, wtdOnly, usafOnly };
}

/**
 * Detect potential staggered fitment from tire sizes
 * Returns groups of front/rear pairs
 */
export function detectStaggeredPairs(
  sizes: string[]
): Array<{ front: string; rear: string; confidence: number }> {
  const pairs: Array<{ front: string; rear: string; confidence: number }> = [];
  const parsed = sizes.map(s => ({ original: s, parsed: normalizeTireSize(s) })).filter(x => x.parsed);
  
  // Group by rim size
  const byRim = new Map<number, typeof parsed>();
  for (const p of parsed) {
    if (!p.parsed) continue;
    const rim = p.parsed.rim;
    if (!byRim.has(rim)) byRim.set(rim, []);
    byRim.get(rim)!.push(p);
  }
  
  // For each rim size, look for front/rear pairs (narrower front, wider rear)
  for (const [rim, group] of byRim) {
    if (group.length < 2) continue;
    
    // Sort by width
    const sorted = [...group].sort((a, b) => {
      if (!a.parsed || !b.parsed) return 0;
      return a.parsed.width - b.parsed.width;
    });
    
    // Check for typical staggered patterns
    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const front = sorted[i];
        const rear = sorted[j];
        if (!front.parsed || !rear.parsed) continue;
        
        const widthDiff = rear.parsed.width - front.parsed.width;
        
        // Typical staggered: 20-60mm wider rear
        if (widthDiff >= 20 && widthDiff <= 60) {
          // Higher confidence if aspect ratios also differ appropriately
          const aspectDiff = front.parsed.aspect - rear.parsed.aspect;
          const confidence = aspectDiff > 0 && aspectDiff <= 15 ? 0.9 : 0.7;
          
          pairs.push({
            front: front.original,
            rear: rear.original,
            confidence,
          });
        }
      }
    }
  }
  
  return pairs;
}

/**
 * Calculate confidence score for a size mismatch
 */
export function calculateMismatchConfidence(
  wtdSizes: string[],
  usafSizes: string[]
): {
  confidence: number;
  reason: string;
  category: "exact" | "partial" | "wtd_only" | "usaf_only" | "notation_diff" | "staggered_issue";
} {
  const comparison = findEquivalentSizes(wtdSizes, usafSizes);
  
  if (comparison.wtdOnly.length === 0 && comparison.usafOnly.length === 0) {
    return { confidence: 1.0, reason: "Exact match after normalization", category: "exact" };
  }
  
  // Check if differences are just notation (RF, P, ZR)
  const wtdParsed = comparison.wtdOnly.map(normalizeTireSize).filter(Boolean);
  const usafParsed = comparison.usafOnly.map(normalizeTireSize).filter(Boolean);
  
  const notationDiffs = wtdParsed.filter(w => 
    usafParsed.some(u => w && u && w.normalized === u.normalized)
  );
  
  if (notationDiffs.length > 0 && notationDiffs.length === comparison.wtdOnly.length) {
    return { confidence: 0.95, reason: "Notation difference only (P/RF/ZR)", category: "notation_diff" };
  }
  
  // Check for staggered issues
  const usafStaggered = detectStaggeredPairs(usafSizes);
  const wtdStaggered = detectStaggeredPairs(wtdSizes);
  
  if (usafStaggered.length > 0 && wtdStaggered.length === 0) {
    return { confidence: 0.8, reason: "USAF shows staggered, WTD may be missing rear sizes", category: "staggered_issue" };
  }
  
  if (comparison.common.length > 0) {
    const matchRate = comparison.common.length / (comparison.common.length + comparison.usafOnly.length);
    return {
      confidence: matchRate,
      reason: `Partial match: ${comparison.common.length} common, ${comparison.usafOnly.length} USAF-only`,
      category: "partial",
    };
  }
  
  if (usafSizes.length === 0) {
    return { confidence: 0.5, reason: "Vehicle not in USAF database", category: "wtd_only" };
  }
  
  if (wtdSizes.length === 0) {
    return { confidence: 0.9, reason: "WTD missing all sizes, USAF has data", category: "usaf_only" };
  }
  
  return { confidence: 0.3, reason: "Complete mismatch - needs review", category: "partial" };
}
