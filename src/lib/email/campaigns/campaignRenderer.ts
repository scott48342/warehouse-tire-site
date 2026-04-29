/**
 * Campaign Email Renderer
 * 
 * Renders campaign emails from DB-first content blocks.
 * Uses unified professional email template system.
 * 
 * @created 2026-04-03
 * @updated 2026-04-29 - Unified professional email template
 */

import { BRAND } from "@/lib/brand";
import {
  emailWrapper,
  heroSection,
  productCard,
  infoBox,
  successBox,
  urgencyBox,
  ctaButton,
  textSection,
  freeShippingBanner,
  footer,
  formatPrice,
} from "../templates";
import type { 
  ContentBlock, 
  CampaignContent,
  HeroBlock,
  PromoBannerBlock,
  RebateSectionBlock,
  ProductGridBlock,
  PackageHighlightBlock,
  TextBlock,
  CtaButtonBlock,
  DividerBlock,
} from "./types";

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://shop.warehousetiredirect.com";
const PRIMARY_COLOR = "#dc2626";
const DARK_BG = "#1a1a1a";

// ============================================================================
// UTM Link Helper
// ============================================================================

export function addUtmParams(
  url: string,
  params: { campaign?: string; source?: string; medium?: string; content?: string }
): string {
  try {
    const urlObj = new URL(url, BASE_URL);
    if (params.campaign) urlObj.searchParams.set("utm_campaign", params.campaign);
    if (params.source) urlObj.searchParams.set("utm_source", params.source || "email");
    if (params.medium) urlObj.searchParams.set("utm_medium", params.medium || "campaign");
    if (params.content) urlObj.searchParams.set("utm_content", params.content);
    return urlObj.toString();
  } catch {
    return url;
  }
}

// ============================================================================
// Block Renderers
// ============================================================================

function renderHero(block: HeroBlock, utmCampaign?: string): string {
  const { headline, subheadline, imageUrl, backgroundColor = PRIMARY_COLOR } = block.data;
  
  return `
    <tr>
      <td style="background-color: ${backgroundColor}; padding: 48px 40px; text-align: center;">
        ${imageUrl ? `<img src="${imageUrl}" alt="" style="max-width: 100%; height: auto; margin-bottom: 24px; border-radius: 8px;">` : ""}
        <h1 style="margin: 0 0 12px; color: white; font-size: 32px; font-weight: 700;">${headline}</h1>
        ${subheadline ? `<p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 18px;">${subheadline}</p>` : ""}
      </td>
    </tr>
  `;
}

function renderPromoBanner(block: PromoBannerBlock, utmCampaign?: string): string {
  const { text, expiresAt } = block.data;
  
  let expiresText = "";
  if (expiresAt) {
    const date = new Date(expiresAt);
    expiresText = ` • Expires ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  
  return urgencyBox(`🔥 ${text}${expiresText}`);
}

