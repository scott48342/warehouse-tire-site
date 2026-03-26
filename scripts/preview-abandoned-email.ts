/**
 * Preview abandoned cart email template
 * Usage: npx tsx scripts/preview-abandoned-email.ts <email>
 */

import { Resend } from "resend";
import { BRAND } from "../src/lib/brand";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || "orders@warehousetiredirect.com";

if (!RESEND_API_KEY) {
  console.error("RESEND_API_KEY not set");
  process.exit(1);
}

const targetEmail = process.argv[2];
if (!targetEmail) {
  console.error("Usage: npx tsx scripts/preview-abandoned-email.ts <email>");
  process.exit(1);
}

// Mock cart data for preview
const mockCart = {
  cartId: "preview-test-123",
  customerFirstName: "Scott",
  customerEmail: targetEmail,
  vehicleYear: "2024",
  vehicleMake: "Ford",
  vehicleModel: "F-150",
  vehicleTrim: "XLT",
  itemCount: 5,
  estimatedTotal: 1847,
  items: [
    { type: "wheel", brand: "Fuel", model: "Rebel", finish: "Matte Black", quantity: 4 },
    { type: "tire", brand: "Nitto", model: "Ridge Grappler", size: "275/65R20", quantity: 4 },
    { type: "accessory", name: "Gorilla Lug Nuts (Black)", quantity: 1 },
  ],
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getTopItemNames(items: any[], maxItems: number = 3): string[] {
  const names: string[] = [];
  for (const item of items) {
    if (names.length >= maxItems) break;
    let name = "";
    if (item.type === "wheel") {
      name = [item.brand, item.model, item.finish].filter(Boolean).join(" ");
    } else if (item.type === "tire") {
      name = [item.brand, item.model, item.size].filter(Boolean).join(" ");
    } else if (item.type === "accessory") {
      name = item.name || [item.brand, item.model].filter(Boolean).join(" ");
    }
    if (name && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

const recoveryLink = "https://shop.warehousetiredirect.com/cart/recover/preview-test-123";
const vehicleLabel = `${mockCart.vehicleYear} ${mockCart.vehicleMake} ${mockCart.vehicleModel} ${mockCart.vehicleTrim}`;
const topItemNames = getTopItemNames(mockCart.items, 3);
const greeting = `Hey ${mockCart.customerFirstName},`;
const introText = `Looks like you didn't finish checking out. No worries — we saved your cart so you can pick up right where you left off.`;

const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete Your Order - ${BRAND.name}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">

  <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: #dc2626; padding: 24px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px;">${BRAND.name}</h1>
    </div>

    <!-- Content -->
    <div style="padding: 32px;">
      
      <!-- Headline -->
      <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 22px;">
        You left something behind
      </h2>
      
      <!-- Personalized Intro -->
      <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px;">
        ${greeting}<br><br>
        ${introText}
      </p>

      <!-- Vehicle Badge -->
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Your Vehicle</div>
        <div style="font-size: 18px; font-weight: 600; color: #1f2937;">🚗 ${vehicleLabel}</div>
      </div>

      <!-- Cart Summary -->
      <div style="background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <div style="margin-bottom: 12px;">
          <span style="color: #6b7280;">Items in cart:</span>
          <span style="font-weight: 600; color: #1f2937; float: right;">${mockCart.itemCount} items</span>
        </div>
        
        <!-- Top Items List -->
        <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb;">
          ${topItemNames.map(name => `
            <div style="color: #374151; font-size: 14px; padding: 4px 0;">• ${name}</div>
          `).join("")}
        </div>

        <div style="padding-top: 12px;">
          <span style="color: #6b7280;">Cart total:</span>
          <span style="font-size: 24px; font-weight: 700; color: #dc2626; float: right;">${formatMoney(mockCart.estimatedTotal)}</span>
        </div>
      </div>

      <!-- Primary CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${recoveryLink}" 
           style="display: inline-block; background: #dc2626; color: white; padding: 16px 48px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 18px;">
          Complete My Order
        </a>
      </div>

      <!-- Reassurance -->
      <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px; text-align: center;">
        ✓ Your cart will restore automatically — just click and continue.
      </p>

      <!-- Light Urgency -->
      <p style="margin: 0; color: #9ca3af; font-size: 13px; text-align: center; font-style: italic;">
        Note: Pricing and availability may change. We recommend completing your order soon to lock in today's prices.
      </p>

    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
        Questions? Reply to this email or call us at ${BRAND.phone.callDisplay}
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        ${BRAND.name}
      </p>
    </div>

  </div>

  <!-- Preview Notice -->
  <div style="margin-top: 20px; padding: 16px; background: #fef3c7; border-radius: 8px; text-align: center;">
    <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">
      ⚠️ PREVIEW ONLY — This is a test email with sample data
    </p>
  </div>

</body>
</html>
`.trim();

async function sendPreview() {
  const resend = new Resend(RESEND_API_KEY);
  
  console.log(`Sending preview email to ${targetEmail}...`);
  
  const { data, error } = await resend.emails.send({
    from: `${BRAND.name} <${FROM_EMAIL}>`,
    to: targetEmail,
    subject: "[PREVIEW] Finish your order for your 2024 Ford F-150",
    html,
    replyTo: BRAND.email,
  });

  if (error) {
    console.error("Failed to send:", error);
    process.exit(1);
  }

  console.log(`✅ Preview sent! Message ID: ${data?.id}`);
}

sendPreview();
