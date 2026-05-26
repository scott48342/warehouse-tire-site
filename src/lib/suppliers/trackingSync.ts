/**
 * Supplier Tracking Sync Service
 * 
 * Polls supplier APIs for tracking numbers on orders that are awaiting shipment.
 * Currently supports: US AutoForce
 * 
 * Run via cron: /api/cron/sync-supplier-tracking
 */

import { db } from "@/lib/db";
import { supplierOrders, orders } from "@/lib/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { getOrderStatus } from "@/lib/usautoforce/client";

export interface TrackingSyncResult {
  checked: number;
  updated: number;
  errors: string[];
  details: Array<{
    orderId: string;
    supplier: string;
    supplierOrderNumber: string;
    trackingNumbers?: string[];
    status: "updated" | "no_tracking" | "error";
    error?: string;
  }>;
}

/**
 * Sync tracking numbers from US AutoForce
 * 
 * Finds orders with:
 * - supplier = 'usautoforce'
 * - status = 'placed' (order confirmed but no tracking yet)
 * - tracking_numbers is null
 * 
 * Then queries USAF OrderStatusDetail API for tracking numbers.
 */
export async function syncUSAutoForceTracking(): Promise<TrackingSyncResult> {
  const result: TrackingSyncResult = {
    checked: 0,
    updated: 0,
    errors: [],
    details: [],
  };

  try {
    // Find USAF orders awaiting tracking
    const pendingOrders = await db
      .select()
      .from(supplierOrders)
      .where(
        and(
          eq(supplierOrders.supplier, "usautoforce"),
          eq(supplierOrders.status, "placed"),
          isNull(supplierOrders.trackingNumbers)
        )
      )
      .limit(20); // Process max 20 per run to avoid timeouts

    console.log(`[tracking-sync] Found ${pendingOrders.length} USAF orders awaiting tracking`);
    result.checked = pendingOrders.length;

    for (const order of pendingOrders) {
      if (!order.supplierOrderNumber) {
        result.details.push({
          orderId: order.orderId,
          supplier: order.supplier,
          supplierOrderNumber: "missing",
          status: "error",
          error: "No supplier order number",
        });
        continue;
      }

      try {
        // Query USAF for order status
        const statusResult = await getOrderStatus(order.supplierOrderNumber);

        if (!statusResult.success) {
          // Order might not be invoiced yet - not an error, just wait
          result.details.push({
            orderId: order.orderId,
            supplier: order.supplier,
            supplierOrderNumber: order.supplierOrderNumber,
            status: "no_tracking",
            error: statusResult.errorMessage,
          });
          continue;
        }

        if (statusResult.trackingNumbers && statusResult.trackingNumbers.length > 0) {
          // Found tracking! Update the order
          await db
            .update(supplierOrders)
            .set({
              trackingNumbers: statusResult.trackingNumbers,
              status: "shipped",
              updatedAt: new Date(),
            })
            .where(eq(supplierOrders.id, order.id));

          // Also update the main order status
          await db
            .update(orders)
            .set({
              status: "shipped",
              updatedAt: new Date(),
            })
            .where(eq(orders.id, order.orderId));

          result.updated++;
          result.details.push({
            orderId: order.orderId,
            supplier: order.supplier,
            supplierOrderNumber: order.supplierOrderNumber,
            trackingNumbers: statusResult.trackingNumbers,
            status: "updated",
          });

          console.log(`[tracking-sync] Updated ${order.orderId} with ${statusResult.trackingNumbers.length} tracking numbers`);
        } else {
          // No tracking yet
          result.details.push({
            orderId: order.orderId,
            supplier: order.supplier,
            supplierOrderNumber: order.supplierOrderNumber,
            status: "no_tracking",
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${order.orderId}: ${errorMsg}`);
        result.details.push({
          orderId: order.orderId,
          supplier: order.supplier,
          supplierOrderNumber: order.supplierOrderNumber || "unknown",
          status: "error",
          error: errorMsg,
        });
      }

      // Rate limit: wait 500ms between API calls
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Database error: ${errorMsg}`);
  }

  return result;
}

/**
 * Run all tracking syncs
 */
export async function syncAllTracking(): Promise<{
  usautoforce: TrackingSyncResult;
}> {
  console.log("[tracking-sync] Starting tracking sync...");

  const usautoforce = await syncUSAutoForceTracking();

  console.log(`[tracking-sync] Complete. USAF: ${usautoforce.updated}/${usautoforce.checked} updated`);

  return { usautoforce };
}
