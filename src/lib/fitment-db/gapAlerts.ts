/**
 * Fitment Gap Alerting System
 * 
 * Sends email alerts when meaningful new fitment gaps are detected.
 * Uses deduplication and cooldown to prevent spam.
 * 
 * Trigger conditions:
 * 1. NEW_VEHICLE: Brand new unresolved vehicle never seen before
 * 2. THRESHOLD_CROSSED: Vehicle crosses occurrence threshold (e.g., 5+ searches)
 * 3. HIGH_PRIORITY: High-priority vehicle based on frequency/recency
 * 
 * Environment variables:
 * - FITMENT_GAP_ALERT_EMAIL: Recipient email address
 * - FITMENT_GAP_ALERTS_ENABLED: "true" to enable alerts
 * - FITMENT_GAP_THRESHOLD: Occurrence count threshold (default: 5)
 * - FITMENT_GAP_COOLDOWN_HOURS: Hours between alerts for same vehicle (default: 24)
 * - FITMENT_GAP_HIGH_PRIORITY_SCORE: Minimum priority score for immediate alert (default: 10)
 * - RESEND_API_KEY: Resend API key for sending emails
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  serial,
  index,
} from "drizzle-orm/pg-core";
import { eq, and, gte, desc } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export function getAlertConfig() {
  return {
    enabled: process.env.FITMENT_GAP_ALERTS_ENABLED === "true",
    recipientEmail: process.env.FITMENT_GAP_ALERT_EMAIL || "",
    threshold: parseInt(process.env.FITMENT_GAP_THRESHOLD || "5", 10),
    cooldownHours: parseInt(process.env.FITMENT_GAP_COOLDOWN_HOURS || "24", 10),
    highPriorityScore: parseFloat(process.env.FITMENT_GAP_HIGH_PRIORITY_SCORE || "10"),
    resendApiKey: process.env.RESEND_API_KEY || "",
    fromEmail: process.env.FITMENT_GAP_FROM_EMAIL || "alerts@warehousetiredirect.com",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERT TRACKING TABLE
// ═══════════════════════════════════════════════════════════════════════════════

export const fitmentGapAlerts = pgTable(
  "fitment_gap_alerts",
  {
    id: serial("id").primaryKey(),
    
    // Vehicle identification (matches unresolved_fitment_searches)
    year: integer("year").notNull(),
    make: text("make").notNull(),
    model: text("model").notNull(),
    trim: text("trim"),
    searchType: text("search_type").notNull(),
    
    // Alert tracking
    alertType: text("alert_type").notNull(), // 'new_vehicle' | 'threshold_crossed' | 'high_priority'
    alertSentAt: timestamp("alert_sent_at", { withTimezone: true }).notNull().defaultNow(),
    
    // Context at time of alert
    occurrenceCountAtAlert: integer("occurrence_count_at_alert").notNull(),
    priorityScoreAtAlert: integer("priority_score_at_alert"),
    
    // Email tracking
    emailId: text("email_id"), // Resend email ID for tracking
    emailStatus: text("email_status"), // 'sent' | 'failed' | 'pending'
  },
  (table) => ({
    vehicleIdx: index("gap_alerts_vehicle_idx").on(
      table.year,
      table.make,
      table.model,
      table.searchType
    ),
    sentAtIdx: index("gap_alerts_sent_at_idx").on(table.alertSentAt),
  })
);

export type FitmentGapAlert = typeof fitmentGapAlerts.$inferSelect;
export type NewFitmentGapAlert = typeof fitmentGapAlerts.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// ALERT TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export type AlertType = "new_vehicle" | "threshold_crossed" | "high_priority" | "daily_summary";

export interface AlertContext {
  year: number;
  make: string;
  model: string;
  trim: string | null;
  searchType: string;
  occurrenceCount: number;
  firstSeen: Date;
  lastSeen: Date;
  source: string;
  samplePaths?: string[];
  priorityScore?: number;
  isNewVehicle: boolean;
  thresholdCrossed: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEDUPLICATION: Check if alert was recently sent
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if an alert was sent for this vehicle within the cooldown window
 */
