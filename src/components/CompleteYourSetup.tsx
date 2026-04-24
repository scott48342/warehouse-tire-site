"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useCart, type CartAccessoryItem } from "@/lib/cart/CartContext";

// ============================================================================
// Types
// ============================================================================

interface Accessory {
  sku: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  category: "lug_nut" | "hub_ring" | "tpms" | "valve_stem";
  required: boolean;
  quantity: number;
  selected: boolean;
}

interface CompleteYourSetupProps {
  wheelDiameter?: number;
  boltPattern?: string;
  vehicleYear?: number;
  vehicleMake?: string;
  vehicleModel?: string;
  className?: string;
  context?: "cart" | "package" | "checkout";
}

// ============================================================================
// Default Accessories
// ============================================================================

const DEFAULT_ACCESSORIES: Omit<Accessory, "selected">[] = [
  {
    sku: "TPMS-SENSOR-UNIVERSAL",
    name: "TPMS Sensors",
    description: "Pre-programmed tire pressure monitoring sensors",
    price: 49.99,
    imageUrl: null,
    category: "tpms",
    required: false, // Optional - customer may reuse existing sensors
    quantity: 4,
  },
  {
    sku: "LUG-KIT-CHROME",
    name: "Chrome Lug Nut Kit",
    description: "Complete lug nut set with lock key",
    price: 79.99,
    imageUrl: null,
    category: "lug_nut",
    required: false, // Optional - customer may reuse existing hardware
    quantity: 1,
  },
  // Valve stems removed - included with installation
  {
    sku: "HUB-CENTRIC-RINGS",
    name: "Hub Centric Rings",
    description: "Eliminate vibration with proper wheel centering",
    price: 24.99,
    imageUrl: null,
    category: "hub_ring",
    required: false,
    quantity: 4,
  },
];

// ============================================================================
// Category Config
// ============================================================================

const CATEGORY_CONFIG: Record<string, { icon: string; label: string }> = {
  tpms: { icon: "📡", label: "Sensors" },
  lug_nut: { icon: "🔩", label: "Hardware" },
  lug_bolt: { icon: "🔩", label: "Hardware" },
  valve_stem: { icon: "🔧", label: "Valve" },
  hub_ring: { icon: "⚙️", label: "Hub Ring" },
};

// ============================================================================
// Main Component
// ============================================================================

