/**
 * AI Campaign Content Generator
 * 
 * Uses Claude to generate personalized email campaign content
 * based on current rebates, inventory, and subscriber data.
 * 
 * @created 2026-04-25
 */

import Anthropic from "@anthropic-ai/sdk";
// import { db } from "@/lib/fitment-db/db";
// TODO: Add manufacturerRebates table to schema when ready to use rebates
// import { manufacturerRebates } from "@/lib/fitment-db/schema";
// import { gte, and, eq } from "drizzle-orm";
import type { CampaignContent, ContentBlock } from "../campaigns/types";

// ============================================================================
// Types
// ============================================================================

export type CampaignType = 
  | "weekly_deals"      // Best current rebates + deals
  | "seasonal"          // Winter/summer tire push
  | "new_arrivals"      // New products
  | "re_engagement"     // Win back inactive subscribers
  | "flash_sale";       // Limited time offer

export interface GeneratedCampaign {
  name: string;
  subject: string;
  previewText: string;
  content: CampaignContent;
  audienceRules: {
    hasVehicle?: boolean;
    vehicleTypes?: string[];  // truck, suv, car
    sources?: string[];
  };
  suggestedSendTime?: string;
}

export interface VehicleContext {
  year: string;
  make: string;
  model: string;
  trim?: string;
}

export interface PersonalizedContent {
  headline: string;
  subheadline: string;
  productRecommendations: {
    type: "wheel" | "tire";
    searchUrl: string;
    description: string;
  }[];
  callToAction: string;
  ctaUrl: string;
}

// ============================================================================
// Claude Client
// ============================================================================

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[AI Campaign] ANTHROPIC_API_KEY not configured");
    return null;
  }
  return new Anthropic({ apiKey });
}

// ============================================================================
// Context Gathering
// ============================================================================

/**
 * Get active rebates for campaign content
 * TODO: Implement when manufacturerRebates table is added to schema
 */
async function getActiveRebates(): Promise<any[]> {
  // Rebates table not yet implemented - return empty array
  // When ready, add manufacturerRebates table to schema and query here
  return [];
}

/**
 * Get current season context
 */
function getSeasonContext(): { season: string; tireType: string; urgency: string } {
  const month = new Date().getMonth(); // 0-11
  
  if (month >= 9 && month <= 11) {
    // Oct-Dec: Winter tire season
    return {
      season: "fall/winter",
      tireType: "winter",
      urgency: "Get ready before the snow hits",
    };
  } else if (month >= 2 && month <= 4) {
    // Mar-May: Summer/all-season swap
    return {
      season: "spring",
      tireType: "summer or all-season",
      urgency: "Time to swap off those winter tires",
    };
  } else if (month >= 5 && month <= 8) {
    // Jun-Sep: Summer performance
    return {
      season: "summer",
      tireType: "performance",
      urgency: "Perfect weather for a new look",
    };
  } else {
    // Jan-Feb: Deep winter
    return {
      season: "winter",
      tireType: "winter",
      urgency: "Stay safe on winter roads",
    };
  }
}

// ============================================================================
// Campaign Generation
// ============================================================================

/**
 * Generate a complete campaign using Claude
 */
