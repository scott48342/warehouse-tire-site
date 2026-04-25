import { NextRequest, NextResponse } from "next/server";
import pg from "pg";
import { sendOrderConfirmationEmail } from "@/lib/email";

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

const VALID_STATUSES = ["received", "processing", "parts_ordered", "ready_for_install", "shipped", "delivered", "completed", "cancelled"];

// POST - Resend order confirmation email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pool = getPool();
  
  try {
    const body = await request.json();
    const { action } = body;
    
    if (action !== "resend_email") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    
    // Get order
    const { rows } = await pool.query(
      `SELECT * FROM orders WHERE id = $1`,
      [id]
    );
    
    if (rows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    
    const order = rows[0];
    const snapshot = order.snapshot_json;
    const customerEmail = order.customer_email || snapshot.customer?.email;
    
    if (!customerEmail) {
      return NextResponse.json({ error: "No customer email on order" }, { status: 400 });
    }
    
    // Resend confirmation email
    const result = await sendOrderConfirmationEmail(id, customerEmail, snapshot);
    
    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: `Order confirmation resent to ${customerEmail} + admin notification`
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.error || "Failed to send email"
      }, { status: 500 });
    }
  } catch (err) {
    console.error("[orders] POST error:", err);
    return NextResponse.json({ error: "Failed to resend email" }, { status: 500 });
  } finally {
    await pool.end();
  }
}

// GET - Fetch order details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pool = getPool();
  
  try {
    const { rows } = await pool.query(
      `SELECT * FROM orders WHERE id = $1`,
      [id]
    );
    
    if (rows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    
    return NextResponse.json({ order: rows[0] });
  } catch (err) {
    console.error("[orders] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  } finally {
    await pool.end();
  }
}

// PATCH - Update order status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pool = getPool();
  
  try {
    const body = await request.json();
    const { status, notes } = body;
    
    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }
    
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ 
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` 
      }, { status: 400 });
    }
    
    // Update order status
    const { rows } = await pool.query(
      `UPDATE orders 
       SET status = $1, 
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    
    if (rows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    
    // Log status change
    await pool.query(
      `INSERT INTO order_status_history (order_id, status, changed_at, notes)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT DO NOTHING`,
      [id, status, notes || null]
    ).catch(() => {
      // Table might not exist yet, ignore
    });
    
    return NextResponse.json({ 
      success: true, 
      order: rows[0],
      message: `Order status updated to ${status}`
    });
  } catch (err) {
    console.error("[orders] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  } finally {
    await pool.end();
  }
}
