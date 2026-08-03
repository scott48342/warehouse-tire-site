/**
 * Cart Recovery Opt-Out
 *
 * GET /api/cart/recovery-optout?cartId=xxx&tk=<signed-token>
 *
 * One-click opt-out linked from every recovery email footer.
 * - Marks the abandoned cart as unsubscribed (stops this cart's reminders)
 * - Revokes the email's cart-recovery consent (stops ALL future reminders)
 * - Does NOT touch general marketing subscription state
 *
 * The token is HMAC-signed and expiring so opt-outs cannot be forged for
 * arbitrary carts, and no email address ever appears in the URL.
 *
 * @created 2026-08-03 (Phase 1 consent rework)
 */

import { db } from "@/lib/fitment-db/db";
import { abandonedCarts } from "@/lib/fitment-db/schema";
import { eq } from "drizzle-orm";
import { verifyCartToken } from "@/lib/cart/recoveryLink";
import { revokeCartRecoveryConsent } from "@/lib/cart/recoveryConsent";
import { BRAND } from "@/lib/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function htmlPage(title: string, message: string): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${title} — ${BRAND.name}</title>
  <style>
    body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #fafafa; margin: 0; padding: 40px 16px; }
    .card { max-width: 480px; margin: 0 auto; background: #fff; border: 1px solid #e5e5e5; border-radius: 16px; padding: 32px; text-align: center; }
    h1 { font-size: 22px; color: #171717; margin: 0 0 12px; }
    p { color: #525252; font-size: 15px; line-height: 1.6; margin: 0 0 20px; }
    a.btn { display: inline-block; background: #dc2626; color: #fff; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <a class="btn" href="/">Continue to ${BRAND.name}</a>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cartId = (url.searchParams.get("cartId") || "").trim();
    const token = url.searchParams.get("tk");

    if (!cartId) {
      return htmlPage("Invalid Link", "This opt-out link is missing information. If you'd like to stop reminder emails, reply to the email you received and we'll take care of it.");
    }

    const verification = verifyCartToken(cartId, token, "optout");
    if (!verification.valid) {
      return htmlPage(
        "Link Expired",
        "This opt-out link is invalid or has expired. If you'd like to stop reminder emails, reply to the email you received and we'll take care of it."
      );
    }

    const [cart] = await db
      .select()
      .from(abandonedCarts)
      .where(eq(abandonedCarts.cartId, cartId))
      .limit(1);

    if (cart) {
      await db
        .update(abandonedCarts)
        .set({ unsubscribed: true, updatedAt: new Date() })
        .where(eq(abandonedCarts.cartId, cartId));

      if (cart.customerEmail) {
        await revokeCartRecoveryConsent(cart.customerEmail, "recovery_email_optout");
      }
    }

    return htmlPage(
      "You're Opted Out",
      "You won't receive any more cart reminder emails from us. This does not affect order confirmations for purchases you make."
    );
  } catch (e) {
    console.error("[cart/recovery-optout] Error:", e);
    return htmlPage(
      "Something Went Wrong",
      "We couldn't process your opt-out automatically. Reply to the email you received and we'll take care of it right away."
    );
  }
}
