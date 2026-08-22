/**
 * GET /api/account/orders/[id]
 * 
 * Get order detail for the authenticated user.
 * 
 * Ownership verified server-side:
 * 1. Valid authenticated session
 * 2. Email is verified (emailVerified === true)
 * 3. Session email matches order customer_email (normalized)
 * 
 * Never trusts order ID alone — ownership check required.
 * 
 * @created 2026-08-22 - Phase 3A: My Orders
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getPool } from "@/lib/quotes";
import { normalizeEmail, emailsMatch } from "@/lib/account/emailUtils";
import type { QuoteSnapshot, QuoteLine } from "@/lib/quotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Order status display labels
const STATUS_LABELS: Record<string, string> = {
  received: "Order Received",
  processing: "Processing",
  parts_ordered: "Parts Ordered",
  ready_for_install: "Ready for Install",
  shipped: "Shipped",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

/**
 * Customer-safe line item
 */
interface CustomerLineItem {
  name: string;
  type: "wheel" | "tire" | "accessory" | "service" | "other";
  sku?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  imageUrl?: string;
  specs?: {
    size?: string;
    brand?: string;
    finish?: string;
  };
}

/**
 * Customer-safe order detail
 */
interface OrderDetail {
  id: string;
  orderDate: string;
  status: string;
  statusLabel: string;
  
  // Amounts
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  
  // Vehicle
  vehicle: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  } | null;
  
  // Line items
  items: CustomerLineItem[];
  
  // Shipping (customer-appropriate info only)
  shipping: {
    name: string;
    city: string;
    state: string;
    zip: string;
  } | null;
  
  // Installation (local site only)
  installation: {
    storeName: string;
    storeAddress?: string;
  } | null;
  
  // Tracking
  tracking: Array<{
    carrier: string;
    trackingNumber: string;
    trackingUrl?: string;
  }>;
}

/**
 * Transform quote line to customer-safe line item
 */
function transformLineItem(line: QuoteLine): CustomerLineItem {
  const cartType = line.meta?.cartType as string | undefined;
  
  let type: CustomerLineItem["type"] = "other";
  if (cartType === "wheel") type = "wheel";
  else if (cartType === "tire") type = "tire";
  else if (cartType === "accessory") type = "accessory";
  else if (line.kind === "catalog") type = "service";
  
  return {
    name: line.name,
    type,
    sku: line.sku || undefined,
    quantity: line.qty,
    unitPrice: line.unitPriceUsd,
    total: line.unitPriceUsd * line.qty,
    imageUrl: line.meta?.imageUrl as string | undefined,
    specs: {
      size: (line.meta?.size || line.meta?.spec?.size) as string | undefined,
      brand: line.meta?.brand as string | undefined,
      finish: line.meta?.finish as string | undefined,
    },
  };
}

/**
 * Generate tracking URL based on carrier detection
 */
