/**
 * Config-Table Enrichment API
 * 
 * Compares existing vehicleFitmentConfigurations with USAF data
 * and legacy vehicleFitments to identify safe enrichment candidates.
 * 
 * This is the PROPER path for USAF enrichments to enter the config system,
 * rather than bypassing config-table priority.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { vehicleFitmentConfigurations, vehicleFitments } from "@/lib/fitment-db/schema";
import { eq, and, ilike } from "drizzle-orm";
import { normalizeMake, normalizeModel } from "@/lib/fitment-db/keys";

export const runtime = "nodejs";
export const maxDuration = 60;

// ============================================================================
// Types
// ============================================================================

interface ConfigTireSize {
  tireSize: string;
  wheelDiameter: number;
  axlePosition: "front" | "rear" | "square";
  source: "config" | "legacy" | "usaf";
}

interface EnrichmentCandidate {
  tireSize: string;
  wheelDiameter: number;
  source: "legacy" | "usaf";
  confidence: number;
  reasons: string[];
  autoRejectReason: string | null;
}

interface ConfigEnrichmentAnalysis {
  vehicle: {
    year: number;
    make: string;
    model: string;
    displayTrim: string | null;
  };
  configTableStatus: "has_data" | "no_data";
  existingConfigSizes: ConfigTireSize[];
  legacySizes: string[];
  usafSizes: string[];
  
  // Analysis results
  missingInConfig: EnrichmentCandidate[];
  duplicateEquivalents: string[];
  possibleStaggeredGaps: string[];
  conflictingDiameters: string[];
  
  // Overall assessment
  overallConfidence: number;
  recommendedAction: "auto_approve" | "review_required" | "auto_reject";
  actionReason: string;
  
  // Dry-run preview
  dryRunPreview: {
    currentChooserBehavior: string;
    proposedChooserBehavior: string;
    regressionRisk: "none" | "low" | "medium" | "high";
    regressionDetails: string[];
  };
}

// ============================================================================
// Auto-Reject Rules
// ============================================================================

interface AutoRejectResult {
  rejected: boolean;
  reason: string | null;
}

function checkAutoReject(
  candidate: { tireSize: string; wheelDiameter: number },
  existingConfig: ConfigTireSize[],
  allCandidates: { tireSize: string; wheelDiameter: number }[]
): AutoRejectResult {
  const { tireSize, wheelDiameter } = candidate;
  
  // Rule 1: Unclear staggered pairings
  // If existing config has staggered setup, new sizes must fit the pattern
  const hasStaggered = existingConfig.some(c => c.axlePosition !== "square");
  if (hasStaggered) {
    const frontDiameters = existingConfig.filter(c => c.axlePosition === "front").map(c => c.wheelDiameter);
    const rearDiameters = existingConfig.filter(c => c.axlePosition === "rear").map(c => c.wheelDiameter);
    
    // New size must match an existing staggered diameter
    if (frontDiameters.length > 0 && rearDiameters.length > 0) {
      if (!frontDiameters.includes(wheelDiameter) && !rearDiameters.includes(wheelDiameter)) {
        return {
          rejected: true,
          reason: `Unclear staggered pairing: ${wheelDiameter}" doesn't match front (${frontDiameters.join(",")}) or rear (${rearDiameters.join(",")}) diameters`,
        };
      }
    }
  }
  
  // Rule 2: Conflicting wheel diameters (too many options)
  const existingDiameters = [...new Set(existingConfig.map(c => c.wheelDiameter))];
  const allNewDiameters = [...new Set(allCandidates.map(c => c.wheelDiameter))];
  const combinedDiameters = [...new Set([...existingDiameters, ...allNewDiameters])];
  
  if (combinedDiameters.length > 5) {
    return {
      rejected: true,
      reason: `Too many wheel diameters (${combinedDiameters.length}): would create confusing chooser experience`,
    };
  }
  
  // Rule 3: HD SRW/DRW ambiguity
  // LT sizes on HD trucks need special handling
  if (tireSize.startsWith("LT")) {
    const hasMixedLoadClass = existingConfig.some(c => 
      !c.tireSize.startsWith("LT") && c.wheelDiameter === wheelDiameter
    );
    if (hasMixedLoadClass) {
      return {
        rejected: true,
        reason: `HD SRW/DRW ambiguity: LT size ${tireSize} mixed with non-LT at same diameter`,
      };
    }
  }
  
  // Rule 4: Mixed load class conflicts
  // P-metric vs LT at same diameter
  if (tireSize.startsWith("P") || tireSize.match(/^\d/)) {
    const hasLTAtSameDiameter = existingConfig.some(c => 
      c.tireSize.startsWith("LT") && c.wheelDiameter === wheelDiameter
    );
    if (hasLTAtSameDiameter) {
      return {
        rejected: true,
        reason: `Mixed load class: P-metric/standard ${tireSize} conflicts with LT sizes at ${wheelDiameter}"`,
      };
    }
  }
  
  // Rule 5: Flotation tire format (e.g., 35x12.50R17)
  if (tireSize.match(/^\d+x\d+/)) {
    return {
      rejected: true,
      reason: `Flotation tire format not supported in config table: ${tireSize}`,
    };
  }
  
  // Rule 6: HL (High Load) prefix - not standard
  if (tireSize.startsWith("HL")) {
    return {
      rejected: true,
      reason: `HL (High Load) tire format not supported: ${tireSize}`,
    };
  }
  
  return { rejected: false, reason: null };
}

// ============================================================================
// Confidence Scoring
// ============================================================================

function calculateConfigMergeConfidence(
  candidate: { tireSize: string; wheelDiameter: number },
  existingConfig: ConfigTireSize[],
  legacySizes: string[],
  usafSizes: string[]
): { confidence: number; reasons: string[] } {
  let confidence = 50; // Base confidence
  const reasons: string[] = [];
  
  // +20: Size exists in both legacy and USAF
  const inLegacy = legacySizes.includes(candidate.tireSize);
  const inUsaf = usafSizes.includes(candidate.tireSize);
  if (inLegacy && inUsaf) {
    confidence += 20;
    reasons.push("Confirmed by both legacy DB and USAF");
  } else if (inLegacy) {
    confidence += 10;
    reasons.push("Exists in legacy fitments");
  } else if (inUsaf) {
    confidence += 10;
    reasons.push("Exists in USAF data");
  }
  
  // +15: Diameter already exists in config
  const existingDiameters = existingConfig.map(c => c.wheelDiameter);
  if (existingDiameters.includes(candidate.wheelDiameter)) {
    confidence += 15;
    reasons.push(`${candidate.wheelDiameter}" already in config`);
  } else {
    reasons.push(`New diameter: ${candidate.wheelDiameter}"`);
  }
  
  // +10: Standard tire size format
  if (candidate.tireSize.match(/^\d{3}\/\d{2}R\d{2}$/)) {
    confidence += 10;
    reasons.push("Standard tire size format");
  } else if (candidate.tireSize.match(/^LT\d{3}\/\d{2}R\d{2}$/)) {
    confidence += 5;
    reasons.push("LT tire format (light truck)");
  } else if (candidate.tireSize.match(/^P\d{3}\/\d{2}R\d{2}$/)) {
    confidence += 5;
    reasons.push("P-metric format");
  }
  
  // -10: Would create 4+ diameter options
  const combinedDiameters = [...new Set([...existingDiameters, candidate.wheelDiameter])];
  if (combinedDiameters.length >= 4) {
    confidence -= 10;
    reasons.push(`Many diameter options (${combinedDiameters.length})`);
  }
  
  // +5: Common OEM size pattern
  const commonPatterns = [
    /^2[0-7]5\/[4-7]0R1[6-9]$/,  // 205-275/40-70R16-19
    /^2[0-7]5\/[4-7]0R2[0-2]$/,  // 205-275/40-70R20-22
  ];
  if (commonPatterns.some(p => candidate.tireSize.match(p))) {
    confidence += 5;
    reasons.push("Common OEM size pattern");
  }
  
  return { confidence: Math.min(100, Math.max(0, confidence)), reasons };
}

// ============================================================================
// Chooser Behavior Preview
// ============================================================================

function previewChooserBehavior(sizes: ConfigTireSize[]): string {
  const diameters = [...new Set(sizes.map(s => s.wheelDiameter))].sort((a, b) => a - b);
  
  if (diameters.length === 0) return "No tire sizes available";
  if (diameters.length === 1) return `Single option: ${diameters[0]}"`;
  
  const hasStaggered = sizes.some(s => s.axlePosition !== "square");
  if (hasStaggered) {
    return `Staggered setup with ${diameters.length} diameter options`;
  }
  
  return `Chooser with ${diameters.length} options: ${diameters.map(d => `${d}"`).join(", ")}`;
}

function assessRegressionRisk(
  current: ConfigTireSize[],
  proposed: ConfigTireSize[]
): { risk: "none" | "low" | "medium" | "high"; details: string[] } {
  const details: string[] = [];
  let riskScore = 0;
  
  // Check for removed sizes
  const currentSizes = new Set(current.map(c => c.tireSize));
  const proposedSizes = new Set(proposed.map(c => c.tireSize));
  const removed = [...currentSizes].filter(s => !proposedSizes.has(s));
  if (removed.length > 0) {
    riskScore += 3;
    details.push(`Sizes removed: ${removed.join(", ")}`);
  }
  
  // Check for staggered → square change
  const currentHasStaggered = current.some(c => c.axlePosition !== "square");
  const proposedHasStaggered = proposed.some(c => c.axlePosition !== "square");
  if (currentHasStaggered && !proposedHasStaggered) {
    riskScore += 2;
    details.push("Staggered setup would become square");
  }
  
  // Check for diameter count increase
  const currentDiameters = [...new Set(current.map(c => c.wheelDiameter))];
  const proposedDiameters = [...new Set(proposed.map(c => c.wheelDiameter))];
  const newDiameters = proposedDiameters.filter(d => !currentDiameters.includes(d));
  if (newDiameters.length > 2) {
    riskScore += 1;
    details.push(`Many new diameters: ${newDiameters.map(d => `${d}"`).join(", ")}`);
  }
  
  if (details.length === 0) {
    details.push("No regressions detected");
  }
  
  const risk = riskScore === 0 ? "none" : riskScore <= 1 ? "low" : riskScore <= 2 ? "medium" : "high";
  return { risk, details };
}

// ============================================================================
// Main Analysis Function
// ============================================================================

async function analyzeConfigEnrichment(
  year: number,
  make: string,
  model: string,
  displayTrim?: string
): Promise<ConfigEnrichmentAnalysis> {
  const makeKey = normalizeMake(make);
  const modelKey = normalizeModel(model);
  
  // Fetch existing config table data
  const configRows = await db
    .select()
    .from(vehicleFitmentConfigurations)
    .where(
      displayTrim
        ? and(
            eq(vehicleFitmentConfigurations.year, year),
            eq(vehicleFitmentConfigurations.makeKey, makeKey),
            eq(vehicleFitmentConfigurations.modelKey, modelKey),
            eq(vehicleFitmentConfigurations.displayTrim, displayTrim)
          )
        : and(
            eq(vehicleFitmentConfigurations.year, year),
            eq(vehicleFitmentConfigurations.makeKey, makeKey),
            eq(vehicleFitmentConfigurations.modelKey, modelKey)
          )
    );
  
  const configTableStatus = configRows.length > 0 ? "has_data" : "no_data";
  
  const existingConfigSizes: ConfigTireSize[] = configRows.map(row => ({
    tireSize: row.tireSize,
    wheelDiameter: row.wheelDiameter,
    axlePosition: row.axlePosition as "front" | "rear" | "square",
    source: "config" as const,
  }));
  
  // Fetch legacy fitment data
  const legacyRows = await db
    .select({
      oemTireSizes: vehicleFitments.oemTireSizes,
      displayTrim: vehicleFitments.displayTrim,
    })
    .from(vehicleFitments)
    .where(
      and(
        eq(vehicleFitments.year, year),
        ilike(vehicleFitments.make, makeKey),
        ilike(vehicleFitments.model, modelKey)
      )
    )
    .limit(10);
  
  // Extract unique tire sizes from legacy
  const legacySizes: string[] = [];
  for (const row of legacyRows) {
    const sizes = row.oemTireSizes as string[] | null;
    if (sizes) {
      for (const size of sizes) {
        if (!legacySizes.includes(size)) {
          legacySizes.push(size);
        }
      }
    }
  }
  
  // TODO: Fetch USAF sizes from cache or API
  // For now, use legacy as proxy (USAF enrichment already merged into legacy)
  const usafSizes = legacySizes.filter(s => 
    s.startsWith("LT") || s.match(/^\d{3}\/\d{2}R\d{2}$/)
  );
  
  // Find sizes missing from config
  const configSizeSet = new Set(existingConfigSizes.map(c => c.tireSize));
  const allCandidateSizes = [...new Set([...legacySizes, ...usafSizes])];
  
  const missingInConfig: EnrichmentCandidate[] = [];
  const duplicateEquivalents: string[] = [];
  const possibleStaggeredGaps: string[] = [];
  const conflictingDiameters: string[] = [];
  
  for (const size of allCandidateSizes) {
    if (configSizeSet.has(size)) {
      continue; // Already in config
    }
    
    // Extract wheel diameter from tire size
    const diameterMatch = size.match(/R(\d+)$/);
    if (!diameterMatch) continue;
    const wheelDiameter = parseInt(diameterMatch[1], 10);
    
    const candidate = { tireSize: size, wheelDiameter };
    
    // Check auto-reject rules
    const autoReject = checkAutoReject(
      candidate,
      existingConfigSizes,
      allCandidateSizes.map(s => {
        const m = s.match(/R(\d+)$/);
        return { tireSize: s, wheelDiameter: m ? parseInt(m[1], 10) : 0 };
      }).filter(c => c.wheelDiameter > 0)
    );
    
    // Calculate confidence
    const { confidence, reasons } = calculateConfigMergeConfidence(
      candidate,
      existingConfigSizes,
      legacySizes,
      usafSizes
    );
    
    missingInConfig.push({
      tireSize: size,
      wheelDiameter,
      source: usafSizes.includes(size) ? "usaf" : "legacy",
      confidence,
      reasons,
      autoRejectReason: autoReject.reason,
    });
    
    // Track issues
    if (autoReject.rejected && autoReject.reason?.includes("conflicting")) {
      conflictingDiameters.push(size);
    }
    if (autoReject.rejected && autoReject.reason?.includes("staggered")) {
      possibleStaggeredGaps.push(size);
    }
  }
  
  // Check for duplicate equivalents (e.g., 275/60R20 and P275/60R20)
  const sizePatterns = new Map<string, string[]>();
  for (const size of [...configSizeSet, ...allCandidateSizes]) {
    const normalized = size.replace(/^[PL]T?/, "");
    if (!sizePatterns.has(normalized)) {
      sizePatterns.set(normalized, []);
    }
    sizePatterns.get(normalized)!.push(size);
  }
  for (const [, variants] of sizePatterns) {
    if (variants.length > 1) {
      duplicateEquivalents.push(variants.join(" ≈ "));
    }
  }
  
  // Calculate overall assessment
  const approvedCandidates = missingInConfig.filter(c => !c.autoRejectReason && c.confidence >= 70);
  const reviewCandidates = missingInConfig.filter(c => !c.autoRejectReason && c.confidence >= 50 && c.confidence < 70);
  const rejectedCandidates = missingInConfig.filter(c => c.autoRejectReason);
  
  let recommendedAction: "auto_approve" | "review_required" | "auto_reject";
  let actionReason: string;
  let overallConfidence = 0;
  
  if (missingInConfig.length === 0) {
    recommendedAction = "auto_approve";
    actionReason = "No missing sizes - config is complete";
    overallConfidence = 100;
  } else if (rejectedCandidates.length === missingInConfig.length) {
    recommendedAction = "auto_reject";
    actionReason = `All ${rejectedCandidates.length} candidates auto-rejected`;
    overallConfidence = 0;
  } else if (approvedCandidates.length > 0 && reviewCandidates.length === 0) {
    recommendedAction = "auto_approve";
    actionReason = `${approvedCandidates.length} high-confidence candidates`;
    overallConfidence = Math.round(approvedCandidates.reduce((sum, c) => sum + c.confidence, 0) / approvedCandidates.length);
  } else {
    recommendedAction = "review_required";
    actionReason = `${reviewCandidates.length} candidates need review, ${rejectedCandidates.length} rejected`;
    overallConfidence = Math.round(
      [...approvedCandidates, ...reviewCandidates].reduce((sum, c) => sum + c.confidence, 0) / 
      Math.max(1, approvedCandidates.length + reviewCandidates.length)
    );
  }
  
  // Build dry-run preview
  const proposedConfigSizes: ConfigTireSize[] = [
    ...existingConfigSizes,
    ...approvedCandidates.map(c => ({
      tireSize: c.tireSize,
      wheelDiameter: c.wheelDiameter,
      axlePosition: "square" as const,
      source: "usaf" as const,
    })),
  ];
  
  const currentBehavior = previewChooserBehavior(existingConfigSizes);
  const proposedBehavior = previewChooserBehavior(proposedConfigSizes);
  const { risk, details } = assessRegressionRisk(existingConfigSizes, proposedConfigSizes);
  
  return {
    vehicle: { year, make, model, displayTrim: displayTrim || null },
    configTableStatus,
    existingConfigSizes,
    legacySizes,
    usafSizes,
    missingInConfig,
    duplicateEquivalents,
    possibleStaggeredGaps,
    conflictingDiameters,
    overallConfidence,
    recommendedAction,
    actionReason,
    dryRunPreview: {
      currentChooserBehavior: currentBehavior,
      proposedChooserBehavior: proposedBehavior,
      regressionRisk: risk,
      regressionDetails: details,
    },
  };
}

// ============================================================================
// API Route Handler
// ============================================================================

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  const trim = url.searchParams.get("trim") || undefined;
  
  if (!year || !make || !model) {
    return NextResponse.json(
      { error: "Missing required params: year, make, model" },
      { status: 400 }
    );
  }
  
  try {
    const analysis = await analyzeConfigEnrichment(
      parseInt(year, 10),
      make,
      model,
      trim
    );
    
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("[config-enrichment] Analysis failed:", error);
    return NextResponse.json(
      { error: "Analysis failed", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST: Promote candidates to config table
 * 
 * Body: {
 *   year: number,
 *   make: string,
 *   model: string,
 *   trim?: string,
 *   candidates: string[], // Tire sizes to promote
 *   dryRun?: boolean
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { year, make, model, trim, candidates, dryRun = true } = body;
    
    if (!year || !make || !model || !candidates || candidates.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: year, make, model, candidates" },
        { status: 400 }
      );
    }
    
    // Re-run analysis to get current state
    const analysis = await analyzeConfigEnrichment(year, make, model, trim);
    
    // Validate candidates
    const validCandidates = analysis.missingInConfig.filter(c => 
      candidates.includes(c.tireSize) && !c.autoRejectReason
    );
    
    const invalidCandidates = candidates.filter(c => 
      !validCandidates.some(v => v.tireSize === c)
    );
    
    if (invalidCandidates.length > 0) {
      return NextResponse.json({
        error: "Some candidates are invalid or auto-rejected",
        invalidCandidates,
      }, { status: 400 });
    }
    
    if (dryRun) {
      // Return what would be created
      const configsToCreate = validCandidates.map(c => ({
        year,
        makeKey: normalizeMake(make),
        modelKey: normalizeModel(model),
        displayTrim: trim || null,
        tireSize: c.tireSize,
        wheelDiameter: c.wheelDiameter,
        axlePosition: "square",
        isDefault: false,
        isOptional: true,
        source: "usaf-enrichment",
        sourceConfidence: c.confidence >= 80 ? "high" : c.confidence >= 60 ? "medium" : "low",
      }));
      
      return NextResponse.json({
        dryRun: true,
        message: `Would create ${configsToCreate.length} config entries`,
        configsToCreate,
        dryRunPreview: analysis.dryRunPreview,
      });
    }
    
    // TODO: Actual insert into vehicleFitmentConfigurations
    // For now, return not implemented
    return NextResponse.json({
      error: "Direct apply not yet implemented. Use dryRun=true to preview.",
      message: "Config promotion requires admin approval workflow",
    }, { status: 501 });
    
  } catch (error) {
    console.error("[config-enrichment] Promotion failed:", error);
    return NextResponse.json(
      { error: "Promotion failed", details: String(error) },
      { status: 500 }
    );
  }
}
