"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart/CartContext";
import type { CartAccessoryItem, AccessoryCategory } from "@/lib/cart/accessoryTypes";

type Props = {
  sku: string;
  name: string;
  brand?: string;
  category: AccessoryCategory;
  imageUrl?: string;
  unitPrice: number;
  className?: string;
};

export function AccessoryAddToCartButton({
  sku,
  name,
  brand,
  category,
  imageUrl,
  unitPrice,
  className = "",
}: Props) {
  const { addAccessory } = useCart();
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const handleAdd = () => {
    const item: CartAccessoryItem = {
      type: "accessory",
      category,
      sku,
      name,
      brand,
      imageUrl,
      unitPrice,
      quantity,
      required: false,
      reason: "Added from product page",
    };
    
    addAccessory(item);
    setAdded(true);
    
    // Reset after animation
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="flex items-center gap-3">
      {/* Quantity selector */}
      <div className="flex items-center border border-gray-300 rounded-lg">
        <button
          onClick={() => setQuantity(q => Math.max(1, q - 1))}
          className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-l-lg"
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span className="px-4 py-2 font-medium">{quantity}</span>
        <button
          onClick={() => setQuantity(q => Math.min(99, q + 1))}
          className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-r-lg"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
      
      {/* Add to cart button */}
      <button
        onClick={handleAdd}
        disabled={unitPrice <= 0}
        className={`
          ${className}
          ${added ? "bg-green-600 hover:bg-green-600" : ""}
          ${unitPrice <= 0 ? "opacity-50 cursor-not-allowed" : ""}
          transition-colors
        `}
      >
        {added ? "✓ Added to Cart" : unitPrice > 0 ? "Add to Cart" : "Contact for Pricing"}
      </button>
    </div>
  );
}
