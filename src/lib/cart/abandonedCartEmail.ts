/**
 * Abandoned Cart Email Service
 * 
 * 3-email recovery sequence:
 * - Email 1: 1 hour after abandonment
 * - Email 2: 24 hours after abandonment
 * - Email 3: 48 hours after abandonment
 * 
 * @created 2026-03-25
 * @updated 2026-04-29 - Unified professional email template
 */

import nodemailer from "nodemailer";
import pg from "pg";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/fitment-db/db";
import { abandonedCarts, emailSubscribers, type AbandonedCart } from "@/lib/fitment-db/schema";
import { eq, and, isNull, isNotNull, lt, or, sql, desc } from "drizzle-orm";
import {
  emailWrapper,
  infoBar,
  greeting,
  productCard,
  priceSummary,
  urgencyBox,
  infoBox,
  ctaButton,
  textSection,
  vehicleBox,
  footer,
  formatPrice,
  type PriceSummaryLine,
} from "@/lib/email/templates";

// ============================================================================
// Configuration
// ============================================================================

/** Safe mode: log instead of send */
export const EMAIL_SAFE_MODE = process.env.EMAIL_SAFE_MODE === "true";

/** Minimum cart value to send emails */
export const MIN_CART_VALUE_FOR_EMAIL = 50;

/** Email schedule (hours after abandonment) */
export const EMAIL_SCHEDULE = {
  first: 1,   // 1 hour
  second: 24, // 24 hours
  third: 48,  // 48 hours
};

/** Minimum hours between any emails to same cart */
const EMAIL_COOLDOWN_HOURS = 6;

/** Base URL for recovery links */
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://shop.warehousetiredirect.com";

// ============================================================================
// Types
// ============================================================================

export type EmailStep = "first" | "second" | "third";

export interface EmailResult {
  success: boolean;
  cartId: string;
  step: EmailStep;
  action: "sent" | "logged" | "skipped";
  reason?: string;
  messageId?: string;
}

export interface ProcessEmailsResult {
  processed: number;
  sent: number;
  logged: number;
  skipped: number;
  errors: number;
  results: EmailResult[];
}

export interface CartEmailStatus {
  cartId: string;
  email: string | null;
  hasConsent: boolean;
  emailsSent: number;
  firstSentAt: Date | null;
  secondSentAt: Date | null;
  thirdSentAt: Date | null;
  lastStatus: string | null;
  nextEmailDue: Date | null;
  nextEmailStep: EmailStep | null;
  canSendMore: boolean;
}

