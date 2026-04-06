/**
 * Competitor Analysis Admin API
 * 
 * GET /api/admin/competitor-analysis
 * List analyses, get stats, get competitors
 * 
 * POST /api/admin/competitor-analysis
 * Create new analysis
 * 
 * PATCH /api/admin/competitor-analysis
 * Update existing analysis
 * 
 * DELETE /api/admin/competitor-analysis
 * Archive or delete analysis
 * 
 * @created 2026-04-06
 */

import { NextRequest, NextResponse } from "next/server";
import {
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
  type PageType,
  type CompetitorAnalysisInput,
} from "@/lib/competitorAnalysisService";

export const runtime = "nodejs";

/**
 * GET /api/admin/competitor-analysis
 * 
 * Query params:
 * - action: 'list' | 'get' | 'stats' | 'competitors' | 'insights' | 'fetch-meta'
 * - id: analysis ID (for 'get' and 'insights')
 * - pageType: filter by 'srp' or 'pdp'
 * - competitor: filter by competitor name
 * - limit/offset: pagination
 * - url: URL to fetch meta for (for 'fetch-meta')
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "list";
    const id = searchParams.get("id");
    const pageType = searchParams.get("pageType") as PageType | null;
    const competitor = searchParams.get("competitor") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const url = searchParams.get("url");

    switch (action) {
      case "get": {
        if (!id) {
          return NextResponse.json({ error: "id is required" }, { status: 400 });
        }
        const analysis = await getAnalysis(id);
        if (!analysis) {
          return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
        }
        return NextResponse.json(analysis);
      }

      case "insights": {
        if (!id) {
          return NextResponse.json({ error: "id is required" }, { status: 400 });
        }
        const analysis = await getAnalysis(id);
        if (!analysis) {
          return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
        }
        const insights = generateInsights(analysis);
        return NextResponse.json({ analysis, insights });
      }

      case "stats": {
        const stats = await getSummaryStats();
        return NextResponse.json(stats);
      }

      case "competitors": {
        const names = await getCompetitorNames();
        return NextResponse.json({ competitors: names });
      }

      case "fetch-meta": {
        if (!url) {
          return NextResponse.json({ error: "url is required" }, { status: 400 });
        }
        const meta = await fetchPageMeta(url);
        return NextResponse.json(meta);
      }

      case "list":
      default: {
        const result = await listAnalyses({
          pageType: pageType || undefined,
          competitorName: competitor,
          limit,
          offset,
        });
        return NextResponse.json(result);
      }
    }
  } catch (err: any) {
    console.error("[admin/competitor-analysis] GET Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to get competitor analysis" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/competitor-analysis
 * 
 * Create a new analysis
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.pageType || !["srp", "pdp"].includes(body.pageType)) {
      return NextResponse.json(
        { error: "pageType must be 'srp' or 'pdp'" },
        { status: 400 }
      );
    }

    if (!body.ourUrl || !body.competitorName || !body.competitorUrl) {
      return NextResponse.json(
        { error: "ourUrl, competitorName, and competitorUrl are required" },
        { status: 400 }
      );
    }

    const input: CompetitorAnalysisInput = {
      pageType: body.pageType,
      ourUrl: body.ourUrl,
      competitorName: body.competitorName,
      competitorUrl: body.competitorUrl,
      vehicleContext: body.vehicleContext,
      productContext: body.productContext,
      competitorScores: body.competitorScores,
      ourScores: body.ourScores,
      notes: body.notes,
      strengths: body.strengths,
      weaknesses: body.weaknesses,
      opportunities: body.opportunities,
    };

    const analysis = await createAnalysis(input);

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (err: any) {
    console.error("[admin/competitor-analysis] POST Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create analysis" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/competitor-analysis
 * 
 * Update an existing analysis
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    // Fetch existing to get pageType if not provided
    const existing = await getAnalysis(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 }
      );
    }

    const input: Partial<CompetitorAnalysisInput> = {
      pageType: updates.pageType || existing.pageType as PageType,
      ...updates,
    };

    const analysis = await updateAnalysis(id, input);

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (err: any) {
    console.error("[admin/competitor-analysis] PATCH Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to update analysis" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/competitor-analysis
 * 
 * Archive or permanently delete an analysis
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const permanent = searchParams.get("permanent") === "true";

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    if (permanent) {
      const deleted = await deleteAnalysis(id);
      return NextResponse.json({ success: deleted });
    } else {
      const archived = await archiveAnalysis(id);
      return NextResponse.json({ success: !!archived, analysis: archived });
    }
  } catch (err: any) {
    console.error("[admin/competitor-analysis] DELETE Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to delete analysis" },
      { status: 500 }
    );
  }
}
