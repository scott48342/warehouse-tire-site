"use client";

import { useCallback } from "react";
import { useQuickView, type QuickViewTireData, type QuickViewWheelData } from "@/contexts/QuickViewContext";

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK VIEW BUTTON - Eye icon for product cards
// ═══════════════════════════════════════════════════════════════════════════════

type QuickViewButtonProps = {
  /** Product data to display in the modal */
  data: QuickViewTireData | QuickViewWheelData;
  /** Optional size variant */
  size?: "sm" | "md";
  /** Optional className override */
  className?: string;
};

/**
 * Quick View Button - Triggers the quick view modal
 * 
 * Renders as an eye icon button that opens the QuickViewModal
 * with the provided product data.
 */
export function QuickViewButton({ data, size = "sm", className }: QuickViewButtonProps) {
  const { openQuickView } = useQuickView();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      openQuickView(data);
    },
    [data, openQuickView]
  );

  const sizeClasses = size === "sm" 
    ? "h-8 w-8" 
    : "h-10 w-10";

  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        ${sizeClasses}
        flex items-center justify-center rounded-lg
        bg-white/90 backdrop-blur-sm border border-neutral-200
        text-neutral-600 hover:text-neutral-900 hover:bg-white
        shadow-sm hover:shadow-md transition-all duration-200
        ${className || ""}
      `}
      title="Quick View"
      aria-label="Quick View"
    >
      <svg
        className={iconSize}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Build tire data for quick view
// ═══════════════════════════════════════════════════════════════════════════════

export function buildTireQuickViewData(params: {
  sku: string;
  brand: string;
  model: string;
  size: string;
  imageUrl?: string;
  price?: number;
  loadIndex?: string;
  speedRating?: string;
  category?: string;
  season?: string;
  mileageWarranty?: number;
  is3PMSF?: boolean;
  isRunFlat?: boolean;
  stockQty?: number;
  inStock?: boolean;
  source?: string;
  // Vehicle context
  year?: string;
  make?: string;
  vehicleModel?: string;
  trim?: string;
  modification?: string;
}): QuickViewTireData {
  return {
    type: "tire",
    sku: params.sku,
    brand: params.brand,
    model: params.model,
    size: params.size,
    imageUrl: params.imageUrl,
    price: params.price,
    loadIndex: params.loadIndex,
    speedRating: params.speedRating,
    category: params.category,
    season: params.season,
    mileageWarranty: params.mileageWarranty,
    is3PMSF: params.is3PMSF,
    isRunFlat: params.isRunFlat,
    stockQty: params.stockQty,
    inStock: params.inStock,
    source: params.source,
    year: params.year,
    make: params.make,
    vehicleModel: params.vehicleModel,
    trim: params.trim,
    modification: params.modification,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Build wheel data for quick view
// ═══════════════════════════════════════════════════════════════════════════════

export function buildWheelQuickViewData(params: {
  sku: string;
  brand: string;
  model: string;
  finish?: string;
  imageUrl?: string;
  price?: number;
  diameter?: string;
  width?: string;
  offset?: string;
  boltPattern?: string;
  centerbore?: string;
  stockQty?: number;
  inventoryType?: string;
  fitmentClass?: "surefit" | "specfit" | "extended";
  // Vehicle context
  year?: string;
  make?: string;
  vehicleModel?: string;
  trim?: string;
  modification?: string;
}): QuickViewWheelData {
  return {
    type: "wheel",
    sku: params.sku,
    brand: params.brand,
    model: params.model,
    finish: params.finish,
    imageUrl: params.imageUrl,
    price: params.price,
    diameter: params.diameter,
    width: params.width,
    offset: params.offset,
    boltPattern: params.boltPattern,
    centerbore: params.centerbore,
    stockQty: params.stockQty,
    inventoryType: params.inventoryType,
    fitmentClass: params.fitmentClass,
    year: params.year,
    make: params.make,
    vehicleModel: params.vehicleModel,
    trim: params.trim,
    modification: params.modification,
  };
}

export default QuickViewButton;
