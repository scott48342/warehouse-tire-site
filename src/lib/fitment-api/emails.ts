/**
 * Fitment API Email Service
 * 
 * Sends onboarding emails via Resend:
 * 1. Confirmation email (immediate on request)
 * 2. Approval email (includes API key)
 * 3. Follow-up email (24h after approval if no calls made)
 */

import { Resend } from "resend";
import { BRAND } from "@/lib/brand";

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://shop.warehousetiredirect.com";
const API_DOCS_URL = `${BASE_URL}/fitment-api#endpoints`;
const FROM_EMAIL = process.env.FITMENT_API_EMAIL_FROM || process.env.EMAIL_FROM || "api@warehousetiredirect.com";

// Safe mode for testing (log instead of send)
const EMAIL_SAFE_MODE = process.env.EMAIL_SAFE_MODE === "true";

// ============================================================================
// Resend Client
// ============================================================================

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[fitmentApiEmail] RESEND_API_KEY not configured");
    return null;
  }
  return new Resend(apiKey);
}

// ============================================================================
// Email Result Type
// ============================================================================

export interface EmailResult {
  success: boolean;
  action: "sent" | "logged" | "failed";
  messageId?: string;
  error?: string;
}

// ============================================================================
// EMAIL 1: Confirmation (Request Received)
// ============================================================================

export async function sendConfirmationEmail(params: {
  email: string;
  name: string;
  company: string;
}): Promise<EmailResult> {
  const { email, name, company } = params;
  
  const subject = "We received your Fitment API access request";
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">

  <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: #3b82f6; padding: 24px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 22px;">Fitment API</h1>
      <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">by Warehouse Tire Direct</p>
    </div>

    <!-- Content -->
    <div style="padding: 32px;">
      
      <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 20px;">
        Thanks for your interest, ${name}!
      </h2>
      
      <p style="margin: 0 0 24px; color: #4b5563;">
        We've received your API access request for <strong>${company}</strong>.
      </p>
      
      <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; color: #1e40af; font-size: 14px;">
          <strong>What happens next?</strong><br>
          We'll review your application and get back to you within 24 hours with your API credentials.
        </p>
      </div>
      
      <p style="margin: 0 0 16px; color: #4b5563;">
        In the meantime, you can:
      </p>
      
      <ul style="margin: 0 0 24px; padding-left: 20px; color: #4b5563;">
        <li style="margin-bottom: 8px;">Review the <a href="${API_DOCS_URL}" style="color: #3b82f6;">API documentation</a></li>
        <li style="margin-bottom: 8px;">Check out example responses and endpoints</li>
        <li>Plan your integration</li>
      </ul>
      
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        Questions? Just reply to this email.
      </p>

    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        Warehouse Tire Direct Fitment API
      </p>
    </div>

  </div>

</body>
</html>
  `.trim();

  return sendEmail({ to: email, subject, html });
}

// ============================================================================
// EMAIL 2: Approval (API Key Delivery)
// ============================================================================

export async function sendApprovalEmail(params: {
  email: string;
  name: string;
  company: string;
  apiKey: string; // Plain key (only time we show it)
  plan: string;
}): Promise<EmailResult> {
  const { email, name, company, apiKey, plan } = params;
  
  const subject = "🎉 Your Fitment API key is ready!";
  
  const exampleUrl = `${BASE_URL}/api/public/fitment/specs?year=2020&make=Ford&model=F-150`;
  const exampleCurl = `curl -H "X-API-Key: ${apiKey}" "${exampleUrl}"`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">

  <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: #10b981; padding: 24px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 22px;">You're Approved! 🎉</h1>
    </div>

    <!-- Content -->
    <div style="padding: 32px;">
      
      <p style="margin: 0 0 24px; color: #4b5563;">
        Hey ${name},<br><br>
        Great news! Your Fitment API access for <strong>${company}</strong> has been approved.
      </p>
      
      <!-- API Key Box -->
      <div style="background: #1f2937; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
          Your API Key
        </p>
        <code style="display: block; color: #10b981; font-size: 14px; word-break: break-all; font-family: 'SF Mono', Monaco, monospace;">
          ${apiKey}
        </code>
        <p style="margin: 12px 0 0; color: #f87171; font-size: 12px;">
          ⚠️ Save this key now — we can't show it again.
        </p>
      </div>
      
      <!-- Plan Info -->
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #6b7280; font-size: 14px;">Plan</span>
          <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${plan.charAt(0).toUpperCase() + plan.slice(1)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #6b7280; font-size: 14px;">Base URL</span>
          <span style="color: #3b82f6; font-size: 14px;">${BASE_URL}/api/public/fitment</span>
        </div>
      </div>
      
      <!-- Quick Start -->
      <h3 style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">
        🚀 Make Your First Call
      </h3>
      
      <p style="margin: 0 0 12px; color: #4b5563; font-size: 14px;">
        Try this example to get fitment specs for a 2020 Ford F-150:
      </p>
      
      <div style="background: #1f2937; border-radius: 8px; padding: 16px; margin-bottom: 24px; overflow-x: auto;">
        <code style="color: #e5e7eb; font-size: 13px; white-space: pre-wrap; word-break: break-all; font-family: 'SF Mono', Monaco, monospace;">
${exampleCurl}
        </code>
      </div>
      
      <!-- Response Preview -->
      <p style="margin: 0 0 12px; color: #4b5563; font-size: 14px;">
        You'll get back:
      </p>
      
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <pre style="margin: 0; color: #374151; font-size: 12px; overflow-x: auto; font-family: 'SF Mono', Monaco, monospace;">{
  "boltPattern": "6x135",
  "centerBore": 87.1,
  "threadSize": "M14x1.5",
  "offsetRange": [20, 44],
  "wheelSizes": ["17x7.5", "18x8", "20x9"],
  "tireSizes": ["265/70R17", "275/65R18"],
  "staggered": false
}</pre>
      </div>
      
      <!-- CTA -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${API_DOCS_URL}" 
           style="display: inline-block; background: #3b82f6; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          View Full Documentation
        </a>
      </div>
      
      <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
        Questions? Reply to this email — we're happy to help!
      </p>

    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        Warehouse Tire Direct Fitment API
      </p>
    </div>

  </div>

</body>
</html>
  `.trim();

  return sendEmail({ to: email, subject, html });
}

