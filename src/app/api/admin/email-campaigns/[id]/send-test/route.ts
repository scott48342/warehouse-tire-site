/**
 * POST /api/admin/email-campaigns/[id]/send-test
 * Send a test email for a campaign
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
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const result = await campaignService.sendTestEmail(id, email);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send test email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[admin/email-campaigns/[id]/send-test] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to send test email" },
      { status: 500 }
    );
  }
}
