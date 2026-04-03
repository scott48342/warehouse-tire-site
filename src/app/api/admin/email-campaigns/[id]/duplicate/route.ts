/**
 * POST /api/admin/email-campaigns/[id]/duplicate
 * Duplicate a campaign
 * 
 * @created 2026-04-03
 */

import { NextRequest, NextResponse } from "next/server";
import { campaignService } from "@/lib/email/campaigns";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const campaign = await campaignService.duplicateCampaign(id);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (err: any) {
    console.error("[admin/email-campaigns/[id]/duplicate] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to duplicate campaign" },
      { status: 500 }
    );
  }
}
