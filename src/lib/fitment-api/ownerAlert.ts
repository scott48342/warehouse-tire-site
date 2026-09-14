/**
 * Fitment API — Owner Alert on New Access Request
 *
 * Notifies the shop owner (email + SMS) the moment a real API access request
 * comes in. Mirrors the proven delivery path used by abandonedCartAlerts.ts:
 * Gmail SMTP configured in admin_settings (key='email') + email-to-SMS gateway.
 * Falls back to Resend if SMTP is not enabled.
 *
 * Background: a real lead (Sunrise Auto Service, 2026-08-11, 10k–50k/mo tier)
 * sat unnoticed for 34 days because only the *applicant* got an email.
 *
 * @created 2026-09-14
 */

import nodemailer from "nodemailer";
import pg from "pg";
import { Resend } from "resend";
import { BRAND } from "@/lib/brand";

const { Pool } = pg;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://shop.warehousetiredirect.com";
const ADMIN_URL = `${BASE_URL}/admin/fitment-api`;

/** Plain-text SMS via carrier email gateways (same list as abandoned-cart alerts) */
const SMS_NOTIFY = (process.env.FITMENT_API_SMS_NOTIFY || "2484990359@tmomail.net")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export interface NewRequestAlertInput {
  requestId: string;
  name: string;
  email: string;
  company: string;
  website?: string;
  useCase: string;
  useCaseDetails?: string;
  expectedUsage?: string;
  spamScore?: number;
}

type EmailSettings = {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
  notifyEmail: string;
};

async function getEmailSettings(): Promise<EmailSettings | null> {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });
  try {
    const { rows } = await pool.query(`SELECT value FROM admin_settings WHERE key = 'email' LIMIT 1`);
    if (!rows.length) return null;
    const v = rows[0].value;
    return {
      enabled: !!v.enabled,
      smtpHost: v.smtpHost || "",
      smtpPort: parseInt(v.smtpPort, 10) || 587,
      smtpUser: v.smtpUser || "",
      smtpPass: v.smtpPass || "",
      fromEmail: v.fromEmail || "",
      fromName: v.fromName || BRAND.name,
      notifyEmail: v.notifyEmail || "",
    };
  } catch (err) {
    console.error("[fitment-api/ownerAlert] Failed to load email settings:", err);
    return null;
  } finally {
    await pool.end();
  }
}

const USAGE_TIER: Record<string, string> = {
  "< 10k": "Starter ($99)",
  "10k-50k": "Growth",
  "50k-100k": "Pro",
  "100k+": "Enterprise",
};

function buildSubject(r: NewRequestAlertInput): string {
  const tier = USAGE_TIER[r.expectedUsage || ""] || r.expectedUsage || "?";
  return `🔑 New Fitment API request — ${r.company} (${tier})`;
}

function buildSms(r: NewRequestAlertInput): string {
  const tier = USAGE_TIER[r.expectedUsage || ""] || r.expectedUsage || "?";
  // Carrier gateways truncate ~160 chars and mangle HTML — keep it plain and short
  return `FITMENT API LEAD: ${r.company} / ${r.name} / ${r.email} / ${tier}. Review: ${ADMIN_URL}`;
}

