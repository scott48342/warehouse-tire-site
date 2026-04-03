/**
 * Admin API: Single Email Campaign
 * 
 * GET    /api/admin/email-campaigns/[id] - Get campaign details
 * PATCH  /api/admin/email-campaigns/[id] - Update campaign
 * DELETE /api/admin/email-campaigns/[id] - Delete campaign
 * 
 * @created 2026-04-03
 */

import { NextRequest, NextResponse } from "next/server";
import { campaignService } from "@/lib/email/campaigns";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/email-campaigns/[id]
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const campaign = await campaignService.getCampaign(id);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (err: any) {
    console.error("[admin/email-campaigns/[id]] GET error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to get campaign" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/email-campaigns/[id]
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();

    const campaign = await campaignService.updateCampaign(id, body);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (err: any) {
    console.error("[admin/email-campaigns/[id]] PATCH error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update campaign" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/email-campaigns/[id]
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const deleted = await campaignService.deleteCampaign(id);

    if (!deleted) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[admin/email-campaigns/[id]] DELETE error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
