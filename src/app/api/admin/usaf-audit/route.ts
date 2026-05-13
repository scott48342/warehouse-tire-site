/**
 * USAF Audit Admin API
 * 
 * GET /api/admin/usaf-audit?file=latest
 * GET /api/admin/usaf-audit?file=2026-05-13T13-48-40.json
 * GET /api/admin/usaf-audit/files - List available audit files
 * POST /api/admin/usaf-audit/review - Save review decisions
 */

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  normalizeTireSize,
  findEquivalentSizes,
  detectStaggeredPairs,
  calculateMismatchConfidence,
} from "@/lib/usaf-fitment/normalize";

export const dynamic = "force-dynamic";

const AUDIT_DIR = path.join(process.cwd(), "scripts/usaf-audit-results");

interface AuditVehicle {
  year: number;
  make: string;
  model: string;
  wtd: { sizes: string[]; trims: string[] };
  usaf: { sizes: string[] };
  comparison: {
    match: boolean;
    wtdOnly: string[];
    usafOnly: string[];
    common: string[];
  };
  error?: string;
}

interface AuditResult {
  timestamp: string;
  filters: Record<string, string>;
  summary: {
    total: number;
    matched: number;
    partial: number;
    wtdOnly: number;
    usafOnly: number;
    errors: number;
  };
  vehicles: AuditVehicle[];
}

interface EnrichedVehicle extends AuditVehicle {
  // Enriched fields
  normalizedComparison: ReturnType<typeof findEquivalentSizes>;
  staggeredPairs: ReturnType<typeof detectStaggeredPairs>;
  mismatchAnalysis: ReturnType<typeof calculateMismatchConfidence>;
  category: "exact" | "partial" | "wtd_only" | "usaf_only" | "notation_diff" | "staggered_issue" | "error";
  recommendedAction: "approve" | "ignore" | "manual_review";
}

function getAuditFiles(): string[] {
  if (!fs.existsSync(AUDIT_DIR)) return [];
  return fs.readdirSync(AUDIT_DIR)
    .filter(f => f.endsWith(".json"))
    .sort((a, b) => b.localeCompare(a)); // Most recent first
}

function loadAuditFile(filename: string): AuditResult | null {
  const filePath = path.join(AUDIT_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as AuditResult;
  } catch {
    return null;
  }
}

