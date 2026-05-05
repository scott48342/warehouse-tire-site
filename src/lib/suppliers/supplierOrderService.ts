/**
 * Supplier Order Service
 * 
 * Automatically places orders with suppliers when customers purchase products.
 * 
 * Supported suppliers:
 * - US AutoForce (tireweb:usautoforce, usautoforce) - TIRES
 * - WheelPros (wheelpros) - WHEELS + TIRES
 * - TireWeb suppliers (tireweb:atd, tireweb:ntw, tireweb:km) - manual for now
 * 
 * Flow:
 * 1. Order created in our system (Stripe webhook)
 * 2. This service groups items by supplier
 * 3. For auto-order suppliers, places orders via their API
 * 4. Stores supplier order references for tracking
 */

import pg from "pg";
import type { QuoteSnapshot, QuoteLine } from "@/lib/quotes";
import { placeOrder as placeUSAutoForceOrder, getOrderStatus } from "@/lib/usautoforce/client";
import { placeWheelProsOrder, trackWheelProsOrder } from "@/lib/wheelpros/orderClient";

// ============================================================================
// TYPES
// ============================================================================

export interface SupplierOrderItem {
  partNumber: string;
  quantity: number;
  cost?: number;
  source: string;
  lineName: string;
}

export interface SupplierOrderRequest {
  orderId: string;
  supplier: string;
  items: SupplierOrderItem[];
  shipTo: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    phone?: string;
  };
}

export interface SupplierOrderResult {
  success: boolean;
  supplier: string;
  supplierOrderNumber?: string;
  supplierPO?: string;
  errorMessage?: string;
  items: SupplierOrderItem[];
}

// ============================================================================
// SUPPLIER ORDER TABLE
// ============================================================================

