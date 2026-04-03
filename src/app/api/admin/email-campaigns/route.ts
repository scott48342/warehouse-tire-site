/**
 * Admin API: Email Campaigns
 * 
 * GET  /api/admin/email-campaigns - List campaigns
 * POST /api/admin/email-campaigns - Create campaign
 * 
 * @created 2026-04-03
 */

import { NextRequest, NextResponse } from "next/server";
import { campaignService } from "@/lib/email/campaigns";

/**
 * GET /api/admin/email-campaigns
 * List campaigns with optional filters
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const status = searchParams.get("status") as any;
    const campaignType = searchParams.get("type") || undefined;
    const includeTest = searchParams.get("includeTest") === "true";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const { campaigns, total } = await campaignService.listCampaigns({
      status,
      campaignType,
      includeTest,
      limit,
      offset,
    });

    return NextResponse.json({
      campaigns,
      total,
      limit,
      offset,
    });
  } catch (err: any) {
    console.error("[admin/email-campaigns] GET error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to list campaigns" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email-campaigns
 * Create a new campaign
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      name,
      campaignType,
      subject,
      previewText,
      fromName,
      replyTo,
      contentJson,
      audienceRulesJson,
      includeFreeShippingBanner,
      includePriceMatch,
      utmCampaign,
      isTest,
      createdBy,
      notes,
    } = body;

    if (!name || !campaignType || !subject) {
      return NextResponse.json(
        { error: "name, campaignType, and subject are required" },
        { status: 400 }
      );
    }

    const campaign = await campaignService.createCampaign({
      name,
      campaignType,
      subject,
      previewText,
      fromName,
      replyTo,
      contentJson,
      audienceRulesJson,
      includeFreeShippingBanner,
      includePriceMatch,
      utmCampaign,
      isTest,
      createdBy,
      notes,
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (err: any) {
    console.error("[admin/email-campaigns] POST error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create campaign" },
      { status: 500 }
    );
  }
}
