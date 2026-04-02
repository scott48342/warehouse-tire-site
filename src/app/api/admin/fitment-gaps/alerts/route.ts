/**
 * Admin API: Fitment Gap Alerts
 * 
 * GET /api/admin/fitment-gaps/alerts
 *   - View alert history and status
 *   - Query params: limit, vehicle (Y/M/M format)
 * 
 * POST /api/admin/fitment-gaps/alerts
 *   - Trigger daily summary email manually
 *   - Body: { action: "daily_summary" }
 */

import { NextResponse } from "next/server";
import {
  getAlertHistory,
  sendDailySummary,
  getAlertConfig,
  fitmentGapAlerts,
} from "@/lib/fitment-db/gapAlerts";
import { db } from "@/lib/fitment-db/db";
import { desc, sql } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || "50")));
    const vehicle = url.searchParams.get("vehicle"); // Format: "2024/ford/f-150"
    
    const config = getAlertConfig();
    
    // If vehicle specified, get alerts for that specific vehicle
    if (vehicle) {
      const parts = vehicle.split("/");
      if (parts.length >= 3) {
        const [year, make, model] = parts;
        const trim = parts[3] || undefined;
        
        const alerts = await getAlertHistory(
          parseInt(year, 10),
          make,
          model,
          trim
        );
        
        return NextResponse.json({
          success: true,
          vehicle: { year, make, model, trim },
          alerts: alerts.map(a => ({
            alertType: a.alertType,
            sentAt: a.alertSentAt,
            occurrenceCount: a.occurrenceCountAtAlert,
            priorityScore: a.priorityScoreAtAlert,
            emailStatus: a.emailStatus,
            emailId: a.emailId,
          })),
          config: {
            enabled: config.enabled,
            threshold: config.threshold,
            cooldownHours: config.cooldownHours,
            highPriorityScore: config.highPriorityScore,
            recipientConfigured: !!config.recipientEmail,
          },
        });
      }
    }
    
    // Get recent alerts across all vehicles
    const recentAlerts = await db
      .select()
      .from(fitmentGapAlerts)
      .orderBy(desc(fitmentGapAlerts.alertSentAt))
      .limit(limit);
    
    // Get summary stats
    const [stats] = await db
      .select({
        totalAlerts: sql<number>`COUNT(*)`,
        newVehicleAlerts: sql<number>`COUNT(*) FILTER (WHERE alert_type = 'new_vehicle')`,
        thresholdAlerts: sql<number>`COUNT(*) FILTER (WHERE alert_type = 'threshold_crossed')`,
        highPriorityAlerts: sql<number>`COUNT(*) FILTER (WHERE alert_type = 'high_priority')`,
        last24h: sql<number>`COUNT(*) FILTER (WHERE alert_sent_at > NOW() - INTERVAL '24 hours')`,
        last7d: sql<number>`COUNT(*) FILTER (WHERE alert_sent_at > NOW() - INTERVAL '7 days')`,
      })
      .from(fitmentGapAlerts);
    
    return NextResponse.json({
      success: true,
      config: {
        enabled: config.enabled,
        threshold: config.threshold,
        cooldownHours: config.cooldownHours,
        highPriorityScore: config.highPriorityScore,
        recipientConfigured: !!config.recipientEmail,
        resendConfigured: !!config.resendApiKey,
      },
      stats: {
        totalAlerts: Number(stats?.totalAlerts) || 0,
        newVehicleAlerts: Number(stats?.newVehicleAlerts) || 0,
        thresholdAlerts: Number(stats?.thresholdAlerts) || 0,
        highPriorityAlerts: Number(stats?.highPriorityAlerts) || 0,
        last24h: Number(stats?.last24h) || 0,
        last7d: Number(stats?.last7d) || 0,
      },
      recentAlerts: recentAlerts.map(a => ({
        vehicle: `${a.year} ${a.make} ${a.model}${a.trim ? ` ${a.trim}` : ""}`,
        alertType: a.alertType,
        sentAt: a.alertSentAt,
        occurrenceCount: a.occurrenceCountAtAlert,
        priorityScore: a.priorityScoreAtAlert,
        emailStatus: a.emailStatus,
      })),
    });
  } catch (err: any) {
    console.error("[admin/fitment-gaps/alerts] GET error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;
    
    if (action === "daily_summary") {
      const config = getAlertConfig();
      
      if (!config.enabled) {
        return NextResponse.json({
          success: false,
          error: "Alerts are disabled. Set FITMENT_GAP_ALERTS_ENABLED=true",
        }, { status: 400 });
      }
      
      if (!config.recipientEmail) {
        return NextResponse.json({
          success: false,
          error: "No recipient email configured. Set FITMENT_GAP_ALERT_EMAIL",
        }, { status: 400 });
      }
      
      const result = await sendDailySummary();
      
      return NextResponse.json({
        success: result.success,
        vehicleCount: result.vehicleCount,
        emailId: result.emailId,
        message: result.vehicleCount > 0 
          ? `Daily summary sent with ${result.vehicleCount} vehicles`
          : "No new vehicles in last 24h, no email sent",
      });
    }
    
    if (action === "test") {
      // Send a test email to verify configuration
      const config = getAlertConfig();
      
      if (!config.resendApiKey) {
        return NextResponse.json({
          success: false,
          error: "RESEND_API_KEY not configured",
        }, { status: 400 });
      }
      
      if (!config.recipientEmail) {
        return NextResponse.json({
          success: false,
          error: "FITMENT_GAP_ALERT_EMAIL not configured",
        }, { status: 400 });
      }
      
      // Send test email
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.fromEmail,
          to: config.recipientEmail,
          subject: "🧪 Fitment Gap Alert Test",
          html: `
            <div style="font-family: -apple-system, sans-serif; padding: 20px;">
              <h1>Test Alert</h1>
              <p>If you're seeing this, your fitment gap alerts are configured correctly!</p>
              <p><strong>Configuration:</strong></p>
              <ul>
                <li>Alerts Enabled: ${config.enabled}</li>
                <li>Threshold: ${config.threshold}</li>
                <li>Cooldown: ${config.cooldownHours}h</li>
                <li>High Priority Score: ${config.highPriorityScore}</li>
              </ul>
            </div>
          `,
          text: "Test Alert - If you're seeing this, your fitment gap alerts are configured correctly!",
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({
          success: false,
          error: `Resend API error: ${errorText}`,
        }, { status: 500 });
      }
      
      const data = await response.json();
      return NextResponse.json({
        success: true,
        message: "Test email sent successfully",
        emailId: data.id,
      });
    }
    
    return NextResponse.json({
      success: false,
      error: `Unknown action: ${action}`,
      validActions: ["daily_summary", "test"],
    }, { status: 400 });
    
  } catch (err: any) {
    console.error("[admin/fitment-gaps/alerts] POST error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
