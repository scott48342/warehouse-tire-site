"use client";

import { useState } from "react";
import { useCart, type CartAccessoryItem } from "@/lib/cart/CartContext";

/**
 * Road Hazard Protection Component
 * 
 * Offers tire protection plan at checkout - 25% of tire price per tire.
 * Covers damage from road hazards (potholes, nails, debris) for 5 years.
 * 
 * @created 2026-04-15
 * @updated 2026-04-17 - Changed to 25% of tire price per tire
 * @updated 2026-04-24 - Changed coverage to 5 years
 */

interface RoadHazardProtectionProps {
  /** Number of tires in cart */
  tireCount: number;
  /** Total tire subtotal (sum of all tire prices) for calculating 25% */
  tireSubtotal?: number;
  /** Context for styling */
  context?: "checkout" | "cart" | "pdp";
  /** Custom class */
  className?: string;
}

// Road hazard product configuration
const ROAD_HAZARD_RATE = 0.25; // 25% of tire price
const ROAD_HAZARD_MIN_PER_TIRE = 15; // Minimum $15 per tire
const ROAD_HAZARD_SKU = "RH-PROTECT-5YR";

export function RoadHazardProtection({
  tireCount,
  tireSubtotal = 0,
  context = "checkout",
  className = "",
}: RoadHazardProtectionProps) {
  const { items, addAccessory, removeItem } = useCart();
  const [adding, setAdding] = useState(false);

  // Check if road hazard already in cart
  const existingRH = items.find(
    (i) => i.type === "accessory" && i.sku === ROAD_HAZARD_SKU
  ) as CartAccessoryItem | undefined;

  const isAdded = !!existingRH;
  
  // Calculate price: 25% of tire price per tire, minimum $15/tire
  const avgTirePrice = tireCount > 0 ? tireSubtotal / tireCount : 0;
  const calculatedPerTire = avgTirePrice * ROAD_HAZARD_RATE;
  const pricePerTire = Math.round(Math.max(ROAD_HAZARD_MIN_PER_TIRE, calculatedPerTire) * 100) / 100;
  const totalPrice = Math.round(pricePerTire * tireCount * 100) / 100;

  // Don't show if no tires or no tire price info
  if (tireCount <= 0 || tireSubtotal <= 0) return null;

  const handleAdd = async () => {
    if (adding || isAdded) return;
    setAdding(true);

    try {
      const rhItem: CartAccessoryItem = {
        type: "accessory",
        category: "tpms", // Using tpms category for service add-ons
        sku: ROAD_HAZARD_SKU,
        name: "5-Year Road Hazard Protection",
        unitPrice: pricePerTire,
        quantity: tireCount,
        required: false,
        reason: "Covers tire damage from potholes, nails, and road debris",
        meta: {
          coverageYears: 5,
          totalPrice: totalPrice,
          rate: ROAD_HAZARD_RATE,
          serviceType: "road_hazard",
        },
      };

      addAccessory(rhItem);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = () => {
    removeItem(ROAD_HAZARD_SKU, "accessory");
  };

  // Compact version for cart
  if (context === "cart") {
    if (isAdded) {
      return (
        <div className={`flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200 ${className}`}>
          <div className="flex items-center gap-2">
            <span className="text-green-600">🛡️</span>
            <span className="text-sm font-semibold text-green-800">Road Hazard Protection Added</span>
          </div>
          <button
            onClick={handleRemove}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Remove
          </button>
        </div>
      );
    }

    return (
      <div className={`p-3 bg-blue-50 rounded-lg border border-blue-200 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            <div>
              <span className="text-sm font-semibold text-blue-900">Add Road Hazard Protection</span>
              <span className="text-xs text-blue-700 ml-2">${totalPrice.toFixed(2)} for {tireCount} tires</span>
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="px-3 py-1 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    );
  }

  // Full version for checkout
  return (
    <div className={`rounded-xl border-2 ${isAdded ? "border-green-300 bg-green-50" : "border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50"} p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isAdded ? "bg-green-100" : "bg-blue-100"}`}>
          <span className="text-2xl">🛡️</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`font-bold ${isAdded ? "text-green-900" : "text-blue-900"}`}>
              5-Year Road Hazard Protection
            </h3>
            {isAdded && (
              <span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs font-bold rounded-full">
                ✓ Added
              </span>
            )}
          </div>
          <p className={`text-sm mt-1 ${isAdded ? "text-green-700" : "text-blue-700"}`}>
            Covers tire replacement if damaged by road hazards — potholes, nails, glass, or debris.
          </p>
        </div>
      </div>

      {/* Coverage details */}
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 text-neutral-700">
          <span className="text-green-600">✓</span>
          <span>Pothole damage</span>
        </div>
        <div className="flex items-center gap-2 text-neutral-700">
          <span className="text-green-600">✓</span>
          <span>Nail punctures</span>
        </div>
        <div className="flex items-center gap-2 text-neutral-700">
          <span className="text-green-600">✓</span>
          <span>Glass & debris</span>
        </div>
        <div className="flex items-center gap-2 text-neutral-700">
          <span className="text-green-600">✓</span>
          <span>Full replacement</span>
        </div>
      </div>

      {/* Pricing */}
      <div className={`mt-4 p-3 rounded-lg ${isAdded ? "bg-green-100" : "bg-white border border-blue-100"}`}>
        <div className="flex items-center justify-between">
          <div>
            <span className={`text-lg font-extrabold ${isAdded ? "text-green-900" : "text-blue-900"}`}>
              ${totalPrice.toFixed(2)}
            </span>
            <span className="text-sm text-neutral-500 ml-2">
              for {tireCount} tire{tireCount !== 1 ? "s" : ""}
            </span>
          </div>
          {isAdded ? (
            <button
              onClick={handleRemove}
              className="px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-800 hover:underline"
            >
              Remove
            </button>
          ) : (
            <button
              onClick={handleAdd}
              disabled={adding}
              className={`px-6 py-2 rounded-lg font-bold text-white transition-colors ${
                adding
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {adding ? "Adding..." : "Add Protection"}
            </button>
          )}
        </div>
      </div>

      {/* Trust footer */}
      <p className="mt-3 text-xs text-neutral-500 text-center">
        Protection starts when your tires are installed. Claims handled hassle-free.
      </p>
    </div>
  );
}

/**
 * Compact inline road hazard option for tire cards/PDP
 */
export function RoadHazardBadge() {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs">
      <span>🛡️</span>
      <span className="font-semibold text-blue-800">Road Hazard Protection Available</span>
    </div>
  );
}
