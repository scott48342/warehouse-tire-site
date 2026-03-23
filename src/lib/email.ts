import { BRAND } from "./brand";
import type { QuoteSnapshot } from "./quotes";

/**
 * Send order confirmation email via Resend
 */
export async function sendOrderConfirmationEmail(
  orderId: string,
  toEmail: string,
  snapshot: QuoteSnapshot
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    console.log("[email] RESEND_API_KEY not configured, skipping email");
    return { success: false, error: "email_not_configured" };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || `orders@${BRAND.domain || "example.com"}`;

  // Build email HTML
  const html = buildOrderConfirmationHtml(orderId, snapshot);
  const text = buildOrderConfirmationText(orderId, snapshot);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: `Order Confirmed: ${orderId} - ${BRAND.name}`,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error("[email] Resend API error:", res.status, errorData);
      return { success: false, error: `resend_error_${res.status}` };
    }

    const data = await res.json();
    console.log("[email] Email sent:", data.id);
    return { success: true, messageId: data.id };
  } catch (err: any) {
    console.error("[email] Failed to send:", err.message);
    return { success: false, error: err.message };
  }
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function buildOrderConfirmationHtml(orderId: string, snapshot: QuoteSnapshot): string {
  const { customer, vehicle, lines, totals } = snapshot;
  
  const vehicleLabel = vehicle 
    ? [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ")
    : "";

  // Group lines by type
  const wheels = lines.filter(l => l.meta?.cartType === "wheel");
  const tires = lines.filter(l => l.meta?.cartType === "tire");
  const accessories = lines.filter(l => l.meta?.cartType === "accessory");
  const services = lines.filter(l => !["wheel", "tire", "accessory"].includes(l.meta?.cartType));

  const renderLineItem = (l: typeof lines[0]) => {
    const ext = (l.unitPriceUsd * l.qty * 100);
    return `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
          <div style="font-weight: 500;">${l.name}</div>
          ${l.sku ? `<div style="font-size: 12px; color: #666;">SKU: ${l.sku}</div>` : ""}
        </td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: center;">${l.qty}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${formatMoney(ext)}</td>
      </tr>
    `;
  };

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

  <div style="padding: 30px 0;">
    <h2 style="margin: 0 0 10px; color: #16a34a;">✓ Order Confirmed</h2>
    <p style="margin: 0; font-size: 18px;">
      Thank you for your order, <strong>${customer.firstName}</strong>!
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
        <td style="padding: 10px 0 0; border-top: 2px solid #333;">Total Paid:</td>
        <td style="padding: 10px 0 0; border-top: 2px solid #333; text-align: right;">${formatMoney(totals.total * 100)}</td>
      </tr>
    </table>
  </div>

  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 14px;">
    <p style="margin: 0 0 10px;">Questions? Reply to this email or call us.</p>
    <p style="margin: 0;">
      <strong>${BRAND.name}</strong>
    </p>
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
TOTAL PAID: $${totals.total.toFixed(2)}

Questions? Reply to this email or call us.

${BRAND.name}
  `.trim();

  return text;
}
