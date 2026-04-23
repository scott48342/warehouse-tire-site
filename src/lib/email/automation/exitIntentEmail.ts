/**
 * Exit Intent (Saved Setup) Email Service
 * 
 * 2-email flow:
 * - Email 1: Immediate when user saves their setup
 * - Email 2: 24 hours later as follow-up
 * 
 * @created 2026-04-23
 */

import nodemailer from "nodemailer";
import pg from "pg";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/fitment-db/db";
import { emailSubscribers, abandonedCarts, type EmailSubscriber } from "@/lib/fitment-db/schema";
import { eq, and, isNull, lt, desc } from "drizzle-orm";
import { markExitIntentFollowupSent, findExitIntentFollowupsDue } from "./emailQueue";

// ============================================================================
// Configuration
// ============================================================================

/** Safe mode: log instead of send */
export const EXIT_EMAIL_SAFE_MODE = process.env.EMAIL_SAFE_MODE === "true";

/** Base URL for links */
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://shop.warehousetiredirect.com";

// ============================================================================
// Types
// ============================================================================

export type ExitEmailStep = "immediate" | "followup";

export interface ExitEmailResult {
  success: boolean;
  subscriberId: string;
  step: ExitEmailStep;
  action: "sent" | "logged" | "skipped";
  reason?: string;
  messageId?: string;
}

export interface ProcessExitEmailsResult {
  processed: number;
  sent: number;
  logged: number;
  skipped: number;
  errors: number;
  results: ExitEmailResult[];
}

// ============================================================================
// SMTP Client (reuse from abandonedCartEmail pattern)
// ============================================================================

const { Pool } = pg;

type EmailSettings = {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
};

async function getEmailSettings(): Promise<EmailSettings | null> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });
  
  try {
    const { rows } = await pool.query(
      `SELECT value FROM admin_settings WHERE key = 'email'`
    );

    if (rows.length === 0) return null;

    const val = rows[0].value;
    if (!val || !val.enabled) return null;

    return {
      enabled: !!val.enabled,
      smtpHost: val.smtpHost || "",
      smtpPort: parseInt(val.smtpPort, 10) || 587,
      smtpUser: val.smtpUser || "",
      smtpPass: val.smtpPass || "",
      fromEmail: val.fromEmail || "",
      fromName: val.fromName || BRAND.name,
    };
  } catch (err) {
    console.error("[exitIntentEmail] Failed to get email settings:", err);
    return null;
  } finally {
    await pool.end();
  }
}

async function getTransporter(settings: EmailSettings) {
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpPort === 465,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPass,
    },
    requireTLS: settings.smtpPort === 587,
    tls: {
      ciphers: "SSLv3",
      rejectUnauthorized: false,
    },
  });
}

// ============================================================================
// Email Templates
// ============================================================================

function buildImmediateSubject(subscriber: {
  vehicleYear?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
}): string {
  if (subscriber.vehicleYear && subscriber.vehicleMake && subscriber.vehicleModel) {
    return `Your ${subscriber.vehicleYear} ${subscriber.vehicleMake} ${subscriber.vehicleModel} setup is saved`;
  }
  return "Your wheel & tire setup is saved";
}

function buildFollowupSubject(subscriber: {
  vehicleYear?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
}): string {
  if (subscriber.vehicleYear && subscriber.vehicleMake && subscriber.vehicleModel) {
    return `Still looking for wheels for your ${subscriber.vehicleMake} ${subscriber.vehicleModel}?`;
  }
  return "Your saved setup is waiting";
}

