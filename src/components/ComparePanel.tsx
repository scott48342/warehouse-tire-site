"use client";

import { useEffect, useCallback, useState } from "react";
import Link from "next/link";
import { useCompare, type CompareItem } from "@/context/CompareContext";
import { useCart, type CartWheelItem, type CartTireItem } from "@/lib/cart/CartContext";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type SpecRow = {
  label: string;
  key: keyof CompareItem["compareData"] | "priceEach" | "priceSet";
  format?: (value: unknown) => string;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SPEC CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════════

const WHEEL_SPECS: SpecRow[] = [
  { label: "Diameter", key: "diameter", format: (v) => v ? `${v}"` : "—" },
  { label: "Width", key: "width", format: (v) => v ? `${v}"` : "—" },
  { label: "Offset", key: "offset", format: (v) => v ? `${v}mm` : "—" },
  { label: "Bolt Pattern", key: "boltPattern" },
  { label: "Center Bore", key: "centerBore", format: (v) => v ? `${v}mm` : "—" },
  { label: "Fitment", key: "fitmentLevel" },
  { label: "Load Rating", key: "loadRating" },
  { label: "Weight", key: "weight", format: (v) => v ? `${v} lbs` : "—" },
];

const TIRE_SPECS: SpecRow[] = [
  { label: "Size", key: "size" },
  { label: "Category", key: "category" },
  { label: "Load Index", key: "loadIndex" },
  { label: "Speed Rating", key: "speedRating" },
  { label: "Load Range", key: "loadRange" },
  { label: "Mileage Warranty", key: "mileageWarranty" },
  { label: "UTQG Treadwear", key: "treadwear" },
  { label: "UTQG Traction", key: "traction" },
  { label: "UTQG Temperature", key: "temperature" },
  { label: "3-Peak Mountain", key: "is3PMSF", format: (v) => v === true ? "Yes" : "—" },
  { label: "Extra Load (XL)", key: "isXL", format: (v) => v === true ? "Yes" : "—" },
  { label: "Run-Flat", key: "isRunFlat", format: (v) => v === true ? "Yes" : "—" },
  { label: "Overall Diameter", key: "overallDiameter" },
  { label: "Section Width", key: "sectionWidth" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatPrice(value: unknown): string {
  if (typeof value !== "number") return "—";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getValue(item: CompareItem, key: SpecRow["key"]): unknown {
  if (key === "priceEach") return item.priceEach;
  if (key === "priceSet") return item.priceSet;
  return item.compareData[key as keyof CompareItem["compareData"]];
}

function hasAnyValue(items: CompareItem[], key: SpecRow["key"]): boolean {
  return items.some((item) => {
    const val = getValue(item, key);
    return val !== undefined && val !== null && val !== "";
  });
}

function formatValue(value: unknown, format?: (v: unknown) => string): string {
  if (value === undefined || value === null || value === "") return "—";
  if (format) return format(value);
  return String(value);
}

// Check if values differ across items (for highlighting)
function valuesDiffer(items: CompareItem[], key: SpecRow["key"]): boolean {
  const values = items.map((item) => getValue(item, key)).filter((v) => v !== undefined && v !== null && v !== "");
  if (values.length <= 1) return false;
  const first = String(values[0]);
  return values.some((v) => String(v) !== first);
}

// Convert CompareItem to CartWheelItem
function compareItemToCartWheel(item: CompareItem, quantity: number): CartWheelItem | null {
  if (!item.id || !item.brand || !item.model) return null;
  
  const unitPrice = item.priceEach;
  if (typeof unitPrice !== "number" || unitPrice <= 0) return null;

  let fitmentClass: CartWheelItem["fitmentClass"] = undefined;
  const fitmentLevel = item.compareData.fitmentLevel?.toLowerCase();
  if (fitmentLevel?.includes("guaranteed") || fitmentLevel?.includes("surefit")) {
    fitmentClass = "surefit";
  } else if (fitmentLevel?.includes("good") || fitmentLevel?.includes("specfit")) {
    fitmentClass = "specfit";
  } else if (fitmentLevel?.includes("custom") || fitmentLevel?.includes("extended")) {
    fitmentClass = "extended";
  }

  return {
    type: "wheel",
    sku: item.id,
    brand: item.brand,
    model: item.model,
    finish: item.finish,
    diameter: item.compareData.diameter,
    width: item.compareData.width,
    offset: item.compareData.offset,
    boltPattern: item.compareData.boltPattern,
    imageUrl: item.imageUrl,
    unitPrice,
    quantity,
    fitmentClass,
  };
}

// Convert CompareItem to CartTireItem
function compareItemToCartTire(item: CompareItem, quantity: number): CartTireItem | null {
  if (!item.id || !item.brand || !item.model) return null;
  
  const unitPrice = item.priceEach;
  if (typeof unitPrice !== "number" || unitPrice <= 0) return null;

  // Build size string from available data
  const size = item.compareData.size || 
    (item.compareData.width && item.compareData.aspectRatio && item.compareData.diameter
      ? `${item.compareData.width}/${item.compareData.aspectRatio}R${item.compareData.diameter}`
      : "");

  return {
    type: "tire",
    sku: item.id,
    brand: item.brand,
    model: item.model,
    size,
    loadIndex: item.compareData.loadIndex,
    speedRating: item.compareData.speedRating,
    imageUrl: item.imageUrl,
    unitPrice,
    quantity,
    source: item.compareData.source,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT CARD COMPONENT (Vertical Layout)
// ═══════════════════════════════════════════════════════════════════════════════

function ProductCard({ 
  item, 
  onRemove,
  onClose,
  activeType 
}: { 
  item: CompareItem; 
  onRemove: () => void;
  onClose: () => void;
  activeType: "wheel" | "tire";
}) {
  const { addItem, setIsOpen } = useCart();
  const [quantity, setQuantity] = useState(4);
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  // Get cart item based on type
  const cartItem = activeType === "wheel" 
    ? compareItemToCartWheel(item, quantity)
    : compareItemToCartTire(item, quantity);
  const canAdd = cartItem !== null;
  const unitPrice = item.priceEach;
  const totalPrice = typeof unitPrice === "number" ? unitPrice * quantity : null;

  // Build product link based on type
  const productLink = (() => {
    if (activeType === "wheel") {
      return `/wheels/${encodeURIComponent(item.id)}`;
    }
    // For tires, include source and size params if available
    const params = new URLSearchParams();
    const source = item.compareData?.source;
    const size = item.compareData?.size;
    if (source?.startsWith("tireweb") || source === "tw") {
      params.set("source", "tireweb");
    }
    if (size) {
      params.set("size", size);
    }
    const queryString = params.toString();
    return `/tires/${encodeURIComponent(item.id)}${queryString ? `?${queryString}` : ""}`;
  })();

  const handleAddToCart = useCallback(() => {
    if (!cartItem) return;
    setIsAdding(true);
    setTimeout(() => {
      addItem({ ...cartItem, quantity }, "compare");
      setIsAdding(false);
      setJustAdded(true);
      setIsOpen(true);
      setTimeout(() => setJustAdded(false), 2000);
    }, 150);
  }, [cartItem, quantity, addItem, setIsOpen]);

  return (
    <div className="relative flex flex-col bg-white border border-neutral-200 rounded-xl overflow-hidden">
      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 border border-neutral-200 text-neutral-400 hover:text-red-600 hover:border-red-300 transition-colors shadow-sm"
        aria-label={`Remove ${item.brand} ${item.model}`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Image - Large and prominent */}
      <div className="relative bg-gradient-to-b from-neutral-50 to-white p-4 sm:p-6">
        <div className="aspect-square w-full max-w-[160px] sm:max-w-[200px] mx-auto">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={`${item.brand} ${item.model}`}
              className="h-full w-full object-contain drop-shadow-md"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-neutral-300 bg-neutral-100 rounded-lg">
              <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Product Info */}
      <div className="flex-1 px-4 pb-2">
        {/* Brand & Model */}
        <div className="mb-2">
          <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            {item.brand}
          </div>
          <Link
            href={productLink}
            onClick={onClose}
            className="text-base sm:text-lg font-bold text-neutral-900 hover:text-blue-600 transition-colors line-clamp-1"
          >
            {item.model}
          </Link>
          {/* Wheel finish */}
          {activeType === "wheel" && item.finish && (
            <div className="text-xs text-neutral-400 line-clamp-1">{item.finish}</div>
          )}
          {/* Tire size and category */}
          {activeType === "tire" && (
            <>
              {item.compareData.size && (
                <div className="text-sm font-medium text-neutral-700">{item.compareData.size}</div>
              )}
              {item.compareData.category && (
                <div className="text-xs text-neutral-500">{item.compareData.category}</div>
              )}
            </>
          )}
        </div>

        {/* Stock Status */}
        {item.compareData.stockStatus && (
          <div className="flex items-center gap-1.5 text-xs text-green-600 mb-3">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{item.compareData.stockStatus}</span>
          </div>
        )}

        {/* Price */}
        <div className="mb-3">
          <span className="text-2xl sm:text-3xl font-bold text-neutral-900">
            {typeof unitPrice === "number" ? `$${unitPrice.toLocaleString()}` : "—"}
          </span>
          <span className="text-sm text-neutral-500 ml-1">/ea</span>
        </div>
      </div>

      {/* Add to Cart Section - works for both wheels and tires */}
      {canAdd && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2">
            {/* Quantity Selector */}
            <div className="flex items-center border border-neutral-300 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3 py-2 text-neutral-600 hover:bg-neutral-100 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                </svg>
              </button>
              <span className="px-3 py-2 text-sm font-semibold text-neutral-900 min-w-[40px] text-center bg-neutral-50">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(Math.min(8, quantity + 1))}
                className="px-3 py-2 text-neutral-600 hover:bg-neutral-100 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {/* Add to Cart Button */}
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isAdding}
              className={`flex-1 py-2.5 px-4 text-sm font-bold rounded-lg transition-all duration-200 ${
                justAdded
                  ? "bg-green-600 text-white"
                  : isAdding
                    ? "bg-neutral-300 text-neutral-500 cursor-wait"
                    : "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] shadow-sm"
              }`}
            >
              {justAdded ? (
                "Added!"
              ) : isAdding ? (
                "Adding..."
              ) : (
                <span className="flex flex-col items-center leading-tight">
                  <span>ADD TO CART</span>
                  {totalPrice && (
                    <span className="text-xs font-normal opacity-90">
                      (${totalPrice.toLocaleString()})
                    </span>
                  )}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Price unavailable state */}
      {!canAdd && (
        <div className="px-4 pb-4">
          <div className="py-2.5 px-4 text-sm font-medium text-neutral-400 bg-neutral-100 rounded-lg text-center">
            Price unavailable
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY SLOT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function EmptySlot() {
  return (
    <div className="flex flex-col items-center justify-center bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-xl min-h-[300px] sm:min-h-[400px]">
      <div className="text-neutral-300 mb-3">
        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <span className="text-sm font-medium text-neutral-400">Add to compare</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPECS COMPARISON SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function SpecsComparison({ items, activeType }: { items: CompareItem[]; activeType: "wheel" | "tire" }) {
  const specs = activeType === "tire" ? TIRE_SPECS : WHEEL_SPECS;
  const specsWithValues = specs.filter((spec) => hasAnyValue(items, spec.key));

  if (specsWithValues.length === 0) return null;

  return (
    <div className="mt-6 border-t border-neutral-200 pt-6">
      <h3 className="text-lg font-bold text-neutral-900 mb-4 px-4">
        Specifications
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide px-4 py-2 w-32">
                Spec
              </th>
              {items.map((item) => (
                <th key={item.id} className="text-center text-xs font-semibold text-neutral-500 uppercase tracking-wide px-4 py-2 min-w-[140px]">
                  {item.model}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {specsWithValues.map((spec, idx) => {
              const differs = valuesDiffer(items, spec.key);
              return (
                <tr key={spec.key} className={idx % 2 === 1 ? "bg-neutral-50/50" : ""}>
                  <td className="text-xs font-medium text-neutral-600 px-4 py-2.5">
                    {spec.label}
                  </td>
                  {items.map((item) => {
                    const value = getValue(item, spec.key);
                    const formatted = formatValue(value, spec.format);
                    const isEmpty = formatted === "—";
                    return (
                      <td 
                        key={item.id} 
                        className={`text-center text-sm px-4 py-2.5 ${
                          isEmpty ? "text-neutral-300" : "text-neutral-800"
                        } ${differs && !isEmpty ? "font-semibold text-blue-700" : ""}`}
                      >
                        {formatted}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function ComparePanel() {
  const { items, activeType, isPanelOpen, closePanel, removeItem, clearAll } = useCompare();

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPanelOpen) closePanel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isPanelOpen, closePanel]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isPanelOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isPanelOpen]);

  if (!isPanelOpen || items.length === 0 || !activeType) return null;

  const currentType: "wheel" | "tire" = activeType;
  const typeLabel = currentType === "wheel" ? "Wheels" : "Tires";
  const emptySlots = Math.max(0, 4 - items.length);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={closePanel}
        aria-hidden="true"
      />

      {/* Modal Panel */}
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6 lg:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-panel-title"
      >
        <div 
          className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl animate-slide-up-panel my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 rounded-t-2xl px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="compare-panel-title" className="text-xl sm:text-2xl font-bold text-neutral-900">
                  Compare {typeLabel}
                </h2>
                <p className="text-sm text-neutral-500 mt-0.5">
                  Select up to 4 {typeLabel.toLowerCase()} to compare
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={clearAll}
                  className="px-3 py-1.5 text-sm font-medium text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={closePanel}
                  className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-100 transition-colors"
                  aria-label="Close"
                >
                  <svg className="h-6 w-6 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6">
            {/* Product Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {items.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  onRemove={() => removeItem(item.id)}
                  onClose={closePanel}
                  activeType={currentType}
                />
              ))}
              
              {/* Empty slots */}
              {emptySlots > 0 && Array.from({ length: Math.min(emptySlots, 2) }).map((_, i) => (
                <EmptySlot key={`empty-${i}`} />
              ))}
            </div>

            {/* Specs Comparison Table */}
            <SpecsComparison items={items} activeType={currentType} />
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-neutral-200 rounded-b-2xl px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-neutral-500 hidden sm:block">
                <span className="text-blue-600 font-medium">Tip:</span> Different values are highlighted in blue
              </p>
              <button
                type="button"
                onClick={closePanel}
                className="ml-auto px-6 py-2.5 bg-neutral-900 text-white font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Styles */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slide-up-panel {
          from {
            opacity: 0;
            transform: translate3d(0, 20px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
        
        .animate-slide-up-panel {
          animation: slide-up-panel 0.3s ease-out forwards;
        }
      `}</style>
    </>
  );
}