// ============================================================================
// EMAIL 3: Follow-up (After Approval, No Calls Yet)
// ============================================================================

export async function sendFollowUpEmail(params: {
  email: string;
  name: string;
  keyPrefix: string; // Only show prefix for security
}): Promise<EmailResult> {
  const { email, name, keyPrefix } = params;
  
  const subject = "Need help getting started with the Fitment API?";
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">

  <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: #8b5cf6; padding: 24px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 22px;">Quick Check-In 👋</h1>
    </div>

    <!-- Content -->
    <div style="padding: 32px;">
      
      <p style="margin: 0 0 24px; color: #4b5563;">
        Hey ${name},
      </p>
      
      <p style="margin: 0 0 24px; color: #4b5563;">
        We noticed you haven't made your first API call yet. Just wanted to check in and see if you need any help getting started.
      </p>
      
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px;">Your API Key</p>
        <code style="color: #1f2937; font-size: 14px;">${keyPrefix}...</code>
      </div>
      
      <h3 style="margin: 0 0 16px; color: #1f2937; font-size: 16px;">
        Common Integration Examples
      </h3>
      
      <div style="margin-bottom: 24px;">
        <p style="margin: 0 0 8px; color: #1f2937; font-weight: 600; font-size: 14px;">
          1. Build a Year/Make/Model Selector
        </p>
        <code style="display: block; background: #f9fafb; padding: 12px; border-radius: 6px; color: #4b5563; font-size: 12px; margin-bottom: 16px;">
GET /api/public/fitment/years<br>
GET /api/public/fitment/makes?year=2024<br>
GET /api/public/fitment/models?year=2024&make=Ford<br>
GET /api/public/fitment/specs?year=2024&make=Ford&model=F-150
        </code>
        
        <p style="margin: 0 0 8px; color: #1f2937; font-weight: 600; font-size: 14px;">
          2. Get Complete Fitment Data
        </p>
        <code style="display: block; background: #f9fafb; padding: 12px; border-radius: 6px; color: #4b5563; font-size: 12px;">
GET /api/public/fitment/specs?year=2020&make=Ford&model=Mustang&trim=GT
        </code>
      </div>
      
      <p style="margin: 0 0 24px; color: #4b5563;">
        Need a quick test? Try our test endpoint:
      </p>
      
      <div style="background: #1f2937; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <code style="color: #e5e7eb; font-size: 13px; font-family: 'SF Mono', Monaco, monospace;">
GET /api/public/fitment/test
        </code>
      </div>
      
      <!-- CTA -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${API_DOCS_URL}" 
           style="display: inline-block; background: #8b5cf6; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          View Documentation
        </a>
      </div>
      
      <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
        Just reply to this email if you're stuck — we're here to help!
      </p>

    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        Warehouse Tire Direct Fitment API
      </p>
    </div>

  </div>

</body>
</html>
  `.trim();

  return sendEmail({ to: email, subject, html });
}

// ============================================================================
// Email Sender (Shared)
// ============================================================================

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailResult> {
  const { to, subject, html } = params;
  
  // Safe mode: log instead of send
  if (EMAIL_SAFE_MODE) {
    console.log("[fitmentApiEmail] SAFE_MODE - Would send email:");
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    return { success: true, action: "logged" };
  }
  
  const resend = getResendClient();
  if (!resend) {
    console.error("[fitmentApiEmail] Resend not configured - email not sent");
    return { success: false, action: "failed", error: "resend_not_configured" };
  }
  
  try {
    const { data, error } = await resend.emails.send({
      from: `Fitment API <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      replyTo: BRAND.email,
    });
    
    if (error) {
      console.error(`[fitmentApiEmail] Resend error for ${to}:`, error);
      return { success: false, action: "failed", error: error.message };
    }
    
    console.log(`[fitmentApiEmail] Sent "${subject}" to ${to}, id: ${data?.id}`);
    return { success: true, action: "sent", messageId: data?.id };
  } catch (err: any) {
    console.error(`[fitmentApiEmail] Failed to send to ${to}:`, err.message);
    return { success: false, action: "failed", error: err.message };
  }
}

// ============================================================================
// Exports
// ============================================================================

export const fitmentApiEmailService = {
  sendConfirmationEmail,
  sendApprovalEmail,
  sendFollowUpEmail,
};

export default fitmentApiEmailService;