export async function ensureSupplierOrdersTable(db: pg.Pool): Promise<void> {
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
    );
    
    CREATE INDEX IF NOT EXISTS supplier_orders_order_id_idx ON supplier_orders (order_id);
    CREATE INDEX IF NOT EXISTS supplier_orders_supplier_idx ON supplier_orders (supplier);
    CREATE INDEX IF NOT EXISTS supplier_orders_status_idx ON supplier_orders (status);
    CREATE INDEX IF NOT EXISTS supplier_orders_supplier_order_idx ON supplier_orders (supplier_order_number);
  `);
}

// ============================================================================
// ITEM EXTRACTION
// ============================================================================

/**
 * Extract ALL items (wheels + tires) from order snapshot, grouped by supplier
 */
export function extractItemsBySupplier(snapshot: QuoteSnapshot): Map<string, SupplierOrderItem[]> {
  const bySupplier = new Map<string, SupplierOrderItem[]>();
  
  for (const line of snapshot.lines) {
    const cartType = line.meta?.cartType;
    
    // Only process tire and wheel items
    if (cartType !== "tire" && cartType !== "wheel") continue;
    
    const source = line.meta?.source || "unknown";
    const partNumber = line.sku;
    
    if (!partNumber) continue;
    
    const item: SupplierOrderItem = {
      partNumber,
      quantity: line.qty,
      cost: line.meta?.cost,
      source,
      lineName: line.name,
    };
    
    // Normalize supplier name
    const supplier = normalizeSupplier(source);
    
    if (!bySupplier.has(supplier)) {
      bySupplier.set(supplier, []);
    }
    bySupplier.get(supplier)!.push(item);
  }
  
  return bySupplier;
}

/**
 * @deprecated Use extractItemsBySupplier instead
 */
export function extractTireItemsBySupplier(snapshot: QuoteSnapshot): Map<string, SupplierOrderItem[]> {
  return extractItemsBySupplier(snapshot);
}

/**
 * Normalize source to supplier name
 */
function normalizeSupplier(source: string): string {
  const s = source.toLowerCase();
  
  if (s.includes("usautoforce") || s === "tireweb:usautoforce") {
    return "usautoforce";
  }
  if (s.includes("atd") || s === "tireweb:atd") {
    return "atd";
  }
  if (s.includes("ntw") || s === "tireweb:ntw") {
    return "ntw";
  }
  if (s.includes("km") || s === "tireweb:km") {
    return "km";
  }
  if (s === "wheelpros") {
    return "wheelpros";
  }
  
  return source;
}

/**
 * Check if supplier supports automatic ordering
 */
export function isAutoOrderSupplier(supplier: string): boolean {
  // US AutoForce: tires via SOAP API
  // WheelPros: wheels + tires via REST API
  return supplier === "usautoforce" || supplier === "wheelpros";
}

// ============================================================================
// ORDER PLACEMENT
// ============================================================================

/**
 * Place order with WheelPros
 */
async function placeWheelProsSupplierOrder(
  request: SupplierOrderRequest
): Promise<SupplierOrderResult> {
  try {
    console.log(`[supplier-order] Placing WheelPros order for ${request.orderId}:`, {
      items: request.items.length,
      shipTo: `${request.shipTo.city}, ${request.shipTo.state}`,
    });
    
    const result = await placeWheelProsOrder({
      purchaseOrderNumber: `WTD-${request.orderId}`,
      items: request.items.map(i => ({
        partNumber: i.partNumber,
        quantity: i.quantity,
      })),
      shipping: {
        shipToName: request.shipTo.name,
        address1: request.shipTo.address1,
        address2: request.shipTo.address2,
        city: request.shipTo.city,
        stateOrProvinceCode: request.shipTo.state,
        postalCode: request.shipTo.zip,
        countryCode: "US",
        phone: request.shipTo.phone || "5555555555",
      },
      orderNotes: `Warehouse Tire Direct Order ${request.orderId}`,
    });
    
    if (result.success) {
      console.log(`[supplier-order] WheelPros order placed: ${result.orderNumber}`);
      return {
        success: true,
        supplier: "wheelpros",
        supplierOrderNumber: result.orderNumber,
        supplierPO: `WTD-${request.orderId}`,
        items: request.items,
      };
    } else {
      console.error(`[supplier-order] WheelPros order failed:`, result.errorMessage);
      return {
        success: false,
        supplier: "wheelpros",
        errorMessage: result.errorMessage,
        items: request.items,
      };
    }
  } catch (err: any) {
    console.error(`[supplier-order] WheelPros order error:`, err);
    return {
      success: false,
      supplier: "wheelpros",
      errorMessage: String(err.message || err),
      items: request.items,
    };
  }
}

/**
 * Place order with US AutoForce
 */
async function placeUSAutoForceSupplierOrder(
  request: SupplierOrderRequest
): Promise<SupplierOrderResult> {
  try {
    console.log(`[supplier-order] Placing US AutoForce order for ${request.orderId}:`, {
      items: request.items.length,
      shipTo: `${request.shipTo.city}, ${request.shipTo.state}`,
    });
    
    const result = await placeUSAutoForceOrder({
      purchaseOrderNumber: `WTD-${request.orderId}`,
      items: request.items.map(i => ({
        partNumber: i.partNumber,
        quantity: i.quantity,
      })),
      shipTo: request.shipTo,
      notes: `Warehouse Tire Direct Order ${request.orderId}`,
    });
    
    if (result.success) {
      console.log(`[supplier-order] US AutoForce order placed: ${result.orderNumber}`);
      return {
        success: true,
        supplier: "usautoforce",
        supplierOrderNumber: result.orderNumber,
        supplierPO: `WTD-${request.orderId}`,
        items: request.items,
      };
    } else {
      console.error(`[supplier-order] US AutoForce order failed:`, result.errorMessage);
      return {
        success: false,
        supplier: "usautoforce",
        errorMessage: result.errorMessage,
        items: request.items,
      };
    }
  } catch (err: any) {
    console.error(`[supplier-order] US AutoForce order error:`, err);
    return {
      success: false,
      supplier: "usautoforce",
      errorMessage: String(err.message || err),
      items: request.items,
    };
  }
}

/**
 * Process all supplier orders for a customer order
 */
export async function processSupplierOrders(
  db: pg.Pool,
  orderId: string,
  snapshot: QuoteSnapshot,
  shipTo: SupplierOrderRequest["shipTo"]
): Promise<SupplierOrderResult[]> {
  await ensureSupplierOrdersTable(db);
  
  const results: SupplierOrderResult[] = [];
  const itemsBySupplier = extractItemsBySupplier(snapshot);
  
  for (const [supplier, items] of itemsBySupplier) {
    console.log(`[supplier-order] Processing ${items.length} items for supplier: ${supplier}`);
    
    const request: SupplierOrderRequest = {
      orderId,
      supplier,
      items,
      shipTo,
    };
    
    let result: SupplierOrderResult;
    
    if (isAutoOrderSupplier(supplier)) {
      // Auto-order supported - place order via API
      if (supplier === "usautoforce") {
        result = await placeUSAutoForceSupplierOrder(request);
      } else if (supplier === "wheelpros") {
        result = await placeWheelProsSupplierOrder(request);
      } else {
        // Shouldn't happen, but handle gracefully
        result = {
          success: false,
          supplier,
          errorMessage: `Auto-order not implemented for ${supplier}`,
          items,
        };
      }
    } else {
      // Manual order required - just log for now
      console.log(`[supplier-order] Manual order required for ${supplier}:`, items);
      result = {
        success: true,
        supplier,
        supplierPO: `MANUAL-${orderId}`,
        items,
      };
    }
    
    // Store result in database
    await db.query(`
      INSERT INTO supplier_orders (
        order_id, supplier, supplier_order_number, supplier_po,
        status, items_json, ship_to_json, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      orderId,
      supplier,
      result.supplierOrderNumber || null,
      result.supplierPO || null,
      result.success ? (isAutoOrderSupplier(supplier) ? "placed" : "manual") : "failed",
      JSON.stringify(items),
      JSON.stringify(shipTo),
      result.errorMessage || null,
    ]);
    
    results.push(result);
  }
  
  return results;
}

