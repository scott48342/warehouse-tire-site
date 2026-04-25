import nodemailer from "nodemailer";
import { BRAND } from "./brand";
import type { QuoteSnapshot } from "./quotes";
import pg from "pg";

const { Pool } = pg;

// Team members to BCC on all order emails
const ORDER_EMAIL_BCC = [
  "steve@warehousetire.net",
  "joe@warehousetire.net",
  "spencer@warehousetire.net",
];

type EmailSettings = {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
  notifyEmail: string; // Admin gets copy of all orders
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
    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

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
    console.error("[email] Failed to get settings:", err);
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
    // Required for Office 365 and other modern SMTP servers
    requireTLS: settings.smtpPort === 587,
    tls: {
      ciphers: "SSLv3",
      rejectUnauthorized: false,
    },
  });
}

/**
 * Send order confirmation email to customer + notification to admin
 */
export async function sendOrderConfirmationEmail(
  orderId: string,
  customerEmail: string,
  snapshot: QuoteSnapshot
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const settings = await getEmailSettings();

  if (!settings) {
    console.log("[email] Email not configured in admin settings, skipping");
    return { success: false, error: "email_not_configured" };
  }

  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
    console.log("[email] SMTP settings incomplete, skipping");
    return { success: false, error: "smtp_incomplete" };
  }

  try {
    const transporter = await getTransporter(settings);
    const fromAddress = `"${settings.fromName}" <${settings.fromEmail}>`;

    // Build email content
    const customerHtml = buildOrderConfirmationHtml(orderId, snapshot, false);
    const customerText = buildOrderConfirmationText(orderId, snapshot);
    const adminHtml = buildOrderConfirmationHtml(orderId, snapshot, true);

    const results: string[] = [];

    // Send to customer
    if (customerEmail) {
      const customerResult = await transporter.sendMail({
        from: fromAddress,
        to: customerEmail,
        bcc: ORDER_EMAIL_BCC,
        subject: `Order Confirmed: ${orderId} - ${BRAND.name}`,
        html: customerHtml,
        text: customerText,
      });
      console.log("[email] Customer email sent:", customerResult.messageId);
      results.push(customerResult.messageId);
    }

    // Send notification to admin
    if (settings.notifyEmail) {
      const adminResult = await transporter.sendMail({
        from: fromAddress,
        to: settings.notifyEmail,
        bcc: ORDER_EMAIL_BCC,
        subject: `🛒 New Order: ${orderId} - ${snapshot.customer.firstName} ${snapshot.customer.lastName}`,
        html: adminHtml,
        text: customerText,
      });
      console.log("[email] Admin notification sent:", adminResult.messageId);
      results.push(adminResult.messageId);
    }

    return { success: true, messageId: results.join(", ") };
  } catch (err: any) {
    console.error("[email] Failed to send:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Test email configuration by sending a test message
 */
export async function sendTestEmail(
  toEmail: string
): Promise<{ success: boolean; error?: string }> {
  const settings = await getEmailSettings();

  if (!settings) {
    return { success: false, error: "Email not configured in admin settings" };
  }

  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
    return { success: false, error: "SMTP settings incomplete" };
  }

  try {
    const transporter = await getTransporter(settings);
    const fromAddress = `"${settings.fromName}" <${settings.fromEmail}>`;

    await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: `Test Email - ${BRAND.name}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>✅ Email Configuration Working</h2>
          <p>This is a test email from ${BRAND.name}.</p>
          <p>If you received this, your email settings are configured correctly.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            Sent from: ${settings.fromEmail}<br>
            SMTP: ${settings.smtpHost}:${settings.smtpPort}
          </p>
        </div>
      `,
      text: `Test Email - ${BRAND.name}\n\nThis is a test email. If you received this, your email settings are configured correctly.`,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format supplier source code into readable name
 * e.g., "tireweb:atd" → "ATD", "km" → "K&M/Keystone", "wheelpros" → "WheelPros"
 */
function formatSupplierName(source: string): string {
  if (!source) return "";
  
  const s = source.toLowerCase();
  
  // TireWeb suppliers
  if (s.includes("tireweb:atd") || s === "atd") return "ATD";
  if (s.includes("tireweb:ntw") || s === "ntw") return "NTW";
  if (s.includes("tireweb:usautoforce") || s === "usautoforce" || s === "usaf") return "US AutoForce";
  if (s.includes("tireweb")) return "TireWeb";
  
  // Other suppliers
  if (s === "km" || s.includes("keystone") || s.includes("meyer")) return "K&M/Keystone";
  if (s === "wheelpros" || s === "wp") return "WheelPros";
  
  // Fallback: capitalize
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function buildOrderConfirmationHtml(orderId: string, snapshot: QuoteSnapshot, isAdmin: boolean): string {
  const { customer, vehicle, lines, totals } = snapshot;

  const vehicleLabel = vehicle
    ? [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ")
    : "";

  // Group lines by type - exclude tax from line items (tax shows in totals only)
  const wheels = lines.filter(l => l.meta?.cartType === "wheel");
  const tires = lines.filter(l => l.meta?.cartType === "tire");
  const accessories = lines.filter(l => l.meta?.cartType === "accessory");
  const services = lines.filter(l => 
    !["wheel", "tire", "accessory"].includes(l.meta?.cartType) && 
    l.meta?.type !== "tax" // Exclude tax - it shows in totals section
  );

  const renderLineItem = (l: typeof lines[0]) => {
    const ext = (l.unitPriceUsd * l.qty * 100);
    const source = l.meta?.source;
    const supplierLabel = source ? formatSupplierName(source) : null;
    
    // Build product name with tire size if available
    let displayName = l.name;
    const tireSize = l.meta?.tireSize || l.meta?.size;
    if (tireSize) {
      displayName = `${tireSize} ${l.name}`;
    }
    
    // Show tire specs if available (width/aspect/diameter)
    const tireSpecs = l.meta?.width && l.meta?.aspectRatio && l.meta?.diameter
      ? `${l.meta.width}/${l.meta.aspectRatio}R${l.meta.diameter}`
      : null;
    if (tireSpecs && !tireSize) {
      displayName = `${tireSpecs} ${l.name}`;
    }
    
    return `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
          <div style="font-weight: 500;">${displayName}</div>
          ${l.sku ? `<div style="font-size: 12px; color: #666;">SKU: ${l.sku}</div>` : ""}
          ${isAdmin && supplierLabel ? `<div style="font-size: 11px; color: #dc2626; font-weight: 600;">📦 Supplier: ${supplierLabel}</div>` : ""}
        </td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: center;">${l.qty}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${formatMoney(ext)}</td>
      </tr>
    `;
  };

  const adminBanner = isAdmin ? `
    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
      <strong>🔔 New Order Notification</strong><br>
      <span style="font-size: 14px;">Customer: ${customer.firstName} ${customer.lastName}</span><br>
      ${customer.email ? `<span style="font-size: 14px;">Email: ${customer.email}</span><br>` : ""}
      ${customer.phone ? `<span style="font-size: 14px;">Phone: ${customer.phone}</span>` : ""}
    </div>
  ` : "";

  // Local mode installation banner (shows for both admin and customer)
  const localModeBanner = snapshot.localMode ? `
    <div style="background: #dbeafe; border: 1px solid #3b82f6; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
      <div style="font-size: 18px; font-weight: 600; color: #1e40af; margin-bottom: 8px;">🔧 Installation Order</div>
      <div style="font-size: 14px; color: #1e3a8a;">
        <strong>Install Location:</strong> ${snapshot.localMode.installStoreName}<br>
        <strong>Address:</strong> ${snapshot.localMode.installStoreAddress}<br>
        <strong>Phone:</strong> ${snapshot.localMode.installStorePhone}
      </div>
      ${isAdmin ? `
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #93c5fd; font-size: 12px; color: #1e40af;">
          <strong>Channel:</strong> local | <strong>Fulfillment:</strong> ${snapshot.localMode.fulfillmentMode}
        </div>
      ` : `
        <div style="margin-top: 10px; font-size: 13px; color: #1e3a8a;">
          We'll contact you to schedule your installation appointment.
        </div>
      `}
    </div>
  ` : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #dc2626;">
    <h1 style="margin: 0; color: #dc2626; font-size: 24px;">${BRAND.name}</h1>
  </div>

  ${adminBanner}
  ${localModeBanner}

  <div style="padding: 30px 0;">
    <h2 style="margin: 0 0 10px; color: #16a34a;">✓ Order Confirmed</h2>
    <p style="margin: 0; font-size: 18px;">
      ${isAdmin ? `Order from <strong>${customer.firstName} ${customer.lastName}</strong>` : `Thank you for your order, <strong>${customer.firstName}</strong>!`}
    </p>
  </div>

  <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 4px 0;"><strong>Order ID:</strong></td>
        <td style="padding: 4px 0; text-align: right; font-family: monospace; font-size: 16px;">${orderId}</td>
      </tr>
      ${vehicleLabel ? `
      <tr>
        <td style="padding: 4px 0;"><strong>Vehicle:</strong></td>
        <td style="padding: 4px 0; text-align: right;">${vehicleLabel}</td>
      </tr>
      ` : ""}
    </table>
  </div>

  <div style="margin-bottom: 30px;">
    <h3 style="margin: 0 0 15px; padding-bottom: 10px; border-bottom: 2px solid #333;">Order Details</h3>

    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 10px; text-align: left;">Item</th>
          <th style="padding: 10px; text-align: center;">Qty</th>
          <th style="padding: 10px; text-align: right;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${wheels.length > 0 ? `
          <tr><td colspan="3" style="padding: 10px 0 5px; font-weight: 600; color: #666;">Wheels</td></tr>
          ${wheels.map(renderLineItem).join("")}
        ` : ""}

        ${tires.length > 0 ? `
          <tr><td colspan="3" style="padding: 10px 0 5px; font-weight: 600; color: #666;">Tires</td></tr>
          ${tires.map(renderLineItem).join("")}
        ` : ""}

        ${accessories.length > 0 ? `
          <tr><td colspan="3" style="padding: 10px 0 5px; font-weight: 600; color: #666;">Accessories</td></tr>
          ${accessories.map(renderLineItem).join("")}
        ` : ""}

        ${services.length > 0 ? `
          <tr><td colspan="3" style="padding: 10px 0 5px; font-weight: 600; color: #666;">Services</td></tr>
          ${services.map(renderLineItem).join("")}
        ` : ""}
      </tbody>
    </table>
  </div>

  <div style="background: #f9fafb; border-radius: 8px; padding: 20px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 4px 0;">Subtotal:</td>
        <td style="padding: 4px 0; text-align: right;">${formatMoney((totals.partsSubtotal + totals.servicesSubtotal) * 100)}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0;">Tax:</td>
        <td style="padding: 4px 0; text-align: right;">${formatMoney(totals.tax * 100)}</td>
      </tr>
      <tr style="font-size: 18px; font-weight: 600;">
        <td style="padding: 10px 0 0; border-top: 2px solid #333;">Total:</td>
        <td style="padding: 10px 0 0; border-top: 2px solid #333; text-align: right;">${formatMoney(totals.total * 100)}</td>
      </tr>
    </table>
  </div>

  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 14px;">
    ${isAdmin ? `
      <p style="margin: 0;"><a href="https://shop.warehousetiredirect.com/admin/orders" style="color: #dc2626;">View in Admin →</a></p>
    ` : `
      <p style="margin: 0 0 10px;">Questions? Reply to this email or call us.</p>
      <p style="margin: 0;"><strong>${BRAND.name}</strong></p>
    `}
  </div>

</body>
</html>
  `.trim();
}

function buildOrderConfirmationText(orderId: string, snapshot: QuoteSnapshot): string {
  const { customer, vehicle, lines, totals } = snapshot;

  const vehicleLabel = vehicle
    ? [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ")
    : "";

  let text = `
${BRAND.name}
${"=".repeat(40)}

ORDER CONFIRMED

Thank you for your order, ${customer.firstName}!

Order ID: ${orderId}
${vehicleLabel ? `Vehicle: ${vehicleLabel}` : ""}

ORDER DETAILS
${"-".repeat(40)}
`;

  for (const l of lines) {
    const ext = l.unitPriceUsd * l.qty;
    text += `${l.name}${l.sku ? ` (${l.sku})` : ""}\n`;
    text += `  Qty: ${l.qty} × $${l.unitPriceUsd.toFixed(2)} = $${ext.toFixed(2)}\n`;
  }

  text += `
${"-".repeat(40)}
Subtotal: $${(totals.partsSubtotal + totals.servicesSubtotal).toFixed(2)}
Tax: $${totals.tax.toFixed(2)}
TOTAL: $${totals.total.toFixed(2)}

Questions? Reply to this email or call us.

${BRAND.name}
  `.trim();

  return text;
}
