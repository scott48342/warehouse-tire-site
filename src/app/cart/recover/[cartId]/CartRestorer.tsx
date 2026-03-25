"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";

interface CartRestorerProps {
  cartId: string;
  items: any[];
}

/**
 * Client component that restores cart items from recovered cart data.
 * 
 * Handles:
 * - Clearing existing cart (optional, based on user choice)
 * - Restoring items to cart context
 * - Setting cart ID for tracking
 * - Redirecting to checkout
 */
export function CartRestorer({ cartId, items }: CartRestorerProps) {
  const router = useRouter();
  const { items: existingItems, addItem, clearCart } = useCart();
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasExistingItems = existingItems.length > 0;

  const handleRestore = async (clearExisting: boolean = true) => {
    try {
      setRestoring(true);
      setError(null);

      // Clear existing cart if requested
      if (clearExisting) {
        clearCart();
      }

      // Restore cart ID for tracking
      if (typeof window !== "undefined") {
        localStorage.setItem("wt_cart_id", cartId);
      }

      // Add items to cart
      for (const item of items) {
        // Ensure item has required fields
        if (item && item.sku && item.unitPrice !== undefined) {
          addItem({
            ...item,
            type: item.type || "wheel", // Default to wheel if not specified
          });
        }
      }

      // Small delay to ensure cart context updates
      await new Promise(resolve => setTimeout(resolve, 100));

      // Redirect to checkout
      router.push("/checkout");
    } catch (err: any) {
      console.error("[CartRestorer] Error restoring cart:", err);
      setError(err.message || "Failed to restore cart");
      setRestoring(false);
    }
  };

  // Auto-restore if no existing items
  useEffect(() => {
    if (!hasExistingItems && items.length > 0 && !restoring) {
      handleRestore(false);
    }
  }, [hasExistingItems, items.length]);

  if (restoring) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="animate-spin w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full mx-auto mb-4" />
        <p className="text-neutral-600">Restoring your cart...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-red-700">{error}</p>
        </div>
        <button
          onClick={() => handleRestore(true)}
          className="w-full h-12 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Show choice if user has existing items
  if (hasExistingItems) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-amber-800 text-sm">
            <strong>Note:</strong> You already have {existingItems.length} item(s) in your current cart.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleRestore(true)}
            className="w-full h-12 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors"
          >
            Replace Cart & Continue
          </button>
          
          <button
            onClick={() => handleRestore(false)}
            className="w-full h-12 bg-neutral-100 text-neutral-700 font-semibold rounded-xl hover:bg-neutral-200 transition-colors"
          >
            Add to Existing Cart
          </button>

          <button
            onClick={() => router.push("/cart")}
            className="w-full h-10 text-neutral-500 hover:text-neutral-700 text-sm transition-colors"
          >
            Keep current cart instead
          </button>
        </div>
      </div>
    );
  }

  // Default: show restore button (shouldn't normally see this due to auto-restore)
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <button
        onClick={() => handleRestore(true)}
        className="w-full h-14 bg-red-600 text-white font-bold text-lg rounded-xl hover:bg-red-700 transition-colors shadow-lg"
      >
        Resume My Order →
      </button>
    </div>
  );
}

export default CartRestorer;