function buildImmediateEmailHtml(subscriber: {
  email: string;
  vehicleYear?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleTrim?: string | null;
  cartId?: string | null;
}): string {
  const vehicleLabel = subscriber.vehicleYear && subscriber.vehicleMake
    ? `${subscriber.vehicleYear} ${subscriber.vehicleMake} ${subscriber.vehicleModel || ""}${subscriber.vehicleTrim ? ` ${subscriber.vehicleTrim}` : ""}`.trim()
    : null;

  // Link: if cart exists, go to recovery; otherwise vehicle page
  const ctaUrl = subscriber.cartId
    ? `${BASE_URL}/cart/recover/${subscriber.cartId}?utm_source=email&utm_medium=automation&utm_campaign=exit_intent`
    : vehicleLabel
      ? `${BASE_URL}/wheels?year=${subscriber.vehicleYear}&make=${encodeURIComponent(subscriber.vehicleMake || "")}&model=${encodeURIComponent(subscriber.vehicleModel || "")}&utm_source=email&utm_medium=automation&utm_campaign=exit_intent`
      : `${BASE_URL}?utm_source=email&utm_medium=automation&utm_campaign=exit_intent`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Setup is Saved - ${BRAND.name}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">

  <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: #dc2626; padding: 24px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px;">${BRAND.name}</h1>
    </div>

    <!-- Content -->
    <div style="padding: 32px;">
      
      <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 22px;">✅ Your Setup is Saved!</h2>
      
      <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px;">
        Hey there,<br><br>
        Good news — we've saved your wheel and tire search so you can pick up right where you left off.
      </p>

      ${vehicleLabel ? `
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Your Vehicle</div>
        <div style="font-size: 18px; font-weight: 600; color: #1f2937;">🚗 ${vehicleLabel}</div>
      </div>
      ` : ""}

      <!-- CTA -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${ctaUrl}" 
           style="display: inline-block; background: #dc2626; color: white; padding: 16px 48px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 18px;">
          Continue Shopping
        </a>
      </div>

      <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px; text-align: center;">
        ✓ Your selections are saved and waiting for you
      </p>

      <!-- Benefits -->
      <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 24px;">
        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
          <span style="color: #10b981;">✓</span>
          <span style="color: #4b5563;">Guaranteed fitment for your vehicle</span>
        </div>
        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
          <span style="color: #10b981;">✓</span>
          <span style="color: #4b5563;">Price match guarantee</span>
        </div>
        <div style="display: flex; gap: 12px;">
          <span style="color: #10b981;">✓</span>
          <span style="color: #4b5563;">Free shipping on orders over $199</span>
        </div>
      </div>

    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
        Questions? Call ${BRAND.phone.callDisplay} or reply to this email
      </p>
      <p style="margin: 0 0 16px; color: #9ca3af; font-size: 12px;">
        ${BRAND.name}
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 11px;">
        <a href="${BASE_URL}/unsubscribe?email=${encodeURIComponent(subscriber.email)}" style="color: #9ca3af;">Unsubscribe</a>
      </p>
    </div>

  </div>

</body>
</html>
  `.trim();
}

function buildFollowupEmailHtml(subscriber: {
  email: string;
  vehicleYear?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleTrim?: string | null;
  cartId?: string | null;
}): string {
  const vehicleLabel = subscriber.vehicleYear && subscriber.vehicleMake
    ? `${subscriber.vehicleYear} ${subscriber.vehicleMake} ${subscriber.vehicleModel || ""}${subscriber.vehicleTrim ? ` ${subscriber.vehicleTrim}` : ""}`.trim()
    : null;

  const ctaUrl = subscriber.cartId
    ? `${BASE_URL}/cart/recover/${subscriber.cartId}?utm_source=email&utm_medium=automation&utm_campaign=exit_intent_followup`
    : vehicleLabel
      ? `${BASE_URL}/wheels?year=${subscriber.vehicleYear}&make=${encodeURIComponent(subscriber.vehicleMake || "")}&model=${encodeURIComponent(subscriber.vehicleModel || "")}&utm_source=email&utm_medium=automation&utm_campaign=exit_intent_followup`
      : `${BASE_URL}?utm_source=email&utm_medium=automation&utm_campaign=exit_intent_followup`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Setup is Waiting - ${BRAND.name}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">

  <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: #dc2626; padding: 24px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px;">${BRAND.name}</h1>
    </div>

    <!-- Content -->
    <div style="padding: 32px;">
      
      <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 22px;">Still thinking it over?</h2>
      
      <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px;">
        Hey,<br><br>
        Just a friendly follow-up — your wheel and tire search is still saved. If you have any questions about fitment, pricing, or installation, we're here to help!
      </p>

      ${vehicleLabel ? `
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Your Vehicle</div>
        <div style="font-size: 18px; font-weight: 600; color: #1f2937;">🚗 ${vehicleLabel}</div>
      </div>
      ` : ""}

      <!-- CTA -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${ctaUrl}" 
           style="display: inline-block; background: #dc2626; color: white; padding: 16px 48px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 18px;">
          Resume Shopping
        </a>
      </div>

      <!-- Price Match -->
      <div style="background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 16px; margin-top: 24px;">
        <div style="font-weight: 600; color: #1e40af; margin-bottom: 4px;">💰 Price Match Guarantee</div>
        <div style="font-size: 14px; color: #1e3a8a;">
          Found a better price? Reply to this email with the link and we'll match it.
        </div>
      </div>

    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
        Questions? Call ${BRAND.phone.callDisplay}
      </p>
      <p style="margin: 0 0 16px; color: #9ca3af; font-size: 12px;">
        ${BRAND.name}
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 11px;">
        <a href="${BASE_URL}/unsubscribe?email=${encodeURIComponent(subscriber.email)}" style="color: #9ca3af;">Unsubscribe</a>
      </p>
    </div>

  </div>

</body>
</html>
  `.trim();
}

// ============================================================================
// Send Functions
// ============================================================================

/**
 * Send immediate email when user saves via exit intent
 */
