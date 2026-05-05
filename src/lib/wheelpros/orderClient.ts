/**
 * WheelPros Order API Client
 * 
 * Places orders with WheelPros via their EDI Order API.
 * Docs: https://developer.wheelpros.com
 * 
 * Note: Order API uses different auth endpoint than Product API
 * Auth: /auth/v1/authorize (NOT /auth/token)
 * Customer #: 0001022896
 */

import { getSupplierCredentials } from "@/lib/supplierCredentialsSecure";

const ORDER_API_BASE = "https://api.wheelpros.com/orders/v1";
const ORDER_AUTH_URL = "https://api.wheelpros.com/auth/v1/authorize";

// Separate token cache for Order API (different auth endpoint)
let orderTokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Get auth token for Order API
 * Uses different endpoint than Product API
 */
async function getOrderApiToken(): Promise<string> {
  const now = Date.now();
  if (orderTokenCache && orderTokenCache.expiresAt > now + 30_000) {
    return orderTokenCache.token;
  }

  const creds = await getSupplierCredentials("wheelpros");
  
  const userName = creds.username;
  const password = creds.password;
  if (!userName || !password) {
    throw new Error("Missing WheelPros credentials. Configure in Admin → Settings → Suppliers.");
  }

  const res = await fetch(ORDER_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ userName, password }),
    cache: "no-store",
  });
  
  if (!res.ok) {
    throw new Error(`WheelPros Order API auth failed: HTTP ${res.status}`);
  }
  
  const data = await res.json();
  const token = data?.accessToken || data?.token;
  const expiresIn = Number(data?.expiresIn || 3600);
  
  if (!token) {
    throw new Error("WheelPros Order API auth: missing token in response");
  }

  orderTokenCache = { 
    token: String(token), 
    expiresAt: now + Math.max(60, expiresIn) * 1000 
  };
  
  return orderTokenCache.token;
}

// ============================================================================
// TYPES
// ============================================================================

export interface WheelProsOrderItem {
  partNumber: string;
  quantity: number;
  warehouseCode?: number;
}

export interface WheelProsShipTo {
  shipToName: string;
  address1: string;
  address2?: string;
  city: string;
  stateOrProvinceCode: string;
  postalCode: string;
  countryCode: string;
  phone: string;
  email?: string;
}

export interface WheelProsCreateOrderRequest {
  purchaseOrderNumber: string;
  items: WheelProsOrderItem[];
  shipping: WheelProsShipTo;
  orderNotes?: string;
  fulfillableOnly?: boolean;
  warehouseCode?: number; // Required at order level if not on items
}

export interface WheelProsOrderResponse {
  message?: string;
  supplierOrderNumber?: string;
  errorCode?: string;
  errorMessage?: string;
  errorType?: string;
}

export interface WheelProsTrackingResponse {
  purchaseOrderNumber?: string;
  supplierOrderNumber?: string;
  status?: string;
  shipments?: Array<{
    trackingNumber?: string;
    carrier?: string;
    shipDate?: string;
    items?: Array<{
      partNumber: string;
      quantity: number;
    }>;
  }>;
  errorCode?: string;
  errorMessage?: string;
}

// ============================================================================
// ORDER CREATION
// ============================================================================

/**
 * Place an order with WheelPros
 */
