/**
 * Competitor Page Analysis Service
 * 
 * Internal tool for comparing our SRP/PDP pages against competitors.
 * Stores URLs, scores, and insights for optimization.
 * 
 * @created 2026-04-06
 */

import { db } from "@/lib/fitment-db/db";
import { 
  competitorPageAnalysis, 
  type CompetitorPageAnalysis, 
  type NewCompetitorPageAnalysis 
} from "@/lib/fitment-db/schema";
import { eq, and, desc, sql, count, or, asc } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export type PageType = "srp" | "pdp";
export type AnalysisStatus = "active" | "archived";

export interface VehicleContext {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
}

export interface ProductContext {
  sku?: string;
  brand?: string;
  productName?: string;
}

// SRP scoring categories
export interface SrpScores {
  imageQuality: number | null;
  pricingClarity: number | null;
  trustSignal: number | null;
  filterUsability: number | null;
  merchandising: number | null;
}

// PDP scoring categories
export interface PdpScores {
  aboveFoldClarity: number | null;
  imageExperience: number | null;
  productInfo: number | null;
  trustLayer: number | null;
  conversionDriver: number | null;
  ctaStrength: number | null;
}

export interface CompetitorAnalysisInput {
  pageType: PageType;
  ourUrl: string;
  competitorName: string;
  competitorUrl: string;
  vehicleContext?: VehicleContext;
  productContext?: ProductContext;
  // Competitor scores
  competitorScores?: SrpScores | PdpScores;
  // Our scores
  ourScores?: SrpScores | PdpScores;
  // Notes
  notes?: string;
  strengths?: string;
  weaknesses?: string;
  opportunities?: string;
}

export interface ScoreComparison {
  category: string;
  ourScore: number | null;
  competitorScore: number | null;
  difference: number;
  winner: "us" | "them" | "tie";
}

export interface AnalysisInsights {
  overallOurAvg: number;
  overallCompetitorAvg: number;
  overallDifference: number;
  overallWinner: "us" | "them" | "tie";
  comparisons: ScoreComparison[];
  gaps: ScoreComparison[]; // Where competitor > us
  advantages: ScoreComparison[]; // Where us > competitor
  opportunities: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate average of non-null scores
 */
function calculateAverage(scores: (number | null)[]): number {
  const validScores = scores.filter((s): s is number => s !== null && s !== undefined);
  if (validScores.length === 0) return 0;
  return Math.round((validScores.reduce((sum, s) => sum + s, 0) / validScores.length) * 10) / 10;
}

/**
 * Fetch page title safely (light automation)
 */
export async function fetchPageMeta(url: string): Promise<{ title?: string; description?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "WTD-Competitor-Analysis/1.0",
        "Accept": "text/html",
      },
    });
    
    clearTimeout(timeout);
    
    if (!res.ok) return {};
    
    const html = await res.text();
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim();
    
    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    const description = descMatch?.[1]?.trim();
    
    return { title, description };
  } catch (err) {
    console.warn(`[CompetitorAnalysis] Failed to fetch meta for ${url}:`, err);
    return {};
  }
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new competitor analysis
 */
