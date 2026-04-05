/**
 * Abandoned Cart Email Service
 * 
 * 3-email recovery sequence:
 * - Email 1: 1 hour after abandonment
 * - Email 2: 24 hours after abandonment
 * - Email 3: 48 hours after abandonment
 * 
 * @created 2026-03-25
 * @updated 2026-04-03 - Full 3-email sequence with subscriber consent check
 */

import { Resend } from "resend";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/fitment-db/db";
import { abandonedCarts, emailSubscribers, type AbandonedCart } from "@/lib/fitment-db/schema";
import { eq, and, isNull, isNotNull, lt, or, sql, desc } from "drizzle-orm";

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

/** From email address */
const FROM_EMAIL = process.env.EMAIL_FROM || "orders@warehousetiredirect.com";

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
// Resend Client
// ============================================================================

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[abandonedCartEmail] RESEND_API_KEY not configured");
    return null;
  }
  return new Resend(apiKey);
}

// ============================================================================
// Consent Checking
// ============================================================================

/**
 * Check if an email has marketing consent
 * Returns true if:
 * - Email exists in email_subscribers with marketing_consent=true and unsubscribed=false
 * - OR email was captured via cart_save/exit_intent (implies consent to recover cart)
 */
async function hasEmailConsent(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check email_subscribers
  const [subscriber] = await db
    .select()
    .from(emailSubscribers)
    .where(
      and(
        eq(emailSubscribers.email, normalizedEmail),
        eq(emailSubscribers.unsubscribed, false),
        or(
          eq(emailSubscribers.marketingConsent, true),
          // Cart recovery sources imply consent for recovery emails
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

/** Direct recovery link (for display/fallback) */
export function generateRecoveryLink(cartId: string): string {
  return `${BASE_URL}/cart/recover/${encodeURIComponent(cartId)}`;
}

/** Tracked click link (records click event before redirecting to recovery) */
export function generateTrackedClickLink(cartId: string): string {
  return `${BASE_URL}/api/email/track/click/${encodeURIComponent(cartId)}`;
}

/** Tracking pixel URL (1x1 GIF that records open event) */
export function generateTrackingPixelUrl(cartId: string): string {
  return `${BASE_URL}/api/email/track/open/${encodeURIComponent(cartId)}`;
}

/** HTML for tracking pixel (invisible 1x1 image) */
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
  const recoveryLink = generateTrackedClickLink(cart.cartId); // Use tracked link
  const trackingPixel = generateTrackingPixelHtml(cart.cartId);
  const customerName = cart.customerFirstName || null;
  
  const vehicleLabel = cart.vehicleYear && cart.vehicleMake
    ? `${cart.vehicleYear} ${cart.vehicleMake} ${cart.vehicleModel || ""}${cart.vehicleTrim ? ` ${cart.vehicleTrim}` : ""}`.trim()
    : null;

  const items = Array.isArray(cart.items) ? cart.items : [];
  const { wheels, tires, accessories } = getItemSummary(items);
  const totalValue = Number(cart.estimatedTotal) || 0;

  const greeting = customerName ? `Hey ${customerName},` : "Hey there,";

  // Step-specific content
  const content: Record<EmailStep, { headline: string; intro: string; urgency: string }> = {
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

  const { headline, intro, urgency } = content[step];

  // Build items HTML
  let itemsHtml = "";
  
  if (wheels.length > 0) {
    const w = wheels[0];
    itemsHtml += `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
          <div style="display: flex; gap: 12px;">
            ${w.imageUrl ? `<img src="${w.imageUrl}" alt="${w.model}" style="width: 60px; height: 60px; object-fit: contain; border-radius: 8px; background: #f3f4f6;">` : ""}
            <div>
              <div style="font-weight: 600; color: #1f2937;">${w.brand} ${w.model}</div>
              <div style="font-size: 14px; color: #6b7280;">${w.diameter}" × ${w.width}" • Qty: ${w.quantity}</div>
              <div style="font-weight: 600; color: #dc2626;">${formatMoney(w.unitPrice * w.quantity)}</div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  if (tires.length > 0) {
    const t = tires[0];
    itemsHtml += `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
          <div style="display: flex; gap: 12px;">
            ${t.imageUrl ? `<img src="${t.imageUrl}" alt="${t.model}" style="width: 60px; height: 60px; object-fit: contain; border-radius: 8px; background: #f3f4f6;">` : ""}
            <div>
              <div style="font-weight: 600; color: #1f2937;">${t.brand} ${t.model}</div>
              <div style="font-size: 14px; color: #6b7280;">${t.size} • Qty: ${t.quantity}</div>
              <div style="font-weight: 600; color: #dc2626;">${formatMoney(t.unitPrice * t.quantity)}</div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  if (accessories.length > 0) {
    const accNames = accessories.map((a: any) => a.name).join(", ");
    itemsHtml += `
      <tr>
        <td style="padding: 12px 0;">
          <div style="font-size: 14px; color: #6b7280;">+ ${accNames}</div>
        </td>
      </tr>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline} - ${BRAND.name}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">

  <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: #dc2626; padding: 24px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px;">${BRAND.name}</h1>
    </div>

    <!-- Content -->
    <div style="padding: 32px;">
      
      <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 22px;">${headline}</h2>
      
      <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px;">
        ${greeting}<br><br>
        ${intro}
      </p>

      ${urgency ? `
      <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
        <div style="font-weight: 600; color: #92400e;">${urgency}</div>
      </div>
      ` : ""}

      ${vehicleLabel ? `
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Your Vehicle</div>
        <div style="font-size: 18px; font-weight: 600; color: #1f2937;">🚗 ${vehicleLabel}</div>
      </div>
      ` : ""}

      <!-- Cart Items -->
      <div style="background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="font-weight: 600; color: #1f2937; margin-bottom: 12px;">Your Package</div>
        <table style="width: 100%; border-collapse: collapse;">
          ${itemsHtml}
        </table>
        <div style="padding-top: 16px; border-top: 2px solid #e5e7eb; margin-top: 12px;">
          <span style="color: #6b7280;">Total:</span>
          <span style="font-size: 24px; font-weight: 700; color: #dc2626; float: right;">${formatMoney(totalValue)}</span>
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${recoveryLink}" 
           style="display: inline-block; background: #dc2626; color: white; padding: 16px 48px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 18px;">
          Complete My Order
        </a>
      </div>

      <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px; text-align: center;">
        ✓ Click to restore your cart — all items saved
      </p>

      <!-- Price Match -->
      <div style="background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 16px; margin-top: 24px;">
        <div style="font-weight: 600; color: #1e40af; margin-bottom: 4px;">💰 Price Match Guarantee</div>
        <div style="font-size: 14px; color: #1e3a8a;">
          Found it cheaper elsewhere? Reply to this email with the link and we'll take a look.
        </div>
      </div>

    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
        Questions? Reply to this email or call ${BRAND.phone.callDisplay}
      </p>
      <p style="margin: 0 0 16px; color: #9ca3af; font-size: 12px;">
        ${BRAND.name}
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 11px;">
        <a href="${BASE_URL}/unsubscribe?email=${encodeURIComponent(cart.customerEmail || "")}" style="color: #9ca3af;">Unsubscribe</a>
      </p>
    </div>

  </div>

  <!-- Email open tracking pixel -->
  ${trackingPixel}

</body>
</html>
  `.trim();
}

// ============================================================================
// Email Sending
// ============================================================================

/**
 * Send recovery email for a specific cart
 */
export async function sendRecoveryEmail(
  cart: AbandonedCart,
  step: EmailStep
): Promise<EmailResult> {
  const cartId = cart.cartId;

  // Skip test data
  if (cart.isTest) {
    return { success: false, cartId, step, action: "skipped", reason: "test_data" };
  }

  // Validation
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

  // Check consent
  const hasConsent = await hasEmailConsent(cart.customerEmail);
  if (!hasConsent) {
    return { success: false, cartId, step, action: "skipped", reason: "no_consent" };
  }

  // Check cooldown
  const lastEmailAt = cart.thirdEmailSentAt || cart.secondEmailSentAt || cart.firstEmailSentAt;
  if (lastEmailAt) {
    const hoursSinceLastEmail = (Date.now() - new Date(lastEmailAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastEmail < EMAIL_COOLDOWN_HOURS) {
      return { success: false, cartId, step, action: "skipped", reason: "cooldown" };
    }
  }

  const subject = buildSubject(cart, step);
  const html = buildEmailHtml(cart, step);

  // Safe mode
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

  const resend = getResendClient();
  if (!resend) {
    return { success: false, cartId, step, action: "skipped", reason: "resend_not_configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `${BRAND.name} <${FROM_EMAIL}>`,
      to: cart.customerEmail,
      subject,
      html,
      replyTo: BRAND.email,
    });

    if (error) {
      console.error(`[abandonedCartEmail] Resend error:`, error);
      await updateEmailTracking(cartId, step, "failed");
      return { success: false, cartId, step, action: "skipped", reason: error.message };
    }

    console.log(`[abandonedCartEmail] Sent ${step} to ${cart.customerEmail}, id: ${data?.id}`);
    await updateEmailTracking(cartId, step, "sent");

    return { success: true, cartId, step, action: "sent", messageId: data?.id };
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
  let prevSentRequired = false;

  if (step === "first") {
    sentAtColumn = abandonedCarts.firstEmailSentAt;
    prevSentRequired = false;
  } else if (step === "second") {
    sentAtColumn = abandonedCarts.secondEmailSentAt;
    prevSentRequired = true;
  } else {
    sentAtColumn = abandonedCarts.thirdEmailSentAt;
    prevSentRequired = true;
  }

  const conditions = [
    eq(abandonedCarts.status, "abandoned"),
    isNotNull(abandonedCarts.customerEmail),
    isNull(sentAtColumn),
    lt(abandonedCarts.abandonedAt, cutoffTime),
    eq(abandonedCarts.unsubscribed, false),
    // Exclude test data from recovery emails
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

/**
 * Process all pending emails
 */
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

/**
 * Get email status for a cart
 */
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

  // Determine next email
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

/**
 * Mark cart recovered after email
 */
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
