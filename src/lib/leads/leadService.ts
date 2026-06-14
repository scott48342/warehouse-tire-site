/**
 * Lead Capture Service
 * 
 * Unified lead capture across all WTD properties:
 * - National (shop.warehousetiredirect.com)
 * - Local (shop.warehousetire.net)
 * - Jake Garage (/garage)
 * 
 * Key principles:
 * - Voluntary capture (never block checkout)
 * - Auto-subscribe with consent
 * - Track source for attribution
 * 
 * @created 2026-07-18
 */

import { db } from "@/lib/fitment-db/db";
import { leads, jakeBuilds, emailSubscribers, abandonedCarts } from "@/lib/fitment-db/schema";
import type { Lead, NewLead, JakeBuild, NewJakeBuild, LeadSourceStats, LeadFunnelStats } from "@/lib/fitment-db/schema";
import { eq, and, desc, sql, count, gte, lt, or, isNotNull } from "drizzle-orm";
import { detectTestData } from "@/lib/testData";

// ============================================================================
// Configuration
// ============================================================================

export type SourceSite = "national" | "local" | "garage";
export type SourceChannel = "cart_save" | "checkout" | "build_save" | "jake_package" | "exit_intent";
export type LeadStatus = "new" | "contacted" | "converted" | "expired";

const HOSTNAME_TO_SITE: Record<string, SourceSite> = {
  "shop.warehousetiredirect.com": "national",
  "warehousetiredirect.com": "national",
  "shop.warehousetire.net": "local",
  "warehousetire.net": "local",
  "localhost": "local", // Default for dev
};

export function detectSourceSite(hostname: string | undefined): SourceSite {
  if (!hostname) return "national";
  const normalized = hostname.toLowerCase().replace(/:\d+$/, ""); // Strip port
  return HOSTNAME_TO_SITE[normalized] || "national";
}

// ============================================================================
// Lead Capture
// ============================================================================

export interface CaptureLeadInput {
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  
  // Vehicle
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  };
  
  // Source
  sourceSite: SourceSite;
  sourceChannel: SourceChannel;
  sessionId?: string;
  
  // Cart
  cartId?: string;
  cartValue?: number;
  cartSnapshot?: any;
  checkoutUrl?: string;
  
  // Jake build
  jakeBuildId?: string;
  
  // Shopping context
  tireSize?: string;
  wheelSize?: string;
  liftLevel?: string;
  buildProfile?: string;
  
  // Tracking
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  
  // Consent
  marketingConsent?: boolean;
  
  // Test override
  isTest?: boolean;
}

export interface CaptureLeadResult {
  success: boolean;
  lead?: Lead;
  isNew: boolean;
  subscriberCreated: boolean;
  error?: string;
}

/**
 * Capture a lead from any source (cart save, Jake build, checkout, etc.)
 */