export async function placeWheelProsOrder(
  request: WheelProsCreateOrderRequest
): Promise<{
  success: boolean;
  orderNumber?: string;
  errorMessage?: string;
}> {
  const token = await getOrderApiToken();
  
  // Build payload - only include fields we have permission to use
  // Fields NOT allowed: allowPartialDelivery, purchaseOrderDate, purchaseOrderMethod
  // warehouseCode is REQUIRED at order level if not specified on items
  const payload = {
    purchaseOrderNumber: request.purchaseOrderNumber,
    warehouseCode: request.warehouseCode || 1001, // Default to warehouse 1001
    items: request.items.map(item => ({
      partNumber: item.partNumber,
      quantity: item.quantity,
      // Only include warehouseCode if specified on item
      ...(item.warehouseCode ? { warehouseCode: item.warehouseCode } : {}),
    })),
    shipping: {
      shipToName: request.shipping.shipToName,
      address1: request.shipping.address1,
      ...(request.shipping.address2 ? { address2: request.shipping.address2 } : {}),
      city: request.shipping.city,
      stateOrProvinceCode: request.shipping.stateOrProvinceCode,
      postalCode: request.shipping.postalCode,
      countryCode: request.shipping.countryCode || "US",
      phone: request.shipping.phone.replace(/\D/g, "").slice(0, 10), // 10 digits only
      ...(request.shipping.email ? { email: request.shipping.email } : {}),
    },
    ...(request.orderNotes ? { orderNotes: request.orderNotes } : {}),
    ...(request.fulfillableOnly ? { fulfillableOnly: true } : {}),
  };
  
  console.log("[wheelpros-order] Placing order:", {
    po: request.purchaseOrderNumber,
    items: request.items.length,
    shipTo: `${request.shipping.city}, ${request.shipping.stateOrProvinceCode}`,
  });
  
  const url = `${ORDER_API_BASE}/create?orderType=edi`;
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  
  const data: WheelProsOrderResponse = await res.json();
  
  if (res.ok && data.message === "success" && data.supplierOrderNumber) {
    console.log("[wheelpros-order] Order placed successfully:", data.supplierOrderNumber);
    return {
      success: true,
      orderNumber: data.supplierOrderNumber,
    };
  }
  
  // Handle errors
  const errorMsg = data.errorMessage || data.message || `HTTP ${res.status}`;
  console.error("[wheelpros-order] Order failed:", errorMsg);
  
  return {
    success: false,
    errorMessage: errorMsg,
  };
}

// ============================================================================
// ORDER TRACKING
// ============================================================================

/**
 * Track a WheelPros order by PO number or supplier order number
 */
export async function trackWheelProsOrder(params: {
  poNumber?: string;
  supplierOrderNumber?: string;
}): Promise<{
  success: boolean;
  status?: string;
  trackingNumbers?: string[];
  shipments?: WheelProsTrackingResponse["shipments"];
  errorMessage?: string;
}> {
  const token = await getOrderApiToken();
  
  const searchParams = new URLSearchParams();
  if (params.poNumber) searchParams.set("poNumber", params.poNumber);
  if (params.supplierOrderNumber) searchParams.set("supplierOrderNumber", params.supplierOrderNumber);
  
  const url = `${ORDER_API_BASE}/track?${searchParams.toString()}`;
  
  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
  
  const data: WheelProsTrackingResponse = await res.json();
  
  if (res.ok && !data.errorCode) {
    // Extract all tracking numbers from shipments
    const trackingNumbers: string[] = [];
    if (data.shipments) {
      for (const shipment of data.shipments) {
        if (shipment.trackingNumber) {
          trackingNumbers.push(shipment.trackingNumber);
        }
      }
    }
    
    return {
      success: true,
      status: data.status || "unknown",
      trackingNumbers,
      shipments: data.shipments,
    };
  }
  
  return {
    success: false,
    errorMessage: data.errorMessage || `HTTP ${res.status}`,
  };
}

// ============================================================================
// RETURN/RMA
// ============================================================================

export interface WheelProsReturnItem {
  supplierOrderNumber: string;
  partNumber: string;
  quantity: number;
  returnReasonCode: string;
}

/**
 * Create a return/RMA with WheelPros
 */
export async function createWheelProsReturn(
  items: WheelProsReturnItem[]
): Promise<{
  success: boolean;
  rmaNumber?: string;
  errorMessage?: string;
}> {
  const token = await getOrderApiToken();
  
  const url = `${ORDER_API_BASE}/return`;
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ items }),
  });
  
  const data = await res.json();
  
  if (res.ok && data.rmaNumber) {
    return {
      success: true,
      rmaNumber: data.rmaNumber,
    };
  }
  
  return {
    success: false,
    errorMessage: data.errorMessage || `HTTP ${res.status}`,
  };
}