function enrichVehicle(v: AuditVehicle): EnrichedVehicle {
  if (v.error) {
    return {
      ...v,
      normalizedComparison: { common: [], wtdOnly: v.wtd.sizes, usafOnly: v.usaf.sizes },
      staggeredPairs: [],
      mismatchAnalysis: { confidence: 0, reason: v.error, category: "partial" },
      category: "error",
      recommendedAction: "manual_review",
    };
  }
  
  const normalizedComparison = findEquivalentSizes(v.wtd.sizes, v.usaf.sizes);
  const staggeredPairs = detectStaggeredPairs(v.usaf.sizes);
  const mismatchAnalysis = calculateMismatchConfidence(v.wtd.sizes, v.usaf.sizes);
  
  // Determine category
  let category: EnrichedVehicle["category"] = mismatchAnalysis.category;
  if (v.error) category = "error";
  
  // Determine recommended action
  let recommendedAction: EnrichedVehicle["recommendedAction"] = "manual_review";
  
  if (category === "exact") {
    recommendedAction = "ignore";
  } else if (category === "notation_diff") {
    recommendedAction = "ignore"; // Just notation differences
  } else if (category === "usaf_only" && mismatchAnalysis.confidence >= 0.8) {
    recommendedAction = "approve"; // High confidence enrichment candidate
  } else if (category === "partial" && normalizedComparison.usafOnly.length > 0 && mismatchAnalysis.confidence >= 0.7) {
    recommendedAction = "approve"; // Partial match with good confidence
  } else if (category === "staggered_issue") {
    recommendedAction = "manual_review"; // Staggered needs human review
  } else if (category === "wtd_only") {
    recommendedAction = "ignore"; // USAF doesn't have data
  }
  
  return {
    ...v,
    normalizedComparison,
    staggeredPairs,
    mismatchAnalysis,
    category,
    recommendedAction,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "load";
  const file = url.searchParams.get("file") || "latest";
  
  if (action === "files") {
    const files = getAuditFiles();
    return NextResponse.json({ files });
  }
  
  // Load audit file
  const files = getAuditFiles();
  if (files.length === 0) {
    return NextResponse.json({ error: "No audit files found" }, { status: 404 });
  }
  
  const filename = file === "latest" ? files[0] : file;
  const audit = loadAuditFile(filename);
  
  if (!audit) {
    return NextResponse.json({ error: `Audit file not found: ${filename}` }, { status: 404 });
  }
  
  // Enrich vehicles with analysis
  const enrichedVehicles = audit.vehicles.map(enrichVehicle);
  
  // Group by category
  const grouped = {
    exact: enrichedVehicles.filter(v => v.category === "exact"),
    partial: enrichedVehicles.filter(v => v.category === "partial"),
    wtdOnly: enrichedVehicles.filter(v => v.category === "wtd_only"),
    usafOnly: enrichedVehicles.filter(v => v.category === "usaf_only"),
    notationDiff: enrichedVehicles.filter(v => v.category === "notation_diff"),
    staggeredIssue: enrichedVehicles.filter(v => v.category === "staggered_issue"),
    error: enrichedVehicles.filter(v => v.category === "error"),
  };
  
  // Calculate enriched summary
  const enrichedSummary = {
    ...audit.summary,
    categories: {
      exact: grouped.exact.length,
      partial: grouped.partial.length,
      wtdOnly: grouped.wtdOnly.length,
      usafOnly: grouped.usafOnly.length,
      notationDiff: grouped.notationDiff.length,
      staggeredIssue: grouped.staggeredIssue.length,
      error: grouped.error.length,
    },
    recommendations: {
      approve: enrichedVehicles.filter(v => v.recommendedAction === "approve").length,
      ignore: enrichedVehicles.filter(v => v.recommendedAction === "ignore").length,
      manualReview: enrichedVehicles.filter(v => v.recommendedAction === "manual_review").length,
    },
  };
  
  // Get top enrichment candidates
  const enrichmentCandidates = enrichedVehicles
    .filter(v => v.recommendedAction === "approve" && v.normalizedComparison.usafOnly.length > 0)
    .sort((a, b) => b.mismatchAnalysis.confidence - a.mismatchAnalysis.confidence)
    .slice(0, 50);
  
  // Get likely bad WTD records (WTD has sizes USAF doesn't)
  const likelyBadRecords = enrichedVehicles
    .filter(v => v.normalizedComparison.wtdOnly.length > 0 && v.usaf.sizes.length > 0)
    .sort((a, b) => b.normalizedComparison.wtdOnly.length - a.normalizedComparison.wtdOnly.length)
    .slice(0, 50);
  
  // Get staggered issues
  const staggeredIssues = enrichedVehicles
    .filter(v => v.staggeredPairs.length > 0 || v.category === "staggered_issue")
    .slice(0, 50);
  
  return NextResponse.json({
    filename,
    timestamp: audit.timestamp,
    filters: audit.filters,
    summary: enrichedSummary,
    grouped,
    highlights: {
      enrichmentCandidates,
      likelyBadRecords,
      staggeredIssues,
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, decisions } = body;
    
    if (action === "export") {
      // Export approved fixes as JSON
      const approved = decisions?.filter((d: any) => d.action === "approve") || [];
      
      const exportData = {
        timestamp: new Date().toISOString(),
        type: "usaf_enrichment_candidates",
        count: approved.length,
        fixes: approved.map((d: any) => ({
          year: d.year,
          make: d.make,
          model: d.model,
          addSizes: d.usafOnly || [],
          confidence: d.confidence,
          source: "usaf_audit",
        })),
      };
      
      // Save to file
      const filename = `enrichment-export-${Date.now()}.json`;
      const filePath = path.join(AUDIT_DIR, filename);
      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
      
      return NextResponse.json({
        success: true,
        filename,
        count: approved.length,
      });
    }
    
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
