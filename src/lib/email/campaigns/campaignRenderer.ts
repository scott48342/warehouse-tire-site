/**
 * Campaign Email Renderer
 * 
 * Renders campaign emails from DB-first content blocks.
 * NO live vendor/API calls during rendering - everything comes from contentJson.
 * 
 * @created 2026-04-03
 */

import { BRAND } from "@/lib/brand";
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
const PRIMARY_COLOR = "#dc2626"; // Brand red
const SECONDARY_COLOR = "#1f2937"; // Dark gray

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
    <div style="background: ${backgroundColor}; padding: 48px 32px; text-align: center;">
      ${imageUrl ? `<img src="${imageUrl}" alt="" style="max-width: 100%; height: auto; margin-bottom: 24px;">` : ""}
      <h1 style="margin: 0 0 12px; color: white; font-size: 32px; font-weight: 700;">${headline}</h1>
      ${subheadline ? `<p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 18px;">${subheadline}</p>` : ""}
    </div>
  `;
}

function renderPromoBanner(block: PromoBannerBlock, utmCampaign?: string): string {
  const { text, backgroundColor = "#fef3c7", textColor = "#92400e", expiresAt } = block.data;
  
  let expiresText = "";
  if (expiresAt) {
    const date = new Date(expiresAt);
    expiresText = ` • Expires ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  
  return `
    <div style="background: ${backgroundColor}; border: 1px solid ${textColor}33; border-radius: 8px; padding: 16px 24px; margin: 24px 0; text-align: center;">
      <span style="color: ${textColor}; font-weight: 600; font-size: 16px;">
        🔥 ${text}${expiresText}
      </span>
    </div>
  `;
}

function renderRebateSection(block: RebateSectionBlock, utmCampaign?: string): string {
  const { title, rebates } = block.data;
  
  const rebateCards = rebates.map(r => `
    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
      <div style="font-weight: 600; color: ${PRIMARY_COLOR}; font-size: 18px;">${r.brand}</div>
      <div style="font-size: 24px; font-weight: 700; color: ${SECONDARY_COLOR}; margin: 8px 0;">${r.amount}</div>
      <div style="font-size: 14px; color: #6b7280;">${r.description}</div>
      ${r.expiresAt ? `<div style="font-size: 12px; color: #9ca3af; margin-top: 8px;">Expires: ${new Date(r.expiresAt).toLocaleDateString()}</div>` : ""}
    </div>
  `).join("");
  
  return `
    <div style="padding: 24px 0;">
      <h2 style="margin: 0 0 16px; color: ${SECONDARY_COLOR}; font-size: 24px; font-weight: 600;">${title}</h2>
      ${rebateCards}
    </div>
  `;
}

