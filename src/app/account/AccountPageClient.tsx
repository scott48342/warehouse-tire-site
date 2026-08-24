"use client";

/**
 * Account Page Client Component
 * 
 * User account dashboard with:
 * - Profile information
 * - Saved vehicles (garage) with server sync
 * - Saved quotes (Phase 3B)
 * - Order history
 * 
 * @updated 2026-08-24 - Added My Quotes section (Phase 3B)
 */

import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAccountGarage } from "@/hooks/useAccountGarage";
import { useAccountOrders, type OrderSummary } from "@/hooks/useAccountOrders";
import { useAccountQuotes, type SavedQuoteResponse } from "@/hooks/useAccountQuotes";
import { OrderDetailModal } from "./OrderDetailModal";
import { QuoteDetailModal } from "./QuoteDetailModal";
import { PendingQuoteClaimHandler } from "@/components/PendingQuoteClaimHandler";

interface User {
  id: string;
  email: string;
  name?: string | null;
  emailVerified: boolean;
}

/**
 * Format date for display
 */
function formatDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString("en-US", {
      month: "short",
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
 * Single order card component
 */
function OrderCard({
  order,
  onViewOrder,
}: {
  order: OrderSummary;
  onViewOrder: (id: string) => void;
}) {
  return (
    <div className="p-4 rounded-xl border border-neutral-200 hover:border-neutral-300 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        {/* Left: Order info */}
        <div className="flex-1 min-w-0">
          {/* Order ID and status */}
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <span className="font-semibold text-neutral-900">{order.id}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(order.status)}`}
            >
              {order.statusLabel}
            </span>
            {order.hasTracking && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                📦 Tracking available
              </span>
            )}
          </div>

          {/* Date and total */}
          <div className="text-sm text-neutral-500 mb-2">
            {formatDate(order.orderDate)} • {formatCurrency(order.total)}
          </div>

          {/* Vehicle */}
          {order.vehicle && (
            <div className="text-sm text-neutral-600 mb-1">
              🚗 {order.vehicle.year} {order.vehicle.make} {order.vehicle.model}
              {order.vehicle.trim && ` ${order.vehicle.trim}`}
            </div>
          )}

          {/* Items summary */}
          <div className="text-sm text-neutral-500 truncate">{order.itemSummary}</div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          <button
            onClick={() => onViewOrder(order.id)}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View Order →
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * My Orders section
 */
function MyOrdersSection({ emailVerified }: { emailVerified: boolean }) {
  const { orders, isLoading, error } = useAccountOrders();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Email not verified - show message
  if (!emailVerified) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">📦</span>
          <h2 className="text-lg font-bold text-neutral-900">My Orders</h2>
        </div>
        <div className="text-center py-6">
          <p className="text-amber-600 mb-2">⚠️ Email verification required</p>
          <p className="text-sm text-neutral-500">
            Please verify your email address to view your order history.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">📦</span>
          <h2 className="text-lg font-bold text-neutral-900">My Orders</h2>
        </div>
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-neutral-300 border-t-neutral-900 mb-3" />
          <p className="text-sm text-neutral-500">Loading orders...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">📦</span>
          <h2 className="text-lg font-bold text-neutral-900">My Orders</h2>
        </div>
        <div className="text-center py-6">
          <p className="text-red-600 mb-2">Unable to load orders</p>
          <p className="text-sm text-neutral-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">📦</span>
          <h2 className="text-lg font-bold text-neutral-900">My Orders</h2>
          {orders.length > 0 && (
            <span className="text-sm text-neutral-500">({orders.length})</span>
          )}
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-neutral-500 mb-4">No orders yet</p>
            <p className="text-sm text-neutral-400 mb-4">
              Orders placed with this email address will appear here
            </p>
            <Link
              href="/tires"
              className="inline-block px-6 py-3 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
            >
              Shop Tires
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onViewOrder={setSelectedOrderId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Order detail modal */}
      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
        />
      )}
    </>
  );
}

/**
 * Single quote card component
 */
function QuoteCard({
  quote,
  onViewQuote,
  onArchive,
  onRename,
}: {
  quote: SavedQuoteResponse;
  onViewQuote: (id: string) => void;
  onArchive: (id: string) => void;
  onRename: (id: string, currentName: string | null) => void;
}) {
  return (
    <div className="p-4 rounded-xl border border-neutral-200 hover:border-neutral-300 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        {/* Left: Quote info */}
        <div className="flex-1 min-w-0">
          {/* Name and status */}
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <span className="font-semibold text-neutral-900">
              {quote.name || `${quote.vehicle.year} ${quote.vehicle.make} ${quote.vehicle.model}`}
            </span>
            {quote.convertedOrderId && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                Purchased
              </span>
            )}
          </div>

          {/* Date and total */}
          <div className="text-sm text-neutral-500 mb-2">
            Saved {formatDate(quote.savedAt)} • {formatCurrency(quote.total)}
          </div>

          {/* Vehicle (if name is custom) */}
          {quote.name && (
            <div className="text-sm text-neutral-600 mb-1">
              🚗 {quote.vehicle.year} {quote.vehicle.make} {quote.vehicle.model}
              {quote.vehicle.trim && ` ${quote.vehicle.trim}`}
            </div>
          )}

          {/* Items summary */}
          <div className="text-sm text-neutral-500 truncate">
            {quote.itemSummary}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          <button
            onClick={() => onViewQuote(quote.id)}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View →
          </button>
          <button
            onClick={() => onRename(quote.id, quote.name)}
            className="text-sm text-neutral-500 hover:text-neutral-700"
          >
            Rename
          </button>
          <button
            onClick={() => onArchive(quote.id)}
            className="text-sm text-red-500 hover:text-red-600"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * My Quotes section
 */
function MyQuotesSection({ emailVerified }: { emailVerified: boolean }) {
  const { quotes, isLoading, error, count, maxQuotes, archiveQuote, renameQuote } = useAccountQuotes();
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  const handleArchive = async (quoteId: string) => {
    if (confirm("Remove this saved quote? This cannot be undone.")) {
      await archiveQuote(quoteId);
    }
  };

  const handleRename = async (quoteId: string, currentName: string | null) => {
    const newName = prompt("Enter a name for this quote:", currentName || "");
    if (newName !== null) {
      await renameQuote(quoteId, newName.trim() || null);
    }
  };

  // Email not verified - show message
  if (!emailVerified) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">📋</span>
          <h2 className="text-lg font-bold text-neutral-900">My Quotes</h2>
        </div>
        <div className="text-center py-6">
          <p className="text-amber-600 mb-2">⚠️ Email verification required</p>
          <p className="text-sm text-neutral-500">
            Please verify your email address to save and view quotes.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">📋</span>
          <h2 className="text-lg font-bold text-neutral-900">My Quotes</h2>
        </div>
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-neutral-300 border-t-neutral-900 mb-3" />
          <p className="text-sm text-neutral-500">Loading quotes...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">📋</span>
          <h2 className="text-lg font-bold text-neutral-900">My Quotes</h2>
        </div>
        <div className="text-center py-6">
          <p className="text-red-600 mb-2">Unable to load quotes</p>
          <p className="text-sm text-neutral-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">📋</span>
          <h2 className="text-lg font-bold text-neutral-900">My Quotes</h2>
          {quotes.length > 0 && (
            <span className="text-sm text-neutral-500">({count}/{maxQuotes})</span>
          )}
        </div>

        {quotes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-neutral-500 mb-4">No saved quotes yet</p>
            <p className="text-sm text-neutral-400 mb-4">
              When you save a cart or package configuration, it will appear here
            </p>
            <Link
              href="/tires"
              className="inline-block px-6 py-3 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {quotes.map((quote) => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                onViewQuote={setSelectedQuoteId}
                onArchive={handleArchive}
                onRename={handleRename}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quote detail modal */}
      {selectedQuoteId && (
        <QuoteDetailModal
          quoteId={selectedQuoteId}
          onClose={() => setSelectedQuoteId(null)}
        />
      )}
    </>
  );
}

export function AccountPageClient({ user }: { user: User }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [signingOut, setSigningOut] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    garage,
    activeVehicle,
    isLoading: garageSyncing,
    isSynced,
    syncError,
    removeVehicle,
    setActiveVehicle,
  } = useAccountGarage();

  // Handle success query params
  useEffect(() => {
    const quoteClaimed = searchParams.get("quote_claimed");
    const quoteSaved = searchParams.get("quote_saved");
    
    if (quoteClaimed) {
      setSuccessMessage("Quote saved to your account!");
      // Clean up URL
      window.history.replaceState({}, "", "/account");
      // Auto-dismiss after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } else if (quoteSaved) {
      setSuccessMessage("Quote saved successfully!");
      window.history.replaceState({}, "", "/account");
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  }, [searchParams]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("[account] Sign out error:", err);
      setSigningOut(false);
    }
  };

  const handleRemoveVehicle = async (vehicleId: string) => {
    if (confirm("Remove this vehicle from your garage?")) {
      await removeVehicle(vehicleId);
    }
  };

  const handleSetActive = async (vehicleId: string) => {
    await setActiveVehicle(vehicleId);
  };

  return (
    <div className="min-h-[80vh] px-4 py-12">
      {/* Handle pending quote claims after auth */}
      <PendingQuoteClaimHandler />
      
      <div className="mx-auto max-w-3xl">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 rounded-xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
            <span className="text-green-600 text-xl">✓</span>
            <p className="text-green-800 font-medium">{successMessage}</p>
            <button 
              onClick={() => setSuccessMessage(null)}
              className="ml-auto text-green-600 hover:text-green-800"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-extrabold text-neutral-900">My Account</h1>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg hover:border-neutral-400 transition-colors disabled:opacity-50"
          >
            {signingOut ? "Signing out..." : "Sign Out"}
          </button>
        </div>

        {/* Profile Section */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center">
              <span className="text-2xl">👤</span>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Signed in as</p>
              <p className="font-semibold text-neutral-900">{user.email}</p>
              {!user.emailVerified && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ Email not verified
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Garage Section */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">🚗</span>
              <h2 className="text-lg font-bold text-neutral-900">My Garage</h2>
              {garage.length > 0 && (
                <span className="text-sm text-neutral-500">
                  ({garage.length}/10)
                </span>
              )}
            </div>
            {garageSyncing && (
              <span className="text-sm text-neutral-500">Syncing...</span>
            )}
            {isSynced && !garageSyncing && (
              <span className="text-sm text-green-600">✓ Synced</span>
            )}
            {syncError && !garageSyncing && !isSynced && (
              <span className="text-sm text-neutral-500" title={syncError}>
                Saved on this device
              </span>
            )}
          </div>

          {garage.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-neutral-500 mb-4">No vehicles saved yet</p>
              <p className="text-sm text-neutral-400 mb-4">
                Shop for tires or wheels to add vehicles to your garage
              </p>
              <Link
                href="/tires"
                className="inline-block px-6 py-3 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
              >
                Shop Tires
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {garage.map((vehicle) => {
                const isActive = activeVehicle?.id === vehicle.id;
                return (
                  <div
                    key={vehicle.id}
                    className={`p-4 rounded-xl border ${
                      isActive
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-200 hover:border-neutral-300"
                    } transition-colors`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-neutral-900">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </span>
                          {vehicle.trim && (
                            <span className="text-neutral-500">{vehicle.trim}</span>
                          )}
                          {isActive && (
                            <span className="text-xs bg-neutral-900 text-white px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        {vehicle.nickname && (
                          <p className="text-sm text-neutral-500 mt-1">
                            "{vehicle.nickname}"
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {!isActive && (
                          <button
                            onClick={() => handleSetActive(vehicle.id)}
                            className="text-sm text-neutral-600 hover:text-neutral-900 underline"
                          >
                            Set Active
                          </button>
                        )}
                        <Link
                          href={`/tires?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}${vehicle.trim ? `&trim=${encodeURIComponent(vehicle.trim)}` : ""}`}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Shop Tires →
                        </Link>
                        <button
                          onClick={() => handleRemoveVehicle(vehicle.id)}
                          className="text-sm text-red-500 hover:text-red-600 p-1"
                          title="Remove vehicle"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-neutral-100">
            <p className="text-xs text-neutral-400">
              Your garage syncs automatically when you sign in. Vehicles you add while shopping
              are saved to your account.
            </p>
          </div>
        </div>

        {/* Quotes Section */}
        <div className="mb-6">
          <MyQuotesSection emailVerified={user.emailVerified} />
        </div>

        {/* Orders Section */}
        <MyOrdersSection emailVerified={user.emailVerified} />
      </div>
    </div>
  );
}