// ============================================================================
// SMTP Client (Office 365 via admin_settings)
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
  notifyEmail: string;
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
      notifyEmail: val.notifyEmail || "",
    };
  } catch (err) {
    console.error("[abandonedCartEmail] Failed to get email settings:", err);
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
// Consent Checking
// ============================================================================

async function hasEmailConsent(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();

  const [subscriber] = await db
    .select()
    .from(emailSubscribers)
    .where(
      and(
        eq(emailSubscribers.email, normalizedEmail),
        eq(emailSubscribers.unsubscribed, false),
        or(
          eq(emailSubscribers.marketingConsent, true),
          eq(emailSubscribers.source, "cart_save"),
          eq(emailSubscribers.source, "exit_intent"),
          eq(emailSubscribers.source, "checkout")
        )
      )
    )
    .limit(1);

  return !!subscriber;
}

// ============================================================================
// Tracking URLs
// ============================================================================

export function generateRecoveryLink(cartId: string): string {
  return `${BASE_URL}/cart/recover/${encodeURIComponent(cartId)}`;
}

export function generateTrackedClickLink(cartId: string): string {
  return `${BASE_URL}/api/email/track/click/${encodeURIComponent(cartId)}`;
}

export function generateTrackingPixelUrl(cartId: string): string {
  return `${BASE_URL}/api/email/track/open/${encodeURIComponent(cartId)}`;
}

export function generateTrackingPixelHtml(cartId: string): string {
  const url = generateTrackingPixelUrl(cartId);
  return `<img src="${url}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" />`;
}

// ============================================================================
// Helpers
// ============================================================================

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getItemSummary(items: any[]): { wheels: any[]; tires: any[]; accessories: any[] } {
  const wheels = items.filter(i => i.type === "wheel");
  const tires = items.filter(i => i.type === "tire");
  const accessories = items.filter(i => i.type === "accessory");
  return { wheels, tires, accessories };
}

// ============================================================================
// Subject Lines
// ============================================================================

function buildSubject(cart: AbandonedCart, step: EmailStep): string {
  const vehicle = cart.vehicleYear && cart.vehicleMake
    ? `${cart.vehicleYear} ${cart.vehicleMake} ${cart.vehicleModel || ""}`
    : null;

  const subjects: Record<EmailStep, string> = {
    first: vehicle 
      ? `Your ${vehicle} wheels are waiting` 
      : "You left something in your cart",
    second: vehicle
      ? `Still thinking about your ${vehicle}?`
      : "Your cart is about to expire",
    third: vehicle
      ? `Last chance: Your ${vehicle} package`
      : "Final reminder: Complete your order",
  };

  return subjects[step];
}

// ============================================================================
// Email Template
// ============================================================================

function buildEmailHtml(cart: AbandonedCart, step: EmailStep): string {
  const recoveryLink = generateTrackedClickLink(cart.cartId);
  const trackingPixel = generateTrackingPixelHtml(cart.cartId);
  const customerName = cart.customerFirstName || null;
  
  const vehicleLabel = cart.vehicleYear && cart.vehicleMake
    ? `${cart.vehicleYear} ${cart.vehicleMake} ${cart.vehicleModel || ""}${cart.vehicleTrim ? ` ${cart.vehicleTrim}` : ""}`.trim()
    : null;

  const items = Array.isArray(cart.items) ? cart.items : [];
  const { wheels, tires, accessories } = getItemSummary(items);
  const totalValue = Number(cart.estimatedTotal) || 0;

  // Step-specific content
  const contentByStep: Record<EmailStep, { headline: string; intro: string; urgency: string }> = {
    first: {
      headline: "You left something behind",
      intro: "We noticed you didn't finish checking out. No worries — your cart is saved and ready when you are.",
      urgency: "",
    },
    second: {
      headline: "Your cart is still waiting",
      intro: "Just a friendly reminder that your wheel and tire package is still in your cart. Prices and availability can change, so we wanted to make sure you don't miss out.",
      urgency: "⏰ Your items are reserved but may sell out",
    },
    third: {
      headline: "Last chance for your package",
      intro: "This is our final reminder. Your cart will expire soon, and we can't guarantee these prices or availability much longer.",
      urgency: "🔥 Final reminder — cart expires in 24 hours",
    },
  };

  const { headline, intro, urgency } = contentByStep[step];

  // Build product cards
  let productCards = "";

  if (wheels.length > 0) {
    const w = wheels[0];
    productCards += productCard({
      emoji: "🛞",
      sectionTitle: `Wheels — Qty ${w.quantity}`,
      imageUrl: w.imageUrl,
      title: `${w.brand || ""} ${w.model || ""}`.trim(),
      subtitle: `${w.diameter || ""}″ × ${w.width || ""}″`,
      totalPrice: w.unitPrice * w.quantity,
      unitPrice: w.unitPrice,
      quantity: w.quantity,
    });
  }

  if (tires.length > 0) {
    const t = tires[0];
    productCards += productCard({
      emoji: "🚗",
      sectionTitle: `Tires — Qty ${t.quantity}`,
      imageUrl: t.imageUrl,
      title: `${t.brand || ""} ${t.model || ""}`.trim(),
      subtitle: t.size || "",
      totalPrice: t.unitPrice * t.quantity,
      unitPrice: t.unitPrice,
      quantity: t.quantity,
    });
  }

  // Price summary
  const summaryLines: PriceSummaryLine[] = [];
  
  // Calculate parts total
  let partsTotal = 0;
  for (const w of wheels) partsTotal += (w.unitPrice || 0) * (w.quantity || 1);
  for (const t of tires) partsTotal += (t.unitPrice || 0) * (t.quantity || 1);
  for (const a of accessories) partsTotal += (a.unitPrice || 0) * (a.quantity || 1);

  if (partsTotal > 0) {
    summaryLines.push({ label: "Cart Subtotal", amount: partsTotal });
  }

  // Build content
  const content = `
    ${infoBar("Cart", cart.cartId.slice(0, 8).toUpperCase(), "Saved", new Date(cart.abandonedAt || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric" }))}
    ${greeting(customerName, intro)}
    ${urgency ? urgencyBox(urgency) : ""}
    ${vehicleLabel ? vehicleBox(vehicleLabel) : ""}
    ${productCards}
    ${accessories.length > 0 ? `
      <tr>
        <td style="padding: 0 40px 16px;">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">+ ${accessories.map((a: any) => a.name).join(", ")}</p>
        </td>
      </tr>
    ` : ""}
    ${priceSummary(summaryLines, "Estimated Total", totalValue)}
    ${textSection("Ready to get rolling? Click below to restore your cart — all items saved.", true)}
    ${ctaButton("Complete My Order", recoveryLink)}
    ${infoBox("💰 Price Match Guarantee", "Found it cheaper elsewhere? Reply to this email with the link and we'll take a look.")}
    ${footer({
      showPhone: true,
      unsubscribeUrl: `${BASE_URL}/unsubscribe?email=${encodeURIComponent(cart.customerEmail || "")}`,
      customText: "Questions? Reply to this email.",
    })}
    <tr><td>${trackingPixel}</td></tr>
  `;

  return emailWrapper({
    title: headline,
    previewText: vehicleLabel ? `Your ${vehicleLabel} package is waiting` : "Your cart is waiting",
    children: content,
  });
}

function buildEmailText(cart: AbandonedCart, step: EmailStep): string {
  const customerName = cart.customerFirstName || "there";
  const vehicleLabel = cart.vehicleYear && cart.vehicleMake
    ? `${cart.vehicleYear} ${cart.vehicleMake} ${cart.vehicleModel || ""}`.trim()
    : "";
  const totalValue = Number(cart.estimatedTotal) || 0;
  const recoveryLink = generateRecoveryLink(cart.cartId);

  const contentByStep: Record<EmailStep, string> = {
    first: "We noticed you didn't finish checking out. No worries — your cart is saved.",
    second: "Just a friendly reminder that your cart is still waiting. Prices can change!",
    third: "This is our final reminder. Your cart will expire soon.",
  };

  return `
${BRAND.name}
${"=".repeat(40)}

Hey ${customerName},

${contentByStep[step]}

${vehicleLabel ? `Vehicle: ${vehicleLabel}\n` : ""}
Estimated Total: ${formatMoney(totalValue)}

Complete your order: ${recoveryLink}

Questions? Reply to this email or call ${BRAND.phone?.callDisplay || "us"}.

${BRAND.name}
  `.trim();
}

// ============================================================================
// Email Sending
// ============================================================================

export async function sendRecoveryEmail(
  cart: AbandonedCart,
  step: EmailStep
): Promise<EmailResult> {
  const cartId = cart.cartId;

  if (cart.isTest) {
    return { success: false, cartId, step, action: "skipped", reason: "test_data" };
  }

  if (!cart.customerEmail) {
    return { success: false, cartId, step, action: "skipped", reason: "no_email" };
  }

  if (cart.status === "recovered") {
    return { success: false, cartId, step, action: "skipped", reason: "already_recovered" };
  }

  if (cart.unsubscribed) {
    return { success: false, cartId, step, action: "skipped", reason: "unsubscribed" };
  }

  const cartValue = Number(cart.estimatedTotal) || 0;
  if (cartValue < MIN_CART_VALUE_FOR_EMAIL) {
    return { success: false, cartId, step, action: "skipped", reason: "below_min_value" };
  }

  const hasConsent = await hasEmailConsent(cart.customerEmail);
  if (!hasConsent) {
    return { success: false, cartId, step, action: "skipped", reason: "no_consent" };
  }

  const lastEmailAt = cart.thirdEmailSentAt || cart.secondEmailSentAt || cart.firstEmailSentAt;
  if (lastEmailAt) {
    const hoursSinceLastEmail = (Date.now() - new Date(lastEmailAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastEmail < EMAIL_COOLDOWN_HOURS) {
      return { success: false, cartId, step, action: "skipped", reason: "cooldown" };
    }
  }

  const subject = buildSubject(cart, step);
  const html = buildEmailHtml(cart, step);
  const text = buildEmailText(cart, step);

  if (EMAIL_SAFE_MODE) {
    console.log("[abandonedCartEmail] SAFE_MODE - Would send email:");
    console.log(`  To: ${cart.customerEmail}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Step: ${step}`);
    console.log(`  Cart ID: ${cartId}`);
    console.log(`  Value: ${formatMoney(cartValue)}`);

    await updateEmailTracking(cartId, step, "logged");
    return { success: true, cartId, step, action: "logged", reason: "safe_mode" };
  }

  const settings = await getEmailSettings();
  if (!settings) {
    console.warn("[abandonedCartEmail] Email not configured in admin settings");
    return { success: false, cartId, step, action: "skipped", reason: "smtp_not_configured" };
  }

  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
    console.warn("[abandonedCartEmail] SMTP settings incomplete");
    return { success: false, cartId, step, action: "skipped", reason: "smtp_incomplete" };
  }

  try {
    const transporter = await getTransporter(settings);
    const fromAddress = `"${settings.fromName}" <${settings.fromEmail}>`;

    const result = await transporter.sendMail({
      from: fromAddress,
      to: cart.customerEmail,
      subject,
      html,
      text,
      replyTo: BRAND.email,
    });

    console.log(`[abandonedCartEmail] Sent ${step} to ${cart.customerEmail}, id: ${result.messageId}`);
    await updateEmailTracking(cartId, step, "sent");

    return { success: true, cartId, step, action: "sent", messageId: result.messageId };
  } catch (err: any) {
    console.error(`[abandonedCartEmail] Failed:`, err.message);
    await updateEmailTracking(cartId, step, "failed");
    return { success: false, cartId, step, action: "skipped", reason: err.message };
  }
}

async function updateEmailTracking(cartId: string, step: EmailStep, status: string): Promise<void> {
  const now = new Date();
  
  const updates: Record<string, any> = {
    emailSentCount: sql`${abandonedCarts.emailSentCount} + 1`,
    lastEmailStatus: status,
    updatedAt: now,
  };

  if (step === "first") updates.firstEmailSentAt = now;
  else if (step === "second") updates.secondEmailSentAt = now;
  else if (step === "third") updates.thirdEmailSentAt = now;

  await db.update(abandonedCarts).set(updates).where(eq(abandonedCarts.cartId, cartId));
}

// ============================================================================
// Batch Processing
// ============================================================================

async function findCartsForStep(step: EmailStep): Promise<AbandonedCart[]> {
  const hours = EMAIL_SCHEDULE[step];
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

  let sentAtColumn: any;

  if (step === "first") {
    sentAtColumn = abandonedCarts.firstEmailSentAt;
  } else if (step === "second") {
    sentAtColumn = abandonedCarts.secondEmailSentAt;
  } else {
    sentAtColumn = abandonedCarts.thirdEmailSentAt;
  }

  const conditions = [
    eq(abandonedCarts.status, "abandoned"),
    isNotNull(abandonedCarts.customerEmail),
    isNull(sentAtColumn),
    lt(abandonedCarts.abandonedAt, cutoffTime),
    eq(abandonedCarts.unsubscribed, false),
    eq(abandonedCarts.isTest, false),
  ];

  if (step === "second") {
    conditions.push(isNotNull(abandonedCarts.firstEmailSentAt));
  } else if (step === "third") {
    conditions.push(isNotNull(abandonedCarts.secondEmailSentAt));
  }

  return db
    .select()
    .from(abandonedCarts)
    .where(and(...conditions))
    .orderBy(desc(abandonedCarts.abandonedAt))
    .limit(50);
}

export async function findCartsForFirstEmail(): Promise<AbandonedCart[]> {
  return findCartsForStep("first");
}

export async function findCartsForSecondEmail(): Promise<AbandonedCart[]> {
  return findCartsForStep("second");
}

export async function findCartsForThirdEmail(): Promise<AbandonedCart[]> {
  return findCartsForStep("third");
}

export async function processAbandonedCartEmails(): Promise<ProcessEmailsResult> {
  const results: EmailResult[] = [];
  let sent = 0, logged = 0, skipped = 0, errors = 0;

  for (const step of ["first", "second", "third"] as EmailStep[]) {
    const carts = await findCartsForStep(step);
    console.log(`[abandonedCartEmail] Found ${carts.length} carts for ${step} email`);

    for (const cart of carts) {
      const result = await sendRecoveryEmail(cart, step);
      results.push(result);

      if (result.action === "sent") sent++;
      else if (result.action === "logged") logged++;
      else if (["no_email", "below_min_value", "cooldown", "no_consent"].includes(result.reason || "")) skipped++;
      else errors++;
    }
  }

  return { processed: results.length, sent, logged, skipped, errors, results };
}

// ============================================================================
// Status & Admin
// ============================================================================

export async function getCartEmailStatus(cartId: string): Promise<CartEmailStatus | null> {
  const [cart] = await db
    .select()
    .from(abandonedCarts)
    .where(eq(abandonedCarts.cartId, cartId))
    .limit(1);

  if (!cart) return null;

  const hasConsent = cart.customerEmail 
    ? await hasEmailConsent(cart.customerEmail)
    : false;

  let nextEmailStep: EmailStep | null = null;
  let nextEmailDue: Date | null = null;

  if (cart.status === "abandoned" && cart.customerEmail && !cart.unsubscribed && hasConsent) {
    const abandonedAt = cart.abandonedAt ? new Date(cart.abandonedAt).getTime() : 0;

    if (!cart.firstEmailSentAt) {
      nextEmailStep = "first";
      nextEmailDue = new Date(abandonedAt + EMAIL_SCHEDULE.first * 60 * 60 * 1000);
    } else if (!cart.secondEmailSentAt) {
      nextEmailStep = "second";
      nextEmailDue = new Date(abandonedAt + EMAIL_SCHEDULE.second * 60 * 60 * 1000);
    } else if (!cart.thirdEmailSentAt) {
      nextEmailStep = "third";
      nextEmailDue = new Date(abandonedAt + EMAIL_SCHEDULE.third * 60 * 60 * 1000);
    }
  }

  const canSendMore = cart.status === "abandoned" && 
    !cart.unsubscribed && 
    hasConsent && 
    !cart.thirdEmailSentAt;

  return {
    cartId: cart.cartId,
    email: cart.customerEmail,
    hasConsent,
    emailsSent: cart.emailSentCount || 0,
    firstSentAt: cart.firstEmailSentAt,
    secondSentAt: cart.secondEmailSentAt,
    thirdSentAt: cart.thirdEmailSentAt,
    lastStatus: cart.lastEmailStatus,
    nextEmailDue,
    nextEmailStep,
    canSendMore,
  };
}

export async function markRecoveredAfterEmail(cartId: string): Promise<void> {
  const [cart] = await db
    .select()
    .from(abandonedCarts)
    .where(eq(abandonedCarts.cartId, cartId))
    .limit(1);

  if (cart && (cart.firstEmailSentAt || cart.secondEmailSentAt || cart.thirdEmailSentAt)) {
    await db
      .update(abandonedCarts)
      .set({ recoveredAfterEmail: true, updatedAt: new Date() })
      .where(eq(abandonedCarts.cartId, cartId));
  }
}

// ============================================================================
// Exports
// ============================================================================

export const abandonedCartEmailService = {
  sendRecoveryEmail,
  processAbandonedCartEmails,
  findCartsForFirstEmail,
  findCartsForSecondEmail,
  findCartsForThirdEmail,
  generateRecoveryLink,
  getCartEmailStatus,
  markRecoveredAfterEmail,
  EMAIL_SAFE_MODE,
  EMAIL_SCHEDULE,
  MIN_CART_VALUE_FOR_EMAIL,
};

export default abandonedCartEmailService;
