/**
 * POST /api/admin/email-campaigns/[id]/start-now
 * Start a campaign immediately
 * 
 * @created 2026-04-03
 */

import { NextRequest, NextResponse } from "next/server";
import { campaignService } from "@/lib/email/campaigns";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const campaign = await campaignService.startCampaignNow(id);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (err: any) {
    console.error("[admin/email-campaigns/[id]/start-now] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to start campaign" },
      { status: 500 }
    );
  }
}
