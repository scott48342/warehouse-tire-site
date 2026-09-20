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
import { getUSAFBrandCode } from "@/lib/usautoforce/brandCodes";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Where the routing source of an item came from:
 *  - catalog:       meta.catalog.supplierSource written server-side by the price resolver (trusted)
 *  - legacy_client: snapshot predates catalog attrs (before 2026-09-20); only the client's
 *                   meta.source exists - grouped for visibility, NEVER auto-ordered
 *  - unknown:       no usable source at all - manual
 */
export type SupplierSourceTrust = "catalog" | "legacy_client" | "unknown";

export interface SupplierOrderItem {
  partNumber: string;
  quantity: number;
  cost?: number;
  source: string;
  sourceTrust: SupplierSourceTrust;
  lineName: string;
  /** Brand name as the CATALOG names it (meta.catalog.brand). Never client meta.brand / line name. */
  brand?: string;
  /**
   * USAF brand/line code - required for USAF orders. Only ever the catalog's own code
   * (meta.catalog.brandCode) or the mapping of the catalog's brand name; never derived from
   * the client's brand claim or the product name.
   */
  lineCode?: string;
  /** Where brand/lineCode came from: catalog | none. Legacy client brand is not used. */
  identityTrust: "catalog" | "none";
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
  /**
   * USAF fulfillment branch selected at checkout (freight-quote origin).
   * Submitted as <branch> so fulfillment matches the shipping quote.
   */
  usafBranch?: string;
}

export interface SupplierOrderResult {
  success: boolean;
  supplier: string;
  supplierOrderNumber?: string;
  supplierPO?: string;
  errorMessage?: string;
  items: SupplierOrderItem[];
  /** Warehouse/branch the order was placed against (USAF) */
  fulfillmentBranch?: string;
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
    
    ALTER TABLE supplier_orders ADD COLUMN IF NOT EXISTS fulfillment_branch TEXT;
    
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
 * Routing source for a snapshot line. The CATALOG's supplierSource (written by the server-side
 * price resolver into meta.catalog) is the only trusted routing key; the client's meta.source is
 * an order-record field a shopper can set to anything. Legacy snapshots (no meta.catalog object)
 * fall back to meta.source for grouping/visibility but are flagged so they are never auto-ordered.
 */
export function resolveLineSupplierSource(line: QuoteLine): { source: string; sourceTrust: SupplierSourceTrust } {
  const meta = (line.meta || {}) as Record<string, unknown>;
  const catalog = meta.catalog;
  if (catalog && typeof catalog === "object") {
    const cs = (catalog as Record<string, unknown>).supplierSource;
    const trusted = typeof cs === "string" ? cs.trim() : "";
    return trusted ? { source: trusted, sourceTrust: "catalog" } : { source: "unknown", sourceTrust: "unknown" };
  }
  const legacy = typeof meta.source === "string" ? meta.source.trim() : "";
  return legacy ? { source: legacy, sourceTrust: "legacy_client" } : { source: "unknown", sourceTrust: "unknown" };
}

/**
 * Product identity for the supplier PO from the catalog block only. The client's meta.brand /
 * meta.brandName and the (client-built) line name are never consulted: a shopper could set them
 * to any brand and, for US AutoForce, any lineCode - which is what the supplier actually ships.
 */
export function resolveLineIdentity(line: QuoteLine): { brand?: string; lineCode?: string; identityTrust: "catalog" | "none" } {
  const meta = (line.meta || {}) as Record<string, unknown>;
  const catalog = meta.catalog;
  if (!catalog || typeof catalog !== "object") return { identityTrust: "none" };
  const c = catalog as Record<string, unknown>;
  const brand = typeof c.brand === "string" && c.brand.trim() ? c.brand.trim() : undefined;
  const code = typeof c.brandCode === "string" && c.brandCode.trim() ? c.brandCode.trim().toUpperCase() : undefined;
  const lineCode = code ?? (brand ? getUSAFBrandCode(brand) ?? undefined : undefined);
  if (!brand && !lineCode) return { identityTrust: "none" };
  return { brand, lineCode, identityTrust: "catalog" };
}

/**
 * An auto-order API call is allowed only when EVERY item's routing came from the catalog and,
 * for US AutoForce (whose order API keys on lineCode), every item's lineCode is catalog-derived.
 */
export function canAutoOrder(supplier: string, items: SupplierOrderItem[]): boolean {
  if (!isAutoOrderSupplier(supplier) || items.length === 0) return false;
  if (!items.every((i) => i.sourceTrust === "catalog")) return false;
  if (supplier === "usautoforce") return items.every((i) => i.identityTrust === "catalog" && !!i.lineCode);
  return true;
}

/** Human-readable reasons an auto-order group is held; empty when canAutoOrder is true. */
export function autoOrderHoldReasons(supplier: string, items: SupplierOrderItem[]): string[] {
  const out: string[] = [];
  for (const i of items) {
    if (i.sourceTrust !== "catalog") out.push(`${i.partNumber} routing=${i.sourceTrust}`);
    else if (supplier === "usautoforce" && (i.identityTrust !== "catalog" || !i.lineCode)) out.push(`${i.partNumber} lineCode=missing`);
  }
  return out;
}

/**
 * Extract ALL items (wheels + tires) from order snapshot, grouped by supplier
 */
