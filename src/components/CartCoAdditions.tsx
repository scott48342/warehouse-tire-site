"use client";

import { useState, useEffect } from "react";
import { useCart, type CartAccessoryItem } from "@/lib/cart/CartContext";
import { trackEvent } from "@/lib/analytics";
import type { CoAddedProduct } from "@/lib/analytics/coPurchase";

// ============================================================================
// Types
// ============================================================================

interface CartCoAdditionsProps {
  /** Custom className */
  className?: string;
}

// ============================================================================
// Category Display Config
// ============================================================================

const PRODUCT_CONFIG: Record<string, { icon: string; displayName?: string }> = {
  tpms: { icon: "📡", displayName: "TPMS Sensors" },
  "lug nut": { icon: "🔩", displayName: "Lug Nuts" },
  "hub ring": { icon: "⚙️", displayName: "Hub Rings" },
  "valve stem": { icon: "🔧", displayName: "Valve Stems" },
  tire: { icon: "🛞" },
  wheel: { icon: "⚙️" },
  accessory: { icon: "🔧" },
};

function getProductConfig(product: CoAddedProduct): { icon: string; displayName: string } {
  const nameLower = product.productName.toLowerCase();
  
  for (const [key, config] of Object.entries(PRODUCT_CONFIG)) {
    if (nameLower.includes(key)) {
      return {
        icon: config.icon,
        displayName: config.displayName || product.productName,
      };
    }
  }
  
  const typeConfig = PRODUCT_CONFIG[product.productType] || { icon: "📦" };
  return {
    icon: typeConfig.icon,
    displayName: product.productName,
  };
}

// ============================================================================
// Main Component
// ============================================================================

export function CartCoAdditions({ className = "" }: CartCoAdditionsProps) {
  const { items, addAccessories } = useCart();
  const [products, setProducts] = useState<CoAddedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedSkus, setAddedSkus] = useState<Set<string>>(new Set());

  // Get SKUs from cart
  const cartSkus = items
    .filter(i => i.type === "wheel" || i.type === "tire")
    .map(i => i.sku)
    .filter(Boolean);

  // SKUs already in cart (to exclude from recommendations)
  const allCartSkus = new Set(items.map(i => i.sku));

  // Fetch recommendations when cart changes
  useEffect(() => {
    if (cartSkus.length === 0) {
      setProducts([]);
      return;
    }

    const fetchRecommendations = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/analytics/co-purchase?skus=${cartSkus.join(",")}&limit=4`);
        if (res.ok) {
          const data = await res.json();
          // Filter out items already in cart
          const filtered = (data.products || []).filter(
            (p: CoAddedProduct) => !allCartSkus.has(p.sku)
          );
          setProducts(filtered);
        }
      } catch (err) {
        console.error("[CartCoAdditions] Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [cartSkus.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Don't render if no recommendations or loading
  if (loading || products.length === 0) {
    return null;
  }

  const handleAddToCart = (product: CoAddedProduct, position: number) => {
    // Track the click
    trackEvent("co_add_product_click", {
      context: "cart",
      clicked_sku: product.sku,
      position,
    });

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
      unitPrice: 49.99, // Default - would be fetched in production
      quantity: 4,
      required: false,
      reason: "Frequently added by customers",
    };

    addAccessories([accessoryItem]);
    setAddedSkus(prev => new Set(prev).add(product.sku));
    
    // Remove from display after adding
    setTimeout(() => {
      setProducts(prev => prev.filter(p => p.sku !== product.sku));
    }, 1000);
  };

  return (
    <div className={`rounded-xl border border-neutral-200 bg-white p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">👥</span>
        <div>
          <h4 className="font-bold text-neutral-900 text-sm">Customers also added</h4>
        </div>
      </div>
      
      <div className="space-y-2">
        {products.map((product, index) => {
          const config = getProductConfig(product);
          const isAdded = addedSkus.has(product.sku);
          
          return (
            <div
              key={product.sku}
              className="flex items-center justify-between gap-3 rounded-lg border border-neutral-100 bg-neutral-50 p-2.5"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg">{config.icon}</span>
                <div>
                  <p className="font-semibold text-neutral-900 text-sm">{config.displayName}</p>
                  <p className="text-xs text-neutral-500">{product.brand}</p>
                </div>
              </div>
              
              <button
                onClick={() => handleAddToCart(product, index)}
                disabled={isAdded}
                className={`
                  rounded-lg px-3 py-1.5 text-xs font-bold transition-all
                  ${isAdded
                    ? "bg-green-100 text-green-700 cursor-default"
                    : "bg-neutral-900 text-white hover:bg-neutral-800"
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

export default CartCoAdditions;
