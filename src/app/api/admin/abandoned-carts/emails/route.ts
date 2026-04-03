/**
 * Abandoned Cart Email API
 * 
 * POST /api/admin/abandoned-carts/emails
 * Process and send recovery emails for abandoned carts.
 * 
 * @created 2026-03-25
 * @updated 2026-04-03 - Updated for 3-email sequence
 */

import { NextResponse } from "next/server";
import {
  processAbandonedCartEmails,
  sendRecoveryEmail,
  findCartsForFirstEmail,
  findCartsForSecondEmail,
  findCartsForThirdEmail,
  EMAIL_SAFE_MODE,
  EMAIL_SCHEDULE,
  type EmailStep,
} from "@/lib/cart/abandonedCartEmail";
import { db } from "@/lib/fitment-db/db";
import { abandonedCarts } from "@/lib/fitment-db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * GET /api/admin/abandoned-carts/emails
 * Get email processing status
 */
export async function GET() {
  try {
    const [pendingFirst, pendingSecond, pendingThird] = await Promise.all([
      findCartsForFirstEmail(),
      findCartsForSecondEmail(),
      findCartsForThirdEmail(),
    ]);

    return NextResponse.json({
      safeMode: EMAIL_SAFE_MODE,
      schedule: EMAIL_SCHEDULE,
      pending: {
        firstEmail: pendingFirst.length,
        secondEmail: pendingSecond.length,
        thirdEmail: pendingThird.length,
        total: pendingFirst.length + pendingSecond.length + pendingThird.length,
      },
    });
  } catch (err: any) {
    console.error("[abandoned-carts/emails] GET Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to get status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/abandoned-carts/emails
 * 
 * Body:
 * - action: "process" | "test" | "preview" | "send-preview"
 * - cartId: (for test) cart to send test email to
 * - step: "first" | "second" | "third" - which email to send
 * - email: (for send-preview) email address to send preview to
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, cartId, step, email } = body;

    switch (action) {
      case "send-preview": {
        if (!email) {
          return NextResponse.json(
            { error: "email required for send-preview action" },
            { status: 400 }
          );
        }

        const emailStep: EmailStep = step || "first";
        if (!["first", "second", "third"].includes(emailStep)) {
          return NextResponse.json(
            { error: "step must be first, second, or third" },
            { status: 400 }
          );
        }

        // Create mock cart for preview
        const mockCart = {
          id: "preview",
          cartId: "preview-test-" + Date.now(),
          sessionId: null,
          customerFirstName: "Scott",
          customerLastName: "Test",
          customerEmail: email,
          customerPhone: null,
          vehicleYear: "2024",
          vehicleMake: "Ford",
          vehicleModel: "F-150",
          vehicleTrim: "XLT",
          items: [
            { type: "wheel", brand: "Fuel", model: "Rebel", finish: "Matte Black", diameter: "20", width: "9", quantity: 4, unitPrice: 350, imageUrl: null },
            { type: "tire", brand: "Nitto", model: "Ridge Grappler", size: "275/65R20", quantity: 4, unitPrice: 280, imageUrl: null },
          ],
          itemCount: 8,
          subtotal: "2520",
          estimatedTotal: "2520",
          status: "abandoned" as const,
          recoveredOrderId: null,
          recoveredAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          abandonedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
          source: "preview",
          userAgent: null,
          ipAddress: null,
          firstEmailSentAt: emailStep !== "first" ? new Date(Date.now() - 24 * 60 * 60 * 1000) : null,
          secondEmailSentAt: emailStep === "third" ? new Date(Date.now() - 12 * 60 * 60 * 1000) : null,
          thirdEmailSentAt: null,
          emailSentCount: emailStep === "first" ? 0 : emailStep === "second" ? 1 : 2,
          lastEmailStatus: null,
          unsubscribed: false,
          recoveredAfterEmail: false,
        };

        // Temporarily bypass safe mode for preview
        const originalSafeMode = process.env.EMAIL_SAFE_MODE;
        process.env.EMAIL_SAFE_MODE = "false";

        try {
          const result = await sendRecoveryEmail(mockCart as any, emailStep);
          
          return NextResponse.json({
            success: result.success,
            action: "send-preview",
            sentTo: email,
            step: emailStep,
            result,
          });
        } finally {
          if (originalSafeMode !== undefined) {
            process.env.EMAIL_SAFE_MODE = originalSafeMode;
          } else {
            delete process.env.EMAIL_SAFE_MODE;
          }
        }
      }

      case "process": {
        const result = await processAbandonedCartEmails();
        
        return NextResponse.json({
          success: true,
          action: "process",
          safeMode: EMAIL_SAFE_MODE,
          ...result,
        });
      }

      case "test": {
        if (!cartId) {
          return NextResponse.json(
            { error: "cartId required for test action" },
            { status: 400 }
          );
        }

        const emailStep: EmailStep = step || "first";
        if (!["first", "second", "third"].includes(emailStep)) {
          return NextResponse.json(
            { error: "step must be first, second, or third" },
            { status: 400 }
          );
        }

        const [cart] = await db
          .select()
          .from(abandonedCarts)
          .where(eq(abandonedCarts.cartId, cartId))
          .limit(1);

        if (!cart) {
          return NextResponse.json(
            { error: "Cart not found" },
            { status: 404 }
          );
        }

        const result = await sendRecoveryEmail(cart, emailStep);
        
        return NextResponse.json({
          success: result.success,
          action: "test",
          safeMode: EMAIL_SAFE_MODE,
          result,
        });
      }

      case "preview": {
        const [firstEmailCarts, secondEmailCarts, thirdEmailCarts] = await Promise.all([
          findCartsForFirstEmail(),
          findCartsForSecondEmail(),
          findCartsForThirdEmail(),
        ]);

        return NextResponse.json({
          action: "preview",
          safeMode: EMAIL_SAFE_MODE,
          schedule: EMAIL_SCHEDULE,
          firstEmail: {
            count: firstEmailCarts.length,
            carts: firstEmailCarts.map(c => ({
              cartId: c.cartId,
              email: c.customerEmail,
              value: Number(c.estimatedTotal),
              abandonedAt: c.abandonedAt,
            })),
          },
          secondEmail: {
            count: secondEmailCarts.length,
            carts: secondEmailCarts.map(c => ({
              cartId: c.cartId,
              email: c.customerEmail,
              value: Number(c.estimatedTotal),
              firstEmailSentAt: c.firstEmailSentAt,
            })),
          },
          thirdEmail: {
            count: thirdEmailCarts.length,
            carts: thirdEmailCarts.map(c => ({
              cartId: c.cartId,
              email: c.customerEmail,
              value: Number(c.estimatedTotal),
              secondEmailSentAt: c.secondEmailSentAt,
            })),
          },
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error("[abandoned-carts/emails] POST Error:", err);
    return NextResponse.json(
      { error: err?.message || "Action failed" },
      { status: 500 }
    );
  }
}
