"use client";

/**
 * AccessoryRecommendations Component
 * 
 * Displays lug nut and hub ring recommendations after wheel selection.
 * Shows required vs optional status with clear explanations.
 */

import { useState } from "react";
import type { CartAccessoryItem, AccessoryRecommendationState } from "@/lib/cart/accessoryTypes";

interface AccessoryRecommendationsProps {
  state: AccessoryRecommendationState | null;
  onAddAccessory?: (item: CartAccessoryItem) => void;
  onAddAllRequired?: (items: CartAccessoryItem[]) => void;
  compact?: boolean;
  className?: string;
}

export function AccessoryRecommendations({
  state,
  onAddAccessory,
  onAddAllRequired,
  compact = false,
  className = "",
}: AccessoryRecommendationsProps) {
  const [addedSkus, setAddedSkus] = useState<Set<string>>(new Set());

  if (!state) return null;

  const requiredItems = [
    ...state.lugNuts.items.filter((i) => i.required),
    ...state.hubRings.items.filter((i) => i.required),
  ];

  const hasRequired = requiredItems.length > 0;
  const totalRequiredPrice = requiredItems.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity,
    0
  );

  const handleAddItem = (item: CartAccessoryItem) => {
    onAddAccessory?.(item);
    setAddedSkus((prev) => new Set([...prev, item.sku]));
  };

  const handleAddAllRequired = () => {
    onAddAllRequired?.(requiredItems);
    setAddedSkus((prev) => new Set([...prev, ...requiredItems.map((i) => i.sku)]));
  };

  if (compact) {
    // Compact view for cart slideout
    return (
      <div className={`rounded-xl border border-amber-200 bg-amber-50 p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-amber-600">⚙️</span>
              <span className="text-sm font-bold text-amber-900">
                Installation Accessories
              </span>
            </div>
            {hasRequired && (
              <div className="mt-1 text-xs text-amber-700">
                {requiredItems.length} required item{requiredItems.length !== 1 ? "s" : ""} •{" "}
                ${totalRequiredPrice.toFixed(2)}
              </div>
            )}
          </div>
          {hasRequired && !addedSkus.has(requiredItems[0]?.sku) && (
            <button
              onClick={handleAddAllRequired}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
            >
              Add Required
            </button>
          )}
          {hasRequired && addedSkus.has(requiredItems[0]?.sku) && (
            <span className="text-xs font-semibold text-green-600">✓ Added</span>
          )}
        </div>
      </div>
    );
  }

  // Full view for package builder
  return (
    <div className={`rounded-2xl border border-neutral-200 bg-white overflow-hidden ${className}`}>
      {/* Header */}
      <div className="border-b border-neutral-100 bg-gradient-to-r from-amber-50 to-white px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
            <span className="text-lg">⚙️</span>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-neutral-900">
              Installation Accessories
            </h3>
            <p className="text-sm text-neutral-600">
              Required for proper wheel installation
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        {/* Lug Nuts Section */}
        <AccessorySection
          title="Lug Nuts"
          icon="🔩"
          status={state.lugNuts.status}
          reason={state.lugNuts.reason}
          items={state.lugNuts.items}
          addedSkus={addedSkus}
          onAddItem={handleAddItem}
        />

        {/* Hub Rings Section */}
        <AccessorySection
          title="Hub Centric Rings"
          icon="🔘"
          status={state.hubRings.status}
          reason={state.hubRings.reason}
          items={state.hubRings.items}
          addedSkus={addedSkus}
          onAddItem={handleAddItem}
        />

        {/* Add All Required Button */}
        {hasRequired && (
          <div className="pt-3 border-t border-neutral-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-neutral-900">
                  Total Required: ${totalRequiredPrice.toFixed(2)}
                </div>
                <div className="text-xs text-neutral-500">
                  {requiredItems.length} item{requiredItems.length !== 1 ? "s" : ""} for proper installation
                </div>
              </div>
              {!requiredItems.every((i) => addedSkus.has(i.sku)) ? (
                <button
                  onClick={handleAddAllRequired}
                  className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-amber-700 transition-colors"
                >
                  Add All Required
                </button>
              ) : (
                <span className="flex items-center gap-2 text-sm font-semibold text-green-600">
                  <span>✓</span> All Required Added
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Accessory Section Subcomponent
// ============================================================================

interface AccessorySectionProps {
  title: string;
  icon: string;
  status: string;
  reason: string;
  items: CartAccessoryItem[];
  addedSkus: Set<string>;
  onAddItem: (item: CartAccessoryItem) => void;
}

function AccessorySection({
  title,
  icon,
  status,
  reason,
  items,
  addedSkus,
  onAddItem,
}: AccessorySectionProps) {
  const isRequired = status === "required";
  const isSkipped = status === "skipped";
  const isNotNeeded = status === "not_needed" || status === "optional";

  return (
    <div
      className={`rounded-xl border p-4 ${
        isRequired
          ? "border-red-200 bg-red-50"
          : isSkipped
            ? "border-neutral-200 bg-neutral-50"
            : "border-green-200 bg-green-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-xl">{icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-neutral-900">{title}</span>
              {isRequired && (
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  REQUIRED
                </span>
              )}
              {isNotNeeded && (
                <span className="rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  NOT NEEDED
                </span>
              )}
              {isSkipped && (
                <span className="rounded-full bg-neutral-400 px-2 py-0.5 text-[10px] font-bold text-white">
                  INFO NEEDED
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-neutral-600">{reason}</p>
          </div>
        </div>
      </div>

      {/* Items */}
      {items.length > 0 && (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div
              key={item.sku}
              className="flex items-center justify-between rounded-lg bg-white p-3 border border-neutral-200"
            >
              <div>
                <div className="text-sm font-semibold text-neutral-900">
                  {item.name}
                </div>
                <div className="text-xs text-neutral-500">
                  Qty: {item.quantity} • ${item.unitPrice.toFixed(2)} each
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-neutral-900">
                  ${(item.unitPrice * item.quantity).toFixed(2)}
                </span>
                {addedSkus.has(item.sku) ? (
                  <span className="text-xs font-semibold text-green-600">✓ Added</span>
                ) : (
                  <button
                    onClick={() => onAddItem(item)}
                    className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-neutral-800"
                  >
                    Add
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Skipped state guidance */}
      {isSkipped && (
        <div className="mt-3 rounded-lg bg-white p-3 border border-neutral-200">
          <p className="text-xs text-neutral-600">
            Vehicle specification data not available. Please verify lug nut thread size and hub bore
            before installation, or contact us for assistance.
          </p>
        </div>
      )}
    </div>
  );
}

export default AccessoryRecommendations;
