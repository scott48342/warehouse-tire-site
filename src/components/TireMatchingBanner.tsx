"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";

type TireSize = {
  size: string;
  label: string;
  isOem?: boolean;
  isPlusSize?: boolean;
};

type TireMatchingBannerProps = {
  wheelDiameter?: string;
  wheelWidth?: string;
  wheelSku?: string;
  oemSizes: string[];
  plusSizes?: string[];
  selectedSize?: string;
  vehicle?: {
    year: string;
    make: string;
    model: string;
    trim?: string;
    modification?: string;
  };
  baseUrl: string;
};

export function TireMatchingBanner({
  wheelDiameter,
  wheelWidth,
  wheelSku,
  oemSizes,
  plusSizes = [],
  selectedSize,
  vehicle,
  baseUrl,
}: TireMatchingBannerProps) {
  const { getWheels, getTotal, hasWheels, hasTires } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const wheels = mounted ? getWheels() : [];
  const cartWheel = wheels[0];
  const cartTotal = mounted ? getTotal() : 0;

  // Only show if there's wheel context (from URL or cart)
  const hasWheelContext = Boolean(wheelSku || wheelDiameter || cartWheel);
  if (!hasWheelContext) return null;

  const wheelInCart = Boolean(cartWheel);
  const effectiveWheel = cartWheel || {
    brand: "Your Wheel",
    model: wheelSku || "",
    diameter: wheelDiameter,
    width: wheelWidth,
    imageUrl: undefined,
    unitPrice: 0,
    quantity: 4,
  };

  // Build recommended sizes with labels
  const recommendedSizes: TireSize[] = [];

  // Add OEM sizes first
  oemSizes.slice(0, 2).forEach((size, idx) => {
    recommendedSizes.push({
      size,
      label: idx === 0 ? "OEM Recommended" : "OEM Option",
      isOem: true,
    });
  });

  // Add plus sizes
  plusSizes.slice(0, 2).forEach((size) => {
    recommendedSizes.push({
      size,
      label: "Plus Size",
      isPlusSize: true,
    });
  });

  // Build URL for size selection
  function getSizeUrl(size: string) {
    const params = new URLSearchParams();
    if (vehicle?.year) params.set("year", vehicle.year);
    if (vehicle?.make) params.set("make", vehicle.make);
    if (vehicle?.model) params.set("model", vehicle.model);
    if (vehicle?.trim) params.set("trim", vehicle.trim);
    if (vehicle?.modification) params.set("modification", vehicle.modification);
    if (wheelSku) params.set("wheelSku", wheelSku);
    if (wheelDiameter) params.set("wheelDia", wheelDiameter);
    if (wheelWidth) params.set("wheelWidth", wheelWidth);
    params.set("size", size);
    return `${baseUrl}?${params.toString()}`;
  }

  // Note: Wheel summary is now shown in TirePageCompactHeader
  // This component focuses on tire size selection only to avoid duplication
  
  return (
    <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4">
      {/* Size Selection - Primary Focus */}
      {recommendedSizes.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🛞</span>
              <span className="text-sm font-bold text-neutral-900">
                Select tire size for your {effectiveWheel.diameter}" wheels
              </span>
            </div>
            <Link
              href="/cart"
              className="text-xs text-neutral-500 hover:text-neutral-700 hover:underline"
            >
              Skip →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {recommendedSizes.map((ts) => {
              const isActive = ts.size === selectedSize;
              return (
                <Link
                  key={ts.size}
                  href={getSizeUrl(ts.size)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-neutral-900 text-white"
                      : ts.isOem
                        ? "border border-green-300 bg-green-50 text-green-900 hover:bg-green-100"
                        : "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                  }`}
                >
                  <span className="font-bold">{ts.size}</span>
                  {!isActive && (
                    <span className="ml-2 text-xs opacity-75">{ts.label}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Package Summary (when tires in cart) */}
      {mounted && hasTires() ? (
        <div className="mt-3 rounded-lg bg-green-50 border border-green-200 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span className="text-sm font-bold text-green-900">Package Ready</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-extrabold text-green-900">
                ${cartTotal.toFixed(2)}
              </span>
              <Link
                href="/package/review"
                className="text-xs font-bold text-green-700 hover:underline"
              >
                Review →
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
