/**
 * AI Campaign Generator Cron
 * 
 * Automatically generates and sends personalized email campaigns.
 * Runs on schedule via Vercel Cron.
 * 
 * Schedule:
 * - Weekly Deals: Tuesdays at 9 AM EST
 * - Seasonal: First of each season month (Mar, Jun, Sep, Dec)
 * 
 * @created 2026-04-25
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  generateCampaign,
  generatePersonalizedContent,
  getGenericContent,
  type CampaignType,
} from "@/lib/email/ai/generateCampaignContent";
import {
  createCampaign,
  buildAudience,
  startSending,
} from "@/lib/email/campaigns/campaignService";
import { getMarketingList } from "@/lib/email/subscriberService";
import { Resend } from "resend";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

// ============================================================================
// Configuration
// ============================================================================

/** Admin email to CC on all campaign sends */
const ADMIN_EMAIL = "scott@warehousetire.net";

/** Only run from Vercel Cron or with secret */
const CRON_SECRET = process.env.CRON_SECRET;

/** Auto-approve campaigns or require manual review */
const AUTO_APPROVE = process.env.AI_CAMPAIGN_AUTO_APPROVE === "true";

// ============================================================================
// Cron Handler
// ============================================================================

export async function GET(request: NextRequest) {
  // Verify cron authorization
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const cronHeader = headersList.get("x-vercel-cron");
  
  const isVercelCron = cronHeader === "1";
  const hasValidSecret = authHeader === `Bearer ${CRON_SECRET}`;
  
  if (!isVercelCron && !hasValidSecret && CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Determine campaign type from query or schedule
  const url = new URL(request.url);
  const campaignTypeParam = url.searchParams.get("type") as CampaignType | null;
  const forceRun = url.searchParams.get("force") === "1";
  const testMode = url.searchParams.get("test") === "1";
  
  // Default to weekly_deals if not specified
  const campaignType: CampaignType = campaignTypeParam || determineCampaignType();

  console.log(`[AI Campaign Cron] Starting ${campaignType} campaign generation`);

  try {
    // 1. Generate campaign content using AI
    const generated = await generateCampaign(campaignType);
    
    if (!generated) {
      console.error("[AI Campaign Cron] Failed to generate campaign content");
      return NextResponse.json(
        { error: "Campaign generation failed" },
        { status: 500 }
      );
    }

    console.log(`[AI Campaign Cron] Generated: "${generated.subject}"`);

    // 2. Create campaign in database
    const campaign = await createCampaign({
      name: `[AI] ${generated.name}`,
      campaignType,
      subject: generated.subject,
      previewText: generated.previewText,
      contentJson: generated.content,
      audienceRulesJson: generated.audienceRules,
      isTest: testMode,
      createdBy: "ai-cron",
      notes: `Auto-generated ${campaignType} campaign`,
    });

    console.log(`[AI Campaign Cron] Created campaign ${campaign.id}`);

    // 3. Build audience
    const audienceResult = await buildAudience(campaign.id);
    console.log(`[AI Campaign Cron] Audience: ${audienceResult.recipientCount} recipients`);

    // 4. If test mode or manual approval required, stop here
    if (testMode) {
      // Send test email to admin
      await sendTestToAdmin(campaign, generated);
      
      return NextResponse.json({
        success: true,
        mode: "test",
        campaign: {
          id: campaign.id,
          name: campaign.name,
          subject: generated.subject,
        },
        audience: audienceResult.recipientCount,
        message: `Test email sent to ${ADMIN_EMAIL}`,
      });
    }

    if (!AUTO_APPROVE && !forceRun) {
      // Send preview to admin for approval
      await sendTestToAdmin(campaign, generated);
      
      return NextResponse.json({
        success: true,
        mode: "pending_approval",
        campaign: {
          id: campaign.id,
          name: campaign.name,
          subject: generated.subject,
        },
        audience: audienceResult.recipientCount,
        message: `Campaign created. Preview sent to ${ADMIN_EMAIL}. Approve in admin panel to send.`,
        approveUrl: `https://shop.warehousetiredirect.com/admin/email-campaigns/${campaign.id}`,
      });
    }

    // 5. Auto-approved: Start sending
    const sendResult = await startSending(campaign.id, {
      bccAdmin: ADMIN_EMAIL,
    });

    return NextResponse.json({
      success: true,
      mode: "sent",
      campaign: {
        id: campaign.id,
        name: campaign.name,
        subject: generated.subject,
      },
      sent: sendResult.sent,
      failed: sendResult.failed,
    });
  } catch (err: any) {
    console.error("[AI Campaign Cron] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Campaign generation failed" },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Determine what type of campaign to generate based on date
 */
function determineCampaignType(): CampaignType {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 2 = Tuesday
  const dayOfMonth = now.getDate();
  const month = now.getMonth();

  // Seasonal campaigns on specific months
  if (dayOfMonth <= 7) {
    if (month === 2) return "seasonal"; // March - spring
    if (month === 5) return "seasonal"; // June - summer
    if (month === 8) return "seasonal"; // September - fall
    if (month === 11) return "seasonal"; // December - winter
  }

  // Tuesday = weekly deals
  if (dayOfWeek === 2) {
    return "weekly_deals";
  }

  // Default
  return "weekly_deals";
}

/**
 * Send test/preview email to admin
 */
async function sendTestToAdmin(
  campaign: any,
  generated: any
): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  if (!process.env.RESEND_API_KEY) {
    console.warn("[AI Campaign Cron] No RESEND_API_KEY, skipping test email");
    return;
  }

  const previewHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 24px; }
        .meta { background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
        .meta-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .meta-row:last-child { border-bottom: none; }
        .label { font-weight: 600; color: #374151; }
        .value { color: #6b7280; }
        .btn { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 8px 4px; }
        .btn-secondary { background: #6b7280; }
        .preview-box { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">🤖 AI Campaign Preview</h1>
          <p style="margin: 8px 0 0; opacity: 0.9;">Review before sending</p>
        </div>
        
        <div class="content">
          <div class="meta">
            <div class="meta-row">
              <span class="label">Campaign Name</span>
              <span class="value">${campaign.name}</span>
            </div>
            <div class="meta-row">
              <span class="label">Subject Line</span>
              <span class="value">${generated.subject}</span>
            </div>
            <div class="meta-row">
              <span class="label">Preview Text</span>
              <span class="value">${generated.previewText}</span>
            </div>
            <div class="meta-row">
              <span class="label">Campaign ID</span>
              <span class="value">${campaign.id}</span>
            </div>
          </div>
          
          <h3>Content Preview</h3>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
            ${renderContentPreview(generated.content)}
          </div>
          
          <div class="preview-box">
            <strong>⚠️ This is a preview.</strong> The actual campaign is saved as a draft.
            Click below to review and approve sending.
          </div>
          
          <div style="text-align: center; margin-top: 24px;">
            <a href="https://shop.warehousetiredirect.com/admin/email-campaigns/${campaign.id}" class="btn">
              Review & Approve
            </a>
            <a href="https://shop.warehousetiredirect.com/admin/email-campaigns" class="btn btn-secondary">
              View All Campaigns
            </a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: "Warehouse Tire <noreply@warehousetiredirect.com>",
      to: ADMIN_EMAIL,
      subject: `[Preview] ${generated.subject}`,
      html: previewHtml,
    });
    console.log(`[AI Campaign Cron] Test email sent to ${ADMIN_EMAIL}`);
  } catch (err) {
    console.error("[AI Campaign Cron] Failed to send test email:", err);
  }
}

/**
 * Render content blocks as HTML preview
 */
function renderContentPreview(content: any): string {
  if (!content?.blocks) return "<em>No content</em>";

  return content.blocks.map((block: any) => {
    switch (block.type) {
      case "hero":
        return `
          <div style="background: ${block.data.backgroundColor || '#dc2626'}; color: white; padding: 24px; text-align: center; border-radius: 8px;">
            <h2 style="margin: 0;">${block.data.headline}</h2>
            ${block.data.subheadline ? `<p style="margin: 8px 0 0; opacity: 0.9;">${block.data.subheadline}</p>` : ""}
          </div>
        `;
      case "text":
        return `<p style="white-space: pre-wrap;">${block.data.content}</p>`;
      case "cta_button":
        return `
          <div style="text-align: center; margin: 16px 0;">
            <span style="display: inline-block; background: ${block.data.backgroundColor || '#dc2626'}; color: white; padding: 12px 24px; border-radius: 8px;">
              ${block.data.text}
            </span>
          </div>
        `;
      case "rebate_section":
        return `
          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h4 style="margin: 0 0 12px;">${block.data.title}</h4>
            ${block.data.rebates?.map((r: any) => `
              <div style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <strong>${r.brand}</strong>: ${r.amount} - ${r.description}
              </div>
            `).join("") || ""}
          </div>
        `;
      default:
        return `<div style="color: #9ca3af; font-style: italic;">[${block.type} block]</div>`;
    }
  }).join("");
}