export async function generateCampaign(
  campaignType: CampaignType,
  options?: {
    focusBrand?: string;
    customPrompt?: string;
  }
): Promise<GeneratedCampaign | null> {
  const client = getAnthropicClient();
  if (!client) {
    console.error("[AI Campaign] No Anthropic client available");
    return null;
  }

  // Gather context
  const rebates = await getActiveRebates();
  const seasonContext = getSeasonContext();
  
  const rebateContext = rebates.length > 0
    ? `Current active rebates:\n${rebates.map(r => `- ${r.brand}: ${r.amount} ${r.description} (expires ${new Date(r.endDate).toLocaleDateString()})`).join("\n")}`
    : "No active manufacturer rebates at this time.";

  const campaignTypePrompts: Record<CampaignType, string> = {
    weekly_deals: `Create a weekly deals email highlighting the best current offers. Focus on value and savings.`,
    seasonal: `Create a ${seasonContext.season} seasonal email about ${seasonContext.tireType} tires. ${seasonContext.urgency}.`,
    new_arrivals: `Create an email showcasing new wheel and tire arrivals. Focus on fresh styles and latest products.`,
    re_engagement: `Create a win-back email for customers who haven't visited in a while. Be warm and offer an incentive.`,
    flash_sale: `Create an urgent flash sale email. Limited time, create excitement and FOMO.`,
  };

  const prompt = `You are an email marketing expert for Warehouse Tire, a tire and wheel retailer in Michigan with an online store.

BUSINESS CONTEXT:
- We sell tires, wheels, and tire/wheel packages
- Two locations: Pontiac and Waterford, MI
- Online store: shop.warehousetiredirect.com
- FREE SHIPPING on orders over $1,500 (IMPORTANT: always use $1,500, never $599)
- Price match guarantee
- Professional installation available

${rebateContext}

SEASON: ${seasonContext.season}
Best tire type to promote: ${seasonContext.tireType}

TASK: ${campaignTypePrompts[campaignType]}
${options?.customPrompt ? `\nADDITIONAL DIRECTION: ${options.customPrompt}` : ""}
${options?.focusBrand ? `\nFOCUS BRAND: ${options.focusBrand}` : ""}

Generate a campaign with:
1. A compelling subject line (under 50 characters, creates curiosity/urgency)
2. Preview text (under 90 characters, complements subject)
3. Main headline
4. Subheadline
5. Exactly 3 value propositions (short, punchy - each should be ONE benefit)
6. Call to action text
7. An expiration date for urgency (typically end of current week or month)
8. 4 featured product suggestions (2 tires, 2 wheels - with realistic price ranges)

VALUE PROPS RULES:
- Keep each under 50 characters
- Make them scannable - one benefit per point
- Include the $1,500 free shipping threshold in one of them
- Example good: "FREE shipping over $1,500"
- Example bad: "FREE shipping on orders over $1,500 - no hidden fees"

Respond in JSON format:
{
  "name": "Internal campaign name",
  "subject": "Email subject line",
  "previewText": "Preview text shown in inbox",
  "headline": "Main headline in email",
  "subheadline": "Supporting subheadline",
  "valueProps": [
    {"icon": "🚚", "text": "FREE shipping over $1,500"},
    {"icon": "💰", "text": "Price match guarantee"},
    {"icon": "🔧", "text": "Pro installation in Pontiac & Waterford"}
  ],
  "ctaText": "Shop Now",
  "urgencyText": "Offer ends Sunday, April 30",
  "featuredProducts": [
    {"name": "Goodyear Assurance MaxLife", "type": "tire", "priceRange": "$140-180/tire"},
    {"name": "Cooper Discoverer AT3", "type": "tire", "priceRange": "$160-220/tire"},
    {"name": "Fuel Vapor D569", "type": "wheel", "priceRange": "$280-350/wheel"},
    {"name": "American Racing AR924", "type": "wheel", "priceRange": "$180-240/wheel"}
  ],
  "tone": "excited|urgent|friendly|professional",
  "audienceHint": "all|truck_owners|car_owners|performance"
}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find(c => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Parse JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const generated = JSON.parse(jsonMatch[0]);

    // Build content blocks
    const contentBlocks: ContentBlock[] = [
      {
        type: "hero",
        data: {
          headline: generated.headline,
          subheadline: generated.subheadline,
          backgroundColor: "#dc2626",
        },
      },
    ];

    // Add value props as structured text (3-column layout via HTML table)
    if (generated.valueProps?.length > 0) {
      const propsHtml = generated.valueProps
        .map((p: { icon: string; text: string }) => 
          `<td style="padding: 12px; text-align: center; width: 33%;">
            <div style="font-size: 24px; margin-bottom: 8px;">${p.icon}</div>
            <div style="font-size: 14px; color: #374151; font-weight: 500;">${p.text}</div>
          </td>`
        )
        .join("");
      
      contentBlocks.push({
        type: "text_block",
        data: {
          content: `<table style="width: 100%; border-collapse: collapse; margin: 16px 0;"><tr>${propsHtml}</tr></table>`,
          alignment: "center",
        },
      });
    }

    // Add urgency banner if provided
    if (generated.urgencyText) {
      contentBlocks.push({
        type: "promo_banner",
        data: {
          text: generated.urgencyText,
          backgroundColor: "#fef3c7",
          textColor: "#92400e",
        },
      });
    }

    // Add CTA
    contentBlocks.push({
      type: "cta_button",
      data: {
        text: generated.ctaText || "Shop Now",
        url: "https://shop.warehousetiredirect.com",
        backgroundColor: "#dc2626",
      },
    });

    // Add featured products grid if provided
    if (generated.featuredProducts?.length > 0) {
      contentBlocks.push({
        type: "product_grid",
        data: {
          title: "Featured This Week",
          columns: 2,
          products: generated.featuredProducts.map((p: { name: string; type: string; priceRange: string }) => ({
            name: p.name,
            brand: p.type === "tire" ? "Tire" : "Wheel",
            price: p.priceRange,
            linkUrl: p.type === "tire" 
              ? "https://shop.warehousetiredirect.com/tires"
              : "https://shop.warehousetiredirect.com/wheels",
            // Note: No imageUrl - would need to look up real product images
          })),
        },
      });
    }

    // Add rebate section if we have rebates and it's a deals campaign
    if (rebates.length > 0 && (campaignType === "weekly_deals" || campaignType === "flash_sale")) {
      contentBlocks.push({
        type: "rebate_section",
        data: {
          title: "Current Manufacturer Rebates",
          rebates: rebates.slice(0, 3).map(r => ({
            brand: r.brand,
            amount: `$${r.amount}`,
            description: r.description,
            expiresAt: r.endDate,
          })),
        },
      });
    }

    // Map audience hint to rules
    const audienceRules: GeneratedCampaign["audienceRules"] = {};
    if (generated.audienceHint === "truck_owners") {
      audienceRules.vehicleTypes = ["truck", "suv"];
    } else if (generated.audienceHint === "car_owners") {
      audienceRules.vehicleTypes = ["car", "sedan"];
    }

    return {
      name: generated.name || `${campaignType}_${Date.now()}`,
      subject: generated.subject,
      previewText: generated.previewText,
      content: { blocks: contentBlocks },
      audienceRules,
      suggestedSendTime: campaignType === "flash_sale" ? "immediate" : "tuesday_9am",
    };
  } catch (err) {
    console.error("[AI Campaign] Generation failed:", err);
    return null;
  }
}

// ============================================================================
// Vehicle Personalization
// ============================================================================

/**
 * Generate personalized content for a specific vehicle
 */
export async function generatePersonalizedContent(
  vehicle: VehicleContext,
  campaignType: CampaignType
): Promise<PersonalizedContent | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const vehicleStr = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`;
  const seasonContext = getSeasonContext();

  const prompt = `You are writing personalized email content for a customer who owns a ${vehicleStr}.

TASK: Write a short, personalized section for a ${campaignType.replace("_", " ")} email.

The content should:
1. Reference their specific vehicle naturally
2. Feel personal, not generic
3. Be concise (2-3 sentences max for headline area)

Respond in JSON:
{
  "headline": "Personalized headline mentioning their vehicle",
  "subheadline": "Supporting text",
  "productSuggestion": "What type of wheels/tires would suit this vehicle",
  "ctaText": "Short CTA text"
}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find(c => c.type === "text");
    if (!textContent || textContent.type !== "text") return null;

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const generated = JSON.parse(jsonMatch[0]);

    // Build search URL for their vehicle
    const searchParams = new URLSearchParams({
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
    });
    if (vehicle.trim) searchParams.set("trim", vehicle.trim);

    return {
      headline: generated.headline,
      subheadline: generated.subheadline,
      productRecommendations: [
        {
          type: "wheel",
          searchUrl: `https://shop.warehousetiredirect.com/wheels?${searchParams}`,
          description: `Wheels for your ${vehicleStr}`,
        },
        {
          type: "tire",
          searchUrl: `https://shop.warehousetiredirect.com/tires?${searchParams}`,
          description: `Tires for your ${vehicleStr}`,
        },
      ],
      callToAction: generated.ctaText || "Shop Now",
      ctaUrl: `https://shop.warehousetiredirect.com/wheels?${searchParams}`,
    };
  } catch (err) {
    console.error("[AI Campaign] Personalization failed:", err);
    return null;
  }
}