function renderProductGrid(block: ProductGridBlock, utmCampaign?: string): string {
  const { title, products, columns = 2 } = block.data;
  const columnWidth = Math.floor(100 / columns) - 2;
  
  const productCards = products.map(p => {
    const url = addUtmParams(p.linkUrl, { campaign: utmCampaign, source: "email", medium: "campaign" });
    return `
      <td style="width: ${columnWidth}%; padding: 8px; vertical-align: top;">
        <a href="${url}" style="text-decoration: none; color: inherit; display: block;">
          ${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.name}" style="width: 100%; height: auto; border-radius: 8px; margin-bottom: 8px;">` : ""}
          <div style="font-size: 12px; color: #6b7280;">${p.brand || ""}</div>
          <div style="font-weight: 600; color: ${SECONDARY_COLOR}; margin: 4px 0;">${p.name}</div>
          <div>
            ${p.originalPrice ? `<span style="text-decoration: line-through; color: #9ca3af; font-size: 14px;">${p.originalPrice}</span>` : ""}
            <span style="font-weight: 700; color: ${PRIMARY_COLOR}; font-size: 18px;">${p.price || ""}</span>
          </div>
        </a>
      </td>
    `;
  }).join("");
  
  // Chunk into rows
  const rows: string[] = [];
  for (let i = 0; i < products.length; i += columns) {
    const rowCells = productCards.slice(i * (productCards.length / products.length), (i + columns) * (productCards.length / products.length));
    rows.push(`<tr>${products.slice(i, i + columns).map((p, j) => {
      const url = addUtmParams(p.linkUrl, { campaign: utmCampaign, source: "email", medium: "campaign" });
      return `
        <td style="width: ${columnWidth}%; padding: 8px; vertical-align: top;">
          <a href="${url}" style="text-decoration: none; color: inherit; display: block;">
            ${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.name}" style="width: 100%; height: auto; border-radius: 8px; margin-bottom: 8px;">` : ""}
            <div style="font-size: 12px; color: #6b7280;">${p.brand || ""}</div>
            <div style="font-weight: 600; color: ${SECONDARY_COLOR}; margin: 4px 0;">${p.name}</div>
            <div>
              ${p.originalPrice ? `<span style="text-decoration: line-through; color: #9ca3af; font-size: 14px;">${p.originalPrice}</span>` : ""}
              <span style="font-weight: 700; color: ${PRIMARY_COLOR}; font-size: 18px;">${p.price || ""}</span>
            </div>
          </a>
        </td>
      `;
    }).join("")}</tr>`);
  }
  
  return `
    <div style="padding: 24px 0;">
      ${title ? `<h2 style="margin: 0 0 16px; color: ${SECONDARY_COLOR}; font-size: 24px; font-weight: 600;">${title}</h2>` : ""}
      <table style="width: 100%; border-collapse: collapse;">
        ${rows.join("")}
      </table>
    </div>
  `;
}

function renderPackageHighlight(block: PackageHighlightBlock, utmCampaign?: string): string {
  const { title, description, imageUrl, price, savings, features, ctaText, ctaUrl } = block.data;
  const url = addUtmParams(ctaUrl, { campaign: utmCampaign, source: "email", medium: "campaign" });
  
  const featureList = features?.map(f => `<li style="margin: 4px 0;">${f}</li>`).join("") || "";
  
  return `
    <div style="background: #f9fafb; border: 2px solid ${PRIMARY_COLOR}; border-radius: 12px; padding: 24px; margin: 24px 0;">
      ${imageUrl ? `<img src="${imageUrl}" alt="${title}" style="width: 100%; max-width: 400px; height: auto; border-radius: 8px; margin: 0 auto 16px; display: block;">` : ""}
      <h2 style="margin: 0 0 8px; color: ${SECONDARY_COLOR}; font-size: 24px; font-weight: 700; text-align: center;">${title}</h2>
      ${description ? `<p style="margin: 0 0 16px; color: #6b7280; text-align: center;">${description}</p>` : ""}
      
      <div style="text-align: center; margin: 16px 0;">
        ${price ? `<span style="font-size: 36px; font-weight: 700; color: ${PRIMARY_COLOR};">${price}</span>` : ""}
        ${savings ? `<div style="background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 999px; display: inline-block; font-size: 14px; font-weight: 600; margin-left: 8px;">Save ${savings}</div>` : ""}
      </div>
      
      ${featureList ? `<ul style="margin: 16px 0; padding-left: 24px; color: #4b5563;">${featureList}</ul>` : ""}
      
      <div style="text-align: center; margin-top: 24px;">
        <a href="${url}" style="display: inline-block; background: ${PRIMARY_COLOR}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          ${ctaText}
        </a>
      </div>
    </div>
  `;
}

function renderTextBlock(block: TextBlock, utmCampaign?: string): string {
  const { content, alignment = "left" } = block.data;
  
  return `
    <div style="padding: 16px 0; text-align: ${alignment}; color: #4b5563; font-size: 16px; line-height: 1.6;">
      ${content}
    </div>
  `;
}

function renderCtaButton(block: CtaButtonBlock, utmCampaign?: string): string {
  const { text, url: linkUrl, style = "primary", alignment = "center" } = block.data;
  const url = addUtmParams(linkUrl, { campaign: utmCampaign, source: "email", medium: "campaign" });
  
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    primary: { bg: PRIMARY_COLOR, color: "white", border: PRIMARY_COLOR },
    secondary: { bg: SECONDARY_COLOR, color: "white", border: SECONDARY_COLOR },
    outline: { bg: "transparent", color: PRIMARY_COLOR, border: PRIMARY_COLOR },
  };
  
  const s = styles[style] || styles.primary;
  
  return `
    <div style="padding: 24px 0; text-align: ${alignment};">
      <a href="${url}" style="display: inline-block; background: ${s.bg}; color: ${s.color}; border: 2px solid ${s.border}; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
        ${text}
      </a>
    </div>
  `;
}

function renderDivider(block: DividerBlock, utmCampaign?: string): string {
  const { style = "solid", color = "#e5e7eb" } = block.data;
  return `<hr style="border: none; border-top: 1px ${style} ${color}; margin: 24px 0;">`;
}

// ============================================================================
// Standard Sections
// ============================================================================

function renderFreeShippingBanner(): string {
  return `
    <div style="background: #dcfce7; border: 1px solid #22c55e; border-radius: 8px; padding: 12px 16px; margin: 16px 0; text-align: center;">
      <span style="color: #166534; font-weight: 600;">🚚 FREE SHIPPING on orders over $1,500</span>
    </div>
  `;
}

function renderPriceMatchBanner(): string {
  return `
    <div style="background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 12px 16px; margin: 16px 0; text-align: center;">
      <span style="font-weight: 600; color: #1e40af;">💰 Price Match Guarantee</span>
      <span style="color: #1e3a8a; font-size: 14px;"> — Found it cheaper? We'll match it.</span>
    </div>
  `;
}

function renderUnsubscribeFooter(unsubscribeUrl: string): string {
  return `
    <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
        Questions? Reply to this email or call ${BRAND.phone?.callDisplay || "us"}
      </p>
      <p style="margin: 0 0 16px; color: #9ca3af; font-size: 12px;">
        ${BRAND.name}
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 11px;">
        <a href="${unsubscribeUrl}" style="color: #9ca3af;">Unsubscribe from marketing emails</a>
      </p>
    </div>
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
  recipientEmail?: string; // For personalization
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
  
  // Build full email
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  ${previewText ? `<!--[if !mso]><!--><span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</span><!--<![endif]-->` : ""}
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background: #f5f5f5;">

  <div style="background: white; overflow: hidden;">
    
    <!-- Header -->
    <div style="background: ${PRIMARY_COLOR}; padding: 16px; text-align: center;">
      <a href="${addUtmParams(BASE_URL, { campaign: utmCampaign, source: "email", medium: "campaign", content: "header_logo" })}" style="text-decoration: none;">
        <span style="color: white; font-size: 24px; font-weight: 700;">${BRAND.name}</span>
      </a>
    </div>

    <!-- Content -->
    <div style="padding: 0 24px;">
      ${blockHtml}
      
      ${includeFreeShippingBanner ? renderFreeShippingBanner() : ""}
      ${includePriceMatch ? renderPriceMatchBanner() : ""}
    </div>

    <!-- Footer -->
    ${renderUnsubscribeFooter(unsubscribeUrl)}

  </div>

</body>
</html>
  `.trim();
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
