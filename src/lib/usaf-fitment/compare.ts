/**
 * USAF Fitment Comparison
 * 
 * Compares our canonical fitment data against USAF vehicle options.
 * Produces discrepancy reports for review.
 */

import type {
  UsafVehicleOption,
  NormalizedFitment,
  FitmentDiscrepancy,
  DiscrepancyType,
  VehicleAuditResult,
} from './types';

import {
  normalizeUsafTireSize,
  inferUsafConfigurations,
  deduplicateUsafOptions,
  tireSizeInList,
} from './normalize';

// ============================================================================
// COMPARISON ENGINE
// ============================================================================

export interface OurFitmentData {
  vehicleId: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  tireSizes: string[];
  isStaggered: boolean;
  wheelDiameters: number[];
  loadRanges?: string[];
  speedRatings?: string[];
}

/**
 * Compare our fitment data against USAF data
 */
export function compareFitment(
  ourData: OurFitmentData,
  usafOptions: UsafVehicleOption[]
): VehicleAuditResult {
  const discrepancies: FitmentDiscrepancy[] = [];
  
  // Deduplicate and normalize USAF data
  const cleanOptions = deduplicateUsafOptions(usafOptions);
  const usafFitment = inferUsafConfigurations(cleanOptions);
  
  // Extract USAF tire sizes as strings
  const usafTireSizes = usafFitment.tireSizes.map(t => t.normalized);
  
  // 1. Check for missing sizes (USAF has, we don't)
  for (const usafSize of usafTireSizes) {
    if (!tireSizeInList(usafSize, ourData.tireSizes)) {
      discrepancies.push({
        type: 'MISSING_SIZE',
        field: 'tireSizes',
        ourValue: null,
        usafValue: usafSize,
        confidence: 80,
        recommendation: 'review',
        notes: `USAF has size ${usafSize} that we don't have`,
      });
    }
  }
  
  // 2. Check for sizes we have that USAF doesn't
  for (const ourSize of ourData.tireSizes) {
    if (!tireSizeInList(ourSize, usafTireSizes)) {
      discrepancies.push({
        type: 'MISSING_IN_USAF',
        field: 'tireSizes',
        ourValue: ourSize,
        usafValue: null,
        confidence: 60,
        recommendation: 'ignore',
        notes: `We have size ${ourSize} that USAF doesn't have (may be aftermarket)`,
      });
    }
  }
  
  // 3. Check staggered detection
  if (usafFitment.isStaggered && !ourData.isStaggered) {
    discrepancies.push({
      type: 'POSSIBLE_STAGGERED',
      field: 'isStaggered',
      ourValue: false,
      usafValue: true,
      confidence: 85,
      recommendation: 'review',
      notes: `USAF indicates staggered: front=${usafFitment.frontSize?.normalized}, rear=${usafFitment.rearSize?.normalized}`,
    });
  } else if (!usafFitment.isStaggered && ourData.isStaggered) {
    discrepancies.push({
      type: 'POSSIBLE_BAD_DB_RECORD',
      field: 'isStaggered',
      ourValue: true,
      usafValue: false,
      confidence: 50,
      recommendation: 'review',
      notes: 'We have staggered flag but USAF does not indicate staggered',
    });
  }
  
  // 4. Check wheel diameters
  for (const usafDiam of usafFitment.wheelDiameters) {
    if (!ourData.wheelDiameters.includes(usafDiam)) {
      discrepancies.push({
        type: 'WHEEL_DIAMETER_MISMATCH',
        field: 'wheelDiameters',
        ourValue: ourData.wheelDiameters.join(', '),
        usafValue: usafDiam,
        confidence: 70,
        recommendation: 'review',
        notes: `USAF has wheel diameter ${usafDiam}" that we don't have`,
      });
    }
  }
  
  // 5. Check load ranges
  if (ourData.loadRanges && usafFitment.loadRanges.length > 0) {
    for (const usafLR of usafFitment.loadRanges) {
      if (!ourData.loadRanges.includes(usafLR)) {
        discrepancies.push({
          type: 'LOAD_RANGE_MISMATCH',
          field: 'loadRanges',
          ourValue: ourData.loadRanges.join(', '),
          usafValue: usafLR,
          confidence: 60,
          recommendation: 'ignore',
        });
      }
    }
  }
  
  // 6. Check speed ratings
  if (ourData.speedRatings && usafFitment.speedRatings.length > 0) {
    for (const usafSR of usafFitment.speedRatings) {
      if (!ourData.speedRatings.includes(usafSR)) {
        discrepancies.push({
          type: 'SPEED_RATING_MISMATCH',
          field: 'speedRatings',
          ourValue: ourData.speedRatings.join(', '),
          usafValue: usafSR,
          confidence: 50,
          recommendation: 'ignore',
        });
      }
    }
  }
  
  // Calculate overall match
  const criticalDiscrepancies = discrepancies.filter(d => 
    ['MISSING_SIZE', 'POSSIBLE_STAGGERED', 'POSSIBLE_BAD_DB_RECORD'].includes(d.type)
  );
  
  let overallMatch: 'full' | 'partial' | 'mismatch';
  if (discrepancies.length === 0) {
    overallMatch = 'full';
  } else if (criticalDiscrepancies.length === 0) {
    overallMatch = 'partial';
  } else {
    overallMatch = 'mismatch';
  }
  
  // Confidence score
  const confidenceScore = discrepancies.length === 0 
    ? 100 
    : Math.max(0, 100 - (discrepancies.length * 10) - (criticalDiscrepancies.length * 15));
  
  return {
    vehicleId: ourData.vehicleId,
    year: ourData.year,
    make: ourData.make,
    model: ourData.model,
    trim: ourData.trim,
    
    ourTireSizes: ourData.tireSizes,
    ourIsStaggered: ourData.isStaggered,
    ourWheelDiameters: ourData.wheelDiameters,
    
    usafTireSizes,
    usafIsStaggered: usafFitment.isStaggered,
    usafWheelDiameters: usafFitment.wheelDiameters,
    usafOptions: cleanOptions,
    
    discrepancies,
    overallMatch,
    confidenceScore,
    
    auditedAt: new Date(),
  };
}

