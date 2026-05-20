/**
 * Candidate Evaluation API
 * 
 * Evaluates wheel search results against known/inferred fitment profiles.
 * Used by Jake to present wheel options even when diameter isn't in "safe" list.
 * 
 * POST /api/fitment/evaluate-candidates
 * 
 * @created 2026-05-20
 */

import { NextRequest, NextResponse } from "next/server";
import {
  evaluateWheelCandidates,
  shouldAttemptSearch,
  buildAnalytics,
  type CandidateEvaluationRequest,
  type CandidateEvaluationAnalytics,
} from "@/lib/fitment/candidateEvaluationService";
import { lookupFallbackFitment } from "@/lib/fitment/fallbackFitmentService";
import { lookupPlatform } from "@/lib/fitment/platformKnowledgeService";

export const runtime = "nodejs";

interface EvaluateCandidatesRequest {
  // Vehicle
  year: number;
  make: string;
  model: string;
  trim?: string;
  
  // Requested specs
  requestedDiameter: number;
  
  // Optional: pre-fetched wheel results
  wheelResults?: Array<{
    sku: string;
    brand?: string;
    model?: string;
    diameter: number;
    width: number;
    offset: number;
    boltPattern: string;
    centerBore?: number;
    inStock?: boolean;
    price?: number;
  }>;
  
  // Optional: pre-fetched profile (if already looked up)
  knownProfile?: CandidateEvaluationRequest["knownProfile"];
  platformKnowledge?: CandidateEvaluationRequest["platformKnowledge"];
  
  // Options
  autoSearchIfEmpty?: boolean;  // If wheelResults empty, search automatically
  includeAnalytics?: boolean;
}

interface EvaluateCandidatesResponse {
  success: boolean;
  
  // Pre-search check
  shouldSearch: boolean;
  searchReason: string;
  diameterCategory: string;
  
  // Evaluation results (if wheelResults provided)
  evaluation?: ReturnType<typeof evaluateWheelCandidates>;
  
  // Analytics
  analytics?: CandidateEvaluationAnalytics;
  
  // Profile used
  profileSource?: string;
  platformUsed?: string;
  
  // Errors
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: EvaluateCandidatesRequest = await request.json();
    
    const { year, make, model, trim, requestedDiameter } = body;
    
    // Validate required fields
    if (!year || !make || !model || !requestedDiameter) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: year, make, model, requestedDiameter",
        },
        { status: 400 }
      );
    }
    
    // Get profile and platform knowledge if not provided
    let knownProfile = body.knownProfile;
    let platformKnowledge = body.platformKnowledge;
    let profileSource = "provided";
    let platformUsed = body.platformKnowledge?.platformName;
    
    if (!knownProfile) {
      // Lookup fallback profile
      const fallbackResult = lookupFallbackFitment({ year, make, model, trim });
      
      if (fallbackResult.success) {
        knownProfile = {
          boltPattern: fallbackResult.boltPattern,
          centerBore: fallbackResult.centerBore,
          offsetRange: fallbackResult.offsetRange,
          safeDiameters: fallbackResult.safeAftermarketDiameters,
          // Map wheel search hints to safe widths
          safeWidths: fallbackResult.wheelSearchHints?.flatMap(h => h.widths),
          platform: fallbackResult.platform,
        };
        profileSource = fallbackResult.source;
      }
    }
    
    if (!platformKnowledge) {
      // Lookup platform knowledge
      const platformResult = lookupPlatform(year, make, model, trim);
      
      if (platformResult.found && platformResult.platform) {
        platformKnowledge = {
          platformId: platformResult.platform.platformId,
          platformName: platformResult.platform.name,
          enthusiastDiameters: platformResult.platform.enthusiastDiameters,
          offsetRange: platformResult.platform.offsetRange,
          staggeredCommon: platformResult.platform.staggeredCommon,
          culturalNotes: platformResult.platform.culturalNotes,
        };
        platformUsed = platformResult.platform.name;
      }
    }
    
    // Check if we should attempt search
    const searchCheck = shouldAttemptSearch(requestedDiameter, knownProfile, platformKnowledge);
    
    // If no wheel results provided, return just the search check
    if (!body.wheelResults || body.wheelResults.length === 0) {
      return NextResponse.json({
        success: true,
        shouldSearch: searchCheck.shouldSearch,
        searchReason: searchCheck.reason,
        diameterCategory: searchCheck.category,
        profileSource,
        platformUsed,
        evaluation: null,
        analytics: null,
      });
    }
    
    // Evaluate candidates
    const evaluationRequest: CandidateEvaluationRequest = {
      year,
      make,
      model,
      trim,
      requestedDiameter,
      knownProfile,
      platformKnowledge,
      wheelResults: body.wheelResults,
    };
    
    const evaluation = evaluateWheelCandidates(evaluationRequest);
    
    // Build analytics if requested
    let analytics: CandidateEvaluationAnalytics | undefined;
    if (body.includeAnalytics) {
      analytics = buildAnalytics(evaluationRequest, evaluation);
    }
    
    // Log for monitoring
    console.log(`[candidate-evaluation] ${year} ${make} ${model} - ${requestedDiameter}" - ${evaluation.evaluationStats.candidatesAccepted}/${evaluation.evaluationStats.totalResults} candidates accepted, confidence: ${evaluation.confidence}`);
    
    return NextResponse.json({
      success: true,
      shouldSearch: searchCheck.shouldSearch,
      searchReason: searchCheck.reason,
      diameterCategory: searchCheck.category,
      evaluation,
      analytics,
      profileSource,
      platformUsed,
    });
    
  } catch (error) {
    console.error("[candidate-evaluation] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: `Evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}

// GET endpoint for quick "should search" check
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const year = parseInt(searchParams.get("year") || "0", 10);
  const make = searchParams.get("make") || "";
  const model = searchParams.get("model") || "";
  const trim = searchParams.get("trim") || undefined;
  const diameter = parseInt(searchParams.get("diameter") || "0", 10);
  
  if (!year || !make || !model || !diameter) {
    return NextResponse.json(
      { error: "Missing required params: year, make, model, diameter" },
      { status: 400 }
    );
  }
  
  // Get profile and platform
  const fallbackResult = lookupFallbackFitment({ year, make, model, trim });
  const platformResult = lookupPlatform(year, make, model, trim);
  
  const knownProfile = fallbackResult.success ? {
    boltPattern: fallbackResult.boltPattern,
    centerBore: fallbackResult.centerBore,
    offsetRange: fallbackResult.offsetRange,
    safeDiameters: fallbackResult.safeAftermarketDiameters,
    safeWidths: fallbackResult.wheelSearchHints?.flatMap(h => h.widths),
    platform: fallbackResult.platform,
  } : undefined;
  
  const platformKnowledge = platformResult.found && platformResult.platform ? {
    platformId: platformResult.platform.platformId,
    platformName: platformResult.platform.name,
    enthusiastDiameters: platformResult.platform.enthusiastDiameters,
    offsetRange: platformResult.platform.offsetRange,
    staggeredCommon: platformResult.platform.staggeredCommon,
    culturalNotes: platformResult.platform.culturalNotes,
  } : undefined;
  
  const searchCheck = shouldAttemptSearch(diameter, knownProfile, platformKnowledge);
  
  return NextResponse.json({
    year,
    make,
    model,
    diameter,
    shouldSearch: searchCheck.shouldSearch,
    reason: searchCheck.reason,
    category: searchCheck.category,
    profileSource: fallbackResult.source,
    platformUsed: platformResult.platform?.name,
  });
}
