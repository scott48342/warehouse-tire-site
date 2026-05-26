import { NextRequest, NextResponse } from "next/server";
import pg from "pg";
import { sendTrackingConfirmationEmail } from "@/lib/email";

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

/**
 * GET /api/admin/tracking?orderId=WTD-XXXXX
 * Get tracking info for an order
 */
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("orderId");
  
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const pool = getPool();
  
  try {
    // Get order and supplier order info
    const { rows } = await pool.query(`
      SELECT 
        o.id,
        o.customer_email,
        o.status as order_status,
        o.snapshot_json,
        o.created_at,
        so.id as supplier_order_id,
        so.supplier,
        so.supplier_order_number,
        so.status as supplier_status,
        so.tracking_numbers,
        so.error_message,
        so.created_at as supplier_order_created
      FROM orders o
      LEFT JOIN supplier_orders so ON so.order_id = o.id
      WHERE o.id = $1
    `, [orderId]);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = rows[0];
    const snapshot = order.snapshot_json || {};

    return NextResponse.json({
      order: {
        id: order.id,
        customerEmail: order.customer_email,
        customerName: `${snapshot.customer?.firstName || ''} ${snapshot.customer?.lastName || ''}`.trim() || 'Customer',
        status: order.order_status,
        createdAt: order.created_at,
      },
      supplierOrder: order.supplier_order_id ? {
        id: order.supplier_order_id,
        supplier: order.supplier,
        supplierOrderNumber: order.supplier_order_number,
        status: order.supplier_status,
        trackingNumbers: order.tracking_numbers || [],
        errorMessage: order.error_message,
        createdAt: order.supplier_order_created,
      } : null,
    });
  } finally {
    await pool.end();
  }
}

/**
 * POST /api/admin/tracking
 * Add/update tracking numbers for an order
 * 
 * Body:
 * {
 *   orderId: "WTD-XXXXX",
 *   trackingNumbers: ["123456789", "987654321"],
 *   sendEmail?: boolean  // default true
 * }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { orderId, trackingNumbers, sendEmail = true } = body;

  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  if (!trackingNumbers || !Array.isArray(trackingNumbers) || trackingNumbers.length === 0) {
    return NextResponse.json({ error: "trackingNumbers array required" }, { status: 400 });
  }

  // Clean tracking numbers (remove whitespace, filter empty)
  const cleanedTracking = trackingNumbers
    .map((t: string) => String(t).trim())
    .filter((t: string) => t.length > 0);

  if (cleanedTracking.length === 0) {
    return NextResponse.json({ error: "No valid tracking numbers provided" }, { status: 400 });
  }

  const pool = getPool();

  try {
    // Check if order exists
    const { rows: orderRows } = await pool.query(`
      SELECT id, customer_email, status, snapshot_json
      FROM orders WHERE id = $1
    `, [orderId]);

    if (orderRows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orderRows[0];
    const snapshot = order.snapshot_json || {};
    const customerName = `${snapshot.customer?.firstName || ''} ${snapshot.customer?.lastName || ''}`.trim() || 'Customer';

    // Update supplier order (if exists)
    const { rowCount } = await pool.query(`
      UPDATE supplier_orders
      SET 
        tracking_numbers = $1,
        status = 'shipped',
        updated_at = NOW()
      WHERE order_id = $2
    `, [cleanedTracking, orderId]);

    // Update main order status
    await pool.query(`
      UPDATE orders
      SET status = 'shipped', updated_at = NOW()
      WHERE id = $1 AND status != 'delivered'
    `, [orderId]);

    // Send email if requested
    let emailResult = null;
    if (sendEmail && order.customer_email) {
      emailResult = await sendTrackingConfirmationEmail(
        orderId,
        order.customer_email,
        customerName,
        cleanedTracking,
        'US AutoForce'
      );
    }

    return NextResponse.json({
      success: true,
      orderId,
      trackingNumbers: cleanedTracking,
      orderStatus: 'shipped',
      supplierOrderUpdated: (rowCount ?? 0) > 0,
      emailSent: emailResult?.success || false,
      emailError: emailResult?.error || null,
    });
  } catch (err) {
    console.error("[admin/tracking] Error:", err);
    return NextResponse.json({ 
      error: "Failed to update tracking",
      details: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  } finally {
    await pool.end();
  }
}
