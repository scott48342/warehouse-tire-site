"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCart, type CartTireItem } from "@/lib/cart/CartContext";

/**
 * Cart prefill page for AI-assisted sales.
 * 
 * URL: /cart/prefill?data=<base64url-encoded-cart-data>
 * 
 * Decodes the cart data, adds items to cart, and redirects to /cart
 */
export default function CartPrefillPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addTire } = useCart();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Loading your cart...");

  useEffect(() => {
    const data = searchParams.get("data");
    
    if (!data) {
      setStatus("error");
      setMessage("No cart data provided");
      return;
    }

    try {
      // Decode base64url (browser-compatible)
      // Convert base64url to standard base64
      const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(base64));
      
      if (!decoded.items || !Array.isArray(decoded.items)) {
        throw new Error("Invalid cart data format");
      }

      // Add each item to cart
      let addedCount = 0;
      for (const item of decoded.items) {
        if (item.type === "tire" || !item.type) {
          const cartItem: CartTireItem = {
            type: "tire",
            sku: item.sku,
            brand: item.brand || "Unknown",
            model: item.model || "Tire",
            size: item.size || "",
            imageUrl: item.imageUrl,
            unitPrice: typeof item.price === "number" ? item.price : parseFloat(item.price) || 0,
            quantity: item.quantity || 4,
            vehicle: decoded.vehicle,
          };
          addTire(cartItem);
          addedCount++;
        }
        // TODO: Add wheel support if needed
      }

      setStatus("success");
      setMessage(`Added ${addedCount} item${addedCount !== 1 ? "s" : ""} to your cart!`);
      
      // Redirect to cart after brief delay to show success
      setTimeout(() => {
        router.push("/cart");
      }, 1000);

    } catch (err) {
      console.error("[CartPrefill] Error:", err);
      setStatus("error");
      setMessage("Failed to load cart. Please try again.");
    }
  }, [searchParams, addTire, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8">
        {status === "loading" && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4" />
            <p className="text-lg text-gray-600">{message}</p>
          </>
        )}
        
        {status === "success" && (
          <>
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <p className="text-lg text-gray-800 font-medium">{message}</p>
            <p className="text-sm text-gray-500 mt-2">Redirecting to your cart...</p>
          </>
        )}
        
        {status === "error" && (
          <>
            <div className="text-red-500 text-5xl mb-4">✕</div>
            <p className="text-lg text-gray-800">{message}</p>
            <button 
              onClick={() => router.push("/cart")}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Go to Cart
            </button>
          </>
        )}
      </div>
    </div>
  );
}