function buildHtml(r: NewRequestAlertInput): string {
  const esc = (s?: string) =>
    (s || "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tier = USAGE_TIER[r.expectedUsage || ""] || r.expectedUsage || "—";
  const site = r.website ? `<a href="${esc(r.website)}">${esc(r.website)}</a>` : "—";
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#222;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="margin:0 0 4px">New Fitment API access request</h2>
  <p style="margin:0 0 16px;color:#666">Submitted just now · <a href="${ADMIN_URL}">Open admin to approve →</a></p>
  <table style="border-collapse:collapse;width:100%">
    <tr><td style="padding:6px 8px;color:#666;width:140px">Company</td><td style="padding:6px 8px"><strong>${esc(r.company)}</strong></td></tr>
    <tr><td style="padding:6px 8px;color:#666">Contact</td><td style="padding:6px 8px">${esc(r.name)} &lt;<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>&gt;</td></tr>
    <tr><td style="padding:6px 8px;color:#666">Website</td><td style="padding:6px 8px">${site}</td></tr>
    <tr><td style="padding:6px 8px;color:#666">Use case</td><td style="padding:6px 8px">${esc(r.useCase)}</td></tr>
    <tr><td style="padding:6px 8px;color:#666">Expected volume</td><td style="padding:6px 8px"><strong>${esc(r.expectedUsage)}</strong> → ${tier}</td></tr>
    <tr><td style="padding:6px 8px;color:#666;vertical-align:top">Details</td><td style="padding:6px 8px;white-space:pre-wrap">${esc(r.useCaseDetails)}</td></tr>
    ${typeof r.spamScore === "number" ? `<tr><td style="padding:6px 8px;color:#666">Spam score</td><td style="padding:6px 8px">${r.spamScore} (passed)</td></tr>` : ""}
  </table>
  <p style="margin:20px 0 0"><a href="${ADMIN_URL}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Review &amp; approve</a></p>
  <p style="margin:24px 0 0;font-size:12px;color:#999">Request ID ${esc(r.requestId)} · Reply directly to this email to reach the applicant.</p>
</body></html>`;
}

// ============================================================================
// Paid subscriber alert (self-serve Stripe checkout)
// ============================================================================

export interface NewSubscriberAlertInput {
  name: string;
  email: string;
  company?: string;
  plan: string;
  planLabel: string; // e.g. "Growth ($249/mo)"
  apiKeyId: string;
  keyPrefix: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

function buildSubscriberSubject(s: NewSubscriberAlertInput): string {
  return `💰 New PAID Fitment API subscriber — ${s.company || s.name} (${s.planLabel})`;
}

function buildSubscriberSms(s: NewSubscriberAlertInput): string {
  return `FITMENT API PAID: ${s.company || s.name} / ${s.email} / ${s.planLabel}. Key auto-issued. ${ADMIN_URL}`;
}

function buildSubscriberHtml(s: NewSubscriberAlertInput): string {
  const esc = (v?: string) =>
    (v || "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const stripeBase = "https://dashboard.stripe.com";
  const custLink = s.stripeCustomerId
    ? `<a href="${stripeBase}/customers/${esc(s.stripeCustomerId)}">${esc(s.stripeCustomerId)}</a>`
    : "—";
  const subLink = s.stripeSubscriptionId
    ? `<a href="${stripeBase}/subscriptions/${esc(s.stripeSubscriptionId)}">${esc(s.stripeSubscriptionId)}</a>`
    : "—";
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#222;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="margin:0 0 4px">💰 New paid Fitment API subscriber</h2>
  <p style="margin:0 0 16px;color:#666">Paid via Stripe Checkout just now · API key was created and emailed automatically. Nothing to approve.</p>
  <table style="border-collapse:collapse;width:100%">
    <tr><td style="padding:6px 8px;color:#666;width:160px">Company</td><td style="padding:6px 8px"><strong>${esc(s.company || s.name)}</strong></td></tr>
    <tr><td style="padding:6px 8px;color:#666">Contact</td><td style="padding:6px 8px">${esc(s.name)} &lt;<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>&gt;</td></tr>
    <tr><td style="padding:6px 8px;color:#666">Plan</td><td style="padding:6px 8px"><strong>${esc(s.planLabel)}</strong></td></tr>
    <tr><td style="padding:6px 8px;color:#666">API key</td><td style="padding:6px 8px"><code>${esc(s.keyPrefix)}…</code> (id ${esc(s.apiKeyId)})</td></tr>
    <tr><td style="padding:6px 8px;color:#666">Stripe customer</td><td style="padding:6px 8px">${custLink}</td></tr>
    <tr><td style="padding:6px 8px;color:#666">Stripe subscription</td><td style="padding:6px 8px">${subLink}</td></tr>
  </table>
  <p style="margin:20px 0 0"><a href="${ADMIN_URL}" style="background:#16a34a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open Fitment API admin</a></p>
  <p style="margin:24px 0 0;font-size:12px;color:#999">Reply directly to this email to reach the subscriber.</p>
</body></html>`;
}

/**
 * Alert the owner about a new paid (Stripe) subscriber. Never throws.
 */
export async function sendOwnerNewSubscriberAlert(
  s: NewSubscriberAlertInput
): Promise<{ email: boolean; sms: boolean; via: "smtp" | "resend" | "none" }> {
  return deliverOwnerAlert({
    subject: buildSubscriberSubject(s),
    html: buildSubscriberHtml(s),
    sms: buildSubscriberSms(s),
    replyTo: s.email,
  });
}

// ============================================================================
// New access request alert (manual review path)
// ============================================================================

/**
 * Send owner alert. Never throws — request submission must not fail because
 * a notification did.
 */
export async function sendOwnerNewRequestAlert(
  r: NewRequestAlertInput
): Promise<{ email: boolean; sms: boolean; via: "smtp" | "resend" | "none" }> {
  return deliverOwnerAlert({
    subject: buildSubject(r),
    html: buildHtml(r),
    sms: buildSms(r),
    replyTo: r.email,
  });
}

// ============================================================================
// Shared transport: Gmail SMTP (admin_settings) → Resend fallback
// ============================================================================

async function deliverOwnerAlert(msg: {
  subject: string;
  html: string;
  sms: string;
  replyTo: string;
}): Promise<{ email: boolean; sms: boolean; via: "smtp" | "resend" | "none" }> {
  const result = { email: false, sms: false, via: "none" as "smtp" | "resend" | "none" };

  if (process.env.EMAIL_SAFE_MODE === "true") {
    console.log("[fitment-api/ownerAlert] SAFE MODE — would alert:", msg.subject);
    return { email: true, sms: true, via: "none" };
  }

  const settings = await getEmailSettings();

  // --- Primary: Gmail SMTP from admin_settings (proven path) ---
  if (settings?.enabled && settings.smtpHost && settings.smtpUser && settings.smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: settings.smtpPort === 465,
        auth: { user: settings.smtpUser, pass: settings.smtpPass },
      });
      const from = `"${settings.fromName}" <${settings.fromEmail || settings.smtpUser}>`;
      const to = settings.notifyEmail || settings.fromEmail || settings.smtpUser;

      await transporter.sendMail({
        from,
        to,
        replyTo: msg.replyTo,
        subject: msg.subject,
        html: msg.html,
      });
      result.email = true;
      result.via = "smtp";

      if (SMS_NOTIFY.length) {
        try {
          await transporter.sendMail({ from, to: SMS_NOTIFY, text: msg.sms });
          result.sms = true;
        } catch (smsErr) {
          console.error("[fitment-api/ownerAlert] SMS gateway send failed:", smsErr);
        }
      }
      return result;
    } catch (err) {
      console.error("[fitment-api/ownerAlert] SMTP send failed, trying Resend:", err);
    }
  }

  // --- Fallback: Resend ---
  const resendKey = process.env.RESEND_API_KEY;
  const fallbackTo = settings?.notifyEmail || process.env.FITMENT_API_OWNER_EMAIL || "scott@warehousetire.net";
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const from = process.env.FITMENT_API_EMAIL_FROM || process.env.EMAIL_FROM || "api@warehousetiredirect.com";
      await resend.emails.send({ from, to: fallbackTo, replyTo: msg.replyTo, subject: msg.subject, html: msg.html });
      result.email = true;
      result.via = "resend";
      if (SMS_NOTIFY.length) {
        try {
          await resend.emails.send({ from, to: SMS_NOTIFY, subject: "", text: msg.sms });
          result.sms = true;
        } catch (smsErr) {
          console.error("[fitment-api/ownerAlert] Resend SMS gateway send failed:", smsErr);
        }
      }
      return result;
    } catch (err) {
      console.error("[fitment-api/ownerAlert] Resend send failed:", err);
    }
  }

  console.error("[fitment-api/ownerAlert] No working email transport — owner NOT notified for", msg.replyTo);
  return result;
}
