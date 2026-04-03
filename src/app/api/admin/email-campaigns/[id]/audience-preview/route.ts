/**
 * GET /api/admin/email-campaigns/[id]/audience-preview
 * Preview audience for a campaign based on its rules
 * 
 * @created 2026-04-03
 */

import { NextRequest, NextResponse } from "next/server";
import { campaignService, audienceResolver, type AudienceRules } from "@/lib/email/campaigns";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const campaign = await campaignService.getCampaign(id);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const preview = await audienceResolver.getAudiencePreview(
      campaign.audienceRulesJson as AudienceRules
    );

    return NextResponse.json({ preview });
  } catch (err: any) {
    console.error("[admin/email-campaigns/[id]/audience-preview] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to preview audience" },
      { status: 500 }
    );
  }
}
