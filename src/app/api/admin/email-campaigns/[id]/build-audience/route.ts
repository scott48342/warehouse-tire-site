/**
 * POST /api/admin/email-campaigns/[id]/build-audience
 * Build audience snapshot for a campaign
 * 
 * @created 2026-04-03
 */

import { NextRequest, NextResponse } from "next/server";
import { campaignService, audienceResolver, type AudienceRules } from "@/lib/email/campaigns";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const campaign = await campaignService.getCampaign(id);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status !== "draft") {
      return NextResponse.json(
        { error: "Can only build audience for draft campaigns" },
        { status: 400 }
      );
    }

    const result = await audienceResolver.buildRecipientSnapshot(
      id,
      campaign.audienceRulesJson as AudienceRules
    );

    return NextResponse.json({
      count: result.count,
      errors: result.errors,
    });
  } catch (err: any) {
    console.error("[admin/email-campaigns/[id]/build-audience] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to build audience" },
      { status: 500 }
    );
  }
}
