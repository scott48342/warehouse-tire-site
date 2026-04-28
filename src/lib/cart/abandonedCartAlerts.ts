/**
 * Abandoned Cart Owner Alerts
 * 
 * Sends email alerts TO THE SHOP OWNER when high-value carts are abandoned.
 * This allows for manual outreach while leads are still warm.
 * 
 * @created 2026-04-24
 */

import nodemailer from "nodemailer";
import pg from "pg";
import type { AbandonedCart } from "@/lib/fitment-db/schema";
import { BRAND } from "@/lib/brand";

const { Pool } = pg;

// Minimum cart value to trigger an alert (avoid spam for small carts)
const MIN_ALERT_VALUE = Number(process.env.ABANDONED_CART_MIN_ALERT_VALUE) || 200;

// SMS notifications via email-to-SMS gateways (plain text only)
const ABANDONED_CART_SMS_NOTIFY = [
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
  notifyEmail: string;
};

/**
 * Get email settings from admin_settings table
 */
async function getEmailSettings(): Promise<EmailSettings | null> {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    const { rows } = await pool.query(
      `SELECT value FROM admin_settings WHERE key = 'email' LIMIT 1`
    );
    if (!rows.length) return null;
    const val = rows[0].value;
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
    console.error("[abandonedCartAlerts] Failed to get email settings:", err);
    return null;
  } finally {
    await pool.end();
  }
}

/**
 * Send an alert to the shop owner about an abandoned cart
 */
export async function sendAbandonedCartAlert(cart: AbandonedCart): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
}> {
  const cartValue = Number(cart.estimatedTotal) || 0;

  // Skip low-value carts
  if (cartValue < MIN_ALERT_VALUE) {
    return {
      success: true,
      skipped: true,
      reason: `Cart value $${cartValue.toFixed(2)} below threshold $${MIN_ALERT_VALUE}`,
    };
  }

  // Get settings from database
  const settings = await getEmailSettings();
  if (!settings || !settings.enabled) {
    console.warn("[abandonedCartAlerts] Email not enabled in admin settings");
    return {
      success: false,
      skipped: true,
      reason: "Email not enabled",
    };
  }

  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
    console.warn("[abandonedCartAlerts] SMTP not configured, skipping alert");
    return {
      success: false,
      skipped: true,
      reason: "SMTP not configured",
    };
  }

  // Get owner email (notifyEmail from settings, or fallback)
  const ownerEmail = settings.notifyEmail || "scott@warehousetire.net";

  // Skip test emails
  const testPatterns = ["@test.", "@example.", "warehousetire", "scott@"];
  if (cart.customerEmail && testPatterns.some(p => cart.customerEmail?.toLowerCase().includes(p))) {
    return {
      success: true,
      skipped: true,
      reason: "Test email address",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
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
    
    const fromAddress = `"${settings.fromName}" <${settings.fromEmail}>`;

    // Build item list
    const items = Array.isArray(cart.items) ? cart.items : [];
    const itemsHtml = items.map((item: any) => {
      if (item.type === "wheel") {
        return `<li><strong>Wheel:</strong> ${item.brand} ${item.model} ${item.finish || ""} - ${item.diameter}"x${item.width}" (${item.quantity}x @ $${item.unitPrice})</li>`;
      } else if (item.type === "tire") {
        return `<li><strong>Tire:</strong> ${item.brand} ${item.model} - ${item.size} (${item.quantity}x @ $${item.unitPrice})</li>`;
      } else {
        return `<li>${item.name || item.type} (${item.quantity}x @ $${item.unitPrice})</li>`;
      }
    }).join("\n");

    // Build vehicle info
    const vehicleInfo = [cart.vehicleYear, cart.vehicleMake, cart.vehicleModel, cart.vehicleTrim]
      .filter(Boolean)
      .join(" ") || "Not specified";

    // Time since cart was created
    const minutesAgo = Math.round((Date.now() - new Date(cart.createdAt).getTime()) / 60000);
    const timeAgo = minutesAgo < 60 
      ? `${minutesAgo} minutes ago`
      : `${Math.round(minutesAgo / 60)} hours ago`;

    const subject = `🛒 Abandoned Cart Alert: $${cartValue.toFixed(2)} - ${cart.customerFirstName || "Customer"} ${cart.customerLastName || ""}`.trim();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">🛒 Abandoned Cart Alert</h1>
          <p style="margin: 10px 0 0; font-size: 24px; font-weight: bold;">$${cartValue.toFixed(2)}</p>
        </div>
        
        <div style="padding: 20px; background: #f9f9f9;">
          <h2 style="color: #333; margin-top: 0;">Customer Info</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Name:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">${cart.customerFirstName || ""} ${cart.customerLastName || ""}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Email:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">
                <a href="mailto:${cart.customerEmail}">${cart.customerEmail}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Phone:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">
                ${cart.customerPhone 
                  ? `<a href="tel:${cart.customerPhone}" style="font-size: 18px; font-weight: bold; color: #dc2626;">${formatPhone(cart.customerPhone)}</a>`
                  : "Not provided"
                }
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Vehicle:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">${vehicleInfo}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Started:</strong></td>
              <td style="padding: 8px 0;">${timeAgo}</td>
            </tr>
          </table>
          
          <h2 style="color: #333; margin-top: 20px;">Cart Contents</h2>
          <ul style="padding-left: 20px;">
            ${itemsHtml || "<li>No items recorded</li>"}
          </ul>
          
          <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 8px;">
            <strong>💡 Tip:</strong> The best time to reach out is within 30 minutes of abandonment. 
            A quick call or text can often close the sale!
          </div>
          
          ${cart.customerPhone ? `
          <div style="margin-top: 20px; text-align: center;">
            <a href="tel:${cart.customerPhone}" 
               style="display: inline-block; background: #16a34a; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold;">
              📞 Call ${formatPhone(cart.customerPhone)}
            </a>
          </div>
          ` : ""}
        </div>
        
        <div style="padding: 15px; background: #333; color: #999; text-align: center; font-size: 12px;">
          Warehouse Tire Direct - Abandoned Cart Alert System
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: fromAddress,
      to: ownerEmail,
      subject,
      html,
    });

    console.log(`[abandonedCartAlerts] Alert sent for cart ${cart.cartId} ($${cartValue.toFixed(2)})`);

    // Send SMS notifications (plain text only, no HTML)
    if (ABANDONED_CART_SMS_NOTIFY.length > 0) {
      const customerName = [cart.customerFirstName, cart.customerLastName].filter(Boolean).join(" ") || "Customer";
      const smsText = `ABANDONED CART: $${cartValue.toFixed(0)}\n${customerName}\n${cart.customerPhone || cart.customerEmail || "No contact"}\n${vehicleInfo}`;
      
      for (const smsAddr of ABANDONED_CART_SMS_NOTIFY) {
        try {
          await transporter.sendMail({
            from: fromAddress,
            to: smsAddr,
            subject: `Cart $${cartValue.toFixed(0)}`,
            text: smsText,
            html: undefined, // Explicitly no HTML
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
            },
          });
          console.log("[abandonedCartAlerts] SMS notification sent to:", smsAddr);
        } catch (smsErr: any) {
          console.error("[abandonedCartAlerts] SMS failed:", smsAddr, smsErr.message);
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("[abandonedCartAlerts] Failed to send alert:", err);
    return {
      success: false,
      error: err?.message || "Failed to send alert",
    };
  }
}

/**
 * Format phone number for display
 */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

export const abandonedCartAlerts = {
  sendAlert: sendAbandonedCartAlert,
  MIN_ALERT_VALUE,
};