export async function createAnalysis(input: CompetitorAnalysisInput): Promise<CompetitorPageAnalysis> {
  const values: NewCompetitorPageAnalysis = {
    pageType: input.pageType,
    ourUrl: input.ourUrl,
    competitorName: input.competitorName,
    competitorUrl: input.competitorUrl,
    vehicleContext: input.vehicleContext,
    productContext: input.productContext,
    notes: input.notes,
    strengths: input.strengths,
    weaknesses: input.weaknesses,
    opportunities: input.opportunities,
  };

  // Set scores based on page type
  if (input.pageType === "srp" && input.competitorScores) {
    const scores = input.competitorScores as SrpScores;
    values.srpImageQualityScore = scores.imageQuality;
    values.srpPricingClarityScore = scores.pricingClarity;
    values.srpTrustSignalScore = scores.trustSignal;
    values.srpFilterUsabilityScore = scores.filterUsability;
    values.srpMerchandisingScore = scores.merchandising;
  }

  if (input.pageType === "srp" && input.ourScores) {
    const scores = input.ourScores as SrpScores;
    values.ourSrpImageQualityScore = scores.imageQuality;
    values.ourSrpPricingClarityScore = scores.pricingClarity;
    values.ourSrpTrustSignalScore = scores.trustSignal;
    values.ourSrpFilterUsabilityScore = scores.filterUsability;
    values.ourSrpMerchandisingScore = scores.merchandising;
  }

  if (input.pageType === "pdp" && input.competitorScores) {
    const scores = input.competitorScores as PdpScores;
    values.pdpAboveFoldClarityScore = scores.aboveFoldClarity;
    values.pdpImageExperienceScore = scores.imageExperience;
    values.pdpProductInfoScore = scores.productInfo;
    values.pdpTrustLayerScore = scores.trustLayer;
    values.pdpConversionDriverScore = scores.conversionDriver;
    values.pdpCtaStrengthScore = scores.ctaStrength;
  }

  if (input.pageType === "pdp" && input.ourScores) {
    const scores = input.ourScores as PdpScores;
    values.ourPdpAboveFoldClarityScore = scores.aboveFoldClarity;
    values.ourPdpImageExperienceScore = scores.imageExperience;
    values.ourPdpProductInfoScore = scores.productInfo;
    values.ourPdpTrustLayerScore = scores.trustLayer;
    values.ourPdpConversionDriverScore = scores.conversionDriver;
    values.ourPdpCtaStrengthScore = scores.ctaStrength;
  }

  const [created] = await db
    .insert(competitorPageAnalysis)
    .values(values)
    .returning();

  return created;
}

/**
 * Update an existing analysis
 */
export async function updateAnalysis(
  id: string, 
  input: Partial<CompetitorAnalysisInput>
): Promise<CompetitorPageAnalysis | null> {
  const updates: Partial<NewCompetitorPageAnalysis> = {
    updatedAt: new Date(),
  };

  if (input.ourUrl !== undefined) updates.ourUrl = input.ourUrl;
  if (input.competitorName !== undefined) updates.competitorName = input.competitorName;
  if (input.competitorUrl !== undefined) updates.competitorUrl = input.competitorUrl;
  if (input.vehicleContext !== undefined) updates.vehicleContext = input.vehicleContext;
  if (input.productContext !== undefined) updates.productContext = input.productContext;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.strengths !== undefined) updates.strengths = input.strengths;
  if (input.weaknesses !== undefined) updates.weaknesses = input.weaknesses;
  if (input.opportunities !== undefined) updates.opportunities = input.opportunities;

  // Update competitor scores
  if (input.competitorScores) {
    if (input.pageType === "srp") {
      const scores = input.competitorScores as SrpScores;
      updates.srpImageQualityScore = scores.imageQuality;
      updates.srpPricingClarityScore = scores.pricingClarity;
      updates.srpTrustSignalScore = scores.trustSignal;
      updates.srpFilterUsabilityScore = scores.filterUsability;
      updates.srpMerchandisingScore = scores.merchandising;
    } else {
      const scores = input.competitorScores as PdpScores;
      updates.pdpAboveFoldClarityScore = scores.aboveFoldClarity;
      updates.pdpImageExperienceScore = scores.imageExperience;
      updates.pdpProductInfoScore = scores.productInfo;
      updates.pdpTrustLayerScore = scores.trustLayer;
      updates.pdpConversionDriverScore = scores.conversionDriver;
      updates.pdpCtaStrengthScore = scores.ctaStrength;
    }
  }

  // Update our scores
  if (input.ourScores) {
    if (input.pageType === "srp") {
      const scores = input.ourScores as SrpScores;
      updates.ourSrpImageQualityScore = scores.imageQuality;
      updates.ourSrpPricingClarityScore = scores.pricingClarity;
      updates.ourSrpTrustSignalScore = scores.trustSignal;
      updates.ourSrpFilterUsabilityScore = scores.filterUsability;
      updates.ourSrpMerchandisingScore = scores.merchandising;
    } else {
      const scores = input.ourScores as PdpScores;
      updates.ourPdpAboveFoldClarityScore = scores.aboveFoldClarity;
      updates.ourPdpImageExperienceScore = scores.imageExperience;
      updates.ourPdpProductInfoScore = scores.productInfo;
      updates.ourPdpTrustLayerScore = scores.trustLayer;
      updates.ourPdpConversionDriverScore = scores.conversionDriver;
      updates.ourPdpCtaStrengthScore = scores.ctaStrength;
    }
  }

  const [updated] = await db
    .update(competitorPageAnalysis)
    .set(updates)
    .where(eq(competitorPageAnalysis.id, id))
    .returning();

  return updated || null;
}

