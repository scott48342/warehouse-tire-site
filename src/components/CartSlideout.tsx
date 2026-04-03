"use client";

import { useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useCart, type CartWheelItem, type CartTireItem, type CartAccessoryItem } from "@/lib/cart/CartContext";
import { AccessoryRecommendations } from "./AccessoryRecommendations";
import {
  loadLiftedContext,
  liftedContextMatchesVehicle,
  getLiftedTireSizesForWheel,
} from "@/lib/liftedBuildContext";
import { EmailCartButton } from "./EmailCartButton";
import { useCartShipping } from "@/lib/shipping/useCartShipping";
import { ZipCodeInput, FreeShippingProgress } from "./ShippingEstimate";
import { formatCurrency, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping/shippingService";

const FITMENT_LABELS = {
  surefit: { label: "Best Fit", color: "text-green-700", bg: "bg-green-100" },
  specfit: { label: "Good Fit", color: "text-blue-700", bg: "bg-blue-100" },
  extended: { label: "Aggressive Fit", color: "text-orange-700", bg: "bg-orange-100" },
} as const;

function WheelItemCard({ item }: { item: CartWheelItem }) {
  const fitment = item.fitmentClass ? FITMENT_LABELS[item.fitmentClass] : null;
  // Defensive: handle corrupted items with missing prices
  const unitPrice = item.unitPrice ?? 0;
  const quantity = item.quantity ?? 0;
  const total = unitPrice * quantity;

  return (
    <div className="flex gap-4 rounded-xl border border-neutral-200 bg-white p-4">
      {/* Image */}
      <div className="w-20 h-20 flex-shrink-0 rounded-lg border border-neutral-100 bg-neutral-50 overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.model}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">
            No image
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-neutral-500">{item.brand}</div>
        <div className="font-extrabold text-neutral-900 truncate">{item.model}</div>
        {item.finish ? (
          <div className="text-sm text-neutral-600">{item.finish}</div>
        ) : null}

        <div className="mt-1 flex flex-wrap gap-1 text-xs">
          {item.diameter ? <span className="text-neutral-600">{item.diameter}&quot;</span> : null}
          {item.width ? <span className="text-neutral-600">× {item.width}&quot;</span> : null}
          {item.boltPattern ? (
            <span className="text-neutral-500">• {item.boltPattern}</span>
          ) : null}
        </div>
        
        {/* SKU */}
        <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{item.sku}</div>

        {item.staggered && item.rearSku ? (
          <div className="mt-1 text-xs text-amber-700 font-medium">
            Staggered setup (front + rear)
          </div>
        ) : null}

        <div className="mt-2 flex items-center justify-between">
          <div className="text-sm">
            <span className="font-extrabold text-neutral-900">
              ${total.toFixed(2)}
            </span>
            <span className="text-neutral-500 ml-1">
              ({quantity} × ${unitPrice.toFixed(2)})
            </span>
          </div>
          {fitment ? (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${fitment.bg} ${fitment.color}`}>
              {fitment.label}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AccessoryItemCard({ item }: { item: CartAccessoryItem }) {
  // Defensive: handle corrupted items with missing prices
  const unitPrice = item.unitPrice ?? 0;
  const quantity = item.quantity ?? 1;
  const total = unitPrice * quantity;

  // Icon based on category
  const iconMap: Record<string, string> = {
    lug_nut: "🔩",
    lug_bolt: "🔩",
    hub_ring: "⭕",
    valve_stem: "🔘",
    tpms: "📡",
  };
  const icon = iconMap[item.category] || "🔧";

  return (
    <div className="flex gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-amber-100 flex items-center justify-center">
        <span className="text-xl">{icon}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-neutral-900 text-sm truncate">{item.name}</span>
          {item.required && (
            <span className="flex-shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold text-white">
              REQUIRED
            </span>
          )}
        </div>
        
        {/* Spec display (thread size, etc.) */}
        {item.spec?.threadSize ? (
          <div className="text-xs text-neutral-700 font-medium">{item.spec.threadSize}</div>
        ) : null}
        
        {/* SKU */}
        <div className="text-[10px] text-neutral-400 font-mono">{item.sku}</div>
        
        <div className="text-xs text-neutral-600 mt-0.5">{item.reason}</div>

        <div className="mt-2 text-sm">
          <span className="font-extrabold text-neutral-900">
            {total === 0 ? "Included" : `$${total.toFixed(2)}`}
          </span>
          {total > 0 && (
            <span className="text-neutral-500 ml-1">
              ({quantity} × ${unitPrice.toFixed(2)})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TireItemCard({ item }: { item: CartTireItem }) {
  // Defensive: handle corrupted items with missing prices
  const unitPrice = item.unitPrice ?? 0;
  const quantity = item.quantity ?? 0;
  const total = unitPrice * quantity;
  
  // Build load/speed display (e.g., "102H")
  const loadSpeedDisplay = [item.loadIndex, item.speedRating].filter(Boolean).join("");

  return (
    <div className="flex gap-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="w-20 h-20 flex-shrink-0 rounded-lg border border-neutral-100 bg-neutral-50 overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.model}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">
            No image
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-neutral-500">{item.brand}</div>
        <div className="font-extrabold text-neutral-900 truncate">{item.model}</div>
        
        {/* Tire size with load/speed rating */}
        <div className="text-sm text-neutral-600">
          {item.size}
          {loadSpeedDisplay ? ` ${loadSpeedDisplay}` : null}
        </div>
        
        {/* SKU */}
        <div className="text-[10px] text-neutral-400 font-mono">{item.sku}</div>

        {item.staggered && item.rearSize ? (
          <div className="mt-1 text-xs text-amber-700 font-medium">
            Staggered: Front {item.size} / Rear {item.rearSize}
          </div>
        ) : null}

        <div className="mt-2 text-sm">
          <span className="font-extrabold text-neutral-900">
            ${total.toFixed(2)}
          </span>
          <span className="text-neutral-500 ml-1">
            ({quantity} × ${unitPrice.toFixed(2)})
          </span>
        </div>
      </div>
    </div>
  );
}

export function CartSlideout() {
  const {
    items,
    isOpen,
    setIsOpen,
    lastAddedItem,
    getTotal,
    getItemCount,
    hasWheels,
    hasTires,
    hasAccessories,
    getWheels,
    removeItem,
    addAccessory,
    addAccessories,
    accessoryState,
  } = useCart();

  const subtotal = getTotal();
  
  // Shipping estimation
  const {
    zipCode,
    setZipCode,
    clearZipCode,
    estimate: shippingEstimate,
    isFreeShipping,
    amountToFreeShipping,
    estimatedTotal,
    isValidZip,
  } = useCartShipping(items, subtotal);

  const slideoutRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, setIsOpen]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        isOpen &&
        slideoutRef.current &&
        !slideoutRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, setIsOpen]);

  // Load lifted context from sessionStorage (if any)
  // This preserves lifted tire recommendations from /lifted page through the wheel → tire flow
  // IMPORTANT: Must be called before early return to satisfy Rules of Hooks
  // Using useMemo since loadLiftedContext is synchronous (reads from sessionStorage)
  const liftedCtx = useMemo(() => {
    if (typeof window === "undefined") return null;
    return isOpen ? loadLiftedContext() : null;
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const wheels = getWheels();
  // Get vehicle from wheel items (which have full vehicle info including trim/modification)
  const wheelVehicle = wheels[0]?.vehicle;
  const lastWheelItem = lastAddedItem?.type === "wheel" ? lastAddedItem as CartWheelItem : null;
  const vehicle = lastWheelItem?.vehicle || wheelVehicle;
  const itemCount = getItemCount();

  // Build tires URL with vehicle, wheel, and lifted info
  const tiresParams = new URLSearchParams();
  if (vehicle) {
    tiresParams.set("year", vehicle.year);
    tiresParams.set("make", vehicle.make);
    tiresParams.set("model", vehicle.model);
    if (vehicle.trim) tiresParams.set("trim", vehicle.trim);
    if (vehicle.modification) tiresParams.set("modification", vehicle.modification);
  }
  if (wheels[0]) {
    tiresParams.set("wheelSku", wheels[0].sku);
    if (wheels[0].diameter) tiresParams.set("wheelDia", wheels[0].diameter);
    if (wheels[0].width) tiresParams.set("wheelWidth", wheels[0].width);
  }

  // Include lifted context if it matches the current vehicle
  // This ensures lifted tire sizes are used instead of OEM sizes
  if (liftedCtx && vehicle && liftedContextMatchesVehicle(liftedCtx, vehicle)) {
    tiresParams.set("liftedSource", "lifted");
    tiresParams.set("liftedPreset", liftedCtx.presetId);
    tiresParams.set("liftedInches", String(liftedCtx.liftInches));
    tiresParams.set("liftedTireDiaMin", String(liftedCtx.tireDiameterMin));
    tiresParams.set("liftedTireDiaMax", String(liftedCtx.tireDiameterMax));
    
    // Get tire sizes that match the selected wheel diameter
    const wheelDia = wheels[0]?.diameter ? parseInt(wheels[0].diameter, 10) : 0;
    if (wheelDia > 0) {
      const tireSizesForWheel = getLiftedTireSizesForWheel(liftedCtx, wheelDia);
      if (tireSizesForWheel.length > 0) {
        tiresParams.set("liftedTireSizes", tireSizesForWheel.join(","));
      } else if (liftedCtx.recommendedTireSizes.length > 0) {
        // Fall back to all recommended sizes if none match this specific wheel dia
        tiresParams.set("liftedTireSizes", liftedCtx.recommendedTireSizes.join(","));
      }
    }
  }

  const tiresUrl = `/tires?${tiresParams.toString()}`;
  const checkoutUrl = `/checkout`;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />

      {/* Slideout Panel */}
      <div
        ref={slideoutRef}
        className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-neutral-50 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📦</span>
              <h2 className="text-lg font-extrabold text-neutral-900">
                {lastAddedItem ? "Added to Package!" : "Your Package"}
              </h2>
            </div>
            <p className="text-sm text-neutral-600">
              {itemCount} {itemCount === 1 ? "item" : "items"} • ${subtotal.toFixed(2)}
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-full p-2 hover:bg-neutral-100 transition-colors"
            aria-label="Close cart"
          >
            <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Vehicle Confirmation */}
        {vehicle ? (
          <div className="mx-5 mt-4 rounded-xl bg-green-50 border border-green-200 p-3">
            <div className="flex items-center gap-2">
              <span className="text-green-600 text-lg">✓</span>
              <div>
                <div className="text-sm font-bold text-green-900">
                  Fits your {vehicle.year} {vehicle.make} {vehicle.model}
                </div>
                <div className="text-xs text-green-700">Guaranteed fitment</div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Wheels */}
          {items.filter(i => i.type === "wheel").map((item) => (
            <div key={`wheel-${item.sku}`} className="relative">
              <WheelItemCard item={item as CartWheelItem} />
              <button
                onClick={() => removeItem(item.sku, "wheel")}
                className="absolute top-2 right-2 rounded-full p-1 hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600"
                aria-label="Remove item"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {/* Tires */}
          {items.filter(i => i.type === "tire").map((item) => (
            <div key={`tire-${item.sku}`} className="relative">
              <TireItemCard item={item as CartTireItem} />
              <button
                onClick={() => removeItem(item.sku, "tire")}
                className="absolute top-2 right-2 rounded-full p-1 hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600"
                aria-label="Remove item"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {/* Accessories */}
          {items.filter(i => i.type === "accessory").map((item) => (
            <div key={`acc-${item.sku}`} className="relative">
              <AccessoryItemCard item={item as CartAccessoryItem} />
              <button
                onClick={() => removeItem(item.sku, "accessory")}
                className="absolute top-2 right-2 rounded-full p-1 hover:bg-amber-100 text-amber-400 hover:text-amber-600"
                aria-label="Remove item"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {/* Accessory Recommendations (if wheels added but accessories not yet) */}
          {hasWheels() && !hasAccessories() && accessoryState && (
            <AccessoryRecommendations
              state={accessoryState}
              onAddAccessory={addAccessory}
              onAddAllRequired={(items) => addAccessories(items)}
              compact
            />
          )}
        </div>

        {/* Package Progress */}
        {hasWheels() && !hasTires() ? (
          <div className="mx-5 mb-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">🛞</span>
              </div>
              <div className="flex-1">
                <div className="font-bold text-amber-900">Step 2: Add Tires</div>
                <div className="text-sm text-amber-800 mt-1">
                  Select tires sized for your wheels to complete your package.
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-2 bg-amber-200 rounded-full overflow-hidden">
                    <div className="h-full w-1/2 bg-green-500 rounded-full" />
                  </div>
                  <span className="text-xs font-bold text-amber-700">50%</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Actions */}
        <div className="border-t border-neutral-200 bg-white px-5 py-4 space-y-3">
          {/* Shipping estimate */}
          {items.length > 0 && (
            <div className="space-y-2">
              {isFreeShipping ? (
                <div className="flex items-center gap-2 text-green-700 text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">Free Shipping!</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-600">Shipping to:</span>
                    <ZipCodeInput
                      value={zipCode}
                      onChange={setZipCode}
                      onClear={clearZipCode}
                      compact
                    />
                    {isValidZip && shippingEstimate && (
                      <span className="text-sm font-semibold">{shippingEstimate.displayAmount}</span>
                    )}
                  </div>
                  <div className="text-xs text-amber-700">
                    {formatCurrency(amountToFreeShipping)} away from free shipping
                  </div>
                </>
              )}
            </div>
          )}

          {/* Totals */}
          <div className="space-y-1 pt-2 border-t border-neutral-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600">Subtotal</span>
              <span className="text-neutral-900">${subtotal.toFixed(2)}</span>
            </div>
            {isValidZip && !isFreeShipping && shippingEstimate && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">Shipping (est.)</span>
                <span className="text-neutral-900">{shippingEstimate.displayAmount}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-lg pt-1">
              <span className="font-semibold text-neutral-700">
                {isValidZip ? "Est. Total" : "Subtotal"}
              </span>
              <span className="font-extrabold text-neutral-900">
                ${isValidZip ? estimatedTotal.toFixed(2) : subtotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Primary CTA - changes based on cart contents */}
          {hasWheels() && !hasTires() ? (
            <Link
              href={tiresUrl}
              onClick={() => setIsOpen(false)}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-extrabold text-white hover:bg-red-700 transition-colors gap-2"
            >
              <span>Select Tires</span>
              <span className="text-red-200">→</span>
            </Link>
          ) : (
            <Link
              href="/cart"
              onClick={() => setIsOpen(false)}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-extrabold text-white hover:bg-red-700 transition-colors gap-2"
            >
              <span>Review Package</span>
              <span className="text-red-200">→</span>
            </Link>
          )}

          {/* Secondary actions */}
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={checkoutUrl}
              onClick={() => setIsOpen(false)}
              className="flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold text-neutral-900 hover:bg-neutral-50 transition-colors"
            >
              Checkout
            </Link>
            <button
              onClick={() => setIsOpen(false)}
              className="flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Keep Shopping
            </button>
          </div>

          {/* Email cart link */}
          <div className="pt-3 border-t border-neutral-100 flex justify-center">
            <EmailCartButton variant="inline" />
          </div>

          {/* Trust badges */}
          <div className="pt-3 flex flex-wrap justify-center gap-4 text-xs text-neutral-500">
            <span>✓ Free shipping over {formatCurrency(FREE_SHIPPING_THRESHOLD)}</span>
            <span>✓ Expert support</span>
          </div>
        </div>
      </div>
    </>
  );
}