function renderRebateSection(block: RebateSectionBlock, utmCampaign?: string): string {
  const { title, rebates } = block.data;
  
  const rebateCards = rebates.map(r => `
    <tr>
      <td style="padding: 0 40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="top">
                    <p style="margin: 0 0 4px; color: ${PRIMARY_COLOR}; font-size: 14px; font-weight: 600; text-transform: uppercase;">${r.brand}</p>
                    <p style="margin: 0 0 4px; color: #1a1a1a; font-size: 24px; font-weight: 700;">${r.amount}</p>
                    <p style="margin: 0; color: #555555; font-size: 14px;">${r.description}</p>
                    ${r.expiresAt ? `<p style="margin: 8px 0 0; color: #888888; font-size: 12px;">Expires: ${new Date(r.expiresAt).toLocaleDateString()}</p>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join("");
  
  return `
    <tr>
      <td style="padding: 24px 40px 8px;">
        <h2 style="margin: 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">${title}</h2>
      </td>
    </tr>
    ${rebateCards}
  `;
}

function renderProductGrid(block: ProductGridBlock, utmCampaign?: string): string {
  const { title, products, columns = 2 } = block.data;
  
  // Build product rows (2 per row for email compatibility)
  const rows: string[] = [];
  for (let i = 0; i < products.length; i += 2) {
    const p1 = products[i];
    const p2 = products[i + 1];
    
    const url1 = addUtmParams(p1.linkUrl, { campaign: utmCampaign, source: "email", medium: "campaign" });
    const url2 = p2 ? addUtmParams(p2.linkUrl, { campaign: utmCampaign, source: "email", medium: "campaign" }) : "";
    
    rows.push(`
      <tr>
        <td width="48%" valign="top" style="padding: 8px;">
          <a href="${url1}" style="text-decoration: none; color: inherit; display: block;">
            ${p1.imageUrl ? `<img src="${p1.imageUrl}" alt="${p1.name}" style="width: 100%; height: auto; border-radius: 8px; margin-bottom: 8px;">` : ""}
            <p style="margin: 0; color: #888888; font-size: 12px;">${p1.brand || ""}</p>
            <p style="margin: 4px 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">${p1.name}</p>
            <p style="margin: 0;">
              ${p1.originalPrice ? `<span style="text-decoration: line-through; color: #888888; font-size: 14px;">${p1.originalPrice}</span> ` : ""}
              <span style="color: ${PRIMARY_COLOR}; font-size: 18px; font-weight: 700;">${p1.price || ""}</span>
            </p>
          </a>
        </td>
        ${p2 ? `
        <td width="48%" valign="top" style="padding: 8px;">
          <a href="${url2}" style="text-decoration: none; color: inherit; display: block;">
            ${p2.imageUrl ? `<img src="${p2.imageUrl}" alt="${p2.name}" style="width: 100%; height: auto; border-radius: 8px; margin-bottom: 8px;">` : ""}
            <p style="margin: 0; color: #888888; font-size: 12px;">${p2.brand || ""}</p>
            <p style="margin: 4px 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">${p2.name}</p>
            <p style="margin: 0;">
              ${p2.originalPrice ? `<span style="text-decoration: line-through; color: #888888; font-size: 14px;">${p2.originalPrice}</span> ` : ""}
              <span style="color: ${PRIMARY_COLOR}; font-size: 18px; font-weight: 700;">${p2.price || ""}</span>
            </p>
          </a>
        </td>
        ` : `<td width="48%"></td>`}
      </tr>
    `);
  }
  
  return `
    ${title ? `
    <tr>
      <td style="padding: 24px 40px 8px;">
        <h2 style="margin: 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">${title}</h2>
      </td>
    </tr>
    ` : ""}
    <tr>
      <td style="padding: 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${rows.join("")}
        </table>
      </td>
    </tr>
  `;
}

function renderPackageHighlight(block: PackageHighlightBlock, utmCampaign?: string): string {
  const { title, description, imageUrl, price, savings, features, ctaText, ctaUrl } = block.data;
  const url = addUtmParams(ctaUrl, { campaign: utmCampaign, source: "email", medium: "campaign" });
  
  const featureList = features?.map(f => `<li style="margin: 4px 0; color: #555555;">${f}</li>`).join("") || "";
  
  return `
    <tr>
      <td style="padding: 24px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border: 2px solid ${PRIMARY_COLOR}; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 24px;">
              ${imageUrl ? `
              <img src="${imageUrl}" alt="${title}" style="width: 100%; max-width: 400px; height: auto; border-radius: 8px; margin: 0 auto 16px; display: block;">
              ` : ""}
              <h2 style="margin: 0 0 8px; color: #1a1a1a; font-size: 24px; font-weight: 700; text-align: center;">${title}</h2>
              ${description ? `<p style="margin: 0 0 16px; color: #555555; text-align: center;">${description}</p>` : ""}
              
              <div style="text-align: center; margin: 16px 0;">
                ${price ? `<span style="font-size: 36px; font-weight: 700; color: ${PRIMARY_COLOR};">${price}</span>` : ""}
                ${savings ? `<span style="background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 999px; font-size: 14px; font-weight: 600; margin-left: 8px;">Save ${savings}</span>` : ""}
              </div>
              
              ${featureList ? `<ul style="margin: 16px 0; padding-left: 24px;">${featureList}</ul>` : ""}
              
              <div style="text-align: center; margin-top: 24px;">
                <a href="${url}" style="display: inline-block; background: ${PRIMARY_COLOR}; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  ${ctaText}
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function renderTextBlock(block: TextBlock, utmCampaign?: string): string {
  const { content, alignment = "left" } = block.data;
  return textSection(content, alignment === "center");
}

function renderCtaButton(block: CtaButtonBlock, utmCampaign?: string): string {
  const { text, url: linkUrl, style = "primary" } = block.data;
  const url = addUtmParams(linkUrl, { campaign: utmCampaign, source: "email", medium: "campaign" });
  return ctaButton(text, url, style === "outline" ? "secondary" : "primary");
}

function renderDivider(block: DividerBlock, utmCampaign?: string): string {
  const { style = "solid", color = "#e9ecef" } = block.data;
  return `
    <tr>
      <td style="padding: 0 40px;">
        <hr style="border: none; border-top: 1px ${style} ${color}; margin: 24px 0;">
      </td>
    </tr>
  `;
}

// ============================================================================
// Main Renderer
// ============================================================================

export interface RenderOptions {
  subject: string;
  previewText?: string;
  content: CampaignContent;
  includeFreeShippingBanner?: boolean;
  includePriceMatch?: boolean;
  utmCampaign?: string;
  unsubscribeUrl: string;
  recipientEmail?: string;
}

export function renderCampaignEmail(options: RenderOptions): string {
  const {
    subject,
    previewText,
    content,
    includeFreeShippingBanner = true,
    includePriceMatch = true,
    utmCampaign,
    unsubscribeUrl,
  } = options;
  
  // Render all blocks
  const blockHtml = content.blocks.map(block => {
    switch (block.type) {
      case "hero":
        return renderHero(block as HeroBlock, utmCampaign);
      case "promo_banner":
        return renderPromoBanner(block as PromoBannerBlock, utmCampaign);
      case "rebate_section":
        return renderRebateSection(block as RebateSectionBlock, utmCampaign);
      case "product_grid":
        return renderProductGrid(block as ProductGridBlock, utmCampaign);
      case "package_highlight":
        return renderPackageHighlight(block as PackageHighlightBlock, utmCampaign);
      case "text_block":
        return renderTextBlock(block as TextBlock, utmCampaign);
      case "cta_button":
        return renderCtaButton(block as CtaButtonBlock, utmCampaign);
      case "divider":
        return renderDivider(block as DividerBlock, utmCampaign);
      default:
        return "";
    }
  }).join("");

  // Build content
  const emailContent = `
    ${blockHtml}
    ${includeFreeShippingBanner ? freeShippingBanner() : ""}
    ${includePriceMatch ? infoBox("💰 Price Match Guarantee", "Found it cheaper? We'll match it.") : ""}
    ${footer({
      showPhone: true,
      unsubscribeUrl,
      customText: `Questions? Reply to this email or call ${BRAND.phone?.callDisplay || "us"}.`,
    })}
  `;

  return emailWrapper({
    title: subject,
    previewText,
    children: emailContent,
  });
}

/**
 * Generate unsubscribe URL for a subscriber
 */
export function generateUnsubscribeUrl(email: string, token?: string): string {
  if (token) {
    return `${BASE_URL}/unsubscribe?token=${encodeURIComponent(token)}`;
  }
  return `${BASE_URL}/unsubscribe?email=${encodeURIComponent(email)}`;
}

// ============================================================================
// Exports
// ============================================================================

export const campaignRenderer = {
  renderCampaignEmail,
  generateUnsubscribeUrl,
  addUtmParams,
};

export default campaignRenderer;
