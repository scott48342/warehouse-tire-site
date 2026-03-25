/**
 * Abandoned Cart Email Service
 * 
 * Sends recovery emails to customers who abandon their carts.
 * Uses Resend API for reliable email delivery.
 * 
 * @created 2026-03-25
 */

import { Resend } from "resend";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/fitment-db/db";
import { abandonedCarts, type AbandonedCart } from "@/lib/fitment-db/schema";
import { eq, and, isNull, isNotNull, lt, sql } from "drizzle-orm";

// ============================================================================
// Configuration
// ============================================================================

/** 
 * Safe mode: log emails instead of sending (for staging)
 * Set EMAIL_SAFE_MODE=true to enable safe mode
 * Default: false (production - actually sends emails)
 */
const EMAIL_SAFE_MODE = process.env.EMAIL_SAFE_MODE === "true";

/** Minimum cart value to send emails */
const MIN_CART_VALUE_FOR_EMAIL = 10;

/** Hours after abandonment to send first email */
const FIRST_EMAIL_DELAY_HOURS = 1;

/** Hours after abandonment to send second email */
const SECOND_EMAIL_DELAY_HOURS = 24;

/** Minimum hours between emails to same cart */
const EMAIL_COOLDOWN_HOURS = 12;

/** Base URL for recovery links */
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://shop.warehousetiredirect.com";

/** From email address */
const FROM_EMAIL = process.env.EMAIL_FROM || "orders@warehousetiredirect.com";

// ============================================================================
// Types
// ============================================================================