// ============================================================================
// Fallback Content (No Vehicle)
// ============================================================================

/**
 * Generate generic content for subscribers without vehicle data
 */
export function getGenericContent(campaignType: CampaignType): PersonalizedContent {
  const seasonContext = getSeasonContext();

  const contentByType: Record<CampaignType, PersonalizedContent> = {
    weekly_deals: {
      headline: "This Week's Best Tire & Wheel Deals",
      subheadline: "Save big on top brands with manufacturer rebates",
      productRecommendations: [
        { type: "wheel", searchUrl: "https://shop.warehousetiredirect.com/wheels", description: "Shop Wheels" },
        { type: "tire", searchUrl: "https://shop.warehousetiredirect.com/tires", description: "Shop Tires" },
      ],
      callToAction: "Shop Deals",
      ctaUrl: "https://shop.warehousetiredirect.com",
    },
    seasonal: {
      headline: `Get Ready for ${seasonContext.season.charAt(0).toUpperCase() + seasonContext.season.slice(1)}`,
      subheadline: `${seasonContext.urgency}. Shop ${seasonContext.tireType} tires now.`,
      productRecommendations: [
        { type: "tire", searchUrl: "https://shop.warehousetiredirect.com/tires", description: `Shop ${seasonContext.tireType} tires` },
      ],
      callToAction: "Shop Now",
      ctaUrl: "https://shop.warehousetiredirect.com/tires",
    },
    new_arrivals: {
      headline: "Fresh Styles Just Landed",
      subheadline: "Check out our newest wheels and tire options",
      productRecommendations: [
        { type: "wheel", searchUrl: "https://shop.warehousetiredirect.com/wheels", description: "New Wheels" },
      ],
      callToAction: "See What's New",
      ctaUrl: "https://shop.warehousetiredirect.com/wheels",
    },
    re_engagement: {
      headline: "We Miss You!",
      subheadline: "It's been a while. Come back and see what's new.",
      productRecommendations: [
        { type: "wheel", searchUrl: "https://shop.warehousetiredirect.com/wheels", description: "Shop Wheels" },
      ],
      callToAction: "Come Back",
      ctaUrl: "https://shop.warehousetiredirect.com",
    },
    flash_sale: {
      headline: "⚡ Flash Sale - Today Only!",
      subheadline: "Limited time savings on select tires and wheels",
      productRecommendations: [
        { type: "wheel", searchUrl: "https://shop.warehousetiredirect.com/wheels", description: "Shop Now" },
      ],
      callToAction: "Shop Flash Sale",
      ctaUrl: "https://shop.warehousetiredirect.com",
    },
  };

  return contentByType[campaignType];
}

export default {
  generateCampaign,
  generatePersonalizedContent,
  getGenericContent,
};
