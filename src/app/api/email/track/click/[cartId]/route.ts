/**
 * Email Click Tracking Redirect
 * 
 * Records click event and redirects to cart recovery page.
 * URL: /api/email/track/click/[cartId]
 * 
 * @created 2026-04-04
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { abandonedCarts } from "@/lib/fitment-db/schema";
import { eq, sql } from "drizzle-orm";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://shop.warehousetiredirect.com";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cartId: string }> }
) {
  const { cartId } = await params;

  // Record the click (fire and forget)
  recordClick(cartId).catch(err => {
    console.error(`[email/track/click] Failed to record click for ${cartId}:`, err);
  });

  // Redirect to recovery page
  const recoveryUrl = `${BASE_URL}/cart/recover/${cartId}`;
  
  return NextResponse.redirect(recoveryUrl, {
    status: 302,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

async function recordClick(cartId: string) {
  const now = new Date();
  
  // Update: set first click time if not set, increment count
  await db
    .update(abandonedCarts)
    .set({
      emailClickedAt: sql`COALESCE(${abandonedCarts.emailClickedAt}, ${now})`,
      emailClickCount: sql`${abandonedCarts.emailClickCount} + 1`,
      updatedAt: now,
    })
    .where(eq(abandonedCarts.cartId, cartId));

  console.log(`[email/track/click] Recorded click for cart ${cartId}`);
}
