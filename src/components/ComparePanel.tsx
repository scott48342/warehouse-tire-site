"use client";

import { useEffect, useCallback } from "react";
import Link from "next/link";
import { useCompare, type CompareItem } from "@/context/CompareContext";

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
  { label: "Price (each)", key: "priceEach", format: formatPrice },
  { label: "Price (set of 4)", key: "priceSet", format: formatPrice },
  { label: "Diameter", key: "diameter", format: (v) => v ? `${v}"` : "—" },
  { label: "Width", key: "width", format: (v) => v ? `${v}"` : "—" },
  { label: "Offset", key: "offset", format: (v) => v ? `${v}mm` : "—" },
  { label: "Bolt Pattern", key: "boltPattern" },
  { label: "Center Bore", key: "centerBore", format: (v) => v ? `${v}mm` : "—" },
  { label: "Fitment", key: "fitmentLevel" },
  { label: "Availability", key: "stockStatus" },
  { label: "Load Rating", key: "loadRating" },
  { label: "Weight", key: "weight", format: (v) => v ? `${v} lbs` : "—" },
];

const TIRE_SPECS: SpecRow[] = [
  { label: "Price (each)", key: "priceEach", format: formatPrice },
  { label: "Price (set of 4)", key: "priceSet", format: formatPrice },
  { label: "Width", key: "width" },
  { label: "Aspect Ratio", key: "aspectRatio" },
  { label: "Diameter", key: "diameter", format: (v) => v ? `${v}"` : "—" },
  { label: "Load Index", key: "loadIndex" },
  { label: "Speed Rating", key: "speedRating" },
  { label: "Treadwear", key: "treadwear" },
  { label: "Traction", key: "traction" },
  { label: "Temperature", key: "temperature" },
  { label: "Category", key: "category" },
  { label: "Availability", key: "stockStatus" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatPrice(value: unknown): string {
  if (typeof value !== "number") return "—";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function ComparePanel() {
  const { items, activeType, isPanelOpen, closePanel, removeItem, clearAll } = useCompare();

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPanelOpen) {
        closePanel();
      }
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
    return () => {
      document.body.style.overflow = "";
    };
  }, [isPanelOpen]);

  if (!isPanelOpen || items.length === 0) {
    return null;
  }

  const specs = activeType === "tire" ? TIRE_SPECS : WHEEL_SPECS;
  
  // Filter specs to only show rows where at least one item has a value
  const visibleSpecs = specs.filter((spec) => hasAnyValue(items, spec.key));

  const typeLabel = activeType === "wheel" ? "Wheels" : "Tires";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={closePanel}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col max-h-[85vh] md:max-h-[80vh] bg-white rounded-t-3xl shadow-2xl animate-slide-up-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-panel-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <svg
                className="h-5 w-5 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                />
              </svg>
            </div>
            <div>
              <h2 id="compare-panel-title" className="text-lg font-bold text-neutral-900">
                Compare {typeLabel}
              </h2>
              <p className="text-sm text-neutral-500">
                {items.length} of 4 {typeLabel.toLowerCase()} selected
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
              aria-label="Close compare panel"
            >
              <svg className="h-6 w-6 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-full">
            {/* Product header row (sticky) */}
            <div className="sticky top-0 z-10 bg-neutral-50 border-b border-neutral-200">
              <div className="grid" style={{ gridTemplateColumns: `180px repeat(${items.length}, minmax(200px, 1fr))` }}>
                {/* Empty corner cell */}
                <div className="p-4 border-r border-neutral-200" />
                
                {/* Product cards */}
                {items.map((item) => (
                  <div key={item.id} className="p-4 border-r border-neutral-200 last:border-r-0">
                    <div className="relative">
                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-neutral-200 text-neutral-400 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm"
                        aria-label={`Remove ${item.brand} ${item.model} from compare`}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>

                      {/* Image */}
                      <div className="aspect-square w-full max-w-[140px] mx-auto mb-3 rounded-xl bg-white border border-neutral-100 overflow-hidden">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={`${item.brand} ${item.model}`}
                            className="h-full w-full object-contain p-2"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-neutral-300">
                            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Brand & Model */}
                      <div className="text-center">
                        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                          {item.brand}
                        </div>
                        <div className="font-bold text-neutral-900 line-clamp-1">
                          {item.model}
                        </div>
                        {item.finish && (
                          <div className="text-sm text-neutral-500 line-clamp-1">
                            {item.finish}
                          </div>
                        )}
                      </div>

                      {/* View details link */}
                      <div className="mt-3 text-center">
                        <Link
                          href={`/wheels/${encodeURIComponent(item.id)}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                          onClick={closePanel}
                        >
                          View details
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Spec rows */}
            <div className="divide-y divide-neutral-100">
              {visibleSpecs.map((spec, rowIndex) => {
                const differs = valuesDiffer(items, spec.key);
                
                return (
                  <div
                    key={spec.key}
                    className={`grid ${rowIndex % 2 === 0 ? "bg-white" : "bg-neutral-50/50"}`}
                    style={{ gridTemplateColumns: `180px repeat(${items.length}, minmax(200px, 1fr))` }}
                  >
                    {/* Label cell */}
                    <div className="p-4 border-r border-neutral-200 flex items-center">
                      <span className="text-sm font-medium text-neutral-600">
                        {spec.label}
                      </span>
                    </div>

                    {/* Value cells */}
                    {items.map((item) => {
                      const value = getValue(item, spec.key);
                      const formatted = formatValue(value, spec.format);
                      const isEmpty = formatted === "—";

                      return (
                        <div
                          key={item.id}
                          className="p-4 border-r border-neutral-200 last:border-r-0 flex items-center justify-center"
                        >
                          <span
                            className={`text-sm text-center ${isEmpty ? "text-neutral-300" : "text-neutral-900"} ${differs && !isEmpty ? "font-semibold text-blue-700" : ""}`}
                          >
                            {formatted}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Empty state for adding more */}
            {items.length < 4 && (
              <div className="p-6 text-center text-sm text-neutral-500">
                Add {4 - items.length} more {typeLabel.toLowerCase()} to compare
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 bg-neutral-50">
          <p className="text-sm text-neutral-500">
            <span className="text-blue-600 font-medium">Tip:</span> Different values are highlighted in blue
          </p>
          <button
            type="button"
            onClick={closePanel}
            className="px-6 py-2.5 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Styles for animations */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slide-up-panel {
          from {
            opacity: 0;
            transform: translateY(100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        
        .animate-slide-up-panel {
          animation: slide-up-panel 0.3s ease-out;
        }
        
        .animate-slide-up {
          animation: slide-up-panel 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
