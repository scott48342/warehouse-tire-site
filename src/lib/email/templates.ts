/**
 * Unified Email Template System
 * 
 * Professional table-based email templates that work across all email clients.
 * Based on the POS quote email design - clean, modern, responsive.
 * 
 * @created 2026-04-29
 */

import { BRAND } from "@/lib/brand";

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://shop.warehousetiredirect.com";
const PRIMARY_COLOR = "#dc2626"; // Brand red
const DARK_BG = "#1a1a1a";
const LIGHT_BG = "#f8f9fa";
const BORDER_COLOR = "#e9ecef";
const TEXT_PRIMARY = "#1a1a1a";
const TEXT_SECONDARY = "#555555";
const TEXT_MUTED = "#888888";
const SUCCESS_COLOR = "#22c55e";

// ============================================================================
// Helper Functions
// ============================================================================

export function formatPrice(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPriceWhole(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ============================================================================
// Base Template Wrapper
// ============================================================================

export interface EmailWrapperOptions {
  title: string;
  previewText?: string;
  children: string;
}

/**
 * Main email wrapper - provides consistent header, container, and base styles
 */
export function emailWrapper(options: EmailWrapperOptions): string {
  const { title, previewText, children } = options;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title} - ${BRAND.name}</title>
  ${previewText ? `<!--[if !mso]><!--><span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</span><!--<![endif]-->` : ""}
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    .fallback-font { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  
  <!-- Wrapper Table -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        
        <!-- Main Container -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: ${DARK_BG}; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">${BRAND.name}</h1>
            </td>
          </tr>
          
          ${children}
          
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>
  `.trim();
}

// ============================================================================
// Common Components
// ============================================================================

/**
 * Info bar below header (quote #, order #, date, etc.)
 */
export function infoBar(leftLabel: string, leftValue: string, rightLabel: string, rightValue: string): string {
  return `
    <tr>
      <td style="background-color: ${LIGHT_BG}; padding: 16px 40px; border-bottom: 1px solid ${BORDER_COLOR};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <span style="color: #6c757d; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">${leftLabel}</span>
              <br>
              <span style="color: ${TEXT_PRIMARY}; font-size: 18px; font-weight: 700; font-family: 'Courier New', monospace;">${leftValue}</span>
            </td>
            <td style="text-align: right;">
              <span style="color: #6c757d; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">${rightLabel}</span>
              <br>
              <span style="color: ${TEXT_PRIMARY}; font-size: 14px;">${rightValue}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Greeting section
 */
export function greeting(name: string | null, message: string): string {
  return `
    <tr>
      <td style="padding: 32px 40px 24px;">
        ${name ? `<p style="margin: 0; color: ${TEXT_PRIMARY}; font-size: 16px; line-height: 1.5;">Hi <strong>${name}</strong>,</p>` : ""}
        <p style="margin: ${name ? "12px" : "0"} 0 0; color: ${TEXT_SECONDARY}; font-size: 15px; line-height: 1.5;">
          ${message}
        </p>
      </td>
    </tr>
  `;
}

/**
 * Product card (wheels, tires, accessories)
 */
export interface ProductCardOptions {
  emoji: string;
  sectionTitle: string;
  imageUrl?: string;
  title: string;
  subtitle: string;
  sku?: string;
  totalPrice: number;
  unitPrice?: number;
  quantity?: number;
}

export function productCard(options: ProductCardOptions): string {
  const { emoji, sectionTitle, imageUrl, title, subtitle, sku, totalPrice, unitPrice, quantity } = options;

  return `
    <tr>
      <td style="padding: 0 40px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${LIGHT_BG}; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 16px 20px; background-color: ${BORDER_COLOR};">
              <span style="color: #495057; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${emoji} ${sectionTitle}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${imageUrl ? `
                  <td width="80" valign="top" style="padding-right: 16px;">
                    <img src="${imageUrl}" alt="${title}" width="80" height="80" style="display: block; border-radius: 6px; background-color: #ffffff; object-fit: contain;">
                  </td>
                  ` : ""}
                  <td valign="top">
                    <p style="margin: 0 0 4px; color: ${TEXT_PRIMARY}; font-size: 16px; font-weight: 600;">${title}</p>
                    <p style="margin: 0 0 4px; color: ${TEXT_SECONDARY}; font-size: 14px;">${subtitle}</p>
                    ${sku ? `<p style="margin: 0; color: ${TEXT_MUTED}; font-size: 12px;">SKU: ${sku}</p>` : ""}
                  </td>
                  <td valign="top" align="right" width="100">
                    <p style="margin: 0; color: ${TEXT_PRIMARY}; font-size: 20px; font-weight: 700;">$${formatPrice(totalPrice)}</p>
                    ${unitPrice && quantity ? `<p style="margin: 4px 0 0; color: ${TEXT_MUTED}; font-size: 12px;">$${formatPrice(unitPrice)} × ${quantity}</p>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Services/line items section
 */
export interface ServiceItem {
  name: string;
  price: number;
  quantity?: number;
}

export function servicesSection(title: string, emoji: string, items: ServiceItem[]): string {
  if (items.length === 0) return "";

  const rows = items.map(item => `
    <tr>
      <td style="padding: 8px 0; color: ${TEXT_SECONDARY}; font-size: 14px;">${item.name}${item.quantity ? ` (×${item.quantity})` : ""}</td>
      <td style="padding: 8px 0; text-align: right; font-size: 14px;">$${formatPrice(item.price)}</td>
    </tr>
  `).join("");

  return `
    <tr>
      <td style="padding: 0 40px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${LIGHT_BG}; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 16px 20px; background-color: ${BORDER_COLOR};">
              <span style="color: #495057; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${emoji} ${title}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${rows}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Price summary box (dark background)
 */
export interface PriceSummaryLine {
  label: string;
  amount: number;
  isDiscount?: boolean;
  isHighlight?: boolean;
}

export function priceSummary(lines: PriceSummaryLine[], totalLabel: string, totalAmount: number): string {
  const lineRows = lines.map(line => {
    const color = line.isDiscount ? SUCCESS_COLOR : line.isHighlight ? "#ffffff" : "#aaaaaa";
    const amountColor = line.isDiscount ? SUCCESS_COLOR : "#ffffff";
    const prefix = line.isDiscount ? "−" : "";
    
    return `
      <tr>
        <td style="padding: 6px 0; color: ${color}; font-size: 14px;">${line.label}</td>
        <td style="padding: 6px 0; text-align: right; color: ${amountColor}; font-size: 14px;">${prefix}$${formatPrice(Math.abs(line.amount))}</td>
      </tr>
    `;
  }).join("");

  return `
    <tr>
      <td style="padding: 0 40px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${DARK_BG}; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${lineRows}
                <tr>
                  <td colspan="2" style="padding-top: 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #333333;">
                      <tr>
                        <td style="padding-top: 16px; color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${totalLabel}</td>
                        <td style="padding-top: 16px; text-align: right; color: ${SUCCESS_COLOR}; font-size: 28px; font-weight: 700;">$${formatPrice(totalAmount)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Notes/info box (yellow background)
 */
export function notesBox(title: string, content: string): string {
  return `
    <tr>
      <td style="padding: 0 40px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border-radius: 8px; border: 1px solid #fef3c7;">
          <tr>
            <td style="padding: 16px 20px;">
              <p style="margin: 0 0 4px; color: #92400e; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${title}</p>
              <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.5;">${content}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Urgency/warning box (amber background)
 */
export function urgencyBox(content: string): string {
  return `
    <tr>
      <td style="padding: 0 40px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 8px; border: 1px solid #f59e0b;">
          <tr>
            <td style="padding: 12px 16px; text-align: center;">
              <span style="color: #92400e; font-weight: 600;">${content}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Info box (blue background - for price match, etc.)
 */
export function infoBox(title: string, content: string): string {
  return `
    <tr>
      <td style="padding: 0 40px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; border: 1px solid #3b82f6;">
          <tr>
            <td style="padding: 16px 20px;">
              <p style="margin: 0 0 4px; color: #1e40af; font-size: 14px; font-weight: 600;">${title}</p>
              <p style="margin: 0; color: #1e3a8a; font-size: 14px; line-height: 1.5;">${content}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Success box (green background)
 */
export function successBox(title: string, content: string): string {
  return `
    <tr>
      <td style="padding: 0 40px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #dcfce7; border-radius: 8px; border: 1px solid #22c55e;">
          <tr>
            <td style="padding: 16px 20px;">
              <p style="margin: 0 0 4px; color: #166534; font-size: 14px; font-weight: 600;">${title}</p>
              <p style="margin: 0; color: #15803d; font-size: 14px; line-height: 1.5;">${content}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * CTA button
 */
export function ctaButton(text: string, url: string, style: "primary" | "secondary" = "primary"): string {
  const bgColor = style === "primary" ? PRIMARY_COLOR : DARK_BG;

  return `
    <tr>
      <td style="padding: 0 40px 32px; text-align: center;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
          <tr>
            <td style="background-color: ${bgColor}; border-radius: 6px;">
              <a href="${url}" style="display: inline-block; padding: 14px 32px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none;">${text}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Text section
 */
export function textSection(content: string, centered: boolean = false): string {
  return `
    <tr>
      <td style="padding: 0 40px 24px; ${centered ? "text-align: center;" : ""}">
        <p style="margin: 0; color: ${TEXT_SECONDARY}; font-size: 14px; line-height: 1.6;">${content}</p>
      </td>
    </tr>
  `;
}

/**
 * Vehicle info box
 */
export function vehicleBox(vehicleLabel: string): string {
  return `
    <tr>
      <td style="padding: 0 40px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${LIGHT_BG}; border-radius: 8px;">
          <tr>
            <td style="padding: 16px 20px;">
              <span style="color: #6c757d; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your Vehicle</span>
              <br>
              <span style="color: ${TEXT_PRIMARY}; font-size: 18px; font-weight: 600;">🚗 ${vehicleLabel}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Footer section
 */
export function footer(options: {
  showValidity?: boolean;
  validityText?: string;
  showPhone?: boolean;
  unsubscribeUrl?: string;
  customText?: string;
}): string {
  const { showValidity, validityText, showPhone = true, unsubscribeUrl, customText } = options;

  return `
    <tr>
      <td style="background-color: ${LIGHT_BG}; padding: 24px 40px; text-align: center; border-top: 1px solid ${BORDER_COLOR};">
        ${showValidity && validityText ? `<p style="margin: 0 0 8px; color: ${TEXT_MUTED}; font-size: 12px;">${validityText}</p>` : ""}
        <p style="margin: 0; color: ${TEXT_PRIMARY}; font-size: 14px; font-weight: 600;">${BRAND.name}</p>
        ${showPhone ? `<p style="margin: 8px 0 0; color: ${TEXT_MUTED}; font-size: 12px;">${BRAND.phone?.callDisplay || "(248) 974-0888"}</p>` : ""}
        ${customText ? `<p style="margin: 8px 0 0; color: ${TEXT_MUTED}; font-size: 12px;">${customText}</p>` : ""}
        ${unsubscribeUrl ? `<p style="margin: 12px 0 0;"><a href="${unsubscribeUrl}" style="color: #9ca3af; font-size: 11px;">Unsubscribe</a></p>` : ""}
      </td>
    </tr>
  `;
}

/**
 * Free shipping banner
 */
export function freeShippingBanner(): string {
  return `
    <tr>
      <td style="padding: 0 40px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #dcfce7; border-radius: 8px; border: 1px solid #22c55e;">
          <tr>
            <td style="padding: 12px 16px; text-align: center;">
              <span style="color: #166534; font-weight: 600;">🚚 FREE SHIPPING on orders over $1,500</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Admin notification banner
 */
export function adminBanner(title: string, details: { label: string; value: string }[]): string {
  const detailRows = details.map(d => `<span style="font-size: 14px;">${d.label}: ${d.value}</span><br>`).join("");

  return `
    <tr>
      <td style="padding: 24px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 8px; border: 1px solid #f59e0b;">
          <tr>
            <td style="padding: 16px 20px;">
              <strong style="color: #92400e;">🔔 ${title}</strong><br>
              ${detailRows}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Hero section with headline (for marketing emails)
 */
export function heroSection(headline: string, subheadline?: string, imageUrl?: string): string {
  return `
    <tr>
      <td style="background-color: ${PRIMARY_COLOR}; padding: 48px 40px; text-align: center;">
        ${imageUrl ? `<img src="${imageUrl}" alt="" style="max-width: 100%; height: auto; margin-bottom: 24px; border-radius: 8px;">` : ""}
        <h1 style="margin: 0 0 12px; color: white; font-size: 32px; font-weight: 700;">${headline}</h1>
        ${subheadline ? `<p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 18px;">${subheadline}</p>` : ""}
      </td>
    </tr>
  `;
}

// ============================================================================
// Exports
// ============================================================================

export const emailTemplates = {
  wrapper: emailWrapper,
  infoBar,
  greeting,
  productCard,
  servicesSection,
  priceSummary,
  notesBox,
  urgencyBox,
  infoBox,
  successBox,
  ctaButton,
  textSection,
  vehicleBox,
  footer,
  freeShippingBanner,
  adminBanner,
  heroSection,
  formatPrice,
  formatPriceWhole,
};

export default emailTemplates;