export async function sendExitIntentImmediateEmail(subscriber: {
  id: string;
  email: string;
  vehicleYear?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleTrim?: string | null;
  cartId?: string | null;
}): Promise<ExitEmailResult> {
  const subscriberId = subscriber.id;

  if (!subscriber.email) {
    return { success: false, subscriberId, step: "immediate", action: "skipped", reason: "no_email" };
  }

  const subject = buildImmediateSubject(subscriber);
  const html = buildImmediateEmailHtml(subscriber);

  if (EXIT_EMAIL_SAFE_MODE) {
    console.log("[exitIntentEmail] SAFE_MODE - Would send immediate email:");
    console.log(`  To: ${subscriber.email}`);
    console.log(`  Subject: ${subject}`);
    return { success: true, subscriberId, step: "immediate", action: "logged", reason: "safe_mode" };
  }

  const settings = await getEmailSettings();
  if (!settings) {
    console.warn("[exitIntentEmail] Email not configured");
    return { success: false, subscriberId, step: "immediate", action: "skipped", reason: "smtp_not_configured" };
  }

  try {
    const transporter = await getTransporter(settings);
    const fromAddress = `"${settings.fromName}" <${settings.fromEmail}>`;

    const result = await transporter.sendMail({
      from: fromAddress,
      to: subscriber.email,
      subject,
      html,
      replyTo: BRAND.email,
    });

    console.log(`[exitIntentEmail] Sent immediate to ${subscriber.email}, id: ${result.messageId}`);
    return { success: true, subscriberId, step: "immediate", action: "sent", messageId: result.messageId };
  } catch (err: any) {
    console.error(`[exitIntentEmail] Failed:`, err.message);
    return { success: false, subscriberId, step: "immediate", action: "skipped", reason: err.message };
  }
}

/**
 * Send follow-up email (24h after capture)
 */
export async function sendExitIntentFollowupEmail(subscriber: {
  id: string;
  email: string;
  vehicleYear?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleTrim?: string | null;
  cartId?: string | null;
}): Promise<ExitEmailResult> {
  const subscriberId = subscriber.id;

  if (!subscriber.email) {
    return { success: false, subscriberId, step: "followup", action: "skipped", reason: "no_email" };
  }

  const subject = buildFollowupSubject(subscriber);
  const html = buildFollowupEmailHtml(subscriber);

  if (EXIT_EMAIL_SAFE_MODE) {
    console.log("[exitIntentEmail] SAFE_MODE - Would send followup email:");
    console.log(`  To: ${subscriber.email}`);
    console.log(`  Subject: ${subject}`);
    await markExitIntentFollowupSent(subscriberId);
    return { success: true, subscriberId, step: "followup", action: "logged", reason: "safe_mode" };
  }

  const settings = await getEmailSettings();
  if (!settings) {
    console.warn("[exitIntentEmail] Email not configured");
    return { success: false, subscriberId, step: "followup", action: "skipped", reason: "smtp_not_configured" };
  }

  try {
    const transporter = await getTransporter(settings);
    const fromAddress = `"${settings.fromName}" <${settings.fromEmail}>`;

    const result = await transporter.sendMail({
      from: fromAddress,
      to: subscriber.email,
      subject,
      html,
      replyTo: BRAND.email,
    });

    console.log(`[exitIntentEmail] Sent followup to ${subscriber.email}, id: ${result.messageId}`);
    
    // Mark as sent
    await markExitIntentFollowupSent(subscriberId);
    
    return { success: true, subscriberId, step: "followup", action: "sent", messageId: result.messageId };
  } catch (err: any) {
    console.error(`[exitIntentEmail] Failed:`, err.message);
    return { success: false, subscriberId, step: "followup", action: "skipped", reason: err.message };
  }
}

/**
 * Process all pending follow-up emails
 */
export async function processExitIntentFollowups(): Promise<ProcessExitEmailsResult> {
  const results: ExitEmailResult[] = [];
  let sent = 0, logged = 0, skipped = 0, errors = 0;

  const pendingSubscribers = await findExitIntentFollowupsDue();
  console.log(`[exitIntentEmail] Found ${pendingSubscribers.length} subscribers for follow-up`);

  for (const subscriber of pendingSubscribers) {
    const result = await sendExitIntentFollowupEmail(subscriber);
    results.push(result);

    if (result.action === "sent") sent++;
    else if (result.action === "logged") logged++;
    else skipped++;
  }

  return { processed: results.length, sent, logged, skipped, errors, results };
}

// ============================================================================
// Exports
// ============================================================================

export const exitIntentEmailService = {
  sendExitIntentImmediateEmail,
  sendExitIntentFollowupEmail,
  processExitIntentFollowups,
  EXIT_EMAIL_SAFE_MODE,
};

export default exitIntentEmailService;