// ============================================================================
// CLASSIFICATION HELPERS
// ============================================================================

/**
 * Classify a discrepancy for prioritization
 */
export function classifyDiscrepancy(d: FitmentDiscrepancy): {
  priority: 'high' | 'medium' | 'low';
  actionRequired: boolean;
  canAutoEnrich: boolean;
} {
  switch (d.type) {
    case 'SAFE_MATCH':
      return { priority: 'low', actionRequired: false, canAutoEnrich: false };
    
    case 'MISSING_SIZE':
      return { priority: 'high', actionRequired: true, canAutoEnrich: true };
    
    case 'POSSIBLE_STAGGERED':
      return { priority: 'high', actionRequired: true, canAutoEnrich: true };
    
    case 'POSSIBLE_BAD_DB_RECORD':
      return { priority: 'high', actionRequired: true, canAutoEnrich: false };
    
    case 'WHEEL_DIAMETER_MISMATCH':
      return { priority: 'medium', actionRequired: true, canAutoEnrich: true };
    
    case 'LOAD_RANGE_MISMATCH':
    case 'SPEED_RATING_MISMATCH':
      return { priority: 'low', actionRequired: false, canAutoEnrich: true };
    
    case 'EXTRA_USAF_CONFIG':
      return { priority: 'medium', actionRequired: true, canAutoEnrich: false };
    
    case 'MISSING_IN_USAF':
      return { priority: 'low', actionRequired: false, canAutoEnrich: false };
    
    default:
      return { priority: 'medium', actionRequired: true, canAutoEnrich: false };
  }
}

/**
 * Get summary statistics for a batch of audit results
 */
export function summarizeAuditBatch(results: VehicleAuditResult[]): {
  total: number;
  fullMatches: number;
  partialMatches: number;
  mismatches: number;
  avgConfidence: number;
  
  bySeverity: {
    high: number;
    medium: number;
    low: number;
  };
  
  byType: Record<DiscrepancyType, number>;
} {
  const byType: Record<string, number> = {};
  let highCount = 0, mediumCount = 0, lowCount = 0;
  
  for (const result of results) {
    for (const d of result.discrepancies) {
      byType[d.type] = (byType[d.type] || 0) + 1;
      
      const { priority } = classifyDiscrepancy(d);
      if (priority === 'high') highCount++;
      else if (priority === 'medium') mediumCount++;
      else lowCount++;
    }
  }
  
  return {
    total: results.length,
    fullMatches: results.filter(r => r.overallMatch === 'full').length,
    partialMatches: results.filter(r => r.overallMatch === 'partial').length,
    mismatches: results.filter(r => r.overallMatch === 'mismatch').length,
    avgConfidence: results.reduce((sum, r) => sum + r.confidenceScore, 0) / results.length,
    
    bySeverity: {
      high: highCount,
      medium: mediumCount,
      low: lowCount,
    },
    
    byType: byType as Record<DiscrepancyType, number>,
  };
}
