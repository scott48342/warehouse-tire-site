"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// ============================================================================
// Types
// ============================================================================

interface CartItem {
  type: "wheel" | "tire" | "accessory";
  sku: string;
  rearSku?: string;
  brand: string;
  model: string;
  finish?: string;
  size?: string;
  rearSize?: string;
  diameter?: string;
  width?: string;
  offset?: string;
  boltPattern?: string;
  loadIndex?: string;
  speedRating?: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  staggered?: boolean;
  vehicle?: {
    year: string;
    make: string;
    model: string;
    trim?: string;
  };
  // Accessory fields
  name?: string;
  category?: string;
  required?: boolean;
}

interface AbandonedCart {
  id: string;
  cartId: string;
  sessionId: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  vehicleYear: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleTrim: string | null;
  items: CartItem[];
  itemCount: number;
  subtotal: string;
  estimatedTotal: string;
  status: "active" | "abandoned" | "recovered" | "expired";
  recoveredOrderId: string | null;
  recoveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  abandonedAt: string | null;
  source: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  // Email tracking
  firstEmailSentAt: string | null;
  secondEmailSentAt: string | null;
  thirdEmailSentAt: string | null;
  emailSentCount: number;
  lastEmailStatus: string | null;
  recoveredAfterEmail: boolean;
  unsubscribed: boolean;
  // Test data
  isTest: boolean;
  testReason: string | null;
}

interface EmailStatus {
  hasConsent: boolean;
  nextEmailStep: string | null;
  nextEmailDue: string | null;
  canSendMore: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  active: { label: "Active", color: "text-green-400", bgColor: "bg-green-900/50" },
  abandoned: { label: "Abandoned", color: "text-yellow-400", bgColor: "bg-yellow-900/50" },
  recovered: { label: "Recovered", color: "text-blue-400", bgColor: "bg-blue-900/50" },
  expired: { label: "Expired", color: "text-neutral-400", bgColor: "bg-neutral-700" },
};

const TYPE_ICONS: Record<string, string> = {
  wheel: "🛞",
  tire: "⭕",
  accessory: "🔧",
};

// ============================================================================
// Components
// ============================================================================

function MetadataCard({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-neutral-500 uppercase tracking-wide">{label}</span>
      <span className={`text-sm text-white ${mono ? "font-mono" : ""}`}>{value || "-"}</span>
    </div>
  );
}

