/**
 * Wheel-Size Trim Mapping Service
 * 
 * Maps our trim labels to Wheel-Size modification/submodel identifiers.
 * Enables auto-selection when a trim has exactly one OEM configuration.
 * 
 * KEY PRINCIPLES:
 * 1. DB-first runtime - no live Wheel-Size API calls
 * 2. Use cached Wheel-Size data from fitment_source_records
 * 3. Store resolved mappings for fast lookup
 * 4. Flag ambiguous cases for admin review
 */

import { db } from "./db";
import { 
  wheelSizeTrimMappings, 
  vehicleFitments, 
  vehicleFitmentConfigurations,
  fitmentSourceRecords,
  type WheelSizeTrimMapping,
  type NewWheelSizeTrimMapping,
  type VehicleFitmentConfiguration,
} from "./schema";
import { eq, and, ilike, sql, inArray, isNull, desc } from "drizzle-orm";
import { normalizeMake, normalizeModel, slugify } from "./keys";

// ============================================================================
// TYPES
// ============================================================================

export interface TrimMappingResult {
  found: boolean;
  mapping: WheelSizeTrimMapping | null;
  configurations: VehicleFitmentConfiguration[];
  autoSelectConfig: VehicleFitmentConfiguration | null;
  showSizeChooser: boolean;
  chooserReason: 'multiple_configs' | 'no_mapping' | 'low_confidence' | 'needs_review' | null;
}

export interface MappingMatchResult {
  wsSlug: string;
  wsGeneration: string | null;
  wsModificationName: string | null;
  wsTrim: string | null;
  wsEngine: string | null;
  wsBody: string | null;
  matchMethod: string;
  matchConfidence: 'high' | 'medium' | 'low';
  matchScore: number;
}

// ============================================================================
// LOOKUP - Runtime resolution (customer-facing)
// ============================================================================

/**
 * Look up trim mapping for a vehicle selection.
 * This is the main runtime entry point - fast, DB-only.
 */
export async function getTrimMapping(
  year: number,
  make: string,
  model: string,
  trim: string
): Promise<TrimMappingResult> {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  
  // 1. Try to find existing mapping
  const [mapping] = await db
    .select()
    .from(wheelSizeTrimMappings)
    .where(
      and(
        eq(wheelSizeTrimMappings.year, year),
        ilike(wheelSizeTrimMappings.make, normalizedMake),
        ilike(wheelSizeTrimMappings.model, normalizedModel),
        eq(wheelSizeTrimMappings.ourTrim, trim)
      )
    )
    .limit(1);
  
  // No mapping found
  if (!mapping) {
    return {
      found: false,
      mapping: null,
      configurations: [],
      autoSelectConfig: null,
      showSizeChooser: true,
      chooserReason: 'no_mapping',
    };
  }
  
  // Mapping needs review - show chooser with low confidence
  if (mapping.needsReview || mapping.status === 'needs_manual') {
    const configs = await getConfigurationsForVehicle(year, make, model, mapping.ourModificationId);
    return {
      found: true,
      mapping,
      configurations: configs,
      autoSelectConfig: null,
      showSizeChooser: true,
      chooserReason: 'needs_review',
    };
  }
  
  // Low confidence mapping - show chooser but suggest default
  if (mapping.matchConfidence === 'low') {
    const configs = await getConfigurationsForVehicle(year, make, model, mapping.ourModificationId);
    const defaultConfig = mapping.defaultConfigId 
      ? configs.find(c => c.id === mapping.defaultConfigId) ?? null
      : null;
    
    return {
      found: true,
      mapping,
      configurations: configs,
      autoSelectConfig: defaultConfig,
      showSizeChooser: true,
      chooserReason: 'low_confidence',
    };
  }
  
  // Single config with high/medium confidence - AUTO-SELECT!
  if (mapping.hasSingleConfig && mapping.defaultConfigId) {
    const configs = await getConfigurationsForVehicle(year, make, model, mapping.ourModificationId);
    const defaultConfig = configs.find(c => c.id === mapping.defaultConfigId);
    
    if (defaultConfig) {
      return {
        found: true,
        mapping,
        configurations: configs,
        autoSelectConfig: defaultConfig,
        showSizeChooser: false, // Skip the chooser!
        chooserReason: null,
      };
    }
  }
  
  // Multiple configs - show chooser
  const configs = await getConfigurationsForVehicle(year, make, model, mapping.ourModificationId);
  const defaultConfig = mapping.defaultConfigId 
    ? configs.find(c => c.id === mapping.defaultConfigId) ?? null
    : configs.find(c => c.isDefault) ?? null;
  
  return {
    found: true,
    mapping,
    configurations: configs,
    autoSelectConfig: defaultConfig,
    showSizeChooser: configs.length > 1,
    chooserReason: configs.length > 1 ? 'multiple_configs' : null,
  };
}

