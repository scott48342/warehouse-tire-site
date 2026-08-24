"use client";

/**
 * Quote Detail Modal
 * 
 * Displays full quote details including vehicle, items, and pricing.
 * Supports "Check Current Price" revalidation flow.
 * 
 * Uses:
 * - CartContext.replaceCart() for cart replacement (not direct localStorage)
 * - GarageContext.setActiveVehicleByData() for vehicle activation (with dedup)
 * 
 * @created 2026-08-24
 * @updated 2026-08-24 - B5 fixes: proper context integration, insufficient qty handling
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart, type CartItem, type CartWheelItem, type CartTireItem, type CartAccessoryItem } from "@/lib/cart/CartContext";
import { useGarage } from "@/contexts/GarageContext";
import type { SavedQuoteDetailResponse, SavedQuoteItem } from "@/lib/savedQuotes/types";
import type { ResumeValidationResult, ValidatedItem } from "@/lib/savedQuotes/resumeTypes";

interface QuoteDetailModalProps {
  quoteId: string;
  onClose: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch { return isoDate; }
}

function ItemTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "tire": return <span title="Tire">🛞</span>;
    case "wheel": return <span title="Wheel">⚙️</span>;
    case "accessory": return <span title="Accessory">🔧</span>;
    default: return <span>📦</span>;
  }
}

// ============================================================================
// Item Display (Saved View)
// ============================================================================

function QuoteItem({ item }: { item: SavedQuoteItem }) {
  return (
    <div className="flex items-start gap-4 p-4 bg-neutral-50 rounded-xl">
      <div className="w-20 h-20 flex-shrink-0 bg-white rounded-lg overflow-hidden border border-neutral-200">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={`${item.brand} ${item.model}`} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            <ItemTypeIcon type={item.type} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-900">{item.brand} {item.model}</span>
              {item.staggered && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Staggered</span>
              )}
            </div>
            <div className="text-sm text-neutral-500 mt-1">
              {item.type === "tire" && (
                <>{item.size}{item.rearSize && ` / ${item.rearSize}`}{item.loadIndex && ` • ${item.loadIndex}`}{item.speedRating}</>
              )}
              {item.type === "wheel" && (
                <>
                  {item.diameter && `${item.diameter}"`}{item.width && ` x ${item.width}"`}
                  {item.offset && ` • Offset ${item.offset}`}{item.boltPattern && ` • ${item.boltPattern}`}
                  {item.finish && <span className="block mt-0.5">{item.finish}</span>}
                </>
              )}
              {item.type === "accessory" && item.category && <span className="capitalize">{item.category}</span>}
            </div>
            <div className="text-xs text-neutral-400 mt-1">SKU: {item.sku}{item.rearSku && ` / ${item.rearSku}`}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-semibold text-neutral-900">{formatCurrency(item.unitPrice * item.quantity)}</div>
            <div className="text-xs text-neutral-500">{item.quantity} × {formatCurrency(item.unitPrice)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Validated Item Display (After Revalidation)
// ============================================================================

function ValidatedItemRow({ item }: { item: ValidatedItem }) {
  const { savedItem, status, currentUnitPrice, priceDifference, currentAvailableQty, message } = item;
  
  const statusColors: Record<string, string> = {
    unchanged: "bg-green-50 border-green-200",
    price_changed: "bg-amber-50 border-amber-200",
    unavailable: "bg-red-50 border-red-200",
    fitment_failed: "bg-red-50 border-red-200",
    insufficient_quantity: "bg-red-50 border-red-200",
    needs_review: "bg-neutral-50 border-neutral-200",
  };
  
  const statusIcons: Record<string, string> = {
    unchanged: "✓",
    price_changed: priceDifference && priceDifference > 0 ? "↑" : "↓",
    unavailable: "✗",
    fitment_failed: "⚠",
    insufficient_quantity: "⚠",
    needs_review: "?",
  };
  
  const isBlocking = status === "unavailable" || status === "fitment_failed" || status === "insufficient_quantity";
  
  return (
    <div className={`flex items-start gap-4 p-4 rounded-xl border ${statusColors[status] || statusColors.needs_review}`}>
      <div className="w-16 h-16 flex-shrink-0 bg-white rounded-lg overflow-hidden border border-neutral-200">
        {savedItem.imageUrl ? (
          <img src={savedItem.imageUrl} alt={`${savedItem.brand} ${savedItem.model}`} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl">
            <ItemTypeIcon type={savedItem.type} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold text-neutral-900">{savedItem.brand} {savedItem.model}</div>
            <div className="text-sm text-neutral-500">
              {savedItem.quantity}× • {savedItem.type === "tire" ? savedItem.size : savedItem.type === "wheel" ? `${savedItem.diameter}"` : savedItem.category}
            </div>
            {status === "insufficient_quantity" && (
              <div className="text-sm mt-1 text-red-600">
                Requested: {savedItem.quantity} • Available: {currentAvailableQty ?? 0}
              </div>
            )}
            {message && status !== "insufficient_quantity" && (
              <div className={`text-sm mt-1 ${isBlocking ? "text-red-600" : "text-amber-600"}`}>
                {message}
              </div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">{statusIcons[status] || "?"}</span>
              {isBlocking ? (
                <span className="text-red-600 font-semibold">
                  {status === "insufficient_quantity" ? "Insufficient Qty" : "Unavailable"}
                </span>
              ) : (
                <div>
                  {currentUnitPrice !== undefined && (
                    <div className="font-semibold text-neutral-900">{formatCurrency(currentUnitPrice * savedItem.quantity)}</div>
                  )}
                  {priceDifference !== undefined && priceDifference !== 0 && (
                    <div className={`text-xs ${priceDifference > 0 ? "text-red-600" : "text-green-600"}`}>
                      {priceDifference > 0 ? "+" : ""}{formatCurrency(priceDifference * savedItem.quantity)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Revalidation Results View
// ============================================================================

function RevalidationResults({
  result, onContinue, onCancel, isContinuing,
}: {
  result: ResumeValidationResult;
  onContinue: () => void;
  onCancel: () => void;
  isContinuing: boolean;
}) {
  const { canContinue, items, pricing, warnings } = result;
  const priceIncreased = (pricing.subtotalDifference ?? 0) > 0;
  const priceDecreased = (pricing.subtotalDifference ?? 0) < 0;
  const priceUnchanged = Math.abs(pricing.subtotalDifference ?? 0) < 0.01;
  
  return (
    <div className="space-y-6">
      {/* Status Header */}
      {canContinue ? (
        priceUnchanged ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <div className="text-2xl mb-2">✓</div>
            <div className="font-semibold text-green-800">Your saved quote is still current.</div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <div className="text-2xl mb-2">⚠</div>
            <div className="font-semibold text-amber-800">Some things have changed since you saved this quote.</div>
          </div>
        )
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <div className="text-2xl mb-2">✗</div>
          <div className="font-semibold text-red-800">This quote can't be continued exactly as saved.</div>
          {result.continueBlockedReason && (
            <div className="text-sm text-red-600 mt-1">{result.continueBlockedReason}</div>
          )}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((warning, idx) => (
            <div key={idx} className={`text-sm p-3 rounded-lg ${
              warning.severity === "error" ? "bg-red-50 text-red-700" :
              warning.severity === "warning" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
            }`}>{warning.message}</div>
          ))}
        </div>
      )}

      {/* Items Comparison */}
      <div>
        <h3 className="font-semibold text-neutral-900 mb-3">Items</h3>
        <div className="space-y-3">
          {items.map((item, idx) => (
            <ValidatedItemRow key={`${item.savedItem.sku}-${idx}`} item={item} />
          ))}
        </div>
      </div>

      {/* Price Comparison */}
      <div className="border-t border-neutral-200 pt-4">
        <h3 className="font-semibold text-neutral-900 mb-3">Price Comparison</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-neutral-100 rounded-xl p-4">
            <div className="text-sm text-neutral-500 mb-1">When Saved (Total)</div>
            <div className="text-2xl font-bold text-neutral-900">{formatCurrency(pricing.savedTotal)}</div>
            <div className="text-xs text-neutral-400 mt-1">Included tax & shipping</div>
          </div>
          <div className={`rounded-xl p-4 ${
            !canContinue ? "bg-neutral-100" :
            priceDecreased ? "bg-green-100" :
            priceIncreased ? "bg-amber-100" : "bg-green-100"
          }`}>
            <div className="text-sm text-neutral-500 mb-1">Current Subtotal</div>
            {canContinue && pricing.currentSubtotal !== undefined ? (
              <>
                <div className="text-2xl font-bold text-neutral-900">{formatCurrency(pricing.currentSubtotal)}</div>
                <div className="text-xs text-neutral-400 mt-1">+ Tax & shipping at checkout</div>
                {!priceUnchanged && (
                  <div className={`text-sm mt-1 ${priceDecreased ? "text-green-600" : "text-amber-600"}`}>
                    {priceDecreased ? "↓ " : "↑ "}{formatCurrency(Math.abs(pricing.subtotalDifference ?? 0))}
                    {priceDecreased ? " less" : " more"}
                  </div>
                )}
              </>
            ) : (
              <div className="text-lg text-neutral-500">—</div>
            )}
          </div>
        </div>
        
        {/* Tax/Shipping pending notice */}
        {canContinue && (pricing.shippingPending || pricing.taxPending) && (
          <div className="mt-3 text-sm text-neutral-500 bg-neutral-50 p-3 rounded-lg">
            <strong>Note:</strong> Final tax and shipping will be calculated at checkout based on your delivery address.
          </div>
        )}
        
        {/* Discount status */}
        {pricing.currentDiscount?.expired && (
          <div className="mt-3 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
            Your saved discount ({pricing.savedDiscount?.code}) has expired and is not included in the current price.
          </div>
        )}
        {pricing.currentDiscount && !pricing.currentDiscount.expired && (
          <div className="mt-3 text-sm text-green-700 bg-green-50 p-3 rounded-lg">
            Discount {pricing.currentDiscount.code} ({pricing.currentDiscount.amount > 0 ? `-${formatCurrency(pricing.currentDiscount.amount)}` : "still valid"}) applied
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-neutral-200 pt-4 flex gap-3">
        <button onClick={onCancel} className="flex-1 px-4 py-3 border border-neutral-300 rounded-xl font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors">
          Cancel
        </button>
        {canContinue ? (
          <button onClick={onContinue} disabled={isContinuing} className="flex-1 px-4 py-3 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-colors disabled:opacity-50">
            {isContinuing ? "Adding to Cart..." : "Continue with Current Price"}
          </button>
        ) : (
          <button onClick={onCancel} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
            Shop Similar Products
          </button>
        )}
      </div>

      <div className="text-center text-xs text-neutral-400">
        Validated at {new Date(result.validatedAt).toLocaleTimeString()}
      </div>
    </div>
  );
}

