"use client";

import React from "react";
import { trackJakeEvent } from "./JakeAnalytics";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CompareProduct {
  type: "tire" | "wheel";
  name: string;
  brand?: string;
  model?: string;
  price?: string;
  priceNum?: number;
  warranty?: string;
  size?: string;
  finish?: string;
  terrain?: string;
  fitmentLabel?: string;
  imageUrl?: string;
  productUrl?: string;
  inStock?: boolean;
  setPrice?: string;
  loadRange?: string;
  speedRating?: string;
}

interface JakeComparePanelProps {
  products: CompareProduct[];
  onRemove: (index: number) => void;
  onClear: () => void;
  onClose: () => void;
  isLocal?: boolean;
  installCostPerTire?: number;
  taxRate?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARE PANEL
// ═══════════════════════════════════════════════════════════════════════════════

export function JakeComparePanel({ 
  products, 
  onRemove, 
  onClear, 
  onClose,
  isLocal = false,
  installCostPerTire = 25,
  taxRate = 0.06,
}: JakeComparePanelProps) {
  if (products.length === 0) return null;

  const isTire = products[0]?.type === "tire";
  const installTotal = installCostPerTire * 4;

  // Spec rows to compare
  const specs = isTire ? [
    { label: "Price (each)", key: "price" },
    ...(isLocal ? [
      { 
        label: "Out the Door (set of 4)", 
        key: "outTheDoor", 
        format: (p: CompareProduct) => {
          const setPrice = (p.priceNum || 0) * 4;
          const subtotal = setPrice + installTotal;
          const tax = subtotal * taxRate;
          const total = subtotal + tax;
          return total > 0 ? `$${total.toFixed(0)}` : "—";
        }
      },
    ] : [
      { label: "Set of 4", key: "setPrice", format: (p: CompareProduct) => p.setPrice || (p.priceNum ? `$${(p.priceNum * 4).toFixed(2)}` : "—") },
    ]),
    { label: "Size", key: "size" },
    { label: "Terrain", key: "terrain" },
    { label: "Warranty", key: "warranty" },
    { label: "Load Range", key: "loadRange" },
    { label: "Speed Rating", key: "speedRating" },
    { label: "In Stock", key: "inStock", format: (p: CompareProduct) => p.inStock ? "✓ Yes" : "—" },
  ] : [
    { label: "Price (each)", key: "price" },
    { label: "Set of 4", key: "setPrice", format: (p: CompareProduct) => p.setPrice || (p.priceNum ? `$${(p.priceNum * 4).toLocaleString()}` : "—") },
    { label: "Size", key: "size" },
    { label: "Finish", key: "finish" },
    { label: "Fitment", key: "fitmentLabel" },
    { label: "In Stock", key: "inStock", format: (p: CompareProduct) => p.inStock ? "✓ Yes" : "—" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-[#111] border border-white/20 rounded-xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="text-white font-bold text-lg">Compare {isTire ? "Tires" : "Wheels"}</h2>
            <p className="text-white/50 text-sm">{products.length} products selected</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClear}
              className="text-white/50 hover:text-white text-sm px-3 py-1.5 rounded hover:bg-white/5 transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={onClose}
              className="text-white/50 hover:text-white p-2 rounded hover:bg-white/5 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Compare Grid */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            {/* Product Headers */}
            <thead className="sticky top-0 bg-[#111] z-10">
              <tr>
                <th className="w-32 p-3 text-left text-white/50 text-xs uppercase tracking-wide border-b border-white/10">
                  Spec
                </th>
                {products.map((product, idx) => (
                  <th key={idx} className="p-3 text-center border-b border-white/10 min-w-[160px]">
                    <div className="relative">
                      <button
                        onClick={() => onRemove(idx)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center text-white text-xs"
                        title="Remove from compare"
                      >
                        ×
                      </button>
                      {/* Product Image */}
                      <div className="w-16 h-16 mx-auto mb-2 bg-white/5 rounded-lg flex items-center justify-center overflow-hidden">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="text-white/20">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                              <circle cx="12" cy="12" r="4" strokeWidth={1.5} />
                            </svg>
                          </div>
                        )}
                      </div>
                      {/* Product Name */}
                      <p className="text-white font-semibold text-sm leading-tight">
                        {product.brand}
                      </p>
                      <p className="text-white/70 text-xs leading-tight">
                        {product.model}
                      </p>
                    </div>
                  </th>
                ))}
                {/* Empty columns for alignment if less than 3 */}
                {Array.from({ length: Math.max(0, 3 - products.length) }).map((_, idx) => (
                  <th key={`empty-${idx}`} className="p-3 min-w-[160px] border-b border-white/10">
                    <div className="w-16 h-16 mx-auto mb-2 bg-white/5 rounded-lg flex items-center justify-center border-2 border-dashed border-white/20">
                      <span className="text-white/30 text-xs">Add</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Spec Rows */}
            <tbody>
              {specs.map((spec, idx) => (
                <tr key={spec.key} className={idx % 2 === 0 ? "bg-white/5" : ""}>
                  <td className="p-3 text-white/50 text-sm font-medium">
                    {spec.label}
                  </td>
                  {products.map((product, pIdx) => {
                    const value = spec.format 
                      ? spec.format(product)
                      : (product as any)[spec.key] || "—";
                    return (
                      <td key={pIdx} className="p-3 text-center text-white text-sm">
                        {value}
                      </td>
                    );
                  })}
                  {/* Empty cells */}
                  {Array.from({ length: Math.max(0, 3 - products.length) }).map((_, idx) => (
                    <td key={`empty-${idx}`} className="p-3 text-center text-white/20">
                      —
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer with CTAs */}
        <div className="px-5 py-4 border-t border-white/10 bg-[#0a0a0a]">
          <div className="flex flex-wrap gap-3 justify-center">
            {products.map((product, idx) => (
              <a
                key={idx}
                href={product.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackJakeEvent("product_clicked", { name: product.name, type: product.type })}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                View {product.brand} →
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARE BUTTON (for product cards)
// ═══════════════════════════════════════════════════════════════════════════════

interface CompareButtonProps {
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function CompareButton({ isSelected, onToggle, disabled }: CompareButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      disabled={disabled && !isSelected}
      className={`px-2 py-1 text-xs rounded transition-all ${
        isSelected
          ? "bg-blue-600 text-white"
          : disabled
            ? "bg-white/5 text-white/30 cursor-not-allowed"
            : "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
      }`}
      title={isSelected ? "Remove from compare" : disabled ? "Max 4 products" : "Add to compare"}
    >
      {isSelected ? "✓ Comparing" : "+ Compare"}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARE FLOATING BAR
// ═══════════════════════════════════════════════════════════════════════════════

interface CompareFloatingBarProps {
  count: number;
  onCompare: () => void;
  onClear: () => void;
}

export function CompareFloatingBar({ count, onCompare, onClear }: CompareFloatingBarProps) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-3">
      <span className="text-sm font-medium">{count} selected</span>
      <button
        onClick={onCompare}
        className="px-3 py-1 bg-white text-blue-600 text-sm font-bold rounded-full hover:bg-blue-50 transition-colors"
      >
        Compare Now
      </button>
      <button
        onClick={onClear}
        className="text-white/70 hover:text-white text-sm"
      >
        Clear
      </button>
    </div>
  );
}

export default JakeComparePanel;
