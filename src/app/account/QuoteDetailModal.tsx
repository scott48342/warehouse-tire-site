"use client";

/**
 * Quote Detail Modal
 * 
 * Displays full quote details including vehicle, items, and pricing.
 * Read-only view - does NOT mutate cart or garage.
 * 
 * @created 2026-08-24
 */

import { useState, useEffect } from "react";
import type { SavedQuoteDetailResponse, SavedQuoteItem } from "@/lib/savedQuotes/types";

interface QuoteDetailModalProps {
  quoteId: string;
  onClose: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return isoDate;
  }
}

function ItemTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "tire":
      return <span title="Tire">🛞</span>;
    case "wheel":
      return <span title="Wheel">⚙️</span>;
    case "accessory":
      return <span title="Accessory">🔧</span>;
    default:
      return <span>📦</span>;
  }
}

function QuoteItem({ item }: { item: SavedQuoteItem }) {
  return (
    <div className="flex items-start gap-4 p-4 bg-neutral-50 rounded-xl">
      {/* Image */}
      <div className="w-20 h-20 flex-shrink-0 bg-white rounded-lg overflow-hidden border border-neutral-200">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={`${item.brand} ${item.model}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            <ItemTypeIcon type={item.type} />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-900">
                {item.brand} {item.model}
              </span>
              {item.staggered && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                  Staggered
                </span>
              )}
            </div>

            {/* Specs based on type */}
            <div className="text-sm text-neutral-500 mt-1">
              {item.type === "tire" && (
                <>
                  {item.size}
                  {item.rearSize && ` / ${item.rearSize}`}
                  {item.loadIndex && ` • ${item.loadIndex}`}
                  {item.speedRating && item.speedRating}
                </>
              )}
              {item.type === "wheel" && (
                <>
                  {item.diameter && `${item.diameter}"`}
                  {item.width && ` x ${item.width}"`}
                  {item.offset && ` • Offset ${item.offset}`}
                  {item.boltPattern && ` • ${item.boltPattern}`}
                  {item.finish && (
                    <span className="block mt-0.5">{item.finish}</span>
                  )}
                </>
              )}
              {item.type === "accessory" && item.category && (
                <span className="capitalize">{item.category}</span>
              )}
            </div>

            {/* SKU */}
            <div className="text-xs text-neutral-400 mt-1">
              SKU: {item.sku}
              {item.rearSku && ` / ${item.rearSku}`}
            </div>
          </div>

          {/* Price */}
          <div className="text-right flex-shrink-0">
            <div className="font-semibold text-neutral-900">
              {formatCurrency(item.unitPrice * item.quantity)}
            </div>
            <div className="text-xs text-neutral-500">
              {item.quantity} × {formatCurrency(item.unitPrice)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function QuoteDetailModal({ quoteId, onClose }: QuoteDetailModalProps) {
  const [quote, setQuote] = useState<SavedQuoteDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuote() {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(`/api/account/quotes/${quoteId}`);
        if (!res.ok) {
          throw new Error("Failed to load quote details");
        }

        const data: SavedQuoteDetailResponse = await res.json();
        setQuote(data);
      } catch (err) {
        console.error("[QuoteDetailModal] Fetch error:", err);
        setError(err instanceof Error ? err.message : "Failed to load quote");
      } finally {
        setIsLoading(false);
      }
    }

    fetchQuote();
  }, [quoteId]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-neutral-900">Quote Details</h2>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors"
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 border-t-neutral-900 mb-4" />
              <p className="text-neutral-500">Loading quote...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-600 mb-2">Unable to load quote</p>
              <p className="text-sm text-neutral-500">{error}</p>
            </div>
          )}

          {quote && (
            <div className="space-y-6">
              {/* Quote Info */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500">
                <span>Saved {formatDate(quote.savedAt)}</span>
                {quote.lastViewedAt && (
                  <>
                    <span>•</span>
                    <span>Last viewed {formatDate(quote.lastViewedAt)}</span>
                  </>
                )}
                {quote.convertedOrderId && (
                  <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    ✓ Purchased ({quote.convertedOrderId})
                  </span>
                )}
              </div>

              {/* Vehicle */}
              <div className="bg-neutral-100 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🚗</span>
                  <div>
                    <div className="font-semibold text-neutral-900">
                      {quote.vehicle.year} {quote.vehicle.make} {quote.vehicle.model}
                      {quote.vehicle.trim && ` ${quote.vehicle.trim}`}
                    </div>
                    {quote.vehicle.modification && (
                      <div className="text-sm text-neutral-500">
                        {quote.vehicle.modification}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <h3 className="font-semibold text-neutral-900 mb-3">
                  Items ({quote.snapshot.items.length})
                </h3>
                <div className="space-y-3">
                  {quote.snapshot.items.map((item, idx) => (
                    <QuoteItem key={`${item.sku}-${idx}`} item={item} />
                  ))}
                </div>
              </div>

              {/* Pricing */}
              <div className="border-t border-neutral-200 pt-4">
                <h3 className="font-semibold text-neutral-900 mb-3">
                  Quote Summary
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Parts Subtotal</span>
                    <span>{formatCurrency(quote.snapshot.pricing.partsSubtotal)}</span>
                  </div>
                  {quote.snapshot.pricing.servicesSubtotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Services</span>
                      <span>{formatCurrency(quote.snapshot.pricing.servicesSubtotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-neutral-500">
                      Est. Tax ({(quote.snapshot.pricing.taxRate * 100).toFixed(0)}%)
                    </span>
                    <span>{formatCurrency(quote.snapshot.pricing.estimatedTax)}</span>
                  </div>
                  {quote.snapshot.pricing.estimatedShipping !== null && (
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Est. Shipping</span>
                      <span>
                        {quote.snapshot.pricing.estimatedShipping === 0
                          ? "FREE"
                          : formatCurrency(quote.snapshot.pricing.estimatedShipping)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-neutral-200 font-semibold text-base">
                    <span>Total</span>
                    <span>{formatCurrency(quote.snapshot.pricing.total)}</span>
                  </div>
                </div>
              </div>

              {/* Note about prices */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <p>
                  <strong>Note:</strong> Prices shown are from when you saved this quote. 
                  Current prices and availability may differ.
                </p>
              </div>

              {/* Actions - placeholder for future "Add to Cart" flow */}
              {!quote.convertedOrderId && (
                <div className="border-t border-neutral-200 pt-4">
                  <p className="text-sm text-neutral-500 text-center">
                    To purchase these items, search for them again in our shop.
                    <br />
                    <span className="text-xs">(Quick resume coming soon)</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