export async function captureLead(input: CaptureLeadInput): Promise<CaptureLeadResult> {
  const normalizedEmail = input.email.toLowerCase().trim();
  
  // Detect test data
  let isTest = input.isTest || false;
  let testReason: string | null = null;
  
  if (!isTest) {
    const detection = detectTestData({
      email: normalizedEmail,
      ipAddress: input.ipAddress,
    });
    if (detection.isTest) {
      isTest = true;
      testReason = detection.reason;
    }
  }
  
  try {
    // Check for existing lead with same email + cart
    const existingConditions = [eq(leads.email, normalizedEmail)];
    if (input.cartId) {
      existingConditions.push(eq(leads.cartId, input.cartId));
    }
    
    const [existing] = await db
      .select()
      .from(leads)
      .where(and(...existingConditions))
      .orderBy(desc(leads.createdAt))
      .limit(1);
    
    if (existing) {
      // Update existing lead with new data
      const [updated] = await db
        .update(leads)
        .set({
          phone: input.phone || existing.phone,
          firstName: input.firstName || existing.firstName,
          lastName: input.lastName || existing.lastName,
          vehicleYear: input.vehicle?.year || existing.vehicleYear,
          vehicleMake: input.vehicle?.make || existing.vehicleMake,
          vehicleModel: input.vehicle?.model || existing.vehicleModel,
          vehicleTrim: input.vehicle?.trim || existing.vehicleTrim,
          cartValue: input.cartValue ? String(input.cartValue) : existing.cartValue,
          cartSnapshot: input.cartSnapshot || existing.cartSnapshot,
          checkoutUrl: input.checkoutUrl || existing.checkoutUrl,
          tireSize: input.tireSize || existing.tireSize,
          wheelSize: input.wheelSize || existing.wheelSize,
          liftLevel: input.liftLevel || existing.liftLevel,
          buildProfile: input.buildProfile || existing.buildProfile,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, existing.id))
        .returning();
      
      console.log(`[leadService] Updated existing lead ${existing.id} for ${normalizedEmail}`);
      
      return {
        success: true,
        lead: updated,
        isNew: false,
        subscriberCreated: false,
      };
    }
    
    // Create new lead
    const [newLead] = await db
      .insert(leads)
      .values({
        email: normalizedEmail,
        phone: input.phone,
        firstName: input.firstName,
        lastName: input.lastName,
        vehicleYear: input.vehicle?.year,
        vehicleMake: input.vehicle?.make,
        vehicleModel: input.vehicle?.model,
        vehicleTrim: input.vehicle?.trim,
        sourceSite: input.sourceSite,
        sourceChannel: input.sourceChannel,
        sessionId: input.sessionId,
        cartId: input.cartId,
        jakeBuildId: input.jakeBuildId,
        cartValue: input.cartValue ? String(input.cartValue) : null,
        tireSize: input.tireSize,
        wheelSize: input.wheelSize,
        liftLevel: input.liftLevel,
        buildProfile: input.buildProfile,
        cartSnapshot: input.cartSnapshot,
        checkoutUrl: input.checkoutUrl,
        marketingConsent: input.marketingConsent ?? true,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
        referrer: input.referrer,
        utmSource: input.utmSource,
        utmMedium: input.utmMedium,
        utmCampaign: input.utmCampaign,
        isTest,
        testReason,
      })
      .returning();
    
    console.log(`[leadService] Created new lead ${newLead.id} for ${normalizedEmail} from ${input.sourceSite}/${input.sourceChannel}`);
    
    // Auto-subscribe to email list with consent
    let subscriberCreated = false;
    if (input.marketingConsent !== false) {
      try {
        await db
          .insert(emailSubscribers)
          .values({
            email: normalizedEmail,
            source: input.sourceChannel,
            vehicleYear: input.vehicle?.year?.toString(),
            vehicleMake: input.vehicle?.make,
            vehicleModel: input.vehicle?.model,
            vehicleTrim: input.vehicle?.trim,
            cartId: input.cartId,
            marketingConsent: true,
            isTest,
            testReason,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          })
          .onConflictDoUpdate({
            target: emailSubscribers.email,
            set: {
              marketingConsent: true,
              lastActiveAt: new Date(),
              updatedAt: new Date(),
            },
          });
        
        subscriberCreated = true;
        console.log(`[leadService] Auto-subscribed ${normalizedEmail}`);
      } catch (err) {
        console.error(`[leadService] Failed to auto-subscribe:`, err);
      }
    }
    
    // Update abandoned cart if exists
    if (input.cartId) {
      try {
        await db
          .update(abandonedCarts)
          .set({
            customerEmail: normalizedEmail,
            customerFirstName: input.firstName,
            customerLastName: input.lastName,
            customerPhone: input.phone,
            updatedAt: new Date(),
          })
          .where(eq(abandonedCarts.cartId, input.cartId));
        
        console.log(`[leadService] Updated abandoned cart ${input.cartId} with lead email`);
      } catch (err) {
        console.error(`[leadService] Failed to update abandoned cart:`, err);
      }
    }
    
    return {
      success: true,
      lead: newLead,
      isNew: true,
      subscriberCreated,
    };
    
  } catch (err: any) {
    console.error(`[leadService] Failed to capture lead:`, err);
    return {
      success: false,
      isNew: false,
      subscriberCreated: false,
      error: err.message,
    };
  }
}

// ============================================================================
// Jake Build Tracking
// ============================================================================

export interface TrackJakeBuildInput {
  conversationId: string;
  sessionId?: string;
  
  // Vehicle
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  };
  
  // Build details
  buildStyle?: string;
  tireSize?: string;
  wheelDiameter?: number;
  wheelWidth?: number;
  liftHeight?: string;
  
  // Recommendations
  recommendedWheels?: any[];
  recommendedTires?: any[];
  recommendedPackageValue?: number;
  
  // Conversation
  messageCount?: number;
  lastUserMessage?: string;
  toolsUsed?: string[];
  
  // Source
  sourceSite?: SourceSite;
  
  // Test
  isTest?: boolean;
}

/**
 * Track a Jake Garage build/conversation
 */
