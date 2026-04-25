/**
 * First Order Discount Service
 * 
 * Generates, validates, and redeems single-use 10% discount codes
 * for first-time visitors.
 * 
 * @created 2026-04-25
 */

import { db } from "@/lib/fitment-db/db";
import { firstOrderDiscounts } from "@/lib/fitment-db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { Resend } from "resend";

// ============================================================================
// Constants
// ============================================================================

const DISCOUNT_PERCENT = 10;
const EXPIRY_HOURS = 48;
const CODE_PREFIX = "FIRST";

// ============================================================================
// Types
// ============================================================================

export interface GenerateDiscountResult {
  success: boolean;
  code?: string;
  expiresAt?: Date;
  error?: string;
  alreadyExists?: boolean;
}

export interface ValidateDiscountResult {
  valid: boolean;
  discountPercent?: number;
  code?: string;
  email?: string;
  error?: string;
  expired?: boolean;
  alreadyRedeemed?: boolean;
}

export interface RedeemDiscountResult {
  success: boolean;
  discountAmount?: number;
  error?: string;
}

// ============================================================================
// Code Generation
// ============================================================================

function generateCode(): string {
  // Generate a unique 8-char alphanumeric code
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I, O, 0, 1 for clarity
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${CODE_PREFIX}${code}`;
}

// ============================================================================
// Generate Discount
// ============================================================================

/**
 * Generate a new first-order discount code for an email.
 * Returns existing code if one already exists for this email.
 */
export async function generateDiscount(
  email: string,
  options?: {
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    source?: string;
  }
): Promise<GenerateDiscountResult> {
  const normalizedEmail = email.trim().toLowerCase();
  
  try {
    // Check if valid discount already exists for this email
    const existing = await db
      .select()
      .from(firstOrderDiscounts)
      .where(
        and(
          eq(firstOrderDiscounts.email, normalizedEmail),
          eq(firstOrderDiscounts.redeemed, false),
          gt(firstOrderDiscounts.expiresAt, new Date())
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      // Return existing valid code
      return {
        success: true,
        code: existing[0].code,
        expiresAt: existing[0].expiresAt,
        alreadyExists: true,
      };
    }
    
    // Check if email has already redeemed a first-order discount
    const redeemed = await db
      .select()
      .from(firstOrderDiscounts)
      .where(
        and(
          eq(firstOrderDiscounts.email, normalizedEmail),
          eq(firstOrderDiscounts.redeemed, true)
        )
      )
      .limit(1);
    
    if (redeemed.length > 0) {
      return {
        success: false,
        error: "This email has already used a first-order discount",
      };
    }
    
    // Generate new code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);
    
    await db.insert(firstOrderDiscounts).values({
      code,
      email: normalizedEmail,
      discountPercent: DISCOUNT_PERCENT.toString(),
      expiresAt,
      source: options?.source || "popup",
      sessionId: options?.sessionId,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent?.slice(0, 500),
    });
    
    return {
      success: true,
      code,
      expiresAt,
    };
  } catch (err) {
    console.error("[firstOrderService] generateDiscount error:", err);
    return {
      success: false,
      error: "Failed to generate discount code",
    };
  }
}

// ============================================================================
// Validate Discount
// ============================================================================

/**
 * Validate a discount code. Returns discount details if valid.
 */
export async function validateDiscount(code: string): Promise<ValidateDiscountResult> {
  const normalizedCode = code.trim().toUpperCase();
  
  try {
    const [discount] = await db
      .select()
      .from(firstOrderDiscounts)
      .where(eq(firstOrderDiscounts.code, normalizedCode))
      .limit(1);
    
    if (!discount) {
      return { valid: false, error: "Invalid discount code" };
    }
    
    if (discount.redeemed) {
      return { 
        valid: false, 
        error: "This discount has already been used",
        alreadyRedeemed: true,
      };
    }
    
    if (new Date() > discount.expiresAt) {
      return { 
        valid: false, 
        error: "This discount has expired",
        expired: true,
      };
    }
    
    return {
      valid: true,
      discountPercent: parseFloat(discount.discountPercent),
      code: discount.code,
      email: discount.email,
    };
  } catch (err) {
    console.error("[firstOrderService] validateDiscount error:", err);
    return { valid: false, error: "Failed to validate discount" };
  }
}

// ============================================================================
// Redeem Discount
// ============================================================================

/**
 * Mark a discount as redeemed. Call this when order is placed.
 */
export async function redeemDiscount(
  code: string,
  orderId: string,
  discountAmount: number
): Promise<RedeemDiscountResult> {
  const normalizedCode = code.trim().toUpperCase();
  
  try {
    // Validate first
    const validation = await validateDiscount(normalizedCode);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    // Mark as redeemed
    await db
      .update(firstOrderDiscounts)
      .set({
        redeemed: true,
        redeemedAt: new Date(),
        redeemedOrderId: orderId,
        redeemedAmount: discountAmount.toString(),
      })
      .where(eq(firstOrderDiscounts.code, normalizedCode));
    
    return { success: true, discountAmount };
  } catch (err) {
    console.error("[firstOrderService] redeemDiscount error:", err);
    return { success: false, error: "Failed to redeem discount" };
  }
}

// ============================================================================
// Check Email Eligibility
// ============================================================================

/**
 * Check if an email is eligible for first-order discount.
 * Returns false if they've already received/used a code.
 */
export async function isEmailEligible(email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  
  try {
    const existing = await db
      .select({ id: firstOrderDiscounts.id })
      .from(firstOrderDiscounts)
      .where(eq(firstOrderDiscounts.email, normalizedEmail))
      .limit(1);
    
    return existing.length === 0;
  } catch (err) {
    console.error("[firstOrderService] isEmailEligible error:", err);
    return true; // Default to eligible on error
  }
}

// ============================================================================
// Send Discount Email
// ============================================================================

/**
 * Send the discount code email to the customer.
 */
export async function sendDiscountEmail(
  email: string,
  code: string,
  expiresAt: Date
): Promise<{ success: boolean; error?: string }> {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.warn("[firstOrderService] RESEND_API_KEY not configured");
      return { success: false, error: "Email not configured" };
    }
    
    const resend = new Resend(resendKey);
    const fromEmail = process.env.RESEND_FROM || "Warehouse Tire <noreply@warehousetiredirect.com>";
    
    const hoursLeft = Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));
    
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Your 10% Warehouse Tire Direct Savings Is Ready 🎉",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #18181b 0%, #27272a 100%); border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">
        🎉 Your Savings Await!
      </h1>
      <p style="color: #a1a1aa; margin: 0; font-size: 16px;">
        Thanks for checking us out
      </p>
    </div>
    
    <!-- Body -->
    <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
      <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        We've created a special <strong>10% discount</strong> just for you. Use the code below at checkout to save on your first order.
      </p>
      
      <!-- Code Box -->
      <div style="background: #f4f4f5; border: 2px dashed #dc2626; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px 0;">
        <p style="color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">
          Your Discount Code
        </p>
        <p style="color: #18181b; font-size: 32px; font-weight: 700; letter-spacing: 3px; margin: 0; font-family: monospace;">
          ${code}
        </p>
      </div>
      
      <!-- Urgency -->
      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 0 8px 8px 0; margin: 0 0 24px 0;">
        <p style="color: #991b1b; font-size: 14px; margin: 0;">
          ⏰ <strong>Expires in ${hoursLeft} hours</strong> — Don't miss out!
        </p>
      </div>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin: 0 0 24px 0;">
        <a href="https://shop.warehousetiredirect.com?discount=${code}" 
           style="display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Shop Now & Save 10%
        </a>
      </div>
      
      <!-- Fine Print -->
      <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
        Single use only • Cannot be combined with other offers • Valid for ${hoursLeft} hours
      </p>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding: 24px 20px;">
      <p style="color: #71717a; font-size: 14px; margin: 0 0 8px 0;">
        Warehouse Tire Direct
      </p>
      <p style="color: #a1a1aa; font-size: 12px; margin: 0;">
        Pontiac & Waterford, MI • Free Shipping on $599+
      </p>
    </div>
  </div>
</body>
</html>
      `,
    });
    
    // Mark email as sent
    await db
      .update(firstOrderDiscounts)
      .set({ emailSentAt: new Date() })
      .where(eq(firstOrderDiscounts.code, code));
    
    return { success: true };
  } catch (err) {
    console.error("[firstOrderService] sendDiscountEmail error:", err);
    return { success: false, error: "Failed to send email" };
  }
}

// ============================================================================
// Get Discount by Code (for cart/checkout auto-apply)
// ============================================================================

/**
 * Get discount details by code. For internal use in cart/checkout.
 */
export async function getDiscountByCode(code: string) {
  const normalizedCode = code.trim().toUpperCase();
  
  try {
    const [discount] = await db
      .select()
      .from(firstOrderDiscounts)
      .where(eq(firstOrderDiscounts.code, normalizedCode))
      .limit(1);
    
    return discount || null;
  } catch (err) {
    console.error("[firstOrderService] getDiscountByCode error:", err);
    return null;
  }
}

// ============================================================================
// Exports
// ============================================================================

export const firstOrderService = {
  generateDiscount,
  validateDiscount,
  redeemDiscount,
  isEmailEligible,
  sendDiscountEmail,
  getDiscountByCode,
  DISCOUNT_PERCENT,
  EXPIRY_HOURS,
};

export default firstOrderService;
