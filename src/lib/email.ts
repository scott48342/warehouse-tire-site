import nodemailer from "nodemailer";
import { BRAND } from "./brand";
import type { QuoteSnapshot } from "./quotes";
import pg from "pg";
import {
  emailWrapper,
  infoBar,
  greeting,
  productCard,
  servicesSection,
  priceSummary,
  infoBox,
  successBox,
  ctaButton,
  footer,
  adminBanner,
  formatPrice,
  type ServiceItem,
  type PriceSummaryLine,
} from "./email/templates";

const { Pool } = pg;

// Team members to BCC on all order emails
const ORDER_EMAIL_BCC = [
  "steve@warehousetire.net",
  "joe@warehousetire.net",
  "spencer@warehousetire.net",
  "scott@warehousetire.net",
];

// SMS notifications via email-to-SMS gateways (plain text only)
const ORDER_SMS_NOTIFY = [
  "2484990359@tmomail.net", // Scott
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

    // Send SMS notifications (plain text only, no HTML)
    if (ORDER_SMS_NOTIFY.length > 0) {
      const smsText = `NEW ORDER: ${orderId}\n${snapshot.customer.firstName} ${snapshot.customer.lastName}\n${snapshot.customer.phone || ""}\n$${snapshot.totals.total.toFixed(0)} total`;
      
      for (const smsAddr of ORDER_SMS_NOTIFY) {
        try {
          await transporter.sendMail({
            from: fromAddress,
            to: smsAddr,
            subject: `Order ${orderId}`,
            text: smsText,
            html: undefined, // Explicitly no HTML
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
            },
          });
          console.log("[email] SMS notification sent to:", smsAddr);
        } catch (smsErr: any) {
          console.error("[email] SMS failed:", smsAddr, smsErr.message);
        }
      }
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

    const html = emailWrapper({
      title: "Test Email",
      children: `
        ${greeting(null, "This is a test email from your store. If you received this, your email settings are configured correctly.")}
        ${successBox("✅ Configuration Working", `SMTP: ${settings.smtpHost}:${settings.smtpPort}`)}
        ${footer({ showPhone: true, customText: "Questions? Reply to this email." })}
      `,
    });

    await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: `Test Email - ${BRAND.name}`,
      html,
      text: `Test Email - ${BRAND.name}\n\nThis is a test email. If you received this, your email settings are configured correctly.`,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Format supplier source code into readable name
 */
function formatSupplierName(source: string): string {
  if (!source) return "";
  
  const s = source.toLowerCase();
  
  if (s.includes("tireweb:atd") || s === "atd") return "ATD";
  if (s.includes("tireweb:ntw") || s === "ntw") return "NTW";
  if (s.includes("tireweb:usautoforce") || s === "usautoforce" || s === "usaf") return "US AutoForce";
  if (s.includes("tireweb")) return "TireWeb";
  if (s === "km" || s.includes("keystone") || s.includes("meyer")) return "K&M/Keystone";
  if (s === "wheelpros" || s === "wp") return "WheelPros";
  
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function buildOrderConfirmationHtml(orderId: string, snapshot: QuoteSnapshot, isAdmin: boolean): string {
  const { customer, vehicle, lines, totals } = snapshot;

  const vehicleLabel = vehicle
    ? [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ")
    : "";

  const orderDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Group lines by type - exclude tax from line items
  const wheels = lines.filter(l => l.meta?.cartType === "wheel");
  const tires = lines.filter(l => l.meta?.cartType === "tire");
  const accessories = lines.filter(l => l.meta?.cartType === "accessory");
  const services = lines.filter(l => 
    !["wheel", "tire", "accessory"].includes(l.meta?.cartType) && 
    l.meta?.type !== "tax"
  );

  // Build wheel cards
  let productCards = "";
  
  for (const w of wheels) {
    const source = w.meta?.source;
    const supplierLabel = isAdmin && source ? ` • 📦 ${formatSupplierName(source)}` : "";
    
    productCards += productCard({
      emoji: "🛞",
      sectionTitle: `Wheels${w.qty > 1 ? ` — Set of ${w.qty}` : ""}`,
      imageUrl: w.meta?.imageUrl,
      title: `${w.meta?.brand || ""} ${w.name}`.trim(),
      subtitle: `${w.meta?.diameter || ""}″ × ${w.meta?.width || ""}″${w.meta?.finish ? ` • ${w.meta.finish}` : ""}${supplierLabel}`,
      sku: w.sku,
      totalPrice: w.unitPriceUsd * w.qty,
      unitPrice: w.unitPriceUsd,
      quantity: w.qty,
    });
  }

  // Build tire cards
  for (const t of tires) {
    const source = t.meta?.source;
    const supplierLabel = isAdmin && source ? ` • 📦 ${formatSupplierName(source)}` : "";
    const tireSize = t.meta?.tireSize || t.meta?.size || 
      (t.meta?.width && t.meta?.aspectRatio && t.meta?.diameter 
        ? `${t.meta.width}/${t.meta.aspectRatio}R${t.meta.diameter}` 
        : "");
    
    productCards += productCard({
      emoji: "🚗",
      sectionTitle: `Tires${t.qty > 1 ? ` — Set of ${t.qty}` : ""}`,
      imageUrl: t.meta?.imageUrl,
      title: `${t.meta?.brand || ""} ${t.name}`.trim(),
      subtitle: `${tireSize}${supplierLabel}`,
      sku: t.sku,
      totalPrice: t.unitPriceUsd * t.qty,
      unitPrice: t.unitPriceUsd,
      quantity: t.qty,
    });
  }

  // Build accessory cards
  for (const a of accessories) {
    const source = a.meta?.source;
    const supplierLabel = isAdmin && source ? ` • 📦 ${formatSupplierName(source)}` : "";
    
    productCards += productCard({
      emoji: "🔩",
      sectionTitle: `Accessories${a.qty > 1 ? ` — Qty ${a.qty}` : ""}`,
      imageUrl: a.meta?.imageUrl,
      title: a.name,
      subtitle: a.meta?.finish || supplierLabel || "",
      sku: a.sku,
      totalPrice: a.unitPriceUsd * a.qty,
      unitPrice: a.unitPriceUsd,
      quantity: a.qty,
    });
  }

  // Build services section
  const serviceItems: ServiceItem[] = services.map(s => ({
    name: s.name,
    price: s.unitPriceUsd * s.qty,
    quantity: s.qty > 1 ? s.qty : undefined,
  }));

  // Build price summary
  const summaryLines: PriceSummaryLine[] = [
    { label: "Subtotal", amount: totals.partsSubtotal + totals.servicesSubtotal },
  ];

  // Check for discount (snapshot.discount is an object with { code, amount, type })
  if (snapshot.discount && snapshot.discount.amount > 0) {
    summaryLines.push({ label: "Discount", amount: snapshot.discount.amount, isDiscount: true });
  }

  // Check for shipping (if present on snapshot)
  const shippingAmount = (snapshot as any).shippingAmount;
  if (shippingAmount && shippingAmount > 0) {
    summaryLines.push({ label: "Shipping", amount: shippingAmount });
  }

  summaryLines.push({ label: "Tax", amount: totals.tax });

  // Build admin banner
  let adminSection = "";
  if (isAdmin) {
    const details = [
      { label: "Customer", value: `${customer.firstName} ${customer.lastName}` },
    ];
    if (customer.email) details.push({ label: "Email", value: customer.email });
    if (customer.phone) details.push({ label: "Phone", value: customer.phone });

    adminSection = adminBanner("New Order Notification", details);
  }

  // Local mode banner
  let localModeSection = "";
  if (snapshot.localMode) {
    localModeSection = successBox(
      "🔧 Installation Order",
      `<strong>Install Location:</strong> ${snapshot.localMode.installStoreName}<br>
       <strong>Address:</strong> ${snapshot.localMode.installStoreAddress}<br>
       <strong>Phone:</strong> ${snapshot.localMode.installStorePhone}
       ${!isAdmin ? "<br><br>We'll contact you to schedule your installation appointment." : ""}`
    );
  }

  // Build the email
  const content = `
    ${adminSection}
    ${infoBar("Order", orderId, "Date", orderDate)}
    ${greeting(
      isAdmin ? null : customer.firstName,
      isAdmin 
        ? `Order from <strong>${customer.firstName} ${customer.lastName}</strong> — $${formatPrice(totals.total)} total`
        : "Thank you for your order! We've received your payment and will begin processing right away."
    )}
    ${localModeSection}
    ${vehicleLabel ? `
      <tr>
        <td style="padding: 0 40px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px;">
            <tr>
              <td style="padding: 16px 20px;">
                <span style="color: #6c757d; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Vehicle</span>
                <br>
                <span style="color: #1a1a1a; font-size: 18px; font-weight: 600;">🚗 ${vehicleLabel}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    ` : ""}
    ${productCards}
    ${servicesSection("Services", "🔧", serviceItems)}
    ${priceSummary(summaryLines, "Total Paid", totals.total)}
    ${infoBox("💰 Price Match Guarantee", "Found it cheaper elsewhere? Reply to this email and we'll take a look.")}
    ${isAdmin 
      ? ctaButton("View in Admin →", "https://shop.warehousetiredirect.com/admin/orders", "secondary")
      : ""
    }
    ${footer({
      showPhone: true,
      customText: isAdmin ? undefined : "Questions? Reply to this email.",
    })}
  `;

  return emailWrapper({
    title: `Order Confirmed: ${orderId}`,
    previewText: `Your order ${orderId} has been confirmed - $${formatPrice(totals.total)} total`,
    children: content,
  });
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
