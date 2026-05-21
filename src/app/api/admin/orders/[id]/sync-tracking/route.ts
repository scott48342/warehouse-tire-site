import { NextRequest, NextResponse } from "next/server";
import pg from "pg";
import { getOrderStatus } from "@/lib/usautoforce";
import { trackPackage, isFedExTrackingNumber } from "@/lib/fedex";

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const pool = getPool();

  try {
    // Get supplier orders for this order
    const { rows: supplierOrders } = await pool.query(`
      SELECT 
        so.id,
        so.supplier,
        so.supplier_order_number,
        so.status,
        so.tracking_numbers,
        o.status as order_status
      FROM supplier_orders so
      JOIN orders o ON o.id = so.order_id
      WHERE so.order_id = $1
    `, [orderId]);

    if (supplierOrders.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No supplier orders found",
        tracking: [],
      });
    }

    let newTracking: string[] = [];
    let delivered = false;

    for (const so of supplierOrders) {
      // Step 1: If USAF, check for tracking updates
      if (so.supplier === "usautoforce" && so.supplier_order_number) {
        const statusResult = await getOrderStatus(so.supplier_order_number);
        
        if (statusResult.success && statusResult.trackingNumbers?.length) {
          const existingTracking = so.tracking_numbers || [];
          const hasNewTracking = statusResult.trackingNumbers.some(
            (t: string) => !existingTracking.includes(t)
          );

          if (hasNewTracking) {
            await pool.query(`
              UPDATE supplier_orders
              SET tracking_numbers = $1, status = $2, updated_at = NOW()
              WHERE id = $3
            `, [statusResult.trackingNumbers, statusResult.status || "shipped", so.id]);

            newTracking = statusResult.trackingNumbers;

            // Update order status to shipped
            await pool.query(`
              UPDATE orders
              SET status = 'shipped', updated_at = NOW()
              WHERE id = $1 AND status = 'parts_ordered'
            `, [orderId]);
          }
        }
      }

      // Step 2: Check FedEx for delivery status
      const trackingNumbers = newTracking.length > 0 ? newTracking : (so.tracking_numbers || []);
      
      if (trackingNumbers.length > 0) {
        let allDelivered = true;
        
        for (const tracking of trackingNumbers) {
          if (!isFedExTrackingNumber(tracking)) continue;
          
          const result = await trackPackage(tracking);
          console.log(`[sync-tracking] FedEx ${tracking}: ${result.status}`);
          
          if (result.status === "delivered") {
            // Keep checking others
          } else if (result.status !== "unknown") {
            allDelivered = false;
          }
        }

        // If all packages delivered, update status
        if (allDelivered && trackingNumbers.some(t => isFedExTrackingNumber(t))) {
          await pool.query(`
            UPDATE orders SET status = 'delivered', updated_at = NOW() WHERE id = $1
          `, [orderId]);
          
          await pool.query(`
            UPDATE supplier_orders SET status = 'delivered', updated_at = NOW() WHERE order_id = $1
          `, [orderId]);
          
          delivered = true;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      tracking: newTracking,
      delivered,
      message: delivered 
        ? "Order marked as delivered" 
        : newTracking.length > 0 
        ? "New tracking found" 
        : "No updates",
    });
  } catch (err) {
    console.error("[sync-tracking] Error:", err);
    return NextResponse.json(
      { error: "Sync failed", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
