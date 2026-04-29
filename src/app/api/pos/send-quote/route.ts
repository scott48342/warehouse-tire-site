import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import pg from "pg";
import { BRAND } from "@/lib/brand";

const { Pool } = pg;

// ============================================================================
// POS Quote Email API
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

    // Build email HTML
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
      subject: `Your Wheel & Tire Quote - ${quoteId} | ${BRAND.name}`,
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
// Email Templates
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

  // Build add-ons list
  const addOnsList: string[] = [];
  if (selectedAddOns.labor) addOnsList.push(`Mount & Balance: $${laborTotal.toFixed(2)}`);
  if (selectedAddOns.tpms) addOnsList.push(`TPMS Sensors: $${(adminSettings.tpmsPerSensor * 4).toFixed(2)}`);
  if (selectedAddOns.disposal) addOnsList.push(`Tire Disposal: $${(adminSettings.disposalPerTire * 4).toFixed(2)}`);
  
  // Custom add-ons
  const customIds = selectedAddOns.customIds as string[] || [];
  for (const addon of adminSettings.customAddOns) {
    if (customIds.includes(addon.id) && addon.name.toLowerCase() !== "valve stems") {
      const price = addon.perUnit ? addon.price * 4 : addon.price;
      addOnsList.push(`${addon.name}: $${price.toFixed(2)}`);
    }
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Quote from ${BRAND.name}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">

  <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: #111; padding: 24px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px;">${BRAND.name}</h1>
      <p style="margin: 8px 0 0; color: #999; font-size: 14px;">Wheel & Tire Package Quote</p>
    </div>

    <!-- Quote Info -->
    <div style="padding: 24px; border-bottom: 1px solid #eee;">
      <p style="margin: 0 0 8px; font-size: 18px;">
        Hi <strong>${customerName}</strong>,
      </p>
      <p style="margin: 0; color: #666;">
        Here's your custom quote for your <strong>${vehicleLabel}</strong>.
      </p>
      <div style="margin-top: 16px; padding: 12px; background: #f9fafb; border-radius: 8px; display: inline-block;">
        <span style="color: #666; font-size: 13px;">Quote #</span>
        <span style="font-family: monospace; font-weight: 600;">${quoteId}</span>
        <span style="color: #999; font-size: 13px; margin-left: 12px;">${quoteDate}</span>
      </div>
    </div>

    <!-- Wheels -->
    <div style="padding: 24px; border-bottom: 1px solid #eee;">
      <h3 style="margin: 0 0 16px; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Wheels (Set of 4)</h3>
      <div style="display: flex; gap: 16px;">
        ${wheel.imageUrl ? `<img src="${wheel.imageUrl}" alt="${wheel.model}" style="width: 80px; height: 80px; object-fit: contain; background: #f5f5f5; border-radius: 8px;">` : ""}
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 16px;">${wheel.brand} ${wheel.model}</div>
          <div style="color: #666; font-size: 14px;">${wheel.diameter}" × ${wheel.width}"${wheel.finish ? ` • ${wheel.finish}` : ""}</div>
          <div style="color: #999; font-size: 12px; margin-top: 4px;">SKU: ${wheel.sku}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 600; font-size: 18px;">$${wheel.setPrice.toLocaleString()}</div>
          <div style="color: #666; font-size: 12px;">$${wheel.unitPrice.toLocaleString()} each</div>
        </div>
      </div>
    </div>

    <!-- Tires -->
    <div style="padding: 24px; border-bottom: 1px solid #eee;">
      <h3 style="margin: 0 0 16px; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Tires (Set of 4)</h3>
      <div style="display: flex; gap: 16px;">
        ${tire.imageUrl ? `<img src="${tire.imageUrl}" alt="${tire.model}" style="width: 80px; height: 80px; object-fit: contain; background: #f5f5f5; border-radius: 8px;">` : ""}
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 16px;">${tire.brand} ${tire.model}</div>
          <div style="color: #666; font-size: 14px;">${tire.size}</div>
          <div style="color: #999; font-size: 12px; margin-top: 4px;">SKU: ${tire.sku}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 600; font-size: 18px;">$${tire.setPrice.toLocaleString()}</div>
          <div style="color: #666; font-size: 12px;">$${tire.unitPrice.toLocaleString()} each</div>
        </div>
      </div>
    </div>

    <!-- Services & Add-ons -->
    ${addOnsList.length > 0 ? `
    <div style="padding: 24px; border-bottom: 1px solid #eee;">
      <h3 style="margin: 0 0 16px; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Installation & Add-ons</h3>
      ${addOnsList.map(item => `<div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px;"><span style="color: #666;">${item.split(":")[0]}</span><span>${item.split(":")[1]}</span></div>`).join("")}
    </div>
    ` : ""}

    <!-- Totals -->
    <div style="padding: 24px; background: #f9fafb;">
      <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px;">
        <span style="color: #666;">Parts</span>
        <span>$${(wheel.setPrice + tire.setPrice).toLocaleString()}</span>
      </div>
      ${laborTotal > 0 ? `
      <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px;">
        <span style="color: #666;">Labor</span>
        <span>$${laborTotal.toFixed(2)}</span>
      </div>
      ` : ""}
      ${addOnsTotal > 0 ? `
      <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px;">
        <span style="color: #666;">Add-ons</span>
        <span>$${addOnsTotal.toFixed(2)}</span>
      </div>
      ` : ""}
      ${discountAmount > 0 ? `
      <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; color: #16a34a;">
        <span>Discount</span>
        <span>-$${discountAmount.toFixed(2)}</span>
      </div>
      ` : ""}
      <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px;">
        <span style="color: #666;">Tax (6%)</span>
        <span>$${taxAmount.toFixed(2)}</span>
      </div>
      ${creditCardFee > 0 ? `
      <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px;">
        <span style="color: #666;">Non Cash Fee (${adminSettings.creditCardFeePercent}%)</span>
        <span>$${creditCardFee.toFixed(2)}</span>
      </div>
      ` : ""}
      <div style="display: flex; justify-content: space-between; padding: 16px 0 0; margin-top: 12px; border-top: 2px solid #333; font-size: 20px; font-weight: 700;">
        <span>Out The Door</span>
        <span style="color: #16a34a;">$${outTheDoorPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
      </div>
    </div>

    ${notes ? `
    <div style="padding: 16px 24px; background: #fffbeb; border-top: 1px solid #fef3c7;">
      <div style="font-size: 12px; color: #92400e; font-weight: 600; margin-bottom: 4px;">Notes</div>
      <div style="font-size: 14px; color: #78350f;">${notes}</div>
    </div>
    ` : ""}

    <!-- Footer -->
    <div style="padding: 24px; text-align: center; background: #111; color: #999;">
      <p style="margin: 0 0 8px; font-size: 14px;">
        Quote valid for 7 days • Prices subject to change
      </p>
      <p style="margin: 0; font-size: 12px;">
        Questions? Just reply to this email or give us a call.
      </p>
      <p style="margin: 16px 0 0; font-weight: 600; color: white;">
        ${BRAND.name}
      </p>
    </div>
  </div>

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

  let text = `
${BRAND.name}
WHEEL & TIRE PACKAGE QUOTE
${"=".repeat(40)}

Hi ${customerName},

Here's your custom quote for your ${vehicleLabel}.

Quote #: ${quoteId}
Date: ${new Date().toLocaleDateString()}

WHEELS (Set of 4)
${"-".repeat(40)}
${wheel.brand} ${wheel.model}
${wheel.diameter}" × ${wheel.width}"${wheel.finish ? ` • ${wheel.finish}` : ""}
SKU: ${wheel.sku}
Price: $${wheel.setPrice.toLocaleString()} ($${wheel.unitPrice.toLocaleString()} each)

TIRES (Set of 4)
${"-".repeat(40)}
${tire.brand} ${tire.model}
${tire.size}
SKU: ${tire.sku}
Price: $${tire.setPrice.toLocaleString()} ($${tire.unitPrice.toLocaleString()} each)

`;

  if (selectedAddOns.labor || selectedAddOns.tpms || selectedAddOns.disposal) {
    text += `INSTALLATION & ADD-ONS\n${"-".repeat(40)}\n`;
    if (selectedAddOns.labor) text += `Mount & Balance: $${laborTotal.toFixed(2)}\n`;
    if (selectedAddOns.tpms) text += `TPMS Sensors: $${(adminSettings.tpmsPerSensor * 4).toFixed(2)}\n`;
    if (selectedAddOns.disposal) text += `Tire Disposal: $${(adminSettings.disposalPerTire * 4).toFixed(2)}\n`;
    text += "\n";
  }

  text += `TOTALS\n${"-".repeat(40)}\n`;
  text += `Parts: $${(wheel.setPrice + tire.setPrice).toLocaleString()}\n`;
  if (laborTotal > 0) text += `Labor: $${laborTotal.toFixed(2)}\n`;
  if (addOnsTotal > 0) text += `Add-ons: $${addOnsTotal.toFixed(2)}\n`;
  if (discountAmount > 0) text += `Discount: -$${discountAmount.toFixed(2)}\n`;
  text += `Tax (6%): $${taxAmount.toFixed(2)}\n`;
  if (creditCardFee > 0) text += `Non Cash Fee: $${creditCardFee.toFixed(2)}\n`;
  text += `\nOUT THE DOOR: $${outTheDoorPrice.toFixed(2)}\n`;

  if (notes) {
    text += `\nNotes: ${notes}\n`;
  }

  text += `
${"-".repeat(40)}
Quote valid for 7 days • Prices subject to change
Questions? Reply to this email or give us a call.

${BRAND.name}
`;

  return text.trim();
}
