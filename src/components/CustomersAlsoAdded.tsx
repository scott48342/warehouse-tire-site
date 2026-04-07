"use client";

import { useState } from "react";
import { useCart, type CartAccessoryItem } from "@/lib/cart/CartContext";
import { trackEvent } from "@/lib/analytics";
import type { CoAddedProduct } from "@/lib/analytics/coPurchase";

// ============================================================================
// Types
// ============================================================================

interface CustomersAlsoAddedProps {
  /** Products to recommend */
  products: CoAddedProduct[];
  /** Where this is being shown */
  context: "pdp" | "cart" | "checkout";
  /** Source product SKU (for analytics) */
  sourceSku?: string;
  /** Custom className */
  className?: string;
}

// ============================================================================
// Category Display Config
// ============================================================================

const PRODUCT_CONFIG: Record<string, { icon: string; displayName?: string }> = {
  // Accessories by category (detected from productName)
  tpms: { icon: "📡", displayName: "TPMS Sensors" },
  "lug nut": { icon: "🔩", displayName: "Lug Nuts" },
  "hub ring": { icon: "⚙️", displayName: "Hub Rings" },
  "valve stem": { icon: "🔧", displayName: "Valve Stems" },
  // Product types
  tire: { icon: "🛞" },
  wheel: { icon: "⚙️" },
  accessory: { icon: "🔧" },
};

function getProductConfig(product: CoAddedProduct): { icon: string; displayName: string } {
  const nameLower = product.productName.toLowerCase();
  
  // Check for known accessory types
  for (const [key, config] of Object.entries(PRODUCT_CONFIG)) {
    if (nameLower.includes(key)) {
      return {
        icon: config.icon,
        displayName: config.displayName || product.productName,
      };
    }
  }
  
  // Fallback by product type
  const typeConfig = PRODUCT_CONFIG[product.productType] || { icon: "📦" };
  return {
    icon: typeConfig.icon,
    displayName: product.productName,
  };
}

// ============================================================================
// Analytics
// ============================================================================

function trackCoAddView(context: string, sourceSku: string | undefined, products: CoAddedProduct[]) {
  trackEvent("co_add_section_view", {
    context,
    source_sku: sourceSku,
    product_count: products.length,
    skus: products.map(p => p.sku).join(","),
  });
}

function trackCoAddClick(context: string, sourceSku: string | undefined, clickedSku: string, position: number) {
  trackEvent("co_add_product_click", {
    context,
    source_sku: sourceSku,
    clicked_sku: clickedSku,
    position,
  });
}

// ============================================================================
// Main Component
// ============================================================================

export function CustomersAlsoAdded({
  products,
  context,
  sourceSku,
  className = "",
}: CustomersAlsoAddedProps) {
  const { addAccessories } = useCart();
  const [addedSkus, setAddedSkus] = useState<Set<string>>(new Set());

  // Don't render if no products
  if (!products || products.length === 0) {
    return null;
  }

  const handleAddToCart = (product: CoAddedProduct, position: number) => {
    // Track the click
    trackCoAddClick(context, sourceSku, product.sku, position);

    // For accessories, add directly to cart
    if (product.productType === "accessory" || 
        product.productName.toLowerCase().includes("tpms") ||
        product.productName.toLowerCase().includes("lug") ||
        product.productName.toLowerCase().includes("hub ring")) {
      
      // Determine category
      let category: CartAccessoryItem["category"] = "tpms";
      const nameLower = product.productName.toLowerCase();
      if (nameLower.includes("lug nut")) category = "lug_nut";
      else if (nameLower.includes("lug bolt")) category = "lug_bolt";
      else if (nameLower.includes("hub ring")) category = "hub_ring";
      else if (nameLower.includes("valve")) category = "valve_stem";

      const accessoryItem: CartAccessoryItem = {
        type: "accessory",
        sku: product.sku,
        name: product.productName,
        category,
        unitPrice: 49.99, // Default price - would need to be fetched in production
        quantity: 4,
        required: false,
        reason: "Frequently added by customers",
      };

      addAccessories([accessoryItem]);
      setAddedSkus(prev => new Set(prev).add(product.sku));
    }
    // For tires/wheels, would navigate to PDP (not implemented here)
  };

  // ──────────────────────────────────────────────────────────────────────────
  // PDP Context - Compact horizontal list
  // ──────────────────────────────────────────────────────────────────────────
  if (context === "pdp") {
    return (
      <div className={`rounded-xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">👥</span>
          <h4 className="font-bold text-neutral-900 text-sm">Customers also added</h4>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {products.map((product, index) => {
            const config = getProductConfig(product);
            const isAdded = addedSkus.has(product.sku);
            
            return (
              <button
                key={product.sku}
                onClick={() => handleAddToCart(product, index)}
                disabled={isAdded}
                className={`
                  inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all
                  ${isAdded
                    ? "border-green-300 bg-green-50 text-green-700 cursor-default"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
                  }
                `}
              >
                <span>{config.icon}</span>
                <span className="font-medium">{config.displayName}</span>
                {isAdded ? (
                  <span className="text-green-600">✓</span>
                ) : (
                  <span className="text-neutral-400">+</span>
                )}
              </button>
            );
          })}
        </div>
        
        <p className="mt-2 text-xs text-neutral-500">
          Based on what other customers purchased
        </p>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Cart Context - Card style with add buttons
  // ──────────────────────────────────────────────────────────────────────────
  if (context === "cart") {
    return (
      <div className={`rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">✨</span>
          <div>
            <h4 className="font-bold text-neutral-900 text-sm">Complete your setup</h4>
            <p className="text-xs text-neutral-600">Customers also added these items</p>
          </div>
        </div>
        
        <div className="space-y-2">
          {products.map((product, index) => {
            const config = getProductConfig(product);
            const isAdded = addedSkus.has(product.sku);
            
            return (
              <div
                key={product.sku}
                className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{config.icon}</span>
                  <div>
                    <p className="font-semibold text-neutral-900 text-sm">{config.displayName}</p>
                    <p className="text-xs text-neutral-500">{product.brand}</p>
                  </div>
                </div>
                
                <button
                  onClick={() => handleAddToCart(product, index)}
                  disabled={isAdded}
                  className={`
                    rounded-lg px-3 py-1.5 text-sm font-bold transition-all
                    ${isAdded
                      ? "bg-green-100 text-green-700 cursor-default"
                      : "bg-amber-500 text-white hover:bg-amber-600"
                    }
                  `}
                >
                  {isAdded ? "✓ Added" : "Add"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Checkout Context - Minimal, non-intrusive
  // ──────────────────────────────────────────────────────────────────────────
  if (context === "checkout") {
    return (
      <div className={`rounded-lg border border-neutral-200 bg-neutral-50 p-3 ${className}`}>
        <p className="text-sm text-neutral-600 mb-2">
          <span className="font-semibold">Frequently added:</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {products.slice(0, 3).map((product, index) => {
            const config = getProductConfig(product);
            const isAdded = addedSkus.has(product.sku);
            
            return (
              <button
                key={product.sku}
                onClick={() => handleAddToCart(product, index)}
                disabled={isAdded}
                className={`
                  inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all
                  ${isAdded
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
                  }
                `}
              >
                <span>{config.icon}</span>
                <span>{config.displayName}</span>
                {!isAdded && <span className="text-neutral-400">+</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

// ============================================================================
// Export
// ============================================================================

export default CustomersAlsoAdded;
