/**
 * TRIM EXPLOSION UTILITY
 * 
 * Handles grouped/consolidated trim records in the database.
 * 
 * PROBLEM:
 * - Some DB records have display_trim like "LX, Sport, EX, EX-L"
 * - Customer selector should show individual trim choices
 * - Each selection must resolve back to the correct fitment record
 * 
 * SOLUTION:
 * - `isGroupedTrim()` - Check if a trim contains multiple values
 * - `explodeTrim()` - Split grouped trim into atomic options
 * - `explodeTrimsFromRecords()` - Process DB records into selector options
 * - `findSourceRecordForTrim()` - Map exploded trim back to source record
 * 
 * RULES:
 * 1. Comma always indicates grouping: "LX, Sport, EX"
 * 2. Spaced slash indicates grouping: "SXT / SXT Plus"
 * 3. Compact slash is NOT grouping: "R/T", "GT/CS", "4x4/2x4"
 * 4. Never expose grouped trims to customers
 * 5. Exploded trims inherit all fitment specs from source record
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TrimRecord {
  modificationId: string;
  displayTrim: string;
  // Optional fitment data that passes through
  oemTireSizes?: string[] | null;
  boltPattern?: string | null;
  centerBoreMm?: string | number | null;
  [key: string]: unknown;
}

export interface ExplodedTrim {
  /** Display label (atomic, never contains commas) */
  label: string;
  /** Unique value for selector (canonical ID) */
  value: string;
  /** Source record's modificationId */
  modificationId: string;
  /** Whether this was extracted from a grouped record */
  isFromGroupedRecord: boolean;
  /** Original grouped trim (for debugging) */
  sourceDisplayTrim: string;
  /** Inherited fitment data */
  tireSizes?: string[];
  boltPattern?: string;
  centerBore?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a displayTrim contains multiple grouped values.
 * 
 * RULES:
 * - Comma always indicates grouping: "LX, Sport, EX" → true
 * - Spaced slash indicates grouping: "SXT / SXT Plus" → true
 * - Compact slash is NOT grouping: "R/T" → false, "GT/CS" → false
 * 
 * @example
 * isGroupedTrim("LX, Sport, EX")    // → true
 * isGroupedTrim("SXT / SXT Plus")   // → true
 * isGroupedTrim("R/T")              // → false
 * isGroupedTrim("GT Performance Pack") // → false
 */
export function isGroupedTrim(displayTrim: string): boolean {
  if (!displayTrim) return false;
  
  // Comma always indicates grouping
  if (displayTrim.includes(',')) return true;
  
  // Spaced slash indicates grouping: " / "
  if (/ \/ /.test(displayTrim)) return true;
  
  return false;
}

/**
 * Split a grouped trim into atomic trim names.
 * 
 * Handles:
 * - Comma separation: "LX, Sport, EX" → ["LX", "Sport", "EX"]
 * - Spaced slash: "SXT / SXT Plus" → ["SXT", "SXT Plus"]
 * - Combined: "LX, Sport / Sport S" → ["LX", "Sport", "Sport S"]
 * 
 * Does NOT split:
 * - "R/T" → ["R/T"] (single trim with slash in name)
 * - "GT/CS" → ["GT/CS"] (single trim)
 * 
 * @param displayTrim - Grouped or single trim
 * @returns Array of atomic trim names
 */
export function explodeTrim(displayTrim: string): string[] {
  if (!displayTrim) return [];
  
  // If not grouped, return as-is
  if (!isGroupedTrim(displayTrim)) {
    return [displayTrim.trim()];
  }
  
  // First split on comma
  let parts = displayTrim.split(',').map(t => t.trim()).filter(Boolean);
  
  // Then split each part on spaced slash (" / ")
  const result: string[] = [];
  for (const part of parts) {
    if (/ \/ /.test(part)) {
      const subParts = part.split(' / ').map(t => t.trim()).filter(Boolean);
      result.push(...subParts);
    } else {
      result.push(part);
    }
  }
  
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// RECORD PROCESSING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a canonical ID for an exploded trim.
 * Format: {year}-{make}-{model}-{trim}-{hash}
 */
function generateCanonicalId(
  year: number,
  make: string,
  model: string,
  trim: string
): string {
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const base = `${year}-${slugify(make)}-${slugify(model)}-${slugify(trim)}`;
  const hash = base.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0).toString(16).slice(-6);
  return `${base}-${hash}`;
}

/**
 * Process database records into exploded trim options for selector.
 * 
 * - Grouped trims are split into individual options
 * - Each option has a unique canonical ID
 * - Duplicate trim names are deduplicated (prefer individual records)
 * - Fitment data is inherited from source record
 * 
 * @param records - Database records with modificationId and displayTrim
 * @param year - Vehicle year (for canonical ID)
 * @param make - Vehicle make (for canonical ID)
 * @param model - Vehicle model (for canonical ID)
 * @returns Deduplicated array of exploded trim options
 */