export async function trackJakeBuild(input: TrackJakeBuildInput): Promise<JakeBuild | null> {
  try {
    // Check for existing conversation
    const [existing] = await db
      .select()
      .from(jakeBuilds)
      .where(eq(jakeBuilds.conversationId, input.conversationId))
      .limit(1);
    
    if (existing) {
      // Update existing
      const [updated] = await db
        .update(jakeBuilds)
        .set({
          vehicleYear: input.vehicle?.year || existing.vehicleYear,
          vehicleMake: input.vehicle?.make || existing.vehicleMake,
          vehicleModel: input.vehicle?.model || existing.vehicleModel,
          vehicleTrim: input.vehicle?.trim || existing.vehicleTrim,
          buildStyle: input.buildStyle || existing.buildStyle,
          tireSize: input.tireSize || existing.tireSize,
          wheelDiameter: input.wheelDiameter || existing.wheelDiameter,
          wheelWidth: input.wheelWidth ? String(input.wheelWidth) : existing.wheelWidth,
          liftHeight: input.liftHeight || existing.liftHeight,
          recommendedWheels: input.recommendedWheels || existing.recommendedWheels,
          recommendedTires: input.recommendedTires || existing.recommendedTires,
          recommendedPackageValue: input.recommendedPackageValue 
            ? String(input.recommendedPackageValue) 
            : existing.recommendedPackageValue,
          messageCount: input.messageCount || existing.messageCount,
          lastUserMessage: input.lastUserMessage || existing.lastUserMessage,
          toolsUsed: input.toolsUsed || existing.toolsUsed,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(jakeBuilds.id, existing.id))
        .returning();
      
      return updated;
    }
    
    // Create new build record
    const [created] = await db
      .insert(jakeBuilds)
      .values({
        conversationId: input.conversationId,
        sessionId: input.sessionId,
        vehicleYear: input.vehicle?.year,
        vehicleMake: input.vehicle?.make,
        vehicleModel: input.vehicle?.model,
        vehicleTrim: input.vehicle?.trim,
        buildStyle: input.buildStyle,
        tireSize: input.tireSize,
        wheelDiameter: input.wheelDiameter,
        wheelWidth: input.wheelWidth ? String(input.wheelWidth) : null,
        liftHeight: input.liftHeight,
        recommendedWheels: input.recommendedWheels,
        recommendedTires: input.recommendedTires,
        recommendedPackageValue: input.recommendedPackageValue 
          ? String(input.recommendedPackageValue) 
          : null,
        messageCount: input.messageCount || 1,
        lastUserMessage: input.lastUserMessage,
        toolsUsed: input.toolsUsed,
        sourceSite: input.sourceSite || "garage",
        isTest: input.isTest || false,
      })
      .returning();
    
    console.log(`[leadService] Tracked Jake build ${created.id} for conversation ${input.conversationId}`);
    return created;
    
  } catch (err) {
    console.error(`[leadService] Failed to track Jake build:`, err);
    return null;
  }
}

/**
 * Link a Jake build to a captured lead
 */
export async function linkJakeBuildToLead(
  conversationId: string,
  email: string
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  
  try {
    // Find the lead
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.email, normalizedEmail))
      .orderBy(desc(leads.createdAt))
      .limit(1);
    
    if (!lead) {
      console.log(`[leadService] No lead found for ${normalizedEmail}`);
      return;
    }
    
    // Update the Jake build
    await db
      .update(jakeBuilds)
      .set({
        leadId: lead.id,
        email: normalizedEmail,
        updatedAt: new Date(),
      })
      .where(eq(jakeBuilds.conversationId, conversationId));
    
    console.log(`[leadService] Linked Jake build ${conversationId} to lead ${lead.id}`);
    
  } catch (err) {
    console.error(`[leadService] Failed to link Jake build to lead:`, err);
  }
}

// ============================================================================
// Lead Status Updates
// ============================================================================

/**
 * Mark a lead as converted (order completed)
 */
export async function markLeadConverted(
  email: string,
  orderId: string
): Promise<Lead | null> {
  const normalizedEmail = email.toLowerCase().trim();
  
  try {
    const [updated] = await db
      .update(leads)
      .set({
        status: "converted",
        convertedOrderId: orderId,
        convertedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(leads.email, normalizedEmail),
          eq(leads.status, "new")
        )
      )
      .returning();
    
    if (updated) {
      console.log(`[leadService] Marked lead ${updated.id} as converted`);
      
      // Also update any linked Jake builds
      await db
        .update(jakeBuilds)
        .set({
          status: "converted",
          orderId,
          updatedAt: new Date(),
        })
        .where(eq(jakeBuilds.email, normalizedEmail));
    }
    
    return updated || null;
    
  } catch (err) {
    console.error(`[leadService] Failed to mark lead converted:`, err);
    return null;
  }
}

