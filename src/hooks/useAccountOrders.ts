/**
 * useAccountOrders Hook
 * 
 * Fetches orders for the authenticated user from /api/account/orders.
 * Requires authenticated session with verified email.
 * 
 * @created 2026-08-22 - Phase 3A: My Orders
 */

import { useState, useEffect, useCallback } from "react";

/**
 * Order summary for list view
 */
export interface OrderSummary {
  id: string;
  orderDate: string;
  status: string;
  statusLabel: string;
  total: number;
  vehicle: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  } | null;
  itemSummary: string;
  itemCount: number;
  hasTracking: boolean;
}

/**
 * Order line item
 */
export interface OrderLineItem {
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
 * Full order detail
 */
export interface OrderDetail {
  id: string;
  orderDate: string;
  status: string;
  statusLabel: string;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  vehicle: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  } | null;
  items: OrderLineItem[];
  shipping: {
    name: string;
    city: string;
    state: string;
    zip: string;
  } | null;
  installation: {
    storeName: string;
    storeAddress?: string;
  } | null;
  tracking: Array<{
    carrier: string;
    trackingNumber: string;
    trackingUrl?: string;
  }>;
}

interface UseAccountOrdersResult {
  orders: OrderSummary[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseOrderDetailResult {
  order: OrderDetail | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetch list of orders for the authenticated user
 */
export function useAccountOrders(): UseAccountOrdersResult {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/account/orders", {
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        
        if (res.status === 401) {
          setError("Please sign in to view your orders");
        } else if (res.status === 403) {
          setError("Please verify your email to view orders");
        } else {
          setError(data.message || "Failed to load orders");
        }
        setOrders([]);
        return;
      }

      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) {
      console.error("[useAccountOrders] Fetch error:", err);
      setError("Failed to load orders");
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    isLoading,
    error,
    refetch: fetchOrders,
  };
}

/**
 * Fetch detail for a specific order
 */
export function useOrderDetail(orderId: string | null): UseOrderDetailResult {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setOrder(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/account/orders/${encodeURIComponent(orderId)}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        
        if (res.status === 401) {
          setError("Please sign in to view this order");
        } else if (res.status === 403) {
          setError("Please verify your email to view orders");
        } else if (res.status === 404) {
          setError("Order not found");
        } else {
          setError(data.message || "Failed to load order");
        }
        setOrder(null);
        return;
      }

      const data = await res.json();
      setOrder(data.order || null);
    } catch (err) {
      console.error("[useOrderDetail] Fetch error:", err);
      setError("Failed to load order");
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  return {
    order,
    isLoading,
    error,
    refetch: fetchOrder,
  };
}
