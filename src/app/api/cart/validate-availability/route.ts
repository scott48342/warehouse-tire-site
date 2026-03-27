import { NextResponse } from "next/server";
import { fetchAvailability, ORDERABLE_TYPES } from "@/lib/availabilityCache";
import { getSupplierCredentials } from "@/lib/supplierCredentialsSecure";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/cart/validate-availability
 * 
 * Live availability validation for cart/checkout.
 * This is the ONLY place where live WheelPros availability checks should happen.
 * 
 * Called:
 * - When user adds to cart (optional, for immediate feedback)
 * - Before checkout submission (required, blocks order if unavailable)
 * 
 * Request body:
 * {
 *   items: [{ sku: string, quantity: number }]
 * }
 * 
 * Response:
 * {
 *   ok: boolean,
 *   items: [{
 *     sku: string,
 *     requestedQty: number,
 *     available: boolean,
 *     inventoryType: string,
 *     localStock: number,
 *     globalStock: number,
 *     totalStock: number,
 *     error?: string
 *   }],
 *   allAvailable: boolean,
 *   unavailableSkus: string[]
 * }
 */
export async function POST(req: Request) {
  const t0 = Date.now();
  
  try {
    const body = await req.json().catch(() => ({}));
    const items: Array<{ sku: string; quantity: number }> = Array.isArray(body.items) ? body.items : [];
    
    if (items.length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: "No items to validate" 
      }, { status: 400 });
    }
    
    // Validate input
    for (const item of items) {
      if (!item.sku || typeof item.sku !== "string") {
        return NextResponse.json({ 
          ok: false, 
          error: `Invalid SKU: ${item.sku}` 
        }, { status: 400 });
      }
      if (!item.quantity || item.quantity < 1) {
        return NextResponse.json({ 
          ok: false, 
          error: `Invalid quantity for SKU ${item.sku}: ${item.quantity}` 
        }, { status: 400 });
      }
    }
    
    const wheelProsBase = process.env.WHEELPROS_WRAPPER_URL || process.env.NEXT_PUBLIC_WHEELPROS_API_BASE_URL;
    if (!wheelProsBase) {
      return NextResponse.json({ 
        ok: false, 
        error: "Supplier API not configured" 
      }, { status: 500 });
    }
    
    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.WHEELPROS_WRAPPER_API_KEY) {
      headers["x-api-key"] = process.env.WHEELPROS_WRAPPER_API_KEY;
    }
    
    // Get supplier credentials
    const wpCreds = await getSupplierCredentials("wheelpros");
    
    // Check availability for all items concurrently
    const results = await Promise.all(
      items.map(async (item) => {
        try {
          const avail = await fetchAvailability({
            wheelProsBase,
            headers,
            sku: item.sku,
            minQty: item.quantity,
            customerNumber: wpCreds.customerNumber || undefined,
            companyCode: wpCreds.companyCode || undefined,
          });
          
          const localStock = avail.localQty || 0;
          const globalStock = avail.globalQty || 0;
          const totalStock = localStock + globalStock;
          const isOrderable = ORDERABLE_TYPES.has(avail.inventoryType);
          const hasStock = totalStock >= item.quantity;
          
          return {
            sku: item.sku,
            requestedQty: item.quantity,
            available: avail.ok && isOrderable && hasStock,
            inventoryType: avail.inventoryType,
            localStock,
            globalStock,
            totalStock,
            checkedAt: avail.checkedAt,
            fromCache: avail.fromCache,
          };
        } catch (e: any) {
          return {
            sku: item.sku,
            requestedQty: item.quantity,
            available: false,
            inventoryType: "",
            localStock: 0,
            globalStock: 0,
            totalStock: 0,
            error: e?.message || "Failed to check availability",
          };
        }
      })
    );
    
    const unavailableSkus = results
      .filter((r) => !r.available)
      .map((r) => r.sku);
    
    return NextResponse.json({
      ok: true,
      items: results,
      allAvailable: unavailableSkus.length === 0,
      unavailableSkus,
      timing: {
        totalMs: Date.now() - t0,
        itemCount: items.length,
      },
    });
  } catch (e: any) {
    console.error("[cart/validate-availability] Error:", e);
    return NextResponse.json({ 
      ok: false, 
      error: e?.message || String(e) 
    }, { status: 500 });
  }
}
