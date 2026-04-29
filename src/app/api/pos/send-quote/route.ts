import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import pg from "pg";
import { BRAND } from "@/lib/brand";

const { Pool } = pg;

// ============================================================================
// POS Quote Email API - Professional email template
// ============================================================================

type EmailSettings = {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
  notifyEmail: string;
};

function getPool() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Missing DATABASE_URL");
  return new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });
}

async function getEmailSettings(): Promise<EmailSettings | null> {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT value FROM admin_settings WHERE key = 'email'`
    );
    if (rows.length === 0) return null;
    const val = rows[0].value;
    if (!val || !val.enabled) return null;
    return {
      enabled: !!val.enabled,
      smtpHost: val.smtpHost || "",
      smtpPort: parseInt(val.smtpPort, 10) || 587,
      smtpUser: val.smtpUser || "",
      smtpPass: val.smtpPass || "",
      fromEmail: val.fromEmail || "",
      fromName: val.fromName || BRAND.name,
      notifyEmail: val.notifyEmail || "",
    };
  } catch (err) {
    console.error("[pos-email] Failed to get settings:", err);
    return null;
  } finally {
    await pool.end();
  }
}

async function getTransporter(settings: EmailSettings) {
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpPort === 465,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPass,
    },
    requireTLS: settings.smtpPort === 587,
    tls: {
      ciphers: "SSLv3",
      rejectUnauthorized: false,
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      to,
      customerName,
      quoteId,
      vehicle,
      wheel,
      tire,
      laborTotal,
      addOnsTotal,
      discountAmount,
      taxAmount,
      creditCardFee,
      outTheDoorPrice,
      selectedAddOns,
      adminSettings,
      notes,
    } = body;

    if (!to) {
      return NextResponse.json({ error: "Email address required" }, { status: 400 });
    }

    const settings = await getEmailSettings();
    if (!settings) {
      return NextResponse.json(
        { error: "Email not configured. Please set up email in Admin Settings." },
        { status: 500 }
      );
    }

    const transporter = await getTransporter(settings);
    const fromAddress = `"${settings.fromName}" <${settings.fromEmail}>`;

    const html = buildQuoteEmailHtml({
      customerName,
      quoteId,
      vehicle,
      wheel,
      tire,
      laborTotal,
      addOnsTotal,
      discountAmount,
      taxAmount,
      creditCardFee,
      outTheDoorPrice,
      selectedAddOns,
      adminSettings,
      notes,
    });

    const text = buildQuoteEmailText({
      customerName,
      quoteId,
      vehicle,
      wheel,
      tire,
      laborTotal,
      addOnsTotal,
      discountAmount,
      taxAmount,
      creditCardFee,
      outTheDoorPrice,
      selectedAddOns,
      adminSettings,
      notes,
    });

    await transporter.sendMail({
      from: fromAddress,
      to,
      subject: `Your Wheel & Tire Quote ${quoteId} | ${BRAND.name}`,
      html,
      text,
    });

    console.log(`[pos-email] Quote ${quoteId} sent to ${to}`);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[pos-email] Failed to send:", err.message);
    return NextResponse.json(
      { error: err.message || "Failed to send email" },
      { status: 500 }
    );
  }
}

// ============================================================================
// Email Templates - Table-based layout for email client compatibility
// ============================================================================

interface QuoteEmailData {
  customerName: string;
  quoteId: string;
  vehicle: { year: string; make: string; model: string; trim?: string };
  wheel: {
    brand: string;
    model: string;
    sku: string;
    diameter: number;
    width: number;
    finish?: string;
    setPrice: number;
    unitPrice: number;
    imageUrl?: string;
  };
  tire: {
    brand: string;
    model: string;
    sku: string;
    size: string;
    setPrice: number;
    unitPrice: number;
    imageUrl?: string;
  };
  laborTotal: number;
  addOnsTotal: number;
  discountAmount: number;
  taxAmount: number;
  creditCardFee: number;
  outTheDoorPrice: number;
  selectedAddOns: Record<string, boolean | string[]>;
  adminSettings: {
    tpmsPerSensor: number;
    disposalPerTire: number;
    creditCardFeePercent: number;
    customAddOns: Array<{ id: string; name: string; price: number; perUnit: boolean }>;
  };
  notes?: string;
}

function formatPrice(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildQuoteEmailHtml(data: QuoteEmailData): string {
  const {
    customerName,
    quoteId,
    vehicle,
    wheel,
    tire,
    laborTotal,
    addOnsTotal,
    discountAmount,
    taxAmount,
    creditCardFee,
    outTheDoorPrice,
    selectedAddOns,
    adminSettings,
    notes,
  } = data;

  const vehicleLabel = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .filter(Boolean)
    .join(" ");

  const quoteDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const partsTotal = wheel.setPrice + tire.setPrice;

  // Build services rows
  const serviceRows: string[] = [];
  if (selectedAddOns.labor && laborTotal > 0) {
    serviceRows.push(`
      <tr>
        <td style="padding: 8px 0; color: #555; font-size: 14px;">Mount & Balance (×4)</td>
        <td style="padding: 8px 0; text-align: right; font-size: 14px;">$${formatPrice(laborTotal)}</td>
      </tr>
    `);
  }
  if (selectedAddOns.tpms) {
    const tpmsTotal = adminSettings.tpmsPerSensor * 4;
    serviceRows.push(`
      <tr>
        <td style="padding: 8px 0; color: #555; font-size: 14px;">TPMS Sensors (×4)</td>
        <td style="padding: 8px 0; text-align: right; font-size: 14px;">$${formatPrice(tpmsTotal)}</td>
      </tr>
    `);
  }
  if (selectedAddOns.disposal) {
    const disposalTotal = adminSettings.disposalPerTire * 4;
    serviceRows.push(`
      <tr>
        <td style="padding: 8px 0; color: #555; font-size: 14px;">Tire Disposal (×4)</td>
        <td style="padding: 8px 0; text-align: right; font-size: 14px;">$${formatPrice(disposalTotal)}</td>
      </tr>
    `);
  }
  
  // Custom add-ons
  const customIds = (selectedAddOns.customIds as string[]) || [];
  for (const addon of adminSettings.customAddOns || []) {
    if (customIds.includes(addon.id) && addon.name.toLowerCase() !== "valve stems") {
      const price = addon.perUnit ? addon.price * 4 : addon.price;
      serviceRows.push(`
        <tr>
          <td style="padding: 8px 0; color: #555; font-size: 14px;">${addon.name}${addon.perUnit ? " (×4)" : ""}</td>
          <td style="padding: 8px 0; text-align: right; font-size: 14px;">$${formatPrice(price)}</td>
        </tr>
      `);
    }
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Quote ${quoteId} - ${BRAND.name}</title>
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
            <td style="background-color: #1a1a1a; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">${BRAND.name}</h1>
              <p style="margin: 8px 0 0; color: #888888; font-size: 14px; font-weight: 400;">Wheel & Tire Package Quote</p>
            </td>
          </tr>
          
          <!-- Quote Info Bar -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 16px 40px; border-bottom: 1px solid #e9ecef;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="color: #6c757d; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Quote</span>
                    <br>
                    <span style="color: #1a1a1a; font-size: 18px; font-weight: 700; font-family: 'Courier New', monospace;">${quoteId}</span>
                  </td>
                  <td style="text-align: right;">
                    <span style="color: #6c757d; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Date</span>
                    <br>
                    <span style="color: #1a1a1a; font-size: 14px;">${quoteDate}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 40px 24px;">
              <p style="margin: 0; color: #1a1a1a; font-size: 16px; line-height: 1.5;">
                Hi <strong>${customerName}</strong>,
              </p>
              <p style="margin: 12px 0 0; color: #555555; font-size: 15px; line-height: 1.5;">
                Thanks for your interest! Here's your custom wheel and tire package quote for your <strong style="color: #1a1a1a;">${vehicleLabel}</strong>.
              </p>
            </td>
          </tr>
          
          <!-- Wheels Section -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; background-color: #e9ecef;">
                    <span style="color: #495057; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">🛞 Wheels — Set of 4</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        ${wheel.imageUrl ? `
                        <td width="80" valign="top" style="padding-right: 16px;">
                          <img src="${wheel.imageUrl}" alt="${wheel.brand} ${wheel.model}" width="80" height="80" style="display: block; border-radius: 6px; background-color: #ffffff;">
                        </td>
                        ` : ""}
                        <td valign="top">
                          <p style="margin: 0 0 4px; color: #1a1a1a; font-size: 16px; font-weight: 600;">${wheel.brand} ${wheel.model}</p>
                          <p style="margin: 0 0 4px; color: #555555; font-size: 14px;">${wheel.diameter}" × ${wheel.width}"${wheel.finish ? ` &bull; ${wheel.finish}` : ""}</p>
                          <p style="margin: 0; color: #888888; font-size: 12px;">SKU: ${wheel.sku}</p>
                        </td>
                        <td valign="top" align="right" width="100">
                          <p style="margin: 0; color: #1a1a1a; font-size: 20px; font-weight: 700;">$${formatPrice(wheel.setPrice)}</p>
                          <p style="margin: 4px 0 0; color: #888888; font-size: 12px;">$${formatPrice(wheel.unitPrice)} ea</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Tires Section -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; background-color: #e9ecef;">
                    <span style="color: #495057; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">🚗 Tires — Set of 4</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        ${tire.imageUrl ? `
                        <td width="80" valign="top" style="padding-right: 16px;">
                          <img src="${tire.imageUrl}" alt="${tire.brand} ${tire.model}" width="80" height="80" style="display: block; border-radius: 6px; background-color: #ffffff;">
                        </td>
                        ` : ""}
                        <td valign="top">
                          <p style="margin: 0 0 4px; color: #1a1a1a; font-size: 16px; font-weight: 600;">${tire.brand} ${tire.model}</p>
                          <p style="margin: 0 0 4px; color: #555555; font-size: 14px;">${tire.size}</p>
                          <p style="margin: 0; color: #888888; font-size: 12px;">SKU: ${tire.sku}</p>
                        </td>
                        <td valign="top" align="right" width="100">
                          <p style="margin: 0; color: #1a1a1a; font-size: 20px; font-weight: 700;">$${formatPrice(tire.setPrice)}</p>
                          <p style="margin: 4px 0 0; color: #888888; font-size: 12px;">$${formatPrice(tire.unitPrice)} ea</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          ${serviceRows.length > 0 ? `
          <!-- Services Section -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; background-color: #e9ecef;">
                    <span style="color: #495057; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">🔧 Installation & Services</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${serviceRows.join("")}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}
          
          <!-- Price Summary -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 6px 0; color: #aaaaaa; font-size: 14px;">Parts (Wheels + Tires)</td>
                        <td style="padding: 6px 0; text-align: right; color: #ffffff; font-size: 14px;">$${formatPrice(partsTotal)}</td>
                      </tr>
                      ${laborTotal > 0 ? `
                      <tr>
                        <td style="padding: 6px 0; color: #aaaaaa; font-size: 14px;">Labor</td>
                        <td style="padding: 6px 0; text-align: right; color: #ffffff; font-size: 14px;">$${formatPrice(laborTotal)}</td>
                      </tr>
                      ` : ""}
                      ${addOnsTotal > 0 ? `
                      <tr>
                        <td style="padding: 6px 0; color: #aaaaaa; font-size: 14px;">Add-ons</td>
                        <td style="padding: 6px 0; text-align: right; color: #ffffff; font-size: 14px;">$${formatPrice(addOnsTotal)}</td>
                      </tr>
                      ` : ""}
                      ${discountAmount > 0 ? `
                      <tr>
                        <td style="padding: 6px 0; color: #22c55e; font-size: 14px;">Discount</td>
                        <td style="padding: 6px 0; text-align: right; color: #22c55e; font-size: 14px;">−$${formatPrice(discountAmount)}</td>
                      </tr>
                      ` : ""}
                      <tr>
                        <td style="padding: 6px 0; color: #aaaaaa; font-size: 14px;">Sales Tax (6%)</td>
                        <td style="padding: 6px 0; text-align: right; color: #ffffff; font-size: 14px;">$${formatPrice(taxAmount)}</td>
                      </tr>
                      ${creditCardFee > 0 ? `
                      <tr>
                        <td style="padding: 6px 0; color: #aaaaaa; font-size: 14px;">Non Cash Fee (${adminSettings.creditCardFeePercent}%)</td>
                        <td style="padding: 6px 0; text-align: right; color: #ffffff; font-size: 14px;">$${formatPrice(creditCardFee)}</td>
                      </tr>
                      ` : ""}
                      <tr>
                        <td colspan="2" style="padding-top: 16px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #333333;">
                            <tr>
                              <td style="padding-top: 16px; color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Out The Door</td>
                              <td style="padding-top: 16px; text-align: right; color: #22c55e; font-size: 28px; font-weight: 700;">$${formatPrice(outTheDoorPrice)}</td>
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
          
          ${notes ? `
          <!-- Notes -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border-radius: 8px; border: 1px solid #fef3c7;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 4px; color: #92400e; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Notes</p>
                    <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.5;">${notes}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}
          
          <!-- CTA -->
          <tr>
            <td style="padding: 0 40px 32px; text-align: center;">
              <p style="margin: 0 0 16px; color: #555555; font-size: 14px;">Ready to get rolling? Give us a call or stop by!</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #dc2626; border-radius: 6px;">
                    <a href="tel:${BRAND.phone?.callE164 || "+12483324120"}" style="display: inline-block; padding: 14px 32px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none;">${BRAND.phone?.callDisplay || "248-332-4120"}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 24px 40px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 8px; color: #888888; font-size: 12px;">Quote valid for 7 days &bull; Prices subject to change &bull; Installation at our location</p>
              <p style="margin: 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">${BRAND.name}</p>
              <p style="margin: 8px 0 0; color: #888888; font-size: 12px;">Questions? Just reply to this email.</p>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>
  `.trim();
}