export function extractItemsBySupplier(snapshot: QuoteSnapshot): Map<string, SupplierOrderItem[]> {
  const bySupplier = new Map<string, SupplierOrderItem[]>();
  
  for (const line of snapshot.lines) {
    const cartType = line.meta?.cartType;
    
    // Only process tire and wheel items
    if (cartType !== "tire" && cartType !== "wheel") continue;
    
    const { source, sourceTrust } = resolveLineSupplierSource(line);
    const partNumber = line.sku;
    
    if (!partNumber) continue;
    
    // Product identity (brand / USAF lineCode): catalog block only - never meta.brand,
    // meta.brandName or the client-built line name (Codex supplier trust review 2026-09-20).
    const { brand, lineCode, identityTrust } = resolveLineIdentity(line);
    
    const item: SupplierOrderItem = {
      partNumber,
      quantity: line.qty,
      cost: line.meta?.cost,
      source,
      sourceTrust,
      lineName: line.name,
      brand,
      lineCode,
      identityTrust,
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
 * 
 * IMPORTANT: USAF Order API requires lineCode (brand code) for all items.
 * Items without lineCode will cause the order to fail with "No part found!"
 */
async function placeUSAutoForceSupplierOrder(
  request: SupplierOrderRequest
): Promise<SupplierOrderResult> {
  try {
    // Check that all items have lineCode
    const itemsWithoutCode = request.items.filter(i => !i.lineCode);
    if (itemsWithoutCode.length > 0) {
      const missingBrands = itemsWithoutCode.map(i => `${i.partNumber} (brand: ${i.brand || "unknown"})`);
      console.error(`[supplier-order] USAF order blocked - missing lineCode for:`, missingBrands);
      return {
        success: false,
        supplier: "usautoforce",
        errorMessage: `Cannot place USAF order: lineCode (brand code) missing for ${itemsWithoutCode.length} item(s). Brands not mapped: ${missingBrands.join(", ")}`,
        items: request.items,
      };
    }
    
    // Resolve fulfillment branch:
    // 1. Use the branch persisted at checkout (matches the freight quote)
    // 2. Otherwise select nearest stocking branch for the destination ZIP
    // (never blindly default to a fixed warehouse)
    let warehouseCode = request.usafBranch;
    if (!warehouseCode && request.shipTo.zip) {
      try {
        const { selectUsafBranch, parseTireSize } = await import("@/lib/usautoforce/branchSelector");
        const selection = await selectUsafBranch(
          request.items.map(i => ({
            partNumber: i.partNumber,
            quantity: i.quantity,
            size: parseTireSize(i.lineName) || undefined,
            name: i.lineName,
          })),
          request.shipTo.zip
        );
        if (selection) {
          warehouseCode = selection.branchCode;
          console.log(`[supplier-order] USAF branch selected at order time: ${warehouseCode} (${selection.warehouse.city}, ${selection.warehouse.state}), complete=${selection.complete}`);
        }
      } catch (err) {
        console.error(`[supplier-order] USAF branch selection failed; order will use client default:`, err);
      }
    }
    
    console.log(`[supplier-order] Placing US AutoForce order for ${request.orderId}:`, {
      items: request.items.length,
      itemDetails: request.items.map(i => ({ partNumber: i.partNumber, lineCode: i.lineCode, qty: i.quantity })),
      shipTo: `${request.shipTo.city}, ${request.shipTo.state}`,
      warehouseCode: warehouseCode || "(client default)",
    });
    
    const result = await placeUSAutoForceOrder({
      purchaseOrderNumber: `WTD-${request.orderId}`,
      items: request.items.map(i => ({
        partNumber: i.partNumber,
        quantity: i.quantity,
        lineCode: i.lineCode!, // We verified above that all items have lineCode
      })),
      shipTo: request.shipTo,
      notes: `Warehouse Tire Direct Order ${request.orderId}`,
      warehouseCode,
    });
    
    if (result.success) {
      console.log(`[supplier-order] US AutoForce order placed: ${result.orderNumber} (branch: ${warehouseCode || "default"})`);
      return {
        success: true,
        supplier: "usautoforce",
        supplierOrderNumber: result.orderNumber,
        supplierPO: `WTD-${request.orderId}`,
        items: request.items,
        fulfillmentBranch: warehouseCode,
      };
    } else {
      console.error(`[supplier-order] US AutoForce order failed:`, result.errorMessage);
      return {
        success: false,
        supplier: "usautoforce",
        errorMessage: result.errorMessage,
        items: request.items,
        fulfillmentBranch: warehouseCode,
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
  shipTo: SupplierOrderRequest["shipTo"],
  options?: { usafBranch?: string }
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
      usafBranch: supplier === "usautoforce" ? options?.usafBranch : undefined,
    };
    
    let result: SupplierOrderResult;
    const autoOrder = canAutoOrder(supplier, items);
    
    if (isAutoOrderSupplier(supplier) && !autoOrder) {
      // The supplier could take an API order, but at least one item's routing or product
      // identity (USAF lineCode) did not come from the catalog (legacy snapshot, unknown
      // source, or catalog without a brand code). Hold for a human - never place a supplier
      // order on a client-claimed source or brand.
      const reasons = autoOrderHoldReasons(supplier, items);
      console.warn(`[supplier-order] ${supplier} order for ${orderId} held for review - not catalog-verified:`, reasons);
      result = {
        success: true,
        supplier,
        supplierPO: `MANUAL-REVIEW-${orderId}`,
        errorMessage: `Held for review: supplier routing/identity not catalog-verified for ${reasons.join(", ")}`,
        items,
      };
    } else if (autoOrder) {
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
        status, items_json, ship_to_json, error_message, fulfillment_branch
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      orderId,
      supplier,
      result.supplierOrderNumber || null,
      result.supplierPO || null,
      result.success ? (autoOrder ? "placed" : "manual") : "failed",
      JSON.stringify(items),
      JSON.stringify(shipTo),
      result.errorMessage || null,
      result.fulfillmentBranch || null,
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
