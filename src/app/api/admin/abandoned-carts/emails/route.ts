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
 * - action: "process" | "test" | "preview"
 * - cartId: (for test) cart to send test email to
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, cartId } = body;

    switch (action) {
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

        const cart = await db.query.abandonedCarts.findFirst({
          where: eq(abandonedCarts.cartId, cartId),
        });

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
