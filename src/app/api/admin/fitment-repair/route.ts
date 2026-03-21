import { NextRequest, NextResponse } from "next/server";
import {
  runRepairSweep,
  getQualityBreakdown,
  formatReportAsText,
} from "@/lib/fitment-db/repairService";

/**
 * Admin API for fitment repair operations
 * 
 * GET - Get quality breakdown / status
 * POST - Run repair sweep
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";
    
    console.log("[admin/fitment-repair] GET - fetching quality breakdown");
    
    const breakdown = await getQualityBreakdown();
    
    if (format === "text") {
      const lines = [
        "FITMENT QUALITY BREAKDOWN",
        "═════════════════════════",
        "",
        `Total Records: ${breakdown.total}`,
        `Valid:         ${breakdown.valid} (${((breakdown.valid / breakdown.total) * 100).toFixed(1)}%)`,
        `Partial:       ${breakdown.partial} (${((breakdown.partial / breakdown.total) * 100).toFixed(1)}%)`,
        `Invalid:       ${breakdown.invalid} (${((breakdown.invalid / breakdown.total) * 100).toFixed(1)}%)`,
        "",
        "Samples:",
        ...breakdown.samples.map(s => `  [${s.quality}] ${s.vehicle}`),
      ];
      
      return new NextResponse(lines.join("\n"), {
        headers: { "Content-Type": "text/plain" },
      });
    }
    
    return NextResponse.json(breakdown);
  } catch (err: any) {
    console.error("[admin/fitment-repair] GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    
    const {
      limit = 50,
      dryRun = false,
      yearMin,
      yearMax,
      make,
      delayMs = 500,
      format = "json",
    } = body;
    
    console.log("[admin/fitment-repair] POST - starting repair sweep", {
      limit,
      dryRun,
      yearMin,
      yearMax,
      make,
    });
    
    const report = await runRepairSweep({
      limit,
      dryRun,
      yearMin,
      yearMax,
      make,
      delayMs,
    });
    
    if (format === "text") {
      const text = formatReportAsText(report);
      return new NextResponse(text, {
        headers: { "Content-Type": "text/plain" },
      });
    }
    
    return NextResponse.json(report);
  } catch (err: any) {
    console.error("[admin/fitment-repair] POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
