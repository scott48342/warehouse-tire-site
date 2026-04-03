/**
 * Email Campaign Types
 * 
 * Shared type definitions for the campaign system.
 * 
 * @created 2026-04-03
 */

// ============================================================================
// Campaign Types
// ============================================================================

export type CampaignType = 
  | "tire_promo" 
  | "wheel_promo" 
  | "package_promo" 
  | "newsletter" 
  | "announcement"
  | "seasonal"
  | "clearance";

export type CampaignStatus = 
  | "draft" 
  | "scheduled" 
  | "sending" 
  | "paused" 
  | "sent" 
  | "cancelled";

export type RecipientStatus = 
  | "pending" 
  | "sent" 
  | "delivered" 
  | "bounced" 
  | "complained" 
  | "failed";

export type EventType = 
  | "sent" 
  | "delivered" 
  | "opened" 
  | "clicked" 
  | "bounced" 
  | "complained" 
  | "unsubscribed";

// ============================================================================
// Audience Rules
// ============================================================================

export interface AudienceRules {
  // Vehicle targeting
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYearMin?: number;
  vehicleYearMax?: number;
  
  // Source filtering
  sources?: string[]; // exit_intent, cart_save, checkout, newsletter, quote
  
  // Behavior filters
  hasCart?: boolean;          // Has an abandoned cart
  hasPurchase?: boolean;      // Has completed a purchase
  activeWithinDays?: number;  // Active within X days
  
  // Exclusions (always applied in addition to these)
  // - unsubscribed
  // - suppressed (bounce/complaint)
  // - isTest (unless includeTest=true)
  // - recent campaign send within X days
  
  recentCampaignExcludeDays?: number; // Default: 7
  includeTest?: boolean;               // Default: false
}

// ============================================================================
// Content Blocks
// ============================================================================

export type ContentBlockType = 
  | "hero"
  | "promo_banner"
  | "rebate_section"
  | "product_grid"
  | "package_highlight"
  | "text_block"
  | "cta_button"
  | "divider"
  | "footer";

export interface ContentBlock {
  type: ContentBlockType;
  data: Record<string, any>;
}

export interface HeroBlock extends ContentBlock {
  type: "hero";
  data: {
    headline: string;
    subheadline?: string;
    imageUrl?: string;
    backgroundColor?: string;
  };
}

export interface PromoBannerBlock extends ContentBlock {
  type: "promo_banner";
  data: {
    text: string;
    backgroundColor?: string;
    textColor?: string;
    expiresAt?: string;
  };
}

export interface RebateSectionBlock extends ContentBlock {
  type: "rebate_section";
  data: {
    title: string;
    rebates: Array<{
      brand: string;
      amount: string;
      description: string;
      expiresAt?: string;
    }>;
  };
}

export interface ProductGridBlock extends ContentBlock {
  type: "product_grid";
  data: {
    title?: string;
    products: Array<{
      name: string;
      brand?: string;
      imageUrl?: string;
      price?: string;
      originalPrice?: string;
      linkUrl: string;
    }>;
    columns?: 2 | 3 | 4;
  };
}

export interface PackageHighlightBlock extends ContentBlock {
  type: "package_highlight";
  data: {
    title: string;
    description?: string;
    imageUrl?: string;
    price?: string;
    savings?: string;
    features?: string[];
    ctaText: string;
    ctaUrl: string;
  };
}

export interface TextBlock extends ContentBlock {
  type: "text_block";
  data: {
    content: string; // HTML or markdown
    alignment?: "left" | "center" | "right";
  };
}

export interface CtaButtonBlock extends ContentBlock {
  type: "cta_button";
  data: {
    text: string;
    url: string;
    style?: "primary" | "secondary" | "outline";
    alignment?: "left" | "center" | "right";
  };
}

export interface DividerBlock extends ContentBlock {
  type: "divider";
  data: {
    style?: "solid" | "dashed" | "dotted";
    color?: string;
  };
}

// ============================================================================
// Campaign Content
// ============================================================================

export interface CampaignContent {
  blocks: ContentBlock[];
}

// ============================================================================
// Monthly Recurring Rules
// ============================================================================

export interface MonthlyRule {
  dayOfMonth: number;       // 1-28 (avoid 29-31 for safety)
  timeOfDay: string;        // "09:00" (local timezone)
  timezone?: string;        // Default: America/New_York
  audienceRulesOverride?: Partial<AudienceRules>;
}

// ============================================================================
// Campaign Stats
// ============================================================================

export interface CampaignStats {
  totalRecipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  
  // Rates
  deliveryRate: number;   // delivered / sent
  openRate: number;       // opened / delivered
  clickRate: number;      // clicked / delivered
  bounceRate: number;     // bounced / sent
  unsubscribeRate: number; // unsubscribed / delivered
}

// ============================================================================
// Audience Preview
// ============================================================================

export interface AudiencePreview {
  totalCount: number;
  sampleEmails: string[];  // First 10 anonymized
  breakdown: {
    bySource: Record<string, number>;
    byMake?: Record<string, number>;
    withVehicle: number;
    withCart: number;
    withPurchase: number;
  };
  exclusions: {
    unsubscribed: number;
    suppressed: number;
    recentCampaign: number;
    test: number;
  };
}
