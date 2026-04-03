/**
 * POST /api/admin/email-campaigns/[id]/schedule
 * Schedule a campaign for future send
 * 
 * @created 2026-04-03
 */

import { NextRequest, NextResponse } from "next/server";
import { campaignService } from "@/lib/email/campaigns";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { scheduledFor } = body;

    if (!scheduledFor) {
      return NextResponse.json(
        { error: "scheduledFor is required (ISO 8601 date string)" },
        { status: 400 }
      );
    }

    const date = new Date(scheduledFor);
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use ISO 8601 format." },
        { status: 400 }
      );
    }

    const campaign = await campaignService.scheduleCampaign(id, date);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (err: any) {
    console.error("[admin/email-campaigns/[id]/schedule] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to schedule campaign" },
      { status: 500 }
    );
  }
}