/**
 * Get configurations for a vehicle/modification
 */
async function getConfigurationsForVehicle(
  year: number,
  make: string,
  model: string,
  modificationId?: string | null
): Promise<VehicleFitmentConfiguration[]> {
  const normalizedMake = normalizeMake(make).toLowerCase();
  const normalizedModel = normalizeModel(model).toLowerCase();
  
  const conditions = [
    eq(vehicleFitmentConfigurations.year, year),
    eq(vehicleFitmentConfigurations.makeKey, normalizedMake),
    eq(vehicleFitmentConfigurations.modelKey, normalizedModel),
  ];
  
  if (modificationId) {
    conditions.push(eq(vehicleFitmentConfigurations.modificationId, modificationId));
  }
  
  return db
    .select()
    .from(vehicleFitmentConfigurations)
    .where(and(...conditions))
    .orderBy(
      desc(vehicleFitmentConfigurations.isDefault),
      vehicleFitmentConfigurations.wheelDiameter
    );
}

// ============================================================================
// MATCHING - Build mappings from cached Wheel-Size data
// ============================================================================

/**
 * Normalize trim string for comparison
 */
function normalizeTrimForMatch(trim: string): string {
  return trim
    .toLowerCase()
    .trim()
    // Remove common suffixes/prefixes
    .replace(/\b(4wd|4x4|awd|2wd|fwd|rwd)\b/gi, '')
    .replace(/\b(crew|extended|regular|double|super)\s*(cab|crew)?\b/gi, '')
    .replace(/\b(short|long|standard)\s*bed\b/gi, '')
    .replace(/\b(diesel|gas|hybrid|electric|ev)\b/gi, '')
    .replace(/\b(automatic|manual|cvt)\b/gi, '')
    // Normalize spacing and punctuation
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity score between two trim strings
 */
function calculateTrimSimilarity(ourTrim: string, wsTrim: string): number {
  const a = normalizeTrimForMatch(ourTrim);
  const b = normalizeTrimForMatch(wsTrim);
  
  // Exact match after normalization
  if (a === b) return 1.0;
  
  // One contains the other
  if (a.includes(b) || b.includes(a)) return 0.9;
  
  // Token-based similarity
  const tokensA = new Set(a.split(' ').filter(t => t.length > 1));
  const tokensB = new Set(b.split(' ').filter(t => t.length > 1));
  
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  
  const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  
  return intersection / union; // Jaccard similarity
}

/**
 * Find best Wheel-Size match for our trim
 */
export async function findWheelSizeMatch(
  year: number,
  make: string,
  model: string,
  ourTrim: string
): Promise<MappingMatchResult | null> {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  
  // Get cached Wheel-Size data for this vehicle
  const sourceRecords = await db
    .select()
    .from(fitmentSourceRecords)
    .where(
      and(
        eq(fitmentSourceRecords.source, 'wheelsize'),
        eq(fitmentSourceRecords.year, year),
        ilike(fitmentSourceRecords.make, normalizedMake),
        ilike(fitmentSourceRecords.model, normalizedModel)
      )
    )
    .limit(100);
  
  if (sourceRecords.length === 0) {
    return null;
  }
  
  // Extract all modifications from cached data
  type WSModification = {
    slug: string;
    name?: string;
    trim?: string | { name?: string };
    engine?: string | { capacity?: string };
    body?: string;
    generation?: { name?: string };
  };
  
  const wsModifications: WSModification[] = [];
  
  for (const record of sourceRecords) {
    const payload = record.rawPayload as any;
    
    // Handle different payload structures
    if (payload.modification) {
      wsModifications.push(payload.modification);
    }
    if (payload.modifications) {
      wsModifications.push(...payload.modifications);
    }
    if (payload.data && Array.isArray(payload.data)) {
      wsModifications.push(...payload.data);
    }
  }
  
  if (wsModifications.length === 0) {
    return null;
  }
  
  // Find best match
  let bestMatch: MappingMatchResult | null = null;
  let bestScore = 0;
  
  for (const ws of wsModifications) {
    const wsTrimStr = typeof ws.trim === 'string' 
      ? ws.trim 
      : ws.trim?.name || ws.name || '';
    
    const score = calculateTrimSimilarity(ourTrim, wsTrimStr);
    
    if (score > bestScore) {
      bestScore = score;
      
      const wsEngineStr = typeof ws.engine === 'string'
        ? ws.engine
        : ws.engine?.capacity || '';
      
      bestMatch = {
        wsSlug: ws.slug,
        wsGeneration: ws.generation?.name || null,
        wsModificationName: ws.name || null,
        wsTrim: wsTrimStr || null,
        wsEngine: wsEngineStr || null,
        wsBody: ws.body || null,
        matchMethod: score >= 1.0 ? 'exact_normalized' 
                   : score >= 0.9 ? 'fuzzy_high'
                   : score >= 0.7 ? 'fuzzy_medium'
                   : 'inferred',
        matchConfidence: score >= 0.9 ? 'high' 
                       : score >= 0.7 ? 'medium' 
                       : 'low',
        matchScore: score,
      };
    }
  }
  
  return bestMatch;
}

// ============================================================================
// ADMIN - Review and management
// ============================================================================

/**
 * Get mappings that need admin review
 */
export async function getMappingsNeedingReview(limit = 50): Promise<WheelSizeTrimMapping[]> {
  return db
    .select()
    .from(wheelSizeTrimMappings)
    .where(eq(wheelSizeTrimMappings.needsReview, true))
    .orderBy(
      desc(wheelSizeTrimMappings.reviewPriority),
      wheelSizeTrimMappings.createdAt
    )
    .limit(limit);
}

/**
 * Approve a mapping
 */
export async function approveMapping(
  id: string,
  reviewedBy: string,
  notes?: string
): Promise<void> {
  await db
    .update(wheelSizeTrimMappings)
    .set({
      needsReview: false,
      status: 'approved',
      reviewedBy,
      reviewedAt: new Date(),
      reviewNotes: notes || null,
    })
    .where(eq(wheelSizeTrimMappings.id, id));
}

/**
 * Reject a mapping (mark for manual intervention)
 */
export async function rejectMapping(
  id: string,
  reviewedBy: string,
  reason: string
): Promise<void> {
  await db
    .update(wheelSizeTrimMappings)
    .set({
      needsReview: false,
      status: 'rejected',
      reviewedBy,
      reviewedAt: new Date(),
      reviewReason: reason,
      reviewNotes: reason,
    })
    .where(eq(wheelSizeTrimMappings.id, id));
}

/**
 * Create a manual mapping
 */
export async function createManualMapping(
  mapping: Omit<NewWheelSizeTrimMapping, 'matchMethod' | 'matchConfidence' | 'status'>
): Promise<WheelSizeTrimMapping> {
  const [inserted] = await db
    .insert(wheelSizeTrimMappings)
    .values({
      ...mapping,
      matchMethod: 'manual',
      matchConfidence: 'high',
      status: 'approved',
      needsReview: false,
    })
    .returning();
  
  return inserted;
}

// ============================================================================
// SYNC - Build mappings from existing data
// ============================================================================

/**
 * Build mappings for all trims in a vehicle
 */
export async function buildMappingsForVehicle(
  year: number,
  make: string,
  model: string
): Promise<{ created: number; updated: number; skipped: number }> {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  
  // Get all our trims for this vehicle
  const fitments = await db
    .select()
    .from(vehicleFitments)
    .where(
      and(
        eq(vehicleFitments.year, year),
        ilike(vehicleFitments.make, normalizedMake),
        ilike(vehicleFitments.model, normalizedModel),
        eq(vehicleFitments.certificationStatus, 'certified')
      )
    );
  
  let created = 0;
  let updated = 0;
  let skipped = 0;
  
  for (const fitment of fitments) {
    // Check if mapping already exists
    const [existing] = await db
      .select()
      .from(wheelSizeTrimMappings)
      .where(
        and(
          eq(wheelSizeTrimMappings.year, year),
          ilike(wheelSizeTrimMappings.make, normalizedMake),
          ilike(wheelSizeTrimMappings.model, normalizedModel),
          eq(wheelSizeTrimMappings.ourTrim, fitment.displayTrim)
        )
      )
      .limit(1);
    
    // Skip if already approved
    if (existing?.status === 'approved') {
      skipped++;
      continue;
    }
    
    // Find Wheel-Size match
    const match = await findWheelSizeMatch(year, make, model, fitment.displayTrim);
    
    if (!match) {
      // No WS data - skip or mark for review
      if (!existing) {
        skipped++;
      }
      continue;
    }
    
    // Get configuration count
    const configs = await getConfigurationsForVehicle(year, make, model, fitment.modificationId);
    const hasSingleConfig = configs.length === 1;
    const defaultConfig = configs.find(c => c.isDefault) || configs[0];
    
    // Determine if needs review
    const needsReview = match.matchConfidence === 'low' || configs.length === 0;
    const reviewReason = needsReview 
      ? (configs.length === 0 ? 'No configurations found' : 'Low confidence match')
      : null;
    
    const mappingData: NewWheelSizeTrimMapping = {
      year,
      make: normalizedMake,
      model: normalizedModel,
      ourTrim: fitment.displayTrim,
      ourModificationId: fitment.modificationId,
      vehicleFitmentId: fitment.id,
      wsSlug: match.wsSlug,
      wsGeneration: match.wsGeneration,
      wsModificationName: match.wsModificationName,
      wsTrim: match.wsTrim,
      wsEngine: match.wsEngine,
      wsBody: match.wsBody,
      matchMethod: match.matchMethod,
      matchConfidence: match.matchConfidence,
      matchScore: String(match.matchScore),
      configCount: configs.length,
      hasSingleConfig,
      defaultConfigId: defaultConfig?.id,
      defaultWheelDiameter: defaultConfig?.wheelDiameter,
      defaultTireSize: defaultConfig?.tireSize,
      allWheelDiameters: [...new Set(configs.map(c => c.wheelDiameter))],
      allTireSizes: [...new Set(configs.map(c => c.tireSize))],
      needsReview,
      reviewReason,
      reviewPriority: needsReview ? (configs.length === 0 ? 10 : 5) : 0,
      status: needsReview ? 'pending' : (match.matchConfidence === 'high' ? 'approved' : 'pending'),
    };
    
    if (existing) {
      await db
        .update(wheelSizeTrimMappings)
        .set(mappingData)
        .where(eq(wheelSizeTrimMappings.id, existing.id));
      updated++;
    } else {
      await db
        .insert(wheelSizeTrimMappings)
        .values(mappingData);
      created++;
    }
  }
  
  return { created, updated, skipped };
}
