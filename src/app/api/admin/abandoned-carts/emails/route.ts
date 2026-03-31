/**
 * Abandoned Cart Email API
 * 
 * POST /api/admin/abandoned-carts/emails
 * Process and send recovery emails for abandoned carts.
 * 
 * Actions:
 * - process: Find and send emails to eligible carts
 * - test: Send test email to specific cart
 * - status: Get email processing status
 * 
 * @created 2026-03-25
 */

import { NextResponse } from "next/server";
import {
  processAbandonedCartEmails,
  sendRecoveryEmail,
  findCartsForFirstEmail,
  findCartsForSecondEmail,
  abandonedCartEmailService,
} from "@/lib/cart/abandonedCartEmail";

const { EMAIL_SAFE_MODE } = abandonedCartEmailService;
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
    const pendingFirst = await findCartsForFirstEmail();
    const pendingSecond = await findCartsForSecondEmail();

    return NextResponse.json({
      safeMode: EMAIL_SAFE_MODE,
      pending: {
        firstEmail: pendingFirst.length,
        secondEmail: pendingSecond.length,
        total: pendingFirst.length + pendingSecond.length,
      },
      config: {
        safeMode: EMAIL_SAFE_MODE,
        firstEmailDelayHours: 1,
        secondEmailDelayHours: 24,
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
 * - email: (for send-preview) email address to send preview to
 * - variant: (for send-preview) "first" | "second" - which email variant
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, cartId, email, variant } = body;

    switch (action) {
      case "send-preview": {
        // Send preview email with mock data to specified address
        if (!email) {
          return NextResponse.json(
            { error: "email required for send-preview action" },
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
            { type: "wheel", brand: "Fuel", model: "Rebel", finish: "Matte Black", quantity: 4 },
            { type: "tire", brand: "Nitto", model: "Ridge Grappler", size: "275/65R20", quantity: 4 },
            { type: "accessory", name: "Gorilla Lug Nuts (Black)", quantity: 1 },
          ],
          itemCount: 5,
          subtotal: "1847",
          estimatedTotal: "1847",
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
          firstEmailSentAt: variant === "second" ? new Date(Date.now() - 24 * 60 * 60 * 1000) : null,
          secondEmailSentAt: null,
          emailSentCount: variant === "second" ? 1 : 0,
          unsubscribed: false,
          recoveredAfterEmail: false,
        };

        // Temporarily bypass safe mode for preview
        const originalSafeMode = process.env.EMAIL_SAFE_MODE;
        process.env.EMAIL_SAFE_MODE = "false";

        try {
          const result = await sendRecoveryEmail(mockCart as any, variant === "second");
          
          return NextResponse.json({
            success: result.success,
            action: "send-preview",
            sentTo: email,
            variant: variant || "first",
            result,
          });
        } finally {
          // Restore safe mode
          if (originalSafeMode) {
            process.env.EMAIL_SAFE_MODE = originalSafeMode;
          } else {
            delete process.env.EMAIL_SAFE_MODE;
          }
        }
      }

      case "process": {
        // Process all pending emails
        const result = await processAbandonedCartEmails();
        
        return NextResponse.json({
          success: true,
          action: "process",
          safeMode: EMAIL_SAFE_MODE,
          ...result,
        });
      }

      case "test": {
        // Send test email to specific cart
        if (!cartId) {
          return NextResponse.json(
            { error: "cartId required for test action" },
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

        const result = await sendRecoveryEmail(cart, false);
        
        return NextResponse.json({
          success: result.success,
          action: "test",
          safeMode: EMAIL_SAFE_MODE,
          result,
        });
      }

      case "preview": {
        // Preview what emails would be sent
        const firstEmailCarts = await findCartsForFirstEmail();
        const secondEmailCarts = await findCartsForSecondEmail();

        return NextResponse.json({
          action: "preview",
          safeMode: EMAIL_SAFE_MODE,
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
