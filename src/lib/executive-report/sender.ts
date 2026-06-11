/**
 * Executive Report Email Sender
 * 
 * Handles sending the executive report email with duplicate-send protection.
 * 
 * @created 2026-06-11
 */

import nodemailer from "nodemailer";
import { Pool } from "pg";
import { BRAND } from "../brand";
import { generateExecutiveReport, type ExecutiveReportData } from "./generator";
import { generateHtmlEmail, generatePlainTextEmail } from "./template";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface EmailSettings {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  reportDate?: string;
  recipient?: string;
  alreadySent?: boolean;
  dryRun?: boolean;
  data?: ExecutiveReportData;
  html?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

async function getEmailSettings(): Promise<EmailSettings | null> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows } = await client.query(
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
    console.error("[executive-report] Failed to get email settings:", err);
    return null;
  } finally {
    client.release();
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

// ═══════════════════════════════════════════════════════════════════════════════
// DUPLICATE SEND PROTECTION
// ═══════════════════════════════════════════════════════════════════════════════

async function ensureReportLogTable(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS executive_report_log (
        id SERIAL PRIMARY KEY,
        report_date DATE NOT NULL UNIQUE,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        recipient TEXT NOT NULL,
        message_id TEXT,
        success BOOLEAN NOT NULL DEFAULT TRUE,
        error TEXT
      )
    `);
  } finally {
    client.release();
  }
}

async function hasReportBeenSent(reportDate: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await ensureReportLogTable();
    const { rows } = await client.query(
      `SELECT id FROM executive_report_log WHERE report_date = $1 AND success = TRUE`,
      [reportDate]
    );
    return rows.length > 0;
  } finally {
    client.release();
  }
}

async function logReportSent(
  reportDate: string,
  recipient: string,
  messageId: string | null,
  success: boolean,
  error: string | null
): Promise<void> {
  const client = await pool.connect();
  try {
    await ensureReportLogTable();
    
    // Upsert: if report already logged (e.g., failed then retried), update it
    await client.query(`
      INSERT INTO executive_report_log (report_date, recipient, message_id, success, error, sent_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (report_date) 
      DO UPDATE SET 
        sent_at = NOW(),
        recipient = $2,
        message_id = COALESCE($3, executive_report_log.message_id),
        success = $4,
        error = $5
    `, [reportDate, recipient, messageId, success, error]);
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET LAST SUCCESSFUL SEND
// ═══════════════════════════════════════════════════════════════════════════════

export async function getLastSuccessfulSend(): Promise<{
  reportDate: string;
  sentAt: string;
  recipient: string;
} | null> {
  const client = await pool.connect();
  try {
    await ensureReportLogTable();
    const { rows } = await client.query(`
      SELECT report_date, sent_at, recipient 
      FROM executive_report_log 
      WHERE success = TRUE 
      ORDER BY sent_at DESC 
      LIMIT 1
    `);
    
    if (rows.length === 0) return null;
    
    return {
      reportDate: rows[0].report_date.toISOString().split('T')[0],
      sentAt: rows[0].sent_at.toISOString(),
      recipient: rows[0].recipient,
    };
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEND EXECUTIVE REPORT
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendExecutiveReport(options: {
  force?: boolean;
  dryRun?: boolean;
  testRecipient?: string;
} = {}): Promise<SendResult> {
  const { force = false, dryRun = false, testRecipient } = options;
  const startTime = Date.now();
  
  console.log(`[executive-report] Starting report generation (force=${force}, dryRun=${dryRun})`);
  
  // Get recipient
  const recipient = testRecipient || process.env.EXECUTIVE_REPORT_EMAIL_TO;
  if (!recipient) {
    console.error("[executive-report] No recipient configured");
    return { 
      success: false, 
      error: "No recipient configured. Set EXECUTIVE_REPORT_EMAIL_TO environment variable." 
    };
  }
  
  // Generate report data
  let data: ExecutiveReportData;
  try {
    data = await generateExecutiveReport();
    console.log(`[executive-report] Report data generated in ${Date.now() - startTime}ms`);
  } catch (err: any) {
    console.error("[executive-report] Failed to generate report data:", err);
    return { success: false, error: `Failed to generate report: ${err.message}` };
  }
  
  const reportDate = data.reportDate;
  
  // Check for duplicate send (unless forced or dry run)
  if (!force && !dryRun) {
    const alreadySent = await hasReportBeenSent(reportDate);
    if (alreadySent) {
      console.log(`[executive-report] Report for ${reportDate} already sent, skipping`);
      return { 
        success: true, 
        alreadySent: true, 
        reportDate,
        recipient,
      };
    }
  }
  
  // Generate email content
  const html = generateHtmlEmail(data);
  const text = generatePlainTextEmail(data);
  const subject = `${BRAND.name} Daily Report - ${new Date(reportDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  
  // Dry run: return data without sending
  if (dryRun) {
    console.log(`[executive-report] Dry run - not sending email`);
    return {
      success: true,
      dryRun: true,
      reportDate,
      recipient,
      data,
      html,
    };
  }
  
  // Get email settings
  const settings = await getEmailSettings();
  if (!settings) {
    console.error("[executive-report] Email not configured in admin settings");
    await logReportSent(reportDate, recipient, null, false, "Email not configured");
    return { success: false, error: "Email not configured in admin settings" };
  }
  
  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
    console.error("[executive-report] SMTP settings incomplete");
    await logReportSent(reportDate, recipient, null, false, "SMTP settings incomplete");
    return { success: false, error: "SMTP settings incomplete" };
  }
  
  // Send email
  try {
    const transporter = await getTransporter(settings);
    const fromAddress = `"${settings.fromName}" <${settings.fromEmail}>`;
    
    const result = await transporter.sendMail({
      from: fromAddress,
      to: recipient,
      subject,
      html,
      text,
    });
    
    const messageId = result.messageId;
    console.log(`[executive-report] Email sent successfully: ${messageId}`);
    
    // Log successful send
    await logReportSent(reportDate, recipient, messageId, true, null);
    
    return {
      success: true,
      messageId,
      reportDate,
      recipient,
    };
  } catch (err: any) {
    console.error("[executive-report] Failed to send email:", err);
    await logReportSent(reportDate, recipient, null, false, err.message);
    return { success: false, error: err.message, reportDate, recipient };
  }
}