export interface EmailResult {
  success: boolean;
  cartId: string;
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
// Recovery Link
// ============================================================================

/**
 * Generate recovery link for a cart
 */
export function generateRecoveryLink(cartId: string): string {
  return `${BASE_URL}/cart/recover/${encodeURIComponent(cartId)}`;
}

// ============================================================================
// Email Template
// ============================================================================

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function buildEmailHtml(cart: AbandonedCart, isSecondEmail: boolean): string {
  const recoveryLink = generateRecoveryLink(cart.cartId);
  const customerName = cart.customerFirstName || "there";
  
  const vehicleLabel = cart.vehicleYear
    ? `${cart.vehicleYear} ${cart.vehicleMake} ${cart.vehicleModel}${cart.vehicleTrim ? ` ${cart.vehicleTrim}` : ""}`
    : null;

  const items = Array.isArray(cart.items) ? cart.items : [];
  const itemCount = cart.itemCount || items.length;
  const totalValue = Number(cart.estimatedTotal) || 0;

  const introText = isSecondEmail
    ? `We noticed you left some great items in your cart. They're still waiting for you!`
    : `Hey ${customerName}! Looks like you left some items in your cart. We've saved them for you.`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">

  <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: #dc2626; padding: 24px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px;">${BRAND.name}</h1>
    </div>

    <!-- Content -->
    <div style="padding: 32px;">
      
      <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 22px;">
        ${isSecondEmail ? "🛒 Your cart misses you!" : "🛒 You left something behind!"}
      </h2>
      
      <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px;">
        ${introText}
      </p>

      ${vehicleLabel ? `
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Your Vehicle</div>
        <div style="font-size: 18px; font-weight: 600; color: #1f2937;">🚗 ${vehicleLabel}</div>
      </div>
      ` : ""}

      <!-- Cart Summary -->
      <div style="background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <div style="margin-bottom: 12px;">
          <span style="color: #6b7280;">Items in cart:</span>
          <span style="font-weight: 600; color: #1f2937; float: right;">${itemCount} items</span>
        </div>
        <div style="padding-top: 12px; border-top: 1px solid #e5e7eb;">
          <span style="color: #6b7280;">Cart total:</span>
          <span style="font-size: 24px; font-weight: 700; color: #dc2626; float: right;">${formatMoney(totalValue)}</span>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${recoveryLink}" 
           style="display: inline-block; background: #dc2626; color: white; padding: 16px 48px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 18px;">
          Resume Your Order →
        </a>
      </div>

      <p style="margin: 24px 0 0; color: #9ca3af; font-size: 14px; text-align: center;">
        This link will restore your cart exactly as you left it.
      </p>

    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
        Questions? Reply to this email or call us at ${BRAND.phone.callDisplay}
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        ${BRAND.name}
      </p>
    </div>

  </div>

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
  isSecondEmail: boolean = false
): Promise<EmailResult> {
  const cartId = cart.cartId;

  // Validation checks
  if (!cart.customerEmail) {
    return { success: false, cartId, action: "skipped", reason: "no_email" };
  }

  if (cart.status === "recovered") {
    return { success: false, cartId, action: "skipped", reason: "already_recovered" };
  }

  if (cart.unsubscribed) {
    return { success: false, cartId, action: "skipped", reason: "unsubscribed" };
  }

  const cartValue = Number(cart.estimatedTotal) || 0;
  if (cartValue < MIN_CART_VALUE_FOR_EMAIL) {
    return { success: false, cartId, action: "skipped", reason: "below_min_value" };
  }

  // Check cooldown
  const lastEmailAt = cart.secondEmailSentAt || cart.firstEmailSentAt;
  if (lastEmailAt) {
    const hoursSinceLastEmail = (Date.now() - new Date(lastEmailAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastEmail < EMAIL_COOLDOWN_HOURS) {
      return { success: false, cartId, action: "skipped", reason: "cooldown" };
    }
  }

  // Build email content
  const subject = isSecondEmail
    ? `Still thinking it over? Your cart is waiting 🛞`
    : `Your cart is waiting 🛞`;
  const html = buildEmailHtml(cart, isSecondEmail);

  // Safe mode: log instead of send
  if (EMAIL_SAFE_MODE) {
    console.log("[abandonedCartEmail] SAFE_MODE - Would send email:");
    console.log(`  To: ${cart.customerEmail}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Cart ID: ${cartId}`);
    console.log(`  Value: ${formatMoney(cartValue)}`);
    console.log(`  Recovery Link: ${generateRecoveryLink(cartId)}`);

    await updateEmailSentTracking(cartId, isSecondEmail);
    return { success: true, cartId, action: "logged", reason: "safe_mode" };
  }

  // Get Resend client
  const resend = getResendClient();
  if (!resend) {
    return { success: false, cartId, action: "skipped", reason: "resend_not_configured" };
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
      console.error(`[abandonedCartEmail] Resend error for ${cart.customerEmail}:`, error);
      return { success: false, cartId, action: "skipped", reason: error.message };
    }

    console.log(`[abandonedCartEmail] Sent to ${cart.customerEmail}, id: ${data?.id}`);

    // Update tracking
    await updateEmailSentTracking(cartId, isSecondEmail);

    return { success: true, cartId, action: "sent", messageId: data?.id };
  } catch (err: any) {
    console.error(`[abandonedCartEmail] Failed to send to ${cart.customerEmail}:`, err.message);
    return { success: false, cartId, action: "skipped", reason: err.message };
  }
}

/**
 * Update email sent tracking in database
 */
async function updateEmailSentTracking(cartId: string, isSecondEmail: boolean): Promise<void> {
  const now = new Date();
  
  if (isSecondEmail) {
    await db
      .update(abandonedCarts)
      .set({
        secondEmailSentAt: now,
        emailSentCount: sql`${abandonedCarts.emailSentCount} + 1`,
        updatedAt: now,
      })
      .where(eq(abandonedCarts.cartId, cartId));
  } else {
    await db
      .update(abandonedCarts)
      .set({
        firstEmailSentAt: now,
        emailSentCount: sql`${abandonedCarts.emailSentCount} + 1`,
        updatedAt: now,
      })
      .where(eq(abandonedCarts.cartId, cartId));
  }
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Find carts that need first email (abandoned 1+ hours ago, no email sent)
 */
export async function findCartsForFirstEmail(): Promise<AbandonedCart[]> {
  const cutoffTime = new Date(Date.now() - FIRST_EMAIL_DELAY_HOURS * 60 * 60 * 1000);

  const carts = await db
    .select()
    .from(abandonedCarts)
    .where(
      and(
        eq(abandonedCarts.status, "abandoned"),
        isNotNull(abandonedCarts.customerEmail),
        isNull(abandonedCarts.firstEmailSentAt),
        lt(abandonedCarts.abandonedAt, cutoffTime)
      )
    )
    .limit(50);

  return carts;
}

/**
 * Find carts that need second email (abandoned 24+ hours ago, first email sent, no second)
 */
export async function findCartsForSecondEmail(): Promise<AbandonedCart[]> {
  const cutoffTime = new Date(Date.now() - SECOND_EMAIL_DELAY_HOURS * 60 * 60 * 1000);

  const carts = await db
    .select()
    .from(abandonedCarts)
    .where(
      and(
        eq(abandonedCarts.status, "abandoned"),
        isNotNull(abandonedCarts.customerEmail),
        isNotNull(abandonedCarts.firstEmailSentAt),
        isNull(abandonedCarts.secondEmailSentAt),
        lt(abandonedCarts.abandonedAt, cutoffTime)
      )
    )
    .limit(50);

  return carts;
}

/**
 * Process all pending abandoned cart emails
 */
export async function processAbandonedCartEmails(): Promise<ProcessEmailsResult> {
  const results: EmailResult[] = [];
  let sent = 0;
  let logged = 0;
  let skipped = 0;
  let errors = 0;

  // Process first emails
  const firstEmailCarts = await findCartsForFirstEmail();
  console.log(`[abandonedCartEmail] Found ${firstEmailCarts.length} carts needing first email`);

  for (const cart of firstEmailCarts) {
    const result = await sendRecoveryEmail(cart, false);
    results.push(result);
    
    if (result.action === "sent") sent++;
    else if (result.action === "logged") logged++;
    else if (result.action === "skipped") {
      if (result.reason && !["no_email", "below_min_value", "cooldown"].includes(result.reason)) {
        errors++;
      } else {
        skipped++;
      }
    }
  }

  // Process second emails
  const secondEmailCarts = await findCartsForSecondEmail();
  console.log(`[abandonedCartEmail] Found ${secondEmailCarts.length} carts needing second email`);

  for (const cart of secondEmailCarts) {
    const result = await sendRecoveryEmail(cart, true);
    results.push(result);
    
    if (result.action === "sent") sent++;
    else if (result.action === "logged") logged++;
    else if (result.action === "skipped") {
      if (result.reason && !["no_email", "below_min_value", "cooldown"].includes(result.reason)) {
        errors++;
      } else {
        skipped++;
      }
    }
  }

  return {
    processed: results.length,
    sent,
    logged,
    skipped,
    errors,
    results,
  };
}

/**
 * Mark cart as recovered after email (for tracking effectiveness)
 */
export async function markRecoveredAfterEmail(cartId: string): Promise<void> {
  const cart = await db.query.abandonedCarts.findFirst({
    where: eq(abandonedCarts.cartId, cartId),
  });

  if (cart && (cart.firstEmailSentAt || cart.secondEmailSentAt)) {
    await db
      .update(abandonedCarts)
      .set({
        recoveredAfterEmail: true,
        updatedAt: new Date(),
      })
      .where(eq(abandonedCarts.cartId, cartId));
  }
}

export const abandonedCartEmailService = {
  sendRecoveryEmail,
  processAbandonedCartEmails,
  findCartsForFirstEmail,
  findCartsForSecondEmail,
  generateRecoveryLink,
  markRecoveredAfterEmail,
  EMAIL_SAFE_MODE,
  FIRST_EMAIL_DELAY_HOURS,
  SECOND_EMAIL_DELAY_HOURS,
};

export default abandonedCartEmailService;
