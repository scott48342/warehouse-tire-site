"use client";

/**
 * Order Detail Modal
 * 
 * Displays full order details in a modal overlay.
 * Fetches data from /api/account/orders/[id] with server-side ownership verification.
 * 
 * @created 2026-08-22 - Phase 3A: My Orders
 */

import { useEffect, useCallback } from "react";
import { useOrderDetail, type OrderDetail, type OrderLineItem } from "@/hooks/useAccountOrders";

interface OrderDetailModalProps {
  orderId: string;
  onClose: () => void;
}

/**
 * Format date for display
 */
function formatDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Get status badge color
 */
function getStatusColor(status: string): string {
  switch (status) {
    case "shipped":
    case "delivered":
    case "completed":
      return "bg-green-100 text-green-700";
    case "processing":
    case "parts_ordered":
    case "ready_for_install":
      return "bg-blue-100 text-blue-700";
    case "cancelled":
      return "bg-red-100 text-red-700";
    default:
      return "bg-neutral-100 text-neutral-700";
  }
}

/**
 * Get icon for line item type
 */
function getItemIcon(type: OrderLineItem["type"]): string {
  switch (type) {
    case "wheel":
      return "🛞";
    case "tire":
      return "⚫";
    case "accessory":
      return "🔧";
    case "service":
      return "🔨";
    default:
      return "📦";
  }
}

/**
 * Line item row component
 */
function LineItemRow({ item }: { item: OrderLineItem }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-neutral-100 last:border-0">
      <span className="text-lg flex-shrink-0">{getItemIcon(item.type)}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-neutral-900 truncate">{item.name}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-neutral-500">
          {item.specs?.brand && <span>{item.specs.brand}</span>}
          {item.specs?.size && <span>{item.specs.size}</span>}
          {item.specs?.finish && <span>{item.specs.finish}</span>}
          {item.sku && <span className="text-neutral-400">SKU: {item.sku}</span>}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-medium text-neutral-900">{formatCurrency(item.total)}</p>
        <p className="text-sm text-neutral-500">
          {item.quantity} × {formatCurrency(item.unitPrice)}
        </p>
      </div>
    </div>
  );
}

/**
 * Tracking link component
 */
function TrackingLink({
  tracking,
}: {
  tracking: OrderDetail["tracking"][number];
}) {
  if (tracking.trackingUrl) {
    return (
      <a
        href={tracking.trackingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-3 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 transition-colors"
      >
        <span className="text-lg">📦</span>
        <div className="flex-1">
          <p className="font-medium text-green-700">{tracking.carrier}</p>
          <p className="text-sm text-green-600 font-mono">{tracking.trackingNumber}</p>
        </div>
        <span className="text-green-600">→</span>
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-neutral-50 border border-neutral-200">
      <span className="text-lg">📦</span>
      <div className="flex-1">
        <p className="font-medium text-neutral-700">{tracking.carrier}</p>
        <p className="text-sm text-neutral-500 font-mono">{tracking.trackingNumber}</p>
      </div>
    </div>
  );
}

export function OrderDetailModal({ orderId, onClose }: OrderDetailModalProps) {
  const { order, isLoading, error } = useOrderDetail(orderId);

  // Close on escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll when modal is open
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-bold text-neutral-900">
            {isLoading ? "Loading..." : order?.id || "Order Details"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 border-t-neutral-900 mb-4" />
              <p className="text-neutral-500">Loading order details...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-600 mb-2">Unable to load order</p>
              <p className="text-sm text-neutral-500">{error}</p>
            </div>
          )}

          {order && (
            <div className="space-y-6">
              {/* Status and date */}
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`text-sm px-3 py-1 rounded-full font-medium ${getStatusColor(order.status)}`}
                >
                  {order.statusLabel}
                </span>
                <span className="text-neutral-500">{formatDate(order.orderDate)}</span>
              </div>

              {/* Vehicle */}
              {order.vehicle && (
                <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200">
                  <p className="text-sm text-neutral-500 mb-1">Vehicle</p>
                  <p className="font-semibold text-neutral-900">
                    {order.vehicle.year} {order.vehicle.make} {order.vehicle.model}
                    {order.vehicle.trim && ` ${order.vehicle.trim}`}
                  </p>
                </div>
              )}

              {/* Tracking */}
              {order.tracking.length > 0 && (
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-3">Tracking</h3>
                  <div className="space-y-2">
                    {order.tracking.map((t, i) => (
                      <TrackingLink key={i} tracking={t} />
                    ))}
                  </div>
                </div>
              )}

              {/* Items */}
              <div>
                <h3 className="font-semibold text-neutral-900 mb-3">Items</h3>
                <div className="rounded-xl border border-neutral-200 overflow-hidden">
                  <div className="divide-y divide-neutral-100">
                    {order.items.map((item, i) => (
                      <div key={i} className="px-4">
                        <LineItemRow item={item} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Subtotal</span>
                    <span className="text-neutral-700">{formatCurrency(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Tax</span>
                    <span className="text-neutral-700">{formatCurrency(order.tax)}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-2 border-t border-neutral-200">
                    <span className="text-neutral-900">Total Paid</span>
                    <span className="text-neutral-900">{formatCurrency(order.amountPaid)}</span>
                  </div>
                </div>
              </div>

              {/* Shipping */}
              {order.shipping && (
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-3">Shipping To</h3>
                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200">
                    <p className="font-medium text-neutral-900">{order.shipping.name}</p>
                    <p className="text-neutral-600">
                      {order.shipping.city}, {order.shipping.state} {order.shipping.zip}
                    </p>
                  </div>
                </div>
              )}

              {/* Installation */}
              {order.installation && (
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-3">Installation</h3>
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                    <p className="font-medium text-blue-900">{order.installation.storeName}</p>
                    {order.installation.storeAddress && (
                      <p className="text-blue-700 text-sm">{order.installation.storeAddress}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-200 bg-neutral-50">
          <div className="flex flex-wrap gap-3 justify-between items-center">
            <p className="text-sm text-neutral-500">
              Questions about your order?{" "}
              <a
                href="mailto:support@warehousetiredirect.com"
                className="text-blue-600 hover:underline"
              >
                Contact us
              </a>
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
