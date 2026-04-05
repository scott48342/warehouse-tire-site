/**
 * Email Open Tracking Pixel
 * 
 * Returns a 1x1 transparent GIF and records the open event.
 * URL: /api/email/track/open/[cartId]
 * 
 * @created 2026-04-04
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { abandonedCarts } from "@/lib/fitment-db/schema";
import { eq, sql } from "drizzle-orm";

// 1x1 transparent GIF (43 bytes)
const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cartId: string }> }
) {
  const { cartId } = await params;

  // Fire and forget - don't block pixel response
  recordOpen(cartId).catch(err => {
    console.error(`[email/track/open] Failed to record open for ${cartId}:`, err);
  });

  // Return tracking pixel immediately
  return new NextResponse(TRACKING_PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(TRACKING_PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

async function recordOpen(cartId: string) {
  const now = new Date();
  
  // Update: set first open time if not set, increment count
  await db
    .update(abandonedCarts)
    .set({
      emailOpenedAt: sql`COALESCE(${abandonedCarts.emailOpenedAt}, ${now})`,
      emailOpenCount: sql`${abandonedCarts.emailOpenCount} + 1`,
      updatedAt: now,
    })
    .where(eq(abandonedCarts.cartId, cartId));

  console.log(`[email/track/open] Recorded open for cart ${cartId}`);
}