function buildQuoteEmailText(data: QuoteEmailData): string {
  const {
    customerName,
    quoteId,
    vehicle,
    wheel,
    tire,
    laborTotal,
    addOnsTotal,
    discountAmount,
    taxAmount,
    creditCardFee,
    outTheDoorPrice,
    selectedAddOns,
    adminSettings,
    notes,
  } = data;

  const vehicleLabel = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .filter(Boolean)
    .join(" ");

  const partsTotal = wheel.setPrice + tire.setPrice;

  let text = `
═══════════════════════════════════════════════════════
                    ${BRAND.name}
              WHEEL & TIRE PACKAGE QUOTE
═══════════════════════════════════════════════════════

Quote #: ${quoteId}
Date: ${new Date().toLocaleDateString()}

Hi ${customerName},

Thanks for your interest! Here's your custom quote for your ${vehicleLabel}.

───────────────────────────────────────────────────────
WHEELS (Set of 4)
───────────────────────────────────────────────────────
${wheel.brand} ${wheel.model}
${wheel.diameter}" × ${wheel.width}"${wheel.finish ? ` • ${wheel.finish}` : ""}
SKU: ${wheel.sku}

                                    $${formatPrice(wheel.setPrice)}
                                    ($${formatPrice(wheel.unitPrice)} each)

───────────────────────────────────────────────────────
TIRES (Set of 4)
───────────────────────────────────────────────────────
${tire.brand} ${tire.model}
${tire.size}
SKU: ${tire.sku}

                                    $${formatPrice(tire.setPrice)}
                                    ($${formatPrice(tire.unitPrice)} each)

`;

  const services: string[] = [];
  if (selectedAddOns.labor && laborTotal > 0) {
    services.push(`Mount & Balance (×4)              $${formatPrice(laborTotal)}`);
  }
  if (selectedAddOns.tpms) {
    services.push(`TPMS Sensors (×4)                 $${formatPrice(adminSettings.tpmsPerSensor * 4)}`);
  }
  if (selectedAddOns.disposal) {
    services.push(`Tire Disposal (×4)                $${formatPrice(adminSettings.disposalPerTire * 4)}`);
  }

  if (services.length > 0) {
    text += `───────────────────────────────────────────────────────
INSTALLATION & SERVICES
───────────────────────────────────────────────────────
${services.join("\n")}

`;
  }

  text += `═══════════════════════════════════════════════════════
                      PRICE SUMMARY
═══════════════════════════════════════════════════════

Parts (Wheels + Tires)            $${formatPrice(partsTotal)}
`;

  if (laborTotal > 0) text += `Labor                             $${formatPrice(laborTotal)}\n`;
  if (addOnsTotal > 0) text += `Add-ons                           $${formatPrice(addOnsTotal)}\n`;
  if (discountAmount > 0) text += `Discount                         -$${formatPrice(discountAmount)}\n`;
  text += `Sales Tax (6%)                    $${formatPrice(taxAmount)}\n`;
  if (creditCardFee > 0) text += `Non Cash Fee                      $${formatPrice(creditCardFee)}\n`;

  text += `
───────────────────────────────────────────────────────
OUT THE DOOR                      $${formatPrice(outTheDoorPrice)}
───────────────────────────────────────────────────────
`;

  if (notes) {
    text += `
Notes: ${notes}
`;
  }

  text += `
═══════════════════════════════════════════════════════

Ready to get rolling? Give us a call: ${BRAND.phone?.callDisplay || "248-332-4120"}

Quote valid for 7 days • Prices subject to change

${BRAND.name}
Questions? Reply to this email.
`;

  return text.trim();
}
