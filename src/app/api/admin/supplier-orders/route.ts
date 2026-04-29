/**
 * Admin API: Supplier Orders
 * 
 * GET - List supplier orders (with filters)
 * POST - Manually trigger supplier order for an existing order
 */

import { NextResponse } from "next/server";
import pg from "pg";
import { 
  getSupplierOrdersForOrder, 
  processSupplierOrders,
  syncUSAutoForceOrderStatus,
  ensureSupplierOrdersTable,
} from "@/lib/suppliers/supplierOrderService";
import { getOrder } from "@/lib/orders";

const { Pool } = pg;

function getPool() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("Missing POSTGRES_URL");
  return new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
}

export const runtime = "nodejs";

/**
 * GET /api/admin/supplier-orders
 * 
 * Query params:
 * - orderId: Filter by order ID
 * - supplier: Filter by supplier
 * - status: Filter by status
 * - limit: Max results (default 50)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");
  const supplier = searchParams.get("supplier");
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
  
  const db = getPool();
  
  try {
    await ensureSupplierOrdersTable(db);
    
    // Build query
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;
    
    if (orderId) {
      conditions.push(`order_id = $${paramIdx++}`);
      params.push(orderId);
    }
    if (supplier) {
      conditions.push(`supplier = $${paramIdx++}`);
      params.push(supplier);
    }
    if (status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(status);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    
    const { rows } = await db.query(`
      SELECT 
        id, order_id, supplier, supplier_order_number, supplier_po,
        status, items_json, ship_to_json, error_message,
        tracking_numbers, created_at, updated_at
      FROM supplier_orders
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIdx}
    `, [...params, limit]);
    
    return NextResponse.json({
      ok: true,
      orders: rows.map(r => ({
        id: r.id,
        orderId: r.order_id,
        supplier: r.supplier,
        supplierOrderNumber: r.supplier_order_number,
        supplierPO: r.supplier_po,
        status: r.status,
        items: r.items_json,
        shipTo: r.ship_to_json,
        errorMessage: r.error_message,
        trackingNumbers: r.tracking_numbers || [],
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (err: any) {
    console.error("[admin/supplier-orders] GET error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  } finally {
    await db.end();
  }
}

/**
 * POST /api/admin/supplier-orders
 * 
 * Actions:
 * - action: "place" - Manually place order with supplier
 * - action: "sync" - Sync order status from supplier
 * 
 * Body:
 * - action: "place" | "sync"
 * - orderId: Our order ID (for "place")
 * - supplierOrderNumber: Supplier's order number (for "sync")
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = body.action;
  
  const db = getPool();
  
  try {
    if (action === "place") {
      // Manually trigger supplier ordering for an existing order
      const orderId = body.orderId;
      if (!orderId) {
        return NextResponse.json({ ok: false, error: "orderId required" }, { status: 400 });
      }
      
      const order = await getOrder(db, orderId);
      if (!order) {
        return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
      }
      
      if (!order.snapshot.shippingAddress) {
        return NextResponse.json({ ok: false, error: "No shipping address on order" }, { status: 400 });
      }
      
      const shipTo = {
        name: `${order.snapshot.customer.firstName} ${order.snapshot.customer.lastName}`.trim(),
        address1: order.snapshot.shippingAddress.address1,
        address2: order.snapshot.shippingAddress.address2,
        city: order.snapshot.shippingAddress.city,
        state: order.snapshot.shippingAddress.state,
        zip: order.snapshot.shippingAddress.zip,
        phone: order.snapshot.customer.phone,
      };
      
      const results = await processSupplierOrders(db, orderId, order.snapshot, shipTo);
      
      return NextResponse.json({
        ok: true,
        results: results.map(r => ({
          supplier: r.supplier,
          success: r.success,
          orderNumber: r.supplierOrderNumber,
          errorMessage: r.errorMessage,
        })),
      });
    }
    
    if (action === "sync") {
      // Sync status from US AutoForce
      const supplierOrderNumber = body.supplierOrderNumber;
      if (!supplierOrderNumber) {
        return NextResponse.json({ ok: false, error: "supplierOrderNumber required" }, { status: 400 });
      }
      
      const status = await syncUSAutoForceOrderStatus(db, supplierOrderNumber);
      
      return NextResponse.json({
        ok: true,
        status: status.status,
        trackingNumbers: status.trackingNumbers,
      });
    }
    
    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("[admin/supplier-orders] POST error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  } finally {
    await db.end();
  }
}