function getTrackingUrl(trackingNumber: string): { carrier: string; url?: string } {
  const num = trackingNumber.trim().toUpperCase();
  
  // FedEx: starts with specific patterns, typically 12-22 digits
  if (/^\d{12,22}$/.test(num) || /^(7489|6129|0075|0143|2036)/.test(num)) {
    return {
      carrier: "FedEx",
      url: `https://www.fedex.com/fedextrack/?trknbr=${num}`,
    };
  }
  
  // UPS: starts with 1Z
  if (/^1Z[A-Z0-9]{16}$/i.test(num)) {
    return {
      carrier: "UPS",
      url: `https://www.ups.com/track?tracknum=${num}`,
    };
  }
  
  // USPS: various patterns
  if (/^(94|93|92|91|90|70|20|23|03)[0-9]{20,}$/i.test(num)) {
    return {
      carrier: "USPS",
      url: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${num}`,
    };
  }
  
  return { carrier: "Carrier" };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    
    if (!orderId) {
      return NextResponse.json(
        { error: "bad_request", message: "Order ID required" },
        { status: 400 }
      );
    }

    // 1. Authenticate
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // 2. Require verified email
    if (!session.user.emailVerified) {
      return NextResponse.json(
        { error: "email_not_verified", message: "Email verification required to view orders" },
        { status: 403 }
      );
    }

    const userEmail = normalizeEmail(session.user.email);
    if (!userEmail) {
      return NextResponse.json(
        { error: "no_email", message: "Account has no email address" },
        { status: 400 }
      );
    }

    // 3. Fetch order
    const db = getPool();
    
    const { rows } = await db.query(
      `
      SELECT 
        o.id,
        o.status,
        o.amount_paid_cents,
        o.customer_email,
        o.created_at,
        o.snapshot_json
      FROM orders o
      WHERE o.id = $1
      LIMIT 1
    `,
      [orderId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "not_found", message: "Order not found" },
        { status: 404 }
      );
    }

    const order = rows[0];

    // 4. OWNERSHIP CHECK — never trust the URL alone
    if (!emailsMatch(order.customer_email, userEmail)) {
      // Log potential unauthorized access attempt (without exposing actual owner)
      console.warn(`[api/account/orders] Ownership denied: user=${userEmail} tried to access order=${orderId}`);
      
      // Return 404 (not 403) to avoid confirming order existence
      return NextResponse.json(
        { error: "not_found", message: "Order not found" },
        { status: 404 }
      );
    }

    // 5. Fetch tracking numbers from supplier orders
    const { rows: supplierRows } = await db.query(
      `
      SELECT tracking_numbers
      FROM supplier_orders
      WHERE order_id = $1 AND tracking_numbers IS NOT NULL
    `,
      [orderId]
    );

    const allTrackingNumbers: string[] = [];
    for (const sr of supplierRows) {
      if (Array.isArray(sr.tracking_numbers)) {
        allTrackingNumbers.push(...sr.tracking_numbers.filter((t: any) => t && t.trim()));
      }
    }

    // 6. Transform to customer-safe detail
    const snapshot = order.snapshot_json as QuoteSnapshot;

    // Extract vehicle
    let vehicle: OrderDetail["vehicle"] = null;
    if (snapshot.vehicle) {
      const { year, make, model, trim } = snapshot.vehicle;
      if (year || make || model) {
        vehicle = { year, make, model, trim };
      }
    }

    // Transform line items (exclude internal fields)
    const items = (snapshot.lines || []).map(transformLineItem);

    // Extract shipping (customer-safe fields only)
    // Note: shippingAddress doesn't have firstName/lastName - use customer info
    let shipping: OrderDetail["shipping"] = null;
    if (snapshot.shippingAddress) {
      const addr = snapshot.shippingAddress;
      const customerName = [snapshot.customer?.firstName, snapshot.customer?.lastName]
        .filter(Boolean)
        .join(" ") || "Customer";
      shipping = {
        name: customerName,
        city: addr.city || "",
        state: addr.state || "",
        zip: addr.zip || "",
      };
    }

    // Extract installation info (local site only)
    // Note: localMode uses installStoreName/installStoreAddress, not store.name/store.address
    let installation: OrderDetail["installation"] = null;
    if (snapshot.localMode) {
      installation = {
        storeName: snapshot.localMode.installStoreName || "Store",
        storeAddress: snapshot.localMode.installStoreAddress,
      };
    }

    // Build tracking array with URLs
    const tracking = [...new Set(allTrackingNumbers)].map((num) => {
      const { carrier, url } = getTrackingUrl(num);
      return {
        carrier,
        trackingNumber: num,
        trackingUrl: url,
      };
    });

    const orderDetail: OrderDetail = {
      id: order.id,
      orderDate: order.created_at?.toISOString() || new Date().toISOString(),
      status: order.status,
      statusLabel: STATUS_LABELS[order.status] || order.status,
      
      subtotal: snapshot.totals?.partsSubtotal || 0,
      tax: snapshot.totals?.tax || 0,
      total: snapshot.totals?.total || 0,
      amountPaid: (order.amount_paid_cents || 0) / 100,
      
      vehicle,
      items,
      shipping,
      installation,
      tracking,
    };

    return NextResponse.json({ order: orderDetail });
  } catch (err: any) {
    console.error("[api/account/orders/[id]] Error:", err);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to fetch order" },
      { status: 500 }
    );
  }
}
