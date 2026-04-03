/**
 * POST /api/admin/email-campaigns/[id]/pause
 * Pause a sending campaign
 * 
 * @created 2026-04-03
 */

import { NextRequest, NextResponse } from "next/server";
import { campaignService } from "@/lib/email/campaigns";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const campaign = await campaignService.pauseCampaign(id);

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found or not in sending state" },
        { status: 404 }
      );
    }

    return NextResponse.json({ campaign });
  } catch (err: any) {
    console.error("[admin/email-campaigns/[id]/pause] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to pause campaign" },
      { status: 500 }
    );
  }
}
