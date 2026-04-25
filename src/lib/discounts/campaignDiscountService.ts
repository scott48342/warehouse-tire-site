/**
 * Campaign Discount Service
 * 
 * Generate, validate, and redeem campaign-specific discount codes.
 * 
 * @created 2026-04-25
 */

import { db } from "@/lib/fitment-db/db";
import { campaignDiscounts } from "@/lib/fitment-db/schema-campaign-discounts";
import { eq, and, gt } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export interface GenerateCampaignDiscountResult {
  success: boolean;
  code?: string;
  expiresAt?: Date;
  error?: string;
}

export interface ValidateDiscountResult {
  valid: boolean;
  discountPercent?: number;
  code?: string;
  email?: string;
  campaignId?: string;
  error?: string;
  expired?: boolean;
  alreadyRedeemed?: boolean;
}

// ============================================================================
// Code Generation
// ============================================================================

function generateCampaignCode(prefix: string = "SAVE"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}${code}`;
}

// ============================================================================
// Generate Discount for Campaign Recipient
// ============================================================================

/**
 * Generate a unique discount code for a campaign recipient.
 * Called when sending campaign emails.
 */
export async function generateCampaignDiscount(
  campaignId: string,
  recipientId: string,
  email: string,
  options: {
    discountPercent: number;
    expiryHours: number;
    codePrefix?: string;
  }
): Promise<GenerateCampaignDiscountResult> {
  const normalizedEmail = email.trim().toLowerCase();
  
  try {
    // Check if code already exists for this recipient
    const existing = await db
      .select()
      .from(campaignDiscounts)
      .where(
        and(
          eq(campaignDiscounts.campaignId, campaignId),
          eq(campaignDiscounts.email, normalizedEmail)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      return {
        success: true,
        code: existing[0].code,
        expiresAt: existing[0].expiresAt,
      };
    }
    
    // Generate unique code
    const code = generateCampaignCode(options.codePrefix || "SAVE");
    const expiresAt = new Date(Date.now() + options.expiryHours * 60 * 60 * 1000);
    
    await db.insert(campaignDiscounts).values({
      campaignId,
      recipientId,
      code,
      email: normalizedEmail,
      discountPercent: options.discountPercent.toString(),
      expiresAt,
    });
    
    return {
      success: true,
      code,
      expiresAt,
    };
  } catch (err) {
    console.error("[campaignDiscountService] generateCampaignDiscount error:", err);
    return {
      success: false,
      error: "Failed to generate discount code",
    };
  }
}

// ============================================================================
// Validate Campaign Discount
// ============================================================================

/**
 * Validate a campaign discount code.
 */
export async function validateCampaignDiscount(code: string): Promise<ValidateDiscountResult> {
  const normalizedCode = code.trim().toUpperCase();
  
  try {
    const [discount] = await db
      .select()
      .from(campaignDiscounts)
      .where(eq(campaignDiscounts.code, normalizedCode))
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
      campaignId: discount.campaignId,
    };
  } catch (err) {
    console.error("[campaignDiscountService] validateCampaignDiscount error:", err);
    return { valid: false, error: "Failed to validate discount" };
  }
}

// ============================================================================
// Redeem Campaign Discount
// ============================================================================

/**
 * Mark a campaign discount as redeemed.
 */
export async function redeemCampaignDiscount(
  code: string,
  orderId: string,
  discountAmount: number
): Promise<{ success: boolean; error?: string }> {
  const normalizedCode = code.trim().toUpperCase();
  
  try {
    const validation = await validateCampaignDiscount(normalizedCode);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    await db
      .update(campaignDiscounts)
      .set({
        redeemed: true,
        redeemedAt: new Date(),
        redeemedOrderId: orderId,
        redeemedAmount: discountAmount.toString(),
      })
      .where(eq(campaignDiscounts.code, normalizedCode));
    
    return { success: true };
  } catch (err) {
    console.error("[campaignDiscountService] redeemCampaignDiscount error:", err);
    return { success: false, error: "Failed to redeem discount" };
  }
}

// ============================================================================
// Track Click
// ============================================================================

/**
 * Track when a discount link is clicked in email.
 */
export async function trackDiscountClick(code: string): Promise<void> {
  const normalizedCode = code.trim().toUpperCase();
  
  try {
    await db
      .update(campaignDiscounts)
      .set({
        clicked: true,
        clickedAt: new Date(),
      })
      .where(
        and(
          eq(campaignDiscounts.code, normalizedCode),
          eq(campaignDiscounts.clicked, false)
        )
      );
  } catch (err) {
    console.error("[campaignDiscountService] trackDiscountClick error:", err);
  }
}

// ============================================================================
// Get Campaign Discount Stats
// ============================================================================

/**
 * Get discount stats for a campaign.
 */
export async function getCampaignDiscountStats(campaignId: string): Promise<{
  issued: number;
  clicked: number;
  redeemed: number;
  revenue: number;
}> {
  try {
    const discounts = await db
      .select()
      .from(campaignDiscounts)
      .where(eq(campaignDiscounts.campaignId, campaignId));
    
    const issued = discounts.length;
    const clicked = discounts.filter(d => d.clicked).length;
    const redeemed = discounts.filter(d => d.redeemed).length;
    const revenue = discounts
      .filter(d => d.redeemedAmount)
      .reduce((sum, d) => sum + parseFloat(d.redeemedAmount || "0"), 0);
    
    return { issued, clicked, redeemed, revenue };
  } catch (err) {
    console.error("[campaignDiscountService] getCampaignDiscountStats error:", err);
    return { issued: 0, clicked: 0, redeemed: 0, revenue: 0 };
  }
}

// ============================================================================
// Exports
// ============================================================================

export const campaignDiscountService = {
  generateCampaignDiscount,
  validateCampaignDiscount,
  redeemCampaignDiscount,
  trackDiscountClick,
  getCampaignDiscountStats,
};

export default campaignDiscountService;
