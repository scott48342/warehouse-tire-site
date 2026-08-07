/**
 * Jake Order Lookup API
 * 
 * Allows Jake to look up orders by order ID or customer email.
 * Returns status, items, and tracking info.
 */

import { NextRequest, NextResponse } from "next/server";
import pg from "pg";

export const runtime = "nodejs";

const { Pool } = pg;

function getPool() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Missing DATABASE_URL");
  return new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
}

// Status labels for customer-friendly display
const STATUS_LABELS: Record<string, string> = {
  received: "Order Received",
  processing: "Processing",
  parts_ordered: "Parts Ordered",
  ready_for_install: "Ready for Installation",
  shipped: "Shipped",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const email = searchParams.get("email");
  
  if (!orderId && !email) {
    return NextResponse.json({ 
      error: "Either orderId or email is required" 
    }, { status: 400 });
  }
  
  const pool = getPool();
  
  try {
    let query: string;
    let params: string[];
    
    if (orderId) {
      // Look up by order ID
      query = `
        SELECT 
          o.id, o.status, o.amount_paid_cents, o.paid_at, 
          o.customer_email, o.snapshot_json, o.created_at,
          so.tracking_numbers, so.supplier, so.status as supplier_status
        FROM orders o
        LEFT JOIN supplier_orders so ON so.order_id = o.id
        WHERE o.id = $1
      `;
      params = [orderId.toUpperCase()];
    } else {
      // Look up by email (most recent order)
      query = `
        SELECT 
          o.id, o.status, o.amount_paid_cents, o.paid_at, 
          o.customer_email, o.snapshot_json, o.created_at,
          so.tracking_numbers, so.supplier, so.status as supplier_status
        FROM orders o
        LEFT JOIN supplier_orders so ON so.order_id = o.id
        WHERE LOWER(o.customer_email) = LOWER($1)
        ORDER BY o.created_at DESC
        LIMIT 1
      `;
      params = [email!];
    }
    
    const { rows } = await pool.query(query, params);
    
    if (rows.length === 0) {
      return NextResponse.json({
        found: false,
        message: orderId 
          ? `No order found with ID ${orderId}` 
          : `No orders found for ${email}`
      });
    }
    
    const order = rows[0];
    const snapshot = order.snapshot_json;
    
    // Build items summary
    const items: { name: string; qty: number; price: number }[] = [];
    
    if (snapshot.items) {
      for (const item of snapshot.items) {
        items.push({
          name: item.name || `${item.brand} ${item.model}`,
          qty: item.quantity || 1,
          price: item.price || item.totalPrice || 0,
        });
      }
    }
    
    // Aggregate tracking numbers from all supplier orders
    const trackingNumbers: string[] = [];
    for (const row of rows) {
      if (row.tracking_numbers && Array.isArray(row.tracking_numbers)) {
        trackingNumbers.push(...row.tracking_numbers);
      }
    }
    
    return NextResponse.json({
      found: true,
      order: {
        id: order.id,
        status: order.status,
        statusLabel: STATUS_LABELS[order.status] || order.status,
        orderDate: order.created_at,
        paidAt: order.paid_at,
        total: order.amount_paid_cents / 100,
        customerEmail: order.customer_email,
        items,
        tracking: trackingNumbers.length > 0 ? trackingNumbers : null,
        shippingAddress: snapshot.shippingAddress ? {
          city: snapshot.shippingAddress.city,
          state: snapshot.shippingAddress.state,
          zip: snapshot.shippingAddress.zip,
        } : null,
      },
    });
  } catch (err) {
    console.error("[jake/order-lookup] Error:", err);
    return NextResponse.json({ 
      error: "Failed to look up order" 
    }, { status: 500 });
  } finally {
    await pool.end();
  }
}