function CartItemRow({ item, index }: { item: CartItem; index: number }) {
  const lineTotal = item.unitPrice * item.quantity;
  const typeIcon = TYPE_ICONS[item.type] || "📦";
  
  // Build spec string based on type
  const specs: string[] = [];
  if (item.type === "wheel") {
    if (item.diameter) specs.push(`${item.diameter}"`);
    if (item.width) specs.push(`${item.width}" wide`);
    if (item.offset) specs.push(`+${item.offset}mm`);
    if (item.boltPattern) specs.push(item.boltPattern);
    if (item.finish) specs.push(item.finish);
  } else if (item.type === "tire") {
    if (item.size) specs.push(item.size);
    if (item.loadIndex && item.speedRating) specs.push(`${item.loadIndex}${item.speedRating}`);
  } else if (item.type === "accessory") {
    if (item.category) specs.push(item.category);
    if (item.required) specs.push("Required");
  }

  return (
    <tr className="border-b border-neutral-700/50 hover:bg-neutral-700/30">
      <td className="px-4 py-3 text-center text-neutral-500">{index + 1}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {item.imageUrl ? (
            <img 
              src={item.imageUrl} 
              alt={item.model || item.name || "Product"} 
              className="w-12 h-12 object-contain rounded bg-neutral-700"
            />
          ) : (
            <div className="w-12 h-12 flex items-center justify-center bg-neutral-700 rounded text-2xl">
              {typeIcon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300 uppercase">
                {item.type}
              </span>
              {item.staggered && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300">
                  Staggered
                </span>
              )}
            </div>
            <div className="text-white font-medium mt-1">
              {item.brand} {item.model || item.name}
            </div>
            {specs.length > 0 && (
              <div className="text-xs text-neutral-400 mt-0.5">
                {specs.join(" · ")}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-neutral-400">{item.sku}</span>
        {item.rearSku && (
          <div className="font-mono text-xs text-neutral-500 mt-0.5">
            Rear: {item.rearSku}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-center text-white">{item.quantity}</td>
      <td className="px-4 py-3 text-right text-neutral-300">{formatCurrency(item.unitPrice)}</td>
      <td className="px-4 py-3 text-right text-white font-medium">{formatCurrency(lineTotal)}</td>
    </tr>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function AbandonedCartDetailPage() {
  const params = useParams();
  const cartId = params.cartId as string;

  const [cart, setCart] = useState<AbandonedCart | null>(null);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [recoveryLink, setRecoveryLink] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCart() {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/abandoned-carts?cartId=${encodeURIComponent(cartId)}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Cart not found");
          } else {
            throw new Error(`HTTP ${res.status}`);
          }
          return;
        }
        const data = await res.json();
        setCart(data.cart);
        setEmailStatus(data.emailStatus);
        setRecoveryLink(data.recoveryLink);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load cart";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    if (cartId) {
      fetchCart();
    }
  }, [cartId]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <div className="text-neutral-500">Loading cart...</div>
      </div>
    );
  }

  if (error || !cart) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300">
          {error || "Cart not found"}
        </div>
        <Link href="/admin/abandoned-carts" className="mt-4 inline-block text-sm text-neutral-400 hover:text-white">
          ← Back to abandoned carts
        </Link>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[cart.status] || STATUS_CONFIG.active;
  const items = Array.isArray(cart.items) ? cart.items : [];
  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

  const customerName = [cart.customerFirstName, cart.customerLastName].filter(Boolean).join(" ");
  const vehicle = cart.vehicleYear 
    ? `${cart.vehicleYear} ${cart.vehicleMake} ${cart.vehicleModel}${cart.vehicleTrim ? ` ${cart.vehicleTrim}` : ""}`
    : null;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin/abandoned-carts" className="text-sm text-neutral-400 hover:text-white mb-2 inline-block">
            ← Back to abandoned carts
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span>🛒</span>
            Cart Details
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
          {cart.isTest && (
            <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-900/50 text-orange-400">
              Test Data
            </span>
          )}
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wide mb-4">Cart Information</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          <MetadataCard label="Cart ID" value={cart.cartId} mono />
          <MetadataCard label="Session ID" value={cart.sessionId?.slice(0, 12)} mono />
          <MetadataCard 
            label="Customer" 
            value={customerName || cart.customerEmail || "Anonymous"} 
          />
          <MetadataCard label="Email" value={cart.customerEmail} />
          <MetadataCard label="Phone" value={cart.customerPhone} />
          <MetadataCard label="Vehicle" value={vehicle} />
          <MetadataCard label="Total Value" value={formatCurrency(cart.estimatedTotal)} />
          <MetadataCard label="Item Count" value={cart.itemCount} />
          <MetadataCard label="Source" value={cart.source || "web"} />
          <MetadataCard label="Created" value={formatDate(cart.createdAt)} />
          <MetadataCard label="Last Activity" value={`${formatDate(cart.lastActivityAt)} (${formatTimeAgo(cart.lastActivityAt)})`} />
          <MetadataCard label="Abandoned At" value={cart.abandonedAt ? formatDate(cart.abandonedAt) : null} />
        </div>

        {/* Test data info */}
        {cart.isTest && cart.testReason && (
          <div className="mt-4 pt-4 border-t border-neutral-700">
            <MetadataCard label="Test Reason" value={cart.testReason} />
          </div>
        )}

        {/* Recovery info */}
        {cart.status === "recovered" && (
          <div className="mt-4 pt-4 border-t border-neutral-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <MetadataCard label="Recovered At" value={formatDate(cart.recoveredAt)} />
              <MetadataCard label="Order ID" value={cart.recoveredOrderId} mono />
              <MetadataCard 
                label="Recovered Via Email" 
                value={cart.recoveredAfterEmail ? "Yes ✉️" : "No"} 
              />
            </div>
          </div>
        )}

        {/* Email tracking */}
        {cart.customerEmail && (
          <div className="mt-4 pt-4 border-t border-neutral-700">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-3">Email Recovery</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              <MetadataCard label="Emails Sent" value={cart.emailSentCount} />
              <MetadataCard label="First Email" value={formatDate(cart.firstEmailSentAt)} />
              <MetadataCard label="Second Email" value={formatDate(cart.secondEmailSentAt)} />
              <MetadataCard label="Third Email" value={formatDate(cart.thirdEmailSentAt)} />
              <MetadataCard label="Last Status" value={cart.lastEmailStatus} />
              <MetadataCard label="Unsubscribed" value={cart.unsubscribed ? "Yes" : "No"} />
            </div>
            {emailStatus && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-6">
                <MetadataCard label="Has Consent" value={emailStatus.hasConsent ? "Yes" : "No"} />
                <MetadataCard label="Next Step" value={emailStatus.nextEmailStep} />
                <MetadataCard label="Next Due" value={emailStatus.nextEmailDue ? formatDate(emailStatus.nextEmailDue) : null} />
                <MetadataCard label="Can Send More" value={emailStatus.canSendMore ? "Yes" : "No"} />
              </div>
            )}
          </div>
        )}

        {/* Recovery link */}
        {recoveryLink && cart.status !== "recovered" && (
          <div className="mt-4 pt-4 border-t border-neutral-700">
            <MetadataCard 
              label="Recovery Link" 
              value={
                <a href={recoveryLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 break-all">
                  {recoveryLink}
                </a>
              } 
            />
          </div>
        )}
      </div>

      {/* Cart Items */}
      <div className="bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-neutral-700">
          <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wide">
            Cart Contents ({items.length} {items.length === 1 ? "item" : "items"})
          </h2>
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            No items in cart
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-900/50">
                <tr className="text-left text-neutral-400 border-b border-neutral-700">
                  <th className="px-4 py-3 font-medium text-center w-12">#</th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium text-center">Qty</th>
                  <th className="px-4 py-3 font-medium text-right">Unit Price</th>
                  <th className="px-4 py-3 font-medium text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <CartItemRow key={`${item.sku}-${index}`} item={item} index={index} />
                ))}
              </tbody>
              <tfoot className="bg-neutral-900/30">
                <tr className="border-t border-neutral-700">
                  <td colSpan={4}></td>
                  <td className="px-4 py-3 text-right text-neutral-400 font-medium">Subtotal:</td>
                  <td className="px-4 py-3 text-right text-white font-bold text-lg">
                    {formatCurrency(subtotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Technical info (collapsed by default) */}
      <details className="bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden">
        <summary className="px-6 py-4 cursor-pointer text-sm font-medium text-neutral-400 hover:text-white">
          Technical Details
        </summary>
        <div className="px-6 pb-4 space-y-3 text-xs">
          <div>
            <span className="text-neutral-500">User Agent:</span>
            <div className="font-mono text-neutral-400 mt-1 break-all">{cart.userAgent || "-"}</div>
          </div>
          <div>
            <span className="text-neutral-500">IP Address:</span>
            <div className="font-mono text-neutral-400 mt-1">{cart.ipAddress || "-"}</div>
          </div>
          <div>
            <span className="text-neutral-500">Raw Items JSON:</span>
            <pre className="font-mono text-neutral-400 mt-1 p-3 bg-neutral-900 rounded overflow-auto max-h-64">
              {JSON.stringify(cart.items, null, 2)}
            </pre>
          </div>
        </div>
      </details>
    </div>
  );
}