// ============================================================================
// Cart Replacement Confirmation Modal
// ============================================================================

function CartReplacementConfirm({
  onConfirm, onCancel, isReplacing,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  isReplacing: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <h3 className="text-xl font-bold text-neutral-900 mb-3">Replace your current cart?</h3>
        <p className="text-neutral-600 mb-6">Continuing with this saved quote will replace the items currently in your cart.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isReplacing} className="flex-1 px-4 py-3 border border-neutral-300 rounded-xl font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isReplacing} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">
            {isReplacing ? "Replacing..." : "Replace Cart & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Modal Component
// ============================================================================

export function QuoteDetailModal({ quoteId, onClose }: QuoteDetailModalProps) {
  const router = useRouter();
  
  // Use proper context hooks instead of direct localStorage
  const { items: cartItems, replaceCart, getItemCount } = useCart();
  const { setActiveVehicleByData } = useGarage();
  
  const [quote, setQuote] = useState<SavedQuoteDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [revalidationResult, setRevalidationResult] = useState<ResumeValidationResult | null>(null);
  const [revalidationError, setRevalidationError] = useState<string | null>(null);
  const [showCartConfirm, setShowCartConfirm] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);

  useEffect(() => {
    async function fetchQuote() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`/api/account/quotes/${quoteId}`);
        if (!res.ok) throw new Error("Failed to load quote details");
        setQuote(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load quote");
      } finally {
        setIsLoading(false);
      }
    }
    fetchQuote();
  }, [quoteId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showCartConfirm) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, showCartConfirm]);

  const handleCheckCurrentPrice = async () => {
    setIsRevalidating(true);
    setRevalidationError(null);
    try {
      const res = await fetch(`/api/account/quotes/${quoteId}/resume`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error?.message || "Failed to check current prices");
      setRevalidationResult(data.result);
    } catch (err) {
      setRevalidationError(err instanceof Error ? err.message : "Failed to check prices");
    } finally {
      setIsRevalidating(false);
    }
  };

  const handleContinue = async () => {
    if (!revalidationResult?.canContinue || !revalidationResult.cartPreview) return;
    
    // Check if cart has items using CartContext
    const hasExistingCart = getItemCount() > 0;
    
    if (hasExistingCart) {
      setShowCartConfirm(true);
    } else {
      await doCartReplacement();
    }
  };

  const doCartReplacement = async () => {
    if (!revalidationResult?.cartPreview || !quote) return;
    setIsContinuing(true);
    setShowCartConfirm(false);
    
    try {
      // Build cart items from validation result
      const newCartItems: CartItem[] = revalidationResult.cartPreview.items.map(item => {
        const savedItem = quote.snapshot.items.find(si => si.sku === item.sku);
        
        if (item.type === "wheel") {
          const wheelItem: CartWheelItem = {
            type: "wheel",
            sku: item.sku,
            rearSku: savedItem?.rearSku,
            brand: item.brand,
            model: item.model,
            finish: savedItem?.finish,
            diameter: savedItem?.diameter,
            width: savedItem?.width,
            offset: savedItem?.offset,
            boltPattern: savedItem?.boltPattern,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            imageUrl: savedItem?.imageUrl,
            staggered: savedItem?.staggered,
            vehicle: quote.vehicle ? {
              year: quote.vehicle.year,
              make: quote.vehicle.make,
              model: quote.vehicle.model,
              trim: quote.vehicle.trim,
              modification: quote.vehicle.modification,
            } : undefined,
          };
          return wheelItem;
        } else if (item.type === "tire") {
          const tireItem: CartTireItem = {
            type: "tire",
            sku: item.sku,
            rearSku: savedItem?.rearSku,
            brand: item.brand,
            model: item.model,
            size: savedItem?.size || "",
            rearSize: savedItem?.rearSize,
            loadIndex: savedItem?.loadIndex,
            speedRating: savedItem?.speedRating,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            imageUrl: savedItem?.imageUrl,
            staggered: savedItem?.staggered,
            source: savedItem?.source,
            vehicle: quote.vehicle ? {
              year: quote.vehicle.year,
              make: quote.vehicle.make,
              model: quote.vehicle.model,
              trim: quote.vehicle.trim,
              modification: quote.vehicle.modification,
            } : undefined,
          };
          return tireItem;
        } else {
          const accessoryItem: CartAccessoryItem = {
            type: "accessory",
            sku: item.sku,
            brand: item.brand,
            name: item.model,
            category: (savedItem?.category as CartAccessoryItem["category"]) || "other",
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            imageUrl: savedItem?.imageUrl,
            required: savedItem?.required ?? false,
            reason: savedItem?.reason ?? "",
          };
          return accessoryItem;
        }
      });

      // Use CartContext.replaceCart (not direct localStorage)
      replaceCart(newCartItems);
      
      // Use GarageContext.setActiveVehicleByData for vehicle activation (handles dedup)
      if (quote.vehicle) {
        setActiveVehicleByData({
          year: quote.vehicle.year,
          make: quote.vehicle.make,
          model: quote.vehicle.model,
          trim: quote.vehicle.trim,
          modification: quote.vehicle.modification,
        });
      }

      onClose();
      router.push("/cart");
    } catch (err) {
      console.error("[QuoteDetailModal] Cart replacement error:", err);
      setRevalidationError("Failed to add items to cart");
    } finally {
      setIsContinuing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
        <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-neutral-900">
            {revalidationResult ? "Price Check Results" : "Quote Details"}
          </h2>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors" title="Close">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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

          {quote && !revalidationResult && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500">
                <span>Saved {formatDate(quote.savedAt)}</span>
                {quote.convertedOrderId && (
                  <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    ✓ Purchased ({quote.convertedOrderId})
                  </span>
                )}
              </div>

              <div className="bg-neutral-100 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🚗</span>
                  <div>
                    <div className="font-semibold text-neutral-900">
                      {quote.vehicle.year} {quote.vehicle.make} {quote.vehicle.model}
                      {quote.vehicle.trim && ` ${quote.vehicle.trim}`}
                    </div>
                    {quote.vehicle.modification && (
                      <div className="text-sm text-neutral-500">{quote.vehicle.modification}</div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-neutral-900 mb-3">Items ({quote.snapshot.items.length})</h3>
                <div className="space-y-3">
                  {quote.snapshot.items.map((item, idx) => (
                    <QuoteItem key={`${item.sku}-${idx}`} item={item} />
                  ))}
                </div>
              </div>

              <div className="border-t border-neutral-200 pt-4">
                <h3 className="font-semibold text-neutral-900 mb-3">Quote Summary (as saved)</h3>
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
                    <span className="text-neutral-500">Est. Tax ({(quote.snapshot.pricing.taxRate * 100).toFixed(0)}%)</span>
                    <span>{formatCurrency(quote.snapshot.pricing.estimatedTax)}</span>
                  </div>
                  {quote.snapshot.pricing.estimatedShipping !== null && (
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Est. Shipping</span>
                      <span>{quote.snapshot.pricing.estimatedShipping === 0 ? "FREE" : formatCurrency(quote.snapshot.pricing.estimatedShipping)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-neutral-200 font-semibold text-base">
                    <span>Total</span>
                    <span>{formatCurrency(quote.snapshot.pricing.total)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <strong>Note:</strong> Prices shown are from when you saved this quote. Current prices and availability may differ.
              </div>

              {revalidationError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{revalidationError}</div>
              )}

              {!quote.convertedOrderId && (
                <div className="border-t border-neutral-200 pt-4">
                  <button
                    onClick={handleCheckCurrentPrice}
                    disabled={isRevalidating}
                    className="w-full px-6 py-4 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isRevalidating ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                        Checking today's price, availability and fitment...
                      </>
                    ) : (
                      <>🔄 Check Current Price</>
                    )}
                  </button>
                </div>
              )}

              {quote.convertedOrderId && (
                <div className="border-t border-neutral-200 pt-4 text-center">
                  <p className="text-sm text-neutral-500">
                    This quote was converted to order <strong>{quote.convertedOrderId}</strong>
                  </p>
                </div>
              )}
            </div>
          )}

          {quote && revalidationResult && (
            <RevalidationResults
              result={revalidationResult}
              onContinue={handleContinue}
              onCancel={() => setRevalidationResult(null)}
              isContinuing={isContinuing}
            />
          )}
        </div>
      </div>

      {showCartConfirm && (
        <CartReplacementConfirm
          onConfirm={doCartReplacement}
          onCancel={() => setShowCartConfirm(false)}
          isReplacing={isContinuing}
        />
      )}
    </div>
  );
}