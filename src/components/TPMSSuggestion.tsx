"use client";

import { useState } from "react";
import { useCart, type CartAccessoryItem } from "@/lib/cart/CartContext";
import { trackEvent } from "@/lib/analytics";

// ============================================================================
// Types
// ============================================================================

interface TPMSSuggestionProps {
  /** Vehicle year - only show if >= 2007 (TPMS mandate) or unknown */
  vehicleYear?: number | string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  /** Context determines styling */
  context?: "pdp" | "cart" | "package";
  /** Custom className */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

// TPMS became mandatory in the US for vehicles starting 2007 model year
const TPMS_MANDATORY_YEAR = 2007;

// Default TPMS product - universal pre-programmed sensors
const TPMS_PRODUCT: Omit<CartAccessoryItem, "type"> = {
  sku: "TPMS-SENSOR-UNIVERSAL",
  name: "TPMS Sensors (Set of 4)",
  category: "tpms",
  unitPrice: 49.99,
  quantity: 4,
  required: false,
  reason: "Recommended for tire pressure monitoring",
  imageUrl: "/images/placeholders/tpms-sensor.png",
};

// ============================================================================
// Helper: Should we show TPMS suggestion?
// ============================================================================

function shouldShowTPMS(vehicleYear?: number | string | null): boolean {
  // If no year provided, show it (let user decide)
  if (!vehicleYear) return true;
  
  const year = typeof vehicleYear === "string" ? parseInt(vehicleYear, 10) : vehicleYear;
  if (isNaN(year)) return true;
  
  // Only show for vehicles 2007+ (TPMS mandatory)
  return year >= TPMS_MANDATORY_YEAR;
}

// ============================================================================
// Analytics
// ============================================================================

function trackTPMSView(context: string, vehicle?: { year?: string | number | null; make?: string | null; model?: string | null }) {
  trackEvent("tpms_suggestion_view", {
    context,
    vehicle_year: vehicle?.year ? String(vehicle.year) : undefined,
    vehicle_make: vehicle?.make || undefined,
    vehicle_model: vehicle?.model || undefined,
  });
}

function trackTPMSAdd(context: string, vehicle?: { year?: string | number | null; make?: string | null; model?: string | null }) {
  trackEvent("tpms_add_to_cart", {
    context,
    sku: TPMS_PRODUCT.sku,
    price: TPMS_PRODUCT.unitPrice * TPMS_PRODUCT.quantity,
    vehicle_year: vehicle?.year ? String(vehicle.year) : undefined,
    vehicle_make: vehicle?.make || undefined,
    vehicle_model: vehicle?.model || undefined,
  });
}

// ============================================================================
// Main Component: TPMSSuggestion
// ============================================================================

export function TPMSSuggestion({
  vehicleYear,
  vehicleMake,
  vehicleModel,
  context = "pdp",
  className = "",
}: TPMSSuggestionProps) {
  const { addAccessories, items } = useCart();
  const [added, setAdded] = useState(false);

  // Don't show if TPMS already in cart
  const hasTPMSInCart = items.some(
    (item) => item.type === "accessory" && (item as CartAccessoryItem).category === "tpms"
  );

  // Don't show for older vehicles that don't have TPMS
  if (!shouldShowTPMS(vehicleYear)) {
    return null;
  }

  // Don't show if already added
  if (hasTPMSInCart) {
    return null;
  }

  const handleAddTPMS = () => {
    const tpmsItem: CartAccessoryItem = {
      ...TPMS_PRODUCT,
      type: "accessory",
      vehicle: vehicleMake && vehicleModel ? {
        year: String(vehicleYear || ""),
        make: vehicleMake,
        model: vehicleModel,
      } : undefined,
    };

    addAccessories([tpmsItem]);
    setAdded(true);
    trackTPMSAdd(context, { year: vehicleYear, make: vehicleMake, model: vehicleModel });

    // Reset after a moment
    setTimeout(() => setAdded(false), 2000);
  };

  const totalPrice = TPMS_PRODUCT.unitPrice * TPMS_PRODUCT.quantity;

  // ──────────────────────────────────────────────────────────────────────────
  // PDP Context - Compact card below CTA
  // ──────────────────────────────────────────────────────────────────────────
  if (context === "pdp") {
    return (
      <div className={`rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <span className="text-2xl">📡</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-neutral-900">Need TPMS sensors?</h4>
              {vehicleMake && vehicleModel && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                  For your vehicle
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-neutral-600">
              Direct-fit sensors available • Pre-programmed & ready to install
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={handleAddTPMS}
                disabled={added}
                className={`
                  inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all
                  ${added
                    ? "bg-green-100 text-green-700 cursor-default"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                  }
                `}
              >
                {added ? (
                  <>
                    <span>✓</span>
                    <span>Added!</span>
                  </>
                ) : (
                  <>
                    <span>Add TPMS</span>
                    <span className="text-blue-200 font-normal">${totalPrice.toFixed(2)}</span>
                  </>
                )}
              </button>
              <span className="text-xs text-neutral-500">Set of 4 sensors</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Cart Context - Compact upsell banner
  // ──────────────────────────────────────────────────────────────────────────
  if (context === "cart") {
    return (
      <div className={`rounded-xl border border-amber-200 bg-amber-50 p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <span className="text-xl flex-shrink-0">📡</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-neutral-900 text-sm">Complete your setup</p>
            <p className="text-xs text-neutral-600">Add TPMS sensors for tire pressure monitoring</p>
          </div>
          <button
            onClick={handleAddTPMS}
            disabled={added}
            className={`
              flex-shrink-0 rounded-lg px-3 py-2 text-sm font-bold transition-all whitespace-nowrap
              ${added
                ? "bg-green-100 text-green-700"
                : "bg-amber-600 text-white hover:bg-amber-700"
              }
            `}
          >
            {added ? "✓ Added" : `Add $${totalPrice.toFixed(2)}`}
          </button>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Package Context - Toggle style with quantity selector
  // ──────────────────────────────────────────────────────────────────────────
  if (context === "package") {
    return <TPMSPackageContext 
      vehicleYear={vehicleYear}
      vehicleMake={vehicleMake}
      vehicleModel={vehicleModel}
      className={className}
    />;
  }

  return null;
}

// ============================================================================
// Package Context TPMS - With quantity selector
// ============================================================================

function TPMSPackageContext({
  vehicleYear,
  vehicleMake,
  vehicleModel,
  className = "",
}: {
  vehicleYear?: number | string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  className?: string;
}) {
  const { addAccessories } = useCart();
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(4);

  const unitPrice = TPMS_PRODUCT.unitPrice;
  const totalPrice = unitPrice * quantity;

  const handleAddTPMS = () => {
    const tpmsItem: CartAccessoryItem = {
      ...TPMS_PRODUCT,
      type: "accessory",
      quantity,
      name: quantity === 1 ? "TPMS Sensor" : `TPMS Sensors (${quantity})`,
      vehicle: vehicleMake && vehicleModel ? {
        year: String(vehicleYear || ""),
        make: vehicleMake,
        model: vehicleModel,
      } : undefined,
    };

    addAccessories([tpmsItem]);
    setAdded(true);
    trackTPMSAdd("package", { year: vehicleYear, make: vehicleMake, model: vehicleModel });

    // Reset after a moment
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className={`rounded-xl border border-neutral-200 bg-white p-4 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">📡</span>
          <div>
            <p className="font-semibold text-neutral-900">TPMS Sensors</p>
            <p className="text-xs text-neutral-500">Pre-programmed • ${unitPrice.toFixed(2)} each</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Quantity selector */}
          <select
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            disabled={added}
            className="h-9 rounded-lg border border-neutral-200 bg-white px-2 text-sm font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {[1, 2, 3, 4, 5, 6, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-sm font-bold text-neutral-900 min-w-[60px] text-right">
            ${totalPrice.toFixed(2)}
          </span>
          <button
            onClick={handleAddTPMS}
            disabled={added}
            className={`
              rounded-lg px-4 py-2 text-sm font-bold transition-all
              ${added
                ? "bg-green-100 text-green-700"
                : "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50"
              }
            `}
          >
            {added ? "✓ Added" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Cart TPMS Upsell - Simpler version for cart slideout
// ============================================================================

export function CartTPMSUpsell({ className = "" }: { className?: string }) {
  return <TPMSSuggestion context="cart" className={className} />;
}

// ============================================================================
// Exports
// ============================================================================

export default TPMSSuggestion;