export async function wasAlertRecentlySent(
  year: number,
  make: string,
  model: string,
  trim: string | null,
  searchType: string,
  alertType: AlertType
): Promise<boolean> {
  const config = getAlertConfig();
  const cooldownCutoff = new Date(Date.now() - config.cooldownHours * 60 * 60 * 1000);
  
  const recentAlerts = await db
    .select()
    .from(fitmentGapAlerts)
    .where(
      and(
        eq(fitmentGapAlerts.year, year),
        eq(fitmentGapAlerts.make, make),
        eq(fitmentGapAlerts.model, model),
        trim 
          ? eq(fitmentGapAlerts.trim, trim)
          : sql`${fitmentGapAlerts.trim} IS NULL`,
        eq(fitmentGapAlerts.searchType, searchType),
        eq(fitmentGapAlerts.alertType, alertType),
        gte(fitmentGapAlerts.alertSentAt, cooldownCutoff)
      )
    )
    .limit(1);
  
  return recentAlerts.length > 0;
}

/**
 * Check if threshold alert was ever sent for this vehicle
 * (Threshold alerts should only be sent once when first crossed)
 */
export async function wasThresholdAlertEverSent(
  year: number,
  make: string,
  model: string,
  trim: string | null,
  searchType: string
): Promise<boolean> {
  const alerts = await db
    .select()
    .from(fitmentGapAlerts)
    .where(
      and(
        eq(fitmentGapAlerts.year, year),
        eq(fitmentGapAlerts.make, make),
        eq(fitmentGapAlerts.model, model),
        trim 
          ? eq(fitmentGapAlerts.trim, trim)
          : sql`${fitmentGapAlerts.trim} IS NULL`,
        eq(fitmentGapAlerts.searchType, searchType),
        eq(fitmentGapAlerts.alertType, "threshold_crossed")
      )
    )
    .limit(1);
  
  return alerts.length > 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECORD ALERT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Record that an alert was sent
 */
export async function recordAlert(
  context: AlertContext,
  alertType: AlertType,
  emailId?: string,
  emailStatus: string = "sent"
): Promise<void> {
  await db.insert(fitmentGapAlerts).values({
    year: context.year,
    make: context.make,
    model: context.model,
    trim: context.trim,
    searchType: context.searchType,
    alertType,
    occurrenceCountAtAlert: context.occurrenceCount,
    priorityScoreAtAlert: context.priorityScore ? Math.round(context.priorityScore) : null,
    emailId,
    emailStatus,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL SENDING (using Resend)
// ═══════════════════════════════════════════════════════════════════════════════

interface EmailResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

/**
 * Send alert email via Resend
 */
async function sendAlertEmail(
  subject: string,
  htmlBody: string,
  textBody: string
): Promise<EmailResult> {
  const config = getAlertConfig();
  
  if (!config.resendApiKey) {
    console.warn("[gapAlerts] No RESEND_API_KEY configured, skipping email");
    return { success: false, error: "No API key configured" };
  }
  
  if (!config.recipientEmail) {
    console.warn("[gapAlerts] No FITMENT_GAP_ALERT_EMAIL configured, skipping email");
    return { success: false, error: "No recipient configured" };
  }
  
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.fromEmail,
        to: config.recipientEmail,
        subject,
        html: htmlBody,
        text: textBody,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[gapAlerts] Resend API error:", errorText);
      return { success: false, error: errorText };
    }
    
    const data = await response.json();
    console.log("[gapAlerts] Email sent successfully:", data.id);
    return { success: true, emailId: data.id };
  } catch (err: any) {
    console.error("[gapAlerts] Failed to send email:", err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

function formatVehicleForEmail(context: AlertContext): { html: string; text: string } {
  const vehicleLabel = `${context.year} ${context.make} ${context.model}${context.trim ? ` ${context.trim}` : ""}`;
  const priorityBadge = context.priorityScore && context.priorityScore >= 10 
    ? "🔴 HIGH PRIORITY" 
    : context.priorityScore && context.priorityScore >= 5 
      ? "🟡 MEDIUM"
      : "";
  
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 16px;">
        <h2 style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 18px;">
          ${vehicleLabel}
        </h2>
        ${priorityBadge ? `<span style="background: ${context.priorityScore! >= 10 ? '#dc2626' : '#ca8a04'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${priorityBadge}</span>` : ""}
      </div>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #666; width: 140px;">Search Type:</td>
          <td style="padding: 8px 0; color: #1a1a1a; font-weight: 500;">${context.searchType}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Occurrence Count:</td>
          <td style="padding: 8px 0; color: #1a1a1a; font-weight: 500;">${context.occurrenceCount}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">First Seen:</td>
          <td style="padding: 8px 0; color: #1a1a1a;">${context.firstSeen.toISOString().split('T')[0]}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Last Seen:</td>
          <td style="padding: 8px 0; color: #1a1a1a;">${context.lastSeen.toISOString().split('T')[0]}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Source:</td>
          <td style="padding: 8px 0; color: #1a1a1a;">${context.source}</td>
        </tr>
        ${context.priorityScore ? `
        <tr>
          <td style="padding: 8px 0; color: #666;">Priority Score:</td>
          <td style="padding: 8px 0; color: #1a1a1a; font-weight: 500;">${context.priorityScore.toFixed(1)}</td>
        </tr>
        ` : ""}
        ${context.samplePaths && context.samplePaths.length > 0 ? `
        <tr>
          <td style="padding: 8px 0; color: #666; vertical-align: top;">Sample URL:</td>
          <td style="padding: 8px 0; color: #1a1a1a; word-break: break-all;">
            <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 12px;">${context.samplePaths[0]}</code>
          </td>
        </tr>
        ` : ""}
      </table>
    </div>
  `;
  
  const text = `
${vehicleLabel}${priorityBadge ? ` [${priorityBadge}]` : ""}

Search Type: ${context.searchType}
Occurrence Count: ${context.occurrenceCount}
First Seen: ${context.firstSeen.toISOString().split('T')[0]}
Last Seen: ${context.lastSeen.toISOString().split('T')[0]}
Source: ${context.source}
${context.priorityScore ? `Priority Score: ${context.priorityScore.toFixed(1)}` : ""}
${context.samplePaths && context.samplePaths.length > 0 ? `Sample URL: ${context.samplePaths[0]}` : ""}
  `.trim();
  
  return { html, text };
}

function buildNewVehicleEmail(context: AlertContext): { subject: string; html: string; text: string } {
  const vehicleLabel = `${context.year} ${context.make} ${context.model}`;
  const formatted = formatVehicleForEmail(context);
  
  return {
    subject: `🆕 New Fitment Gap: ${vehicleLabel}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">New Fitment Gap Detected</h1>
        <p style="color: #666; margin-bottom: 24px;">A customer searched for a vehicle not in your fitment database.</p>
        ${formatted.html}
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <a href="https://shop.warehousetiredirect.com/api/admin/fitment-gaps?report=top" 
             style="background: #1a1a1a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
            View All Gaps
          </a>
        </div>
      </div>
    `,
    text: `NEW FITMENT GAP DETECTED\n\nA customer searched for a vehicle not in your fitment database.\n\n${formatted.text}\n\nView all gaps: https://shop.warehousetiredirect.com/api/admin/fitment-gaps?report=top`,
  };
}

function buildThresholdEmail(context: AlertContext, threshold: number): { subject: string; html: string; text: string } {
  const vehicleLabel = `${context.year} ${context.make} ${context.model}`;
  const formatted = formatVehicleForEmail(context);
  
  return {
    subject: `📈 Fitment Gap Trending: ${vehicleLabel} (${context.occurrenceCount} searches)`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">Fitment Gap Crossed Threshold</h1>
        <p style="color: #666; margin-bottom: 24px;">This vehicle has been searched <strong>${context.occurrenceCount} times</strong> (threshold: ${threshold}). Consider adding fitment data.</p>
        ${formatted.html}
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <a href="https://shop.warehousetiredirect.com/api/admin/fitment-gaps?report=priority" 
             style="background: #1a1a1a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
            View Priority Gaps
          </a>
        </div>
      </div>
    `,
    text: `FITMENT GAP CROSSED THRESHOLD\n\nThis vehicle has been searched ${context.occurrenceCount} times (threshold: ${threshold}). Consider adding fitment data.\n\n${formatted.text}\n\nView priority gaps: https://shop.warehousetiredirect.com/api/admin/fitment-gaps?report=priority`,
  };
}

function buildHighPriorityEmail(context: AlertContext): { subject: string; html: string; text: string } {
  const vehicleLabel = `${context.year} ${context.make} ${context.model}`;
  const formatted = formatVehicleForEmail(context);
  
  return {
    subject: `🔴 HIGH PRIORITY Gap: ${vehicleLabel} (score: ${context.priorityScore?.toFixed(1)})`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <h1 style="color: #dc2626; font-size: 20px; margin: 0;">🔴 High Priority Fitment Gap</h1>
          <p style="color: #7f1d1d; margin: 8px 0 0 0;">This vehicle has high demand and recent activity. Prioritize adding fitment data.</p>
        </div>
        ${formatted.html}
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <a href="https://shop.warehousetiredirect.com/api/admin/fitment-gaps?report=priority" 
             style="background: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
            View All High Priority
          </a>
        </div>
      </div>
    `,
    text: `🔴 HIGH PRIORITY FITMENT GAP\n\nThis vehicle has high demand and recent activity. Prioritize adding fitment data.\n\n${formatted.text}\n\nView all high priority: https://shop.warehousetiredirect.com/api/admin/fitment-gaps?report=priority`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ALERT FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export interface CheckAlertResult {
  shouldAlert: boolean;
  alertType: AlertType | null;
  reason: string;
  alertSent: boolean;
  emailId?: string;
}

/**
 * Check if an alert should be sent and send it if appropriate.
 * 
 * This is called from logUnresolvedFitment after the record is created/updated.
 * 
 * Returns whether an alert was sent and why.
 */
export async function checkAndSendAlert(context: AlertContext): Promise<CheckAlertResult> {
  const config = getAlertConfig();
  
  // Check if alerts are enabled
  if (!config.enabled) {
    return { shouldAlert: false, alertType: null, reason: "Alerts disabled", alertSent: false };
  }
  
  if (!config.recipientEmail) {
    return { shouldAlert: false, alertType: null, reason: "No recipient email configured", alertSent: false };
  }
  
  const { year, make, model, trim, searchType, occurrenceCount, priorityScore, isNewVehicle, thresholdCrossed } = context;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 1: High priority alert (immediate, bypasses new vehicle alert)
  // ═══════════════════════════════════════════════════════════════════════════
  if (priorityScore && priorityScore >= config.highPriorityScore) {
    const recentlySent = await wasAlertRecentlySent(year, make, model, trim, searchType, "high_priority");
    if (!recentlySent) {
      const email = buildHighPriorityEmail(context);
      const result = await sendAlertEmail(email.subject, email.html, email.text);
      await recordAlert(context, "high_priority", result.emailId, result.success ? "sent" : "failed");
      
      return {
        shouldAlert: true,
        alertType: "high_priority",
        reason: `Priority score ${priorityScore.toFixed(1)} >= ${config.highPriorityScore}`,
        alertSent: result.success,
        emailId: result.emailId,
      };
    }
    return { shouldAlert: false, alertType: null, reason: "High priority alert recently sent (cooldown)", alertSent: false };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 2: Threshold crossed (one-time alert)
  // ═══════════════════════════════════════════════════════════════════════════
  if (thresholdCrossed && occurrenceCount >= config.threshold) {
    const everSent = await wasThresholdAlertEverSent(year, make, model, trim, searchType);
    if (!everSent) {
      const email = buildThresholdEmail(context, config.threshold);
      const result = await sendAlertEmail(email.subject, email.html, email.text);
      await recordAlert(context, "threshold_crossed", result.emailId, result.success ? "sent" : "failed");
      
      return {
        shouldAlert: true,
        alertType: "threshold_crossed",
        reason: `Occurrence count ${occurrenceCount} crossed threshold ${config.threshold}`,
        alertSent: result.success,
        emailId: result.emailId,
      };
    }
    return { shouldAlert: false, alertType: null, reason: "Threshold alert already sent for this vehicle", alertSent: false };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 3: New vehicle alert
  // ═══════════════════════════════════════════════════════════════════════════
  if (isNewVehicle) {
    // For new vehicles, we only send immediate alerts for potentially high-value vehicles
    // (newer model years, known makes). Otherwise, they go into the daily summary.
    const currentYear = new Date().getFullYear();
    const isRecentModelYear = year >= currentYear - 3;
    const isKnownMake = ["ford", "chevrolet", "toyota", "honda", "ram", "gmc", "jeep", "dodge", "nissan", "subaru", "mazda", "hyundai", "kia", "volkswagen", "bmw", "mercedes", "audi", "lexus", "acura", "tesla", "rivian", "lucid"].includes(make.toLowerCase());
    
    // Only send immediate alert for recent model years from known makes
    if (isRecentModelYear && isKnownMake) {
      const recentlySent = await wasAlertRecentlySent(year, make, model, trim, searchType, "new_vehicle");
      if (!recentlySent) {
        const email = buildNewVehicleEmail(context);
        const result = await sendAlertEmail(email.subject, email.html, email.text);
        await recordAlert(context, "new_vehicle", result.emailId, result.success ? "sent" : "failed");
        
        return {
          shouldAlert: true,
          alertType: "new_vehicle",
          reason: `New vehicle: ${year} model year, known make (${make})`,
          alertSent: result.success,
          emailId: result.emailId,
        };
      }
      return { shouldAlert: false, alertType: null, reason: "New vehicle alert recently sent (cooldown)", alertSent: false };
    }
    
    // For older/unknown vehicles, just log without immediate alert (will be in daily summary)
    return { shouldAlert: false, alertType: null, reason: "New vehicle logged (older model year or unknown make - daily summary only)", alertSent: false };
  }
  
  return { shouldAlert: false, alertType: null, reason: "No alert conditions met", alertSent: false };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY SUMMARY (called via cron or manual trigger)
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendDailySummary(): Promise<{ success: boolean; vehicleCount: number; emailId?: string }> {
  const config = getAlertConfig();
  
  if (!config.enabled || !config.recipientEmail) {
    return { success: false, vehicleCount: 0 };
  }
  
  // Get all new vehicles from the last 24 hours
  const { getRecentUnresolvedVehicles, getUnresolvedSummary } = await import("./unresolvedFitmentTracker");
  
  const recentVehicles = await getRecentUnresolvedVehicles({ sinceDays: 1, limit: 50 });
  const summary = await getUnresolvedSummary();
  
  if (recentVehicles.length === 0) {
    console.log("[gapAlerts] No new vehicles in last 24h, skipping daily summary");
    return { success: true, vehicleCount: 0 };
  }
  
  // Build summary email
  const vehicleRows = recentVehicles.map(v => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${v.searchType}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${v.occurrenceCount}</td>
    </tr>
  `).join("");
  
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">Daily Fitment Gap Summary</h1>
      <p style="color: #666; margin-bottom: 24px;">Here are the unresolved vehicle searches from the last 24 hours.</p>
      
      <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <div style="display: flex; gap: 24px;">
          <div>
            <div style="font-size: 24px; font-weight: bold; color: #1a1a1a;">${summary.lastWeekVehicles}</div>
            <div style="font-size: 12px; color: #666;">Vehicles (7d)</div>
          </div>
          <div>
            <div style="font-size: 24px; font-weight: bold; color: #1a1a1a;">${summary.lastWeekSearches}</div>
            <div style="font-size: 12px; color: #666;">Searches (7d)</div>
          </div>
          <div>
            <div style="font-size: 24px; font-weight: bold; color: #1a1a1a;">${summary.totalVehicles}</div>
            <div style="font-size: 12px; color: #666;">Total Gaps</div>
          </div>
        </div>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 8px; text-align: left;">Vehicle</th>
            <th style="padding: 8px; text-align: center;">Type</th>
            <th style="padding: 8px; text-align: center;">Searches</th>
          </tr>
        </thead>
        <tbody>
          ${vehicleRows}
        </tbody>
      </table>
      
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <a href="https://shop.warehousetiredirect.com/api/admin/fitment-gaps?report=summary" 
           style="background: #1a1a1a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
          View Full Report
        </a>
      </div>
    </div>
  `;
  
  const text = `DAILY FITMENT GAP SUMMARY\n\nVehicles (7d): ${summary.lastWeekVehicles}\nSearches (7d): ${summary.lastWeekSearches}\nTotal Gaps: ${summary.totalVehicles}\n\nRecent vehicles:\n${recentVehicles.map(v => `- ${v.year} ${v.make} ${v.model} (${v.occurrenceCount} searches)`).join("\n")}\n\nView full report: https://shop.warehousetiredirect.com/api/admin/fitment-gaps?report=summary`;
  
  const result = await sendAlertEmail(
    `📊 Daily Fitment Gap Summary: ${recentVehicles.length} new vehicles`,
    html,
    text
  );
  
  return {
    success: result.success,
    vehicleCount: recentVehicles.length,
    emailId: result.emailId,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN QUERY: Get alert history for a vehicle
// ═══════════════════════════════════════════════════════════════════════════════

export async function getAlertHistory(
  year: number,
  make: string,
  model: string,
  trim?: string
): Promise<FitmentGapAlert[]> {
  return db
    .select()
    .from(fitmentGapAlerts)
    .where(
      and(
        eq(fitmentGapAlerts.year, year),
        eq(fitmentGapAlerts.make, make.toLowerCase()),
        eq(fitmentGapAlerts.model, model.toLowerCase()),
        trim 
          ? eq(fitmentGapAlerts.trim, trim.toLowerCase())
          : sql`${fitmentGapAlerts.trim} IS NULL`
      )
    )
    .orderBy(desc(fitmentGapAlerts.alertSentAt));
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE CREATION SQL
// ═══════════════════════════════════════════════════════════════════════════════

export const createAlertsTableSQL = `
CREATE TABLE IF NOT EXISTS fitment_gap_alerts (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  search_type TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  alert_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  occurrence_count_at_alert INTEGER NOT NULL,
  priority_score_at_alert INTEGER,
  email_id TEXT,
  email_status TEXT
);

CREATE INDEX IF NOT EXISTS gap_alerts_vehicle_idx 
  ON fitment_gap_alerts (year, make, model, search_type);
CREATE INDEX IF NOT EXISTS gap_alerts_sent_at_idx 
  ON fitment_gap_alerts (alert_sent_at DESC);
`;

export default {
  checkAndSendAlert,
  sendDailySummary,
  getAlertHistory,
  getAlertConfig,
  wasAlertRecentlySent,
};
