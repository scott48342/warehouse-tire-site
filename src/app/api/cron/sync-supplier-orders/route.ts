import { NextRequest, NextResponse } from "next/server";
import pg from "pg";
import { getOrderStatus } from "@/lib/usautoforce";
import { sendTrackingConfirmationEmail } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

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

// Cron job to sync tracking info from USAF for open orders
// Run every 2 hours (see vercel.json)
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel cron or manual trigger)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow without auth for testing, but log it
    console.log("[sync-supplier-orders] No auth header, proceeding anyway");
  }

  const pool = getPool();
  
  try {
    // Find supplier orders that need tracking updates
    // (status is not 'delivered' or 'cancelled', and no tracking yet or updated > 1 hour ago)
    const { rows: pendingOrders } = await pool.query(`
      SELECT 
        so.id,
        so.order_id,
        so.supplier,
        so.supplier_order_number,
        so.status,
        so.tracking_numbers,
        so.updated_at,
        o.customer_email
      FROM supplier_orders so
      JOIN orders o ON o.id = so.order_id
      WHERE so.supplier = 'usautoforce'
        AND so.status NOT IN ('delivered', 'cancelled', 'error')
        AND (
          so.tracking_numbers IS NULL 
          OR array_length(so.tracking_numbers, 1) IS NULL
          OR so.updated_at < NOW() - INTERVAL '1 hour'
        )
      ORDER BY so.created_at DESC
      LIMIT 20
    `);

    console.log(`[sync-supplier-orders] Found ${pendingOrders.length} orders to sync`);

    const results: Array<{
      orderId: string;
      supplierOrderNumber: string;
      status: string;
      tracking: string[] | null;
      updated: boolean;
    }> = [];

    for (const order of pendingOrders) {
      try {
        // Call USAF API to get order status
        const statusResult = await getOrderStatus(order.supplier_order_number);
        
        if (statusResult.success) {
          const newTracking = statusResult.trackingNumbers || [];
          const newStatus = statusResult.status || order.status;
          
          // Check if we have new tracking
          const existingTracking = order.tracking_numbers || [];
          const hasNewTracking = newTracking.length > existingTracking.length ||
            newTracking.some((t: string) => !existingTracking.includes(t));
          
          // Update database
          await pool.query(`
            UPDATE supplier_orders
            SET 
              status = $1,
              tracking_numbers = $2,
              updated_at = NOW()
            WHERE id = $3
          `, [
            newStatus,
            newTracking,
            order.id
          ]);

          // If we got new tracking, update order status and send email
          if (hasNewTracking && newTracking.length > 0) {
            await pool.query(`
              UPDATE orders
              SET status = 'shipped', updated_at = NOW()
              WHERE id = $1 AND status = 'parts_ordered'
            `, [order.order_id]);
            
            console.log(`[sync-supplier-orders] Order ${order.order_id} now has tracking: ${newTracking.join(', ')}`);
            
            // Get customer info for email
            const { rows: orderRows } = await pool.query(`
              SELECT customer_email, snapshot_json FROM orders WHERE id = $1
            `, [order.order_id]);
            
            if (orderRows.length > 0 && orderRows[0].customer_email) {
              const snapshot = orderRows[0].snapshot_json;
              const customerName = `${snapshot.customer?.firstName || ''} ${snapshot.customer?.lastName || ''}`.trim() || 'Customer';
              
              // Send tracking confirmation email
              const emailResult = await sendTrackingConfirmationEmail(
                order.order_id,
                orderRows[0].customer_email,
                customerName,
                newTracking,
                order.supplier === 'usautoforce' ? 'US AutoForce' : order.supplier
              );
              
              if (emailResult.success) {
                console.log(`[sync-supplier-orders] Tracking email sent for ${order.order_id}`);
              } else {
                console.error(`[sync-supplier-orders] Failed to send tracking email for ${order.order_id}:`, emailResult.error);
              }
            }
          }

          results.push({
            orderId: order.order_id,
            supplierOrderNumber: order.supplier_order_number,
            status: newStatus,
            tracking: newTracking,
            updated: hasNewTracking,
          });
        } else {
          console.error(`[sync-supplier-orders] Failed to get status for ${order.supplier_order_number}:`, statusResult.errorMessage);
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`[sync-supplier-orders] Error syncing ${order.supplier_order_number}:`, err);
      }
    }

    const withTracking = results.filter(r => r.tracking && r.tracking.length > 0);
    
    return NextResponse.json({
      ok: true,
      synced: results.length,
      withTracking: withTracking.length,
      results,
    });
  } catch (err) {
    console.error("[sync-supplier-orders] Error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  } finally {
    await pool.end();
  }
}
