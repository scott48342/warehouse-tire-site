/**
 * Jake Send Quote API
 * 
 * Sends a quote/build summary email to a customer.
 * Allows them to review and purchase later.
 */

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

interface QuoteItem {
  type: string;
  brand: string;
  model: string;
  size: string;
  quantity: number;
  price: number;
  lineTotal: number;
}

interface QuoteRequest {
  email: string;
  customerName?: string;
  vehicle?: {
    year?: number;
    make?: string;
    model?: string;
  };
  items: QuoteItem[];
  grandTotal: number;
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: QuoteRequest = await request.json();
    const { email, customerName, vehicle, items, grandTotal, notes } = body;
    
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items in quote" }, { status: 400 });
    }
    
    // Build the email HTML
    const vehicleText = vehicle 
      ? `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}`.trim()
      : "Your Vehicle";
    
    const itemRows = items.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          <strong>${item.brand} ${item.model}</strong><br>
          <span style="color: #666; font-size: 14px;">${item.type === "wheel" ? "Wheel" : "Tire"} - ${item.size}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;"><strong>$${item.lineTotal.toFixed(2)}</strong></td>
      </tr>
    `).join("");
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      
      <!-- Header -->
      <div style="background: #1a1a1a; padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Your Custom Build Quote</h1>
        <p style="color: #aaa; margin: 8px 0 0 0;">Warehouse Tire Direct</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 24px;">
        <p style="margin: 0 0 16px 0;">Hi${customerName ? ` ${customerName}` : ""}!</p>
        <p style="margin: 0 0 24px 0;">Here's the build we put together for your <strong>${vehicleText}</strong>:</p>
        
        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <thead>
            <tr style="background: #f9f9f9;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Each</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 16px 12px; text-align: right; font-size: 18px;"><strong>Grand Total:</strong></td>
              <td style="padding: 16px 12px; text-align: right; font-size: 18px; color: #2563eb;"><strong>$${grandTotal.toFixed(2)}</strong></td>
            </tr>
          </tfoot>
        </table>
        
        ${notes ? `
        <div style="background: #f0f9ff; border-left: 4px solid #2563eb; padding: 12px 16px; margin-bottom: 24px;">
          <p style="margin: 0; color: #1e40af;"><strong>Note from Jake:</strong></p>
          <p style="margin: 8px 0 0 0;">${notes}</p>
        </div>
        ` : ""}
        
        <!-- CTA -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="https://shop.warehousetiredirect.com/jake" 
             style="display: inline-block; background: #2563eb; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            Complete Your Purchase
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; margin: 24px 0 0 0;">
          Questions? Reply to this email or call us at <strong>(248) 332-4120</strong>
        </p>
      </div>
      
      <!-- Footer -->
      <div style="background: #f9f9f9; padding: 16px 24px; text-align: center; border-top: 1px solid #eee;">
        <p style="margin: 0; color: #666; font-size: 12px;">
          Warehouse Tire Direct<br>
          Pontiac: 1100 Cesar E Chavez Ave, Pontiac MI 48340<br>
          Waterford: 4459 Pontiac Lake Rd, Waterford MI 48328
        </p>
      </div>
      
    </div>
  </div>
</body>
</html>
    `;
    
    // Send the email
    const { data, error } = await resend.emails.send({
      from: "Jake at Warehouse Tire <jake@warehousetiredirect.com>",
      to: [email],
      replyTo: "scott@warehousetire.net",
      subject: `Your ${vehicleText} Build Quote - Warehouse Tire Direct`,
      html,
    });
    
    if (error) {
      console.error("[jake/send-quote] Resend error:", error);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }
    
    console.log(`[jake/send-quote] Quote sent to ${email}, id=${data?.id}`);
    
    return NextResponse.json({
      success: true,
      emailId: data?.id,
    });
  } catch (err) {
    console.error("[jake/send-quote] Error:", err);
    return NextResponse.json({ error: "Failed to send quote" }, { status: 500 });
  }
}