/**
 * Get analysis by ID
 */
export async function getAnalysis(id: string): Promise<CompetitorPageAnalysis | null> {
  const [analysis] = await db
    .select()
    .from(competitorPageAnalysis)
    .where(eq(competitorPageAnalysis.id, id))
    .limit(1);
  
  return analysis || null;
}

/**
 * List analyses with filters
 */
export async function listAnalyses(options?: {
  pageType?: PageType;
  competitorName?: string;
  status?: AnalysisStatus;
  limit?: number;
  offset?: number;
  orderBy?: "created" | "updated";
}): Promise<{ analyses: CompetitorPageAnalysis[]; total: number }> {
  const { pageType, competitorName, status = "active", limit = 50, offset = 0, orderBy = "updated" } = options || {};

  const conditions: any[] = [];
  
  if (status) {
    conditions.push(eq(competitorPageAnalysis.status, status));
  }
  
  if (pageType) {
    conditions.push(eq(competitorPageAnalysis.pageType, pageType));
  }
  
  if (competitorName) {
    conditions.push(eq(competitorPageAnalysis.competitorName, competitorName));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(competitorPageAnalysis)
    .where(where);
  
  const total = Number(countResult?.count || 0);

  // Get analyses
  const orderColumn = orderBy === "created" 
    ? competitorPageAnalysis.createdAt 
    : competitorPageAnalysis.updatedAt;

  const analyses = await db
    .select()
    .from(competitorPageAnalysis)
    .where(where)
    .orderBy(desc(orderColumn))
    .limit(limit)
    .offset(offset);

  return { analyses, total };
}

/**
 * Archive an analysis
 */
export async function archiveAnalysis(id: string): Promise<CompetitorPageAnalysis | null> {
  const [updated] = await db
    .update(competitorPageAnalysis)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(competitorPageAnalysis.id, id))
    .returning();
  
  return updated || null;
}

/**
 * Delete an analysis permanently
 */
export async function deleteAnalysis(id: string): Promise<boolean> {
  const result = await db
    .delete(competitorPageAnalysis)
    .where(eq(competitorPageAnalysis.id, id));
  
  return (result as any).rowCount > 0;
}

// ============================================================================
// Insight Generation
// ============================================================================

/**
 * Generate insights from an analysis
 */
export function generateInsights(analysis: CompetitorPageAnalysis): AnalysisInsights {
  const comparisons: ScoreComparison[] = [];
  
  if (analysis.pageType === "srp") {
    // SRP comparisons
    const categories = [
      { name: "Image Quality", our: analysis.ourSrpImageQualityScore, comp: analysis.srpImageQualityScore },
      { name: "Pricing Clarity", our: analysis.ourSrpPricingClarityScore, comp: analysis.srpPricingClarityScore },
      { name: "Trust Signals", our: analysis.ourSrpTrustSignalScore, comp: analysis.srpTrustSignalScore },
      { name: "Filter Usability", our: analysis.ourSrpFilterUsabilityScore, comp: analysis.srpFilterUsabilityScore },
      { name: "Merchandising", our: analysis.ourSrpMerchandisingScore, comp: analysis.srpMerchandisingScore },
    ];
    
    for (const cat of categories) {
      const diff = (cat.our ?? 0) - (cat.comp ?? 0);
      comparisons.push({
        category: cat.name,
        ourScore: cat.our,
        competitorScore: cat.comp,
        difference: diff,
        winner: diff > 0 ? "us" : diff < 0 ? "them" : "tie",
      });
    }
  } else {
    // PDP comparisons
    const categories = [
      { name: "Above-Fold Clarity", our: analysis.ourPdpAboveFoldClarityScore, comp: analysis.pdpAboveFoldClarityScore },
      { name: "Image Experience", our: analysis.ourPdpImageExperienceScore, comp: analysis.pdpImageExperienceScore },
      { name: "Product Info", our: analysis.ourPdpProductInfoScore, comp: analysis.pdpProductInfoScore },
      { name: "Trust Layer", our: analysis.ourPdpTrustLayerScore, comp: analysis.pdpTrustLayerScore },
      { name: "Conversion Drivers", our: analysis.ourPdpConversionDriverScore, comp: analysis.pdpConversionDriverScore },
      { name: "CTA Strength", our: analysis.ourPdpCtaStrengthScore, comp: analysis.pdpCtaStrengthScore },
    ];
    
    for (const cat of categories) {
      const diff = (cat.our ?? 0) - (cat.comp ?? 0);
      comparisons.push({
        category: cat.name,
        ourScore: cat.our,
        competitorScore: cat.comp,
        difference: diff,
        winner: diff > 0 ? "us" : diff < 0 ? "them" : "tie",
      });
    }
  }

  // Calculate averages
  const ourScores = comparisons.map(c => c.ourScore).filter((s): s is number => s !== null);
  const compScores = comparisons.map(c => c.competitorScore).filter((s): s is number => s !== null);
  
  const overallOurAvg = calculateAverage(ourScores);
  const overallCompetitorAvg = calculateAverage(compScores);
  const overallDifference = Math.round((overallOurAvg - overallCompetitorAvg) * 10) / 10;

  // Identify gaps and advantages
  const gaps = comparisons.filter(c => c.winner === "them" && c.difference <= -2);
  const advantages = comparisons.filter(c => c.winner === "us" && c.difference >= 2);

  // Generate opportunity flags
  const opportunities: string[] = [];
  
  for (const gap of gaps) {
    opportunities.push(`Competitor advantage in ${gap.category} (${Math.abs(gap.difference)} points)`);
  }
  
  if (overallDifference < -3) {
    opportunities.push(`Overall competitive gap of ${Math.abs(overallDifference).toFixed(1)} points`);
  }

  // High-impact categories where we're behind
  const highImpactCategories = ["Pricing Clarity", "Trust Signals", "CTA Strength", "Conversion Drivers"];
  for (const comp of comparisons) {
    if (highImpactCategories.includes(comp.category) && comp.winner === "them") {
      opportunities.push(`High-impact gap: ${comp.category}`);
    }
  }

  return {
    overallOurAvg,
    overallCompetitorAvg,
    overallDifference,
    overallWinner: overallDifference > 0 ? "us" : overallDifference < 0 ? "them" : "tie",
    comparisons,
    gaps,
    advantages,
    opportunities: [...new Set(opportunities)], // dedupe
  };
}