// ============================================================================
// ORDER STATUS SYNC
// ============================================================================

/**
 * Sync order status from WheelPros
 */
export async function syncWheelProsOrderStatus(
  db: pg.Pool,
  supplierOrderNumber: string
): Promise<{
  status: string;
  trackingNumbers: string[];
}> {
  try {
    const result = await trackWheelProsOrder({ supplierOrderNumber });
    
    if (result.success) {
      // Update our record
      await db.query(`
        UPDATE supplier_orders
        SET status = $1,
            tracking_numbers = $2,
            updated_at = NOW()
        WHERE supplier_order_number = $3 AND supplier = 'wheelpros'
      `, [
        result.status || "unknown",
        result.trackingNumbers || [],
        supplierOrderNumber,
      ]);
      
      return {
        status: result.status || "unknown",
        trackingNumbers: result.trackingNumbers || [],
      };
    }
    
    return { status: "unknown", trackingNumbers: [] };
  } catch (err) {
    console.error(`[supplier-order] WheelPros status sync error for ${supplierOrderNumber}:`, err);
    return { status: "error", trackingNumbers: [] };
  }
}

/**
 * Sync order status from US AutoForce
 */
export async function syncUSAutoForceOrderStatus(
  db: pg.Pool,
  supplierOrderNumber: string
): Promise<{
  status: string;
  trackingNumbers: string[];
}> {
  try {
    const status = await getOrderStatus(supplierOrderNumber);
    
    if (status.success) {
      // Update our record
      await db.query(`
        UPDATE supplier_orders
        SET status = $1,
            tracking_numbers = $2,
            updated_at = NOW()
        WHERE supplier_order_number = $3
      `, [
        status.status || "unknown",
        status.trackingNumbers || [],
        supplierOrderNumber,
      ]);
      
      return {
        status: status.status || "unknown",
        trackingNumbers: status.trackingNumbers || [],
      };
    }
    
    return { status: "unknown", trackingNumbers: [] };
  } catch (err) {
    console.error(`[supplier-order] Status sync error for ${supplierOrderNumber}:`, err);
    return { status: "error", trackingNumbers: [] };
  }
}

/**
 * Get supplier orders for a customer order
 */
export async function getSupplierOrdersForOrder(
  db: pg.Pool,
  orderId: string
): Promise<Array<{
  supplier: string;
  supplierOrderNumber: string | null;
  status: string;
  items: SupplierOrderItem[];
  trackingNumbers: string[];
  errorMessage: string | null;
}>> {
  await ensureSupplierOrdersTable(db);
  
  const { rows } = await db.query(`
    SELECT supplier, supplier_order_number, status, items_json, 
           tracking_numbers, error_message
    FROM supplier_orders
    WHERE order_id = $1
    ORDER BY created_at
  `, [orderId]);
  
  return rows.map(r => ({
    supplier: r.supplier,
    supplierOrderNumber: r.supplier_order_number,
    status: r.status,
    items: r.items_json as SupplierOrderItem[],
    trackingNumbers: r.tracking_numbers || [],
    errorMessage: r.error_message,
  }));
}