// ============================================================================
// Analytics
// ============================================================================

/**
 * Get lead capture stats by source
 */
export async function getLeadSourceStats(
  includeTest: boolean = false
): Promise<LeadSourceStats[]> {
  const conditions = includeTest ? [] : [eq(leads.isTest, false)];
  
  const results = await db
    .select({
      sourceSite: leads.sourceSite,
      sourceChannel: leads.sourceChannel,
      totalLeads: count(),
      convertedLeads: sql<number>`COUNT(*) FILTER (WHERE ${leads.status} = 'converted')`,
      totalValue: sql<number>`COALESCE(SUM(${leads.cartValue}), 0)`,
    })
    .from(leads)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(leads.sourceSite, leads.sourceChannel)
    .orderBy(desc(sql`COUNT(*)`));
  
  return results.map(r => ({
    sourceSite: r.sourceSite,
    sourceChannel: r.sourceChannel,
    totalLeads: Number(r.totalLeads),
    convertedLeads: Number(r.convertedLeads),
    conversionRate: r.totalLeads > 0 
      ? Math.round((Number(r.convertedLeads) / Number(r.totalLeads)) * 100) 
      : 0,
    totalValue: Number(r.totalValue),
    averageValue: r.totalLeads > 0 
      ? Math.round(Number(r.totalValue) / Number(r.totalLeads)) 
      : 0,
  }));
}

/**
 * Get lead funnel stats
 */
export async function getLeadFunnelStats(
  includeTest: boolean = false
): Promise<LeadFunnelStats> {
  const conditions = includeTest ? [] : [eq(leads.isTest, false)];
  
  const [stats] = await db
    .select({
      newLeads: sql<number>`COUNT(*) FILTER (WHERE ${leads.status} = 'new')`,
      contactedLeads: sql<number>`COUNT(*) FILTER (WHERE ${leads.status} = 'contacted')`,
      convertedLeads: sql<number>`COUNT(*) FILTER (WHERE ${leads.status} = 'converted')`,
      expiredLeads: sql<number>`COUNT(*) FILTER (WHERE ${leads.status} = 'expired')`,
      emailsSent: sql<number>`COALESCE(SUM(${leads.emailsSent}), 0)`,
      emailsOpened: sql<number>`COUNT(*) FILTER (WHERE ${leads.lastEmailOpenedAt} IS NOT NULL)`,
      emailsClicked: sql<number>`COUNT(*) FILTER (WHERE ${leads.lastEmailClickedAt} IS NOT NULL)`,
    })
    .from(leads)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  
  const total = Number(stats.newLeads) + Number(stats.contactedLeads) + 
                Number(stats.convertedLeads) + Number(stats.expiredLeads);
  
  return {
    newLeads: Number(stats.newLeads),
    contactedLeads: Number(stats.contactedLeads),
    convertedLeads: Number(stats.convertedLeads),
    expiredLeads: Number(stats.expiredLeads),
    emailsSent: Number(stats.emailsSent),
    emailsOpened: Number(stats.emailsOpened),
    emailsClicked: Number(stats.emailsClicked),
    openRate: stats.emailsSent > 0 
      ? Math.round((Number(stats.emailsOpened) / Number(stats.emailsSent)) * 100) 
      : 0,
    clickRate: stats.emailsOpened > 0 
      ? Math.round((Number(stats.emailsClicked) / Number(stats.emailsOpened)) * 100) 
      : 0,
    conversionRate: total > 0 
      ? Math.round((Number(stats.convertedLeads) / total) * 100) 
      : 0,
  };
}

/**
 * Get recent leads for dashboard
 */
export async function getRecentLeads(
  limit: number = 10,
  includeTest: boolean = false
): Promise<Lead[]> {
  const conditions = includeTest ? [] : [eq(leads.isTest, false)];
  
  return db
    .select()
    .from(leads)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(leads.createdAt))
    .limit(limit);
}

// ============================================================================
// Exports
// ============================================================================

export const leadService = {
  captureLead,
  trackJakeBuild,
  linkJakeBuildToLead,
  markLeadConverted,
  getLeadSourceStats,
  getLeadFunnelStats,
  getRecentLeads,
  detectSourceSite,
};

export default leadService;