/**
 * Get summary stats across all analyses
 */
export async function getSummaryStats(): Promise<{
  totalAnalyses: number;
  srpCount: number;
  pdpCount: number;
  competitorCounts: { name: string; count: number }[];
  avgOurScore: number;
  avgCompetitorScore: number;
}> {
  const [stats] = await db
    .select({
      totalAnalyses: count(),
      srpCount: sql<number>`SUM(CASE WHEN ${competitorPageAnalysis.pageType} = 'srp' THEN 1 ELSE 0 END)::int`,
      pdpCount: sql<number>`SUM(CASE WHEN ${competitorPageAnalysis.pageType} = 'pdp' THEN 1 ELSE 0 END)::int`,
    })
    .from(competitorPageAnalysis)
    .where(eq(competitorPageAnalysis.status, "active"));

  const competitorCounts = await db
    .select({
      name: competitorPageAnalysis.competitorName,
      count: count(),
    })
    .from(competitorPageAnalysis)
    .where(eq(competitorPageAnalysis.status, "active"))
    .groupBy(competitorPageAnalysis.competitorName)
    .orderBy(desc(count()));

  return {
    totalAnalyses: Number(stats?.totalAnalyses || 0),
    srpCount: Number(stats?.srpCount || 0),
    pdpCount: Number(stats?.pdpCount || 0),
    competitorCounts: competitorCounts.map(c => ({ name: c.name, count: Number(c.count) })),
    avgOurScore: 0, // Would need to calculate across all analyses
    avgCompetitorScore: 0,
  };
}

/**
 * Get unique competitor names
 */
export async function getCompetitorNames(): Promise<string[]> {
  const results = await db
    .selectDistinct({ name: competitorPageAnalysis.competitorName })
    .from(competitorPageAnalysis)
    .where(eq(competitorPageAnalysis.status, "active"))
    .orderBy(asc(competitorPageAnalysis.competitorName));
  
  return results.map(r => r.name);
}

// ============================================================================
// Export
// ============================================================================

export const competitorAnalysisService = {
  createAnalysis,
  updateAnalysis,
  getAnalysis,
  listAnalyses,
  archiveAnalysis,
  deleteAnalysis,
  generateInsights,
  getSummaryStats,
  getCompetitorNames,
  fetchPageMeta,
};

export default competitorAnalysisService;
