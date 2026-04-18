"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart/CartContext";
import type { CartAccessoryItem } from "@/lib/cart/accessoryTypes";

interface SuspensionProduct {
  sku: string;
  productDesc: string;
  brand: string;
  productType: string | null;
  liftHeight: number | null;
  liftLevel: string | null;
  make: string;
  model: string;
  yearStart: number;
  yearEnd: number;
  msrp: number | null;
  mapPrice: number | null;
  imageUrl: string | null;
  inStock: boolean;
  inventory: number;
}

interface SuspensionAddToCartProps {
  product: SuspensionProduct;
  vehicleContext: { year: string; make: string; model: string } | null;
}

export function SuspensionAddToCart({ product, vehicleContext }: SuspensionAddToCartProps) {
  const { addAccessory, setIsOpen } = useCart();
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const price = product.msrp || product.mapPrice;
  if (!price) return null;

  const handleAddToCart = () => {
    const item: CartAccessoryItem = {
      type: "accessory",
      category: "suspension",
      sku: product.sku,
      name: product.productDesc,
      brand: product.brand,
      imageUrl: product.imageUrl || undefined,
      unitPrice: price,
      quantity,
      required: false,
      reason: product.liftHeight ? `${product.liftHeight}" lift kit` : "Suspension kit",
      spec: {
        liftHeight: product.liftHeight || undefined,
        liftLevel: product.liftLevel || undefined,
        productType: product.productType || undefined,
      },
      vehicle: vehicleContext || {
        year: String(product.yearStart),
        make: product.make,
        model: product.model,
      },
    };

    addAccessory(item);
    setAdded(true);
    setIsOpen(true);

    // Reset after 2 seconds
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Quantity selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-neutral-600">Quantity:</span>
        <div className="flex items-center rounded-xl border border-neutral-200 bg-white">
          <button
            type="button"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="px-4 py-2 text-lg font-bold text-neutral-600 hover:text-neutral-900"
          >
            −
          </button>
          <span className="w-12 text-center text-lg font-bold text-neutral-900">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity(quantity + 1)}
            className="px-4 py-2 text-lg font-bold text-neutral-600 hover:text-neutral-900"
          >
            +
          </button>
        </div>
        {quantity > 1 && (
          <span className="text-sm text-neutral-500">
            Total: ${(price * quantity).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
      </div>

      {/* Add to cart button */}
      <button
        type="button"
        onClick={handleAddToCart}
        disabled={added}
        className={`flex h-14 w-full items-center justify-center gap-2 rounded-xl text-lg font-extrabold transition-colors ${
          added
            ? "bg-green-500 text-white cursor-default"
            : "bg-purple-600 text-white hover:bg-purple-700"
        }`}
      >
        {added ? (
          <>
            <span>✓</span>
            <span>Added to Cart</span>
          </>
        ) : (
          <>
            <span>🛒</span>
            <span>Add to Cart</span>
          </>
        )}
      </button>

      {/* Continue shopping link */}
      <p className="text-center text-sm text-neutral-500">
        Add wheels and tires to complete your lifted build
      </p>
    </div>
  );
}
