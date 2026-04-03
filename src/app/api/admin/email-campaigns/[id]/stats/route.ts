/**
 * GET /api/admin/email-campaigns/[id]/stats
 * Get campaign statistics
 * 
 * @created 2026-04-03
 */

import { NextRequest, NextResponse } from "next/server";
import { campaignService } from "@/lib/email/campaigns";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const stats = await campaignService.getCampaignStats(id);

    if (!stats) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ stats });
  } catch (err: any) {
    console.error("[admin/email-campaigns/[id]/stats] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to get campaign stats" },
      { status: 500 }
    );
  }
}
