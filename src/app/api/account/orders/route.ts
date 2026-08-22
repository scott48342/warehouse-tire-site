/**
 * GET /api/account/orders
 * 
 * List orders for the authenticated user.
 * 
 * Ownership determined by:
 * 1. Valid authenticated session
 * 2. Email is verified (emailVerified === true)
 * 3. Session email matches order customer_email (normalized)
 * 
 * @created 2026-08-22 - Phase 3A: My Orders
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getPool } from "@/lib/quotes";
import { normalizeEmail } from "@/lib/account/emailUtils";
import type { QuoteSnapshot, QuoteLine } from "@/lib/quotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Order status display labels
const STATUS_LABELS: Record<string, string> = {
  received: "Order Received",
  processing: "Processing",
  parts_ordered: "Parts Ordered",
  ready_for_install: "Ready for Install",
  shipped: "Shipped",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

/**
 * Customer-safe order summary for list view
 */
interface OrderSummary {
  id: string;
  orderDate: string;
  status: string;
  statusLabel: string;
  total: number;
  vehicle: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  } | null;
  itemSummary: string;
  itemCount: number;
  hasTracking: boolean;
}

/**
 * Extract vehicle info from snapshot
 */
function extractVehicle(snapshot: QuoteSnapshot): OrderSummary["vehicle"] {
  if (!snapshot.vehicle) return null;
  const { year, make, model, trim } = snapshot.vehicle;
  if (!year && !make && !model) return null;
  return { year, make, model, trim };
}

/**
 * Generate item summary string (e.g., "4x Michelin Defender 2, 4x Fuel Rebel")
 */
function generateItemSummary(lines: QuoteLine[]): string {
  const productLines = lines.filter(
    (l) => l.kind === "product" || l.meta?.cartType === "wheel" || l.meta?.cartType === "tire"
  );

  if (productLines.length === 0) return "No items";

  // Group by name, sum quantities
  const grouped: Record<string, number> = {};
  for (const line of productLines) {
    const name = line.name || "Item";
    grouped[name] = (grouped[name] || 0) + line.qty;
  }

  const parts = Object.entries(grouped)
    .slice(0, 3) // Max 3 items in summary
    .map(([name, qty]) => `${qty}x ${name}`);

  const remaining = Object.keys(grouped).length - 3;
  if (remaining > 0) {
    parts.push(`+${remaining} more`);
  }

  return parts.join(", ");
}

/**
 * Count total items (products only)
 */
function countItems(lines: QuoteLine[]): number {
  return lines
    .filter(
      (l) => l.kind === "product" || l.meta?.cartType === "wheel" || l.meta?.cartType === "tire"
    )
    .reduce((sum, l) => sum + l.qty, 0);
}

export async function GET(request: Request) {
  try {
    // 1. Authenticate
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // 2. Require verified email
    if (!session.user.emailVerified) {
      return NextResponse.json(
        { error: "email_not_verified", message: "Email verification required to view orders" },
        { status: 403 }
      );
    }

    const userEmail = normalizeEmail(session.user.email);
    if (!userEmail) {
      return NextResponse.json(
        { error: "no_email", message: "Account has no email address" },
        { status: 400 }
      );
    }

    // 3. Query orders by normalized email
    const db = getPool();

    // Ensure supplier_orders table exists for tracking query
    await db.query(`
      CREATE TABLE IF NOT EXISTS supplier_orders (
        id SERIAL PRIMARY KEY,
        order_id TEXT NOT NULL,
        supplier TEXT NOT NULL,
        supplier_order_number TEXT,
        supplier_po TEXT,
        status TEXT DEFAULT 'pending',
        items_json JSONB NOT NULL,
        ship_to_json JSONB,
        error_message TEXT,
        tracking_numbers TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows } = await db.query(
      `
      SELECT 
        o.id,
        o.status,
        o.amount_paid_cents,
        o.created_at,
        o.snapshot_json,
        COALESCE(
          (
            SELECT array_agg(DISTINCT t) 
            FROM supplier_orders so, unnest(so.tracking_numbers) t 
            WHERE so.order_id = o.id AND t IS NOT NULL AND t != ''
          ),
          '{}'::text[]
        ) AS tracking_numbers
      FROM orders o
      WHERE LOWER(TRIM(o.customer_email)) = $1
      ORDER BY o.created_at DESC
      LIMIT 50
    `,
      [userEmail]
    );

    // 4. Transform to customer-safe summaries
    const orders: OrderSummary[] = rows.map((row) => {
      const snapshot = row.snapshot_json as QuoteSnapshot;
      const trackingNumbers: string[] = row.tracking_numbers || [];

      return {
        id: row.id,
        orderDate: row.created_at?.toISOString() || new Date().toISOString(),
        status: row.status,
        statusLabel: STATUS_LABELS[row.status] || row.status,
        total: (row.amount_paid_cents || 0) / 100,
        vehicle: extractVehicle(snapshot),
        itemSummary: generateItemSummary(snapshot.lines || []),
        itemCount: countItems(snapshot.lines || []),
        hasTracking: trackingNumbers.length > 0,
      };
    });

    return NextResponse.json({
      orders,
      count: orders.length,
    });
  } catch (err: any) {
    console.error("[api/account/orders] Error:", err);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