export function CompleteYourSetup({
  wheelDiameter,
  boltPattern,
  vehicleYear,
  vehicleMake,
  vehicleModel,
  className = "",
  context = "package",
}: CompleteYourSetupProps) {
  const { addAccessories, getAccessories, removeItem } = useCart();
  
  const [accessories, setAccessories] = useState<Accessory[]>(() => 
    DEFAULT_ACCESSORIES.map(acc => ({
      ...acc,
      selected: acc.required,
    }))
  );

  const [expanded, setExpanded] = useState(context !== "cart");

  // Calculate totals
  const selectedAccessories = accessories.filter(a => a.selected);
  const requiredTotal = accessories
    .filter(a => a.required && a.selected)
    .reduce((sum, a) => sum + (a.price * a.quantity), 0);
  const optionalTotal = accessories
    .filter(a => !a.required && a.selected)
    .reduce((sum, a) => sum + (a.price * a.quantity), 0);
  const totalPrice = requiredTotal + optionalTotal;

  // Toggle accessory selection
  const toggleAccessory = (sku: string) => {
    setAccessories(prev => prev.map(a => {
      if (a.sku === sku && !a.required) {
        return { ...a, selected: !a.selected };
      }
      return a;
    }));
  };

  // Add selected accessories to cart
  const handleAddToCart = () => {
    const cartItems: CartAccessoryItem[] = selectedAccessories.map(a => ({
      type: "accessory" as const,
      sku: a.sku,
      name: a.name,
      unitPrice: a.price,
      quantity: a.quantity,
      category: a.category,
      required: a.required,
      reason: a.required ? "Recommended for new wheel installation" : "Optional accessory",
      imageUrl: a.imageUrl || undefined,
    }));

    addAccessories(cartItems);
  };

  // Compact view for cart - FIX #6: Reframe as "Finish Your Build"
  if (context === "cart" && !expanded) {
    return (
      <div className={`rounded-lg border border-neutral-200 bg-neutral-50 p-4 ${className}`}>
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-between text-left"
        >
          <div>
            <p className="font-medium text-neutral-900">Finish Your Build</p>
            <p className="text-sm text-neutral-600">
              Recommended for install readiness
            </p>
          </div>
          <span className="text-2xl">+</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-neutral-200 bg-white p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">
            {context === "cart" ? "Finish Your Build" : "Complete Your Setup"}
          </h3>
          <p className="text-sm text-neutral-600">
            {context === "cart" ? "Recommended for install readiness" : "Add essential accessories for a perfect install"}
          </p>
        </div>
        {context === "cart" && (
          <button
            onClick={() => setExpanded(false)}
            className="text-neutral-400 hover:text-neutral-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Required Section */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">
          Recommended
        </p>
        <div className="space-y-3">
          {accessories.filter(a => a.required).map((acc) => (
            <AccessoryItem
              key={acc.sku}
              accessory={acc}
              onToggle={() => toggleAccessory(acc.sku)}
            />
          ))}
        </div>
      </div>

      {/* Optional Section */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">
          Optional Add-Ons
        </p>
        <div className="space-y-3">
          {accessories.filter(a => !a.required).map((acc) => (
            <AccessoryItem
              key={acc.sku}
              accessory={acc}
              onToggle={() => toggleAccessory(acc.sku)}
            />
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="border-t border-neutral-200 pt-4 mt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-neutral-600">
              {selectedAccessories.length} item{selectedAccessories.length !== 1 ? "s" : ""} selected
            </p>
            <p className="text-2xl font-bold text-neutral-900">
              ${totalPrice.toFixed(2)}
            </p>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={selectedAccessories.length === 0}
            className="rounded-lg bg-neutral-900 px-6 py-2.5 font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Accessory Item Component
// ============================================================================

interface AccessoryItemProps {
  accessory: Accessory;
  onToggle: () => void;
}

function AccessoryItem({ accessory, onToggle }: AccessoryItemProps) {
  const categoryConfig = CATEGORY_CONFIG[accessory.category] || CATEGORY_CONFIG.misc;
  const totalPrice = accessory.price * accessory.quantity;

  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
        ${accessory.selected
          ? "border-neutral-900 bg-neutral-50"
          : "border-neutral-200 hover:border-neutral-300"
        }
      `}
      onClick={onToggle}
    >
      {/* Checkbox */}
      <div
        className={`
          w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
          ${accessory.selected
            ? "bg-neutral-900 border-neutral-900 text-white"
            : "border-neutral-300"
          }
          ${accessory.required ? "opacity-70" : ""}
        `}
      >
        {accessory.selected && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {/* Icon */}
      <span className="text-2xl flex-shrink-0">{categoryConfig.icon}</span>

      {/* Info */}
      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-neutral-900 truncate">{accessory.name}</p>
          {accessory.required && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
              Recommended
            </span>
          )}
        </div>
        <p className="text-sm text-neutral-500 truncate">{accessory.description}</p>
      </div>

      {/* Price */}
      <div className="text-right flex-shrink-0">
        <p className="font-semibold text-neutral-900">${totalPrice.toFixed(2)}</p>
        {accessory.quantity > 1 && (
          <p className="text-xs text-neutral-500">
            ${accessory.price.toFixed(2)} × {accessory.quantity}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Cart Accessory Upsell (Simpler version for cart page)
// ============================================================================

export function CartAccessoryUpsell({ className = "" }: { className?: string }) {
  return (
    <CompleteYourSetup
      context="cart"
      className={className}
    />
  );
}

// ============================================================================
// Exports
// ============================================================================

export default CompleteYourSetup;