export function explodeTrimsFromRecords(
  records: TrimRecord[],
  year: number,
  make: string,
  model: string
): ExplodedTrim[] {
  const seenLabels = new Map<string, ExplodedTrim>();
  
  // First pass: process individual (non-grouped) records
  // These take priority over exploded grouped records
  for (const rec of records) {
    if (isGroupedTrim(rec.displayTrim)) continue;
    
    const label = rec.displayTrim.trim();
    if (!label) continue;
    
    const key = label.toLowerCase();
    if (seenLabels.has(key)) continue;
    
    seenLabels.set(key, {
      label,
      value: generateCanonicalId(year, make, model, label),
      modificationId: rec.modificationId,
      isFromGroupedRecord: false,
      sourceDisplayTrim: rec.displayTrim,
      tireSizes: Array.isArray(rec.oemTireSizes) ? rec.oemTireSizes : undefined,
      boltPattern: rec.boltPattern ?? undefined,
      centerBore: rec.centerBoreMm ? Number(rec.centerBoreMm) : undefined,
    });
  }
  
  // Second pass: process grouped records
  // Only add trims not already seen from individual records
  for (const rec of records) {
    if (!isGroupedTrim(rec.displayTrim)) continue;
    
    const atomicTrims = explodeTrim(rec.displayTrim);
    
    for (const label of atomicTrims) {
      const key = label.toLowerCase();
      if (seenLabels.has(key)) continue;
      
      seenLabels.set(key, {
        label,
        value: generateCanonicalId(year, make, model, label),
        modificationId: rec.modificationId,
        isFromGroupedRecord: true,
        sourceDisplayTrim: rec.displayTrim,
        tireSizes: Array.isArray(rec.oemTireSizes) ? rec.oemTireSizes : undefined,
        boltPattern: rec.boltPattern ?? undefined,
        centerBore: rec.centerBoreMm ? Number(rec.centerBoreMm) : undefined,
      });
    }
  }
  
  // Sort alphabetically
  return Array.from(seenLabels.values()).sort((a, b) => 
    a.label.localeCompare(b.label)
  );
}

/**
 * Find the source database record for an exploded trim selection.
 * 
 * Use this to map a customer's trim selection back to the correct
 * fitment record for resolution.
 * 
 * @param selectedTrim - Trim label selected by customer
 * @param records - Database records to search
 * @returns Matching record or null
 */
export function findSourceRecordForTrim(
  selectedTrim: string,
  records: TrimRecord[]
): TrimRecord | null {
  const normalizedSelection = selectedTrim.toLowerCase().trim();
  
  // First: try exact match on non-grouped records (preferred)
  for (const rec of records) {
    if (!isGroupedTrim(rec.displayTrim)) {
      if (rec.displayTrim.toLowerCase().trim() === normalizedSelection) {
        return rec;
      }
    }
  }
  
  // Second: try match within grouped records
  for (const rec of records) {
    if (isGroupedTrim(rec.displayTrim)) {
      const atomicTrims = explodeTrim(rec.displayTrim);
      for (const trim of atomicTrims) {
        if (trim.toLowerCase().trim() === normalizedSelection) {
          return rec;
        }
      }
    }
  }
  
  // Third: try normalized match (case-insensitive, whitespace-tolerant)
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedTarget = normalize(selectedTrim);
  
  for (const rec of records) {
    const atomicTrims = isGroupedTrim(rec.displayTrim) 
      ? explodeTrim(rec.displayTrim) 
      : [rec.displayTrim];
    
    for (const trim of atomicTrims) {
      if (normalize(trim) === normalizedTarget) {
        return rec;
      }
    }
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate that exploded trims resolve correctly back to source records.
 * Returns any issues found.
 */
export function validateTrimExplosion(
  records: TrimRecord[],
  year: number,
  make: string,
  model: string
): string[] {
  const errors: string[] = [];
  const exploded = explodeTrimsFromRecords(records, year, make, model);
  
  for (const option of exploded) {
    const source = findSourceRecordForTrim(option.label, records);
    if (!source) {
      errors.push(`Exploded trim "${option.label}" cannot find source record`);
    } else if (source.modificationId !== option.modificationId) {
      errors.push(`Exploded trim "${option.label}" modificationId mismatch: expected ${option.modificationId}, found ${source.modificationId}`);
    }
  }
  
  return errors;
}

/**
 * Get statistics about trim grouping in a set of records.
 */
export function getTrimGroupingStats(records: TrimRecord[]): {
  totalRecords: number;
  groupedRecords: number;
  individualRecords: number;
  totalAtomicTrims: number;
  trimsFromGrouped: number;
  trimsFromIndividual: number;
} {
  let groupedRecords = 0;
  let individualRecords = 0;
  let trimsFromGrouped = 0;
  let trimsFromIndividual = 0;
  
  for (const rec of records) {
    if (isGroupedTrim(rec.displayTrim)) {
      groupedRecords++;
      trimsFromGrouped += explodeTrim(rec.displayTrim).length;
    } else {
      individualRecords++;
      trimsFromIndividual++;
    }
  }
  
  return {
    totalRecords: records.length,
    groupedRecords,
    individualRecords,
    totalAtomicTrims: trimsFromGrouped + trimsFromIndividual,
    trimsFromGrouped,
    trimsFromIndividual,
  };
}
