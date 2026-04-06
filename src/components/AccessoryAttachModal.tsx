"use client";

/**
 * Accessory Attach Modal
 * 
 * Turns accessory attachment from background logic into a clear,
 * guided decision moment. Shows when user adds wheels/packages.
 * 
 * Key features:
 * - Preselects lugs + hub rings (required)
 * - TPMS optional (not forced)
 * - Clear 1-line explanations
 * - Add All / Choose / Skip options
 * - Falls back gracefully if dismissed
 * 
 * @created 2026-04-06
 */

import { useState, useEffect, useCallback } from "react";
import type { CartAccessoryItem } from "@/lib/cart/accessoryTypes";

// ============================================================================
// Types
// ============================================================================

export interface AccessoryOption {
  /** Accessory item data */
  item: CartAccessoryItem;
  /** Display label */
  label: string;
  /** 1-line explanation */
  description: string;
  /** Icon/emoji */
  icon: string;
  /** Is this preselected by default? */
  preselected: boolean;
  /** Is this truly required (can't be unchecked)? */
  required: boolean;
}

interface AccessoryAttachModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Available accessories to present */
  accessories: AccessoryOption[];
  /** Called when user confirms selection */
  onConfirm: (selectedItems: CartAccessoryItem[]) => void;
  /** Called when user skips (for analytics) */
  onSkip?: () => void;
  /** Wheel info for context */
  wheelInfo?: {
    name: string;
    quantity: number;
  };
}

// ============================================================================
// Helper: Build accessory options from fitment result
// ============================================================================

export function buildAccessoryOptions(
  requiredItems: CartAccessoryItem[],
  optionalItems?: CartAccessoryItem[]
): AccessoryOption[] {
  const options: AccessoryOption[] = [];

  // Process required items
  for (const item of requiredItems) {
    const option = itemToOption(item, true);
    if (option) options.push(option);
  }

  // Process optional items (e.g., TPMS)
  if (optionalItems) {
    for (const item of optionalItems) {
      const option = itemToOption(item, false);
      if (option) options.push(option);
    }
  }

  return options;
}

function itemToOption(item: CartAccessoryItem, isRequired: boolean): AccessoryOption | null {
  switch (item.category) {
    case "lug_nut":
    case "lug_bolt":
      return {
        item,
        label: "Lug Nuts",
        description: "Required to mount your wheels securely",
        icon: "🔩",
        preselected: true,
        required: isRequired,
      };

    case "hub_ring":
      return {
        item,
        label: "Hub Centric Rings",
        description: "Ensures vibration-free, perfectly centered fit",
        icon: "⭕",
        preselected: true,
        required: false, // Can be unchecked even if "required" by fitment
      };

    case "tpms":
      return {
        item,
        label: "TPMS Sensors",
        description: "Monitors tire pressure for safety",
        icon: "📊",
        preselected: false, // Optional by default
        required: false,
      };

    case "valve_stem":
      return {
        item,
        label: "Valve Stems",
        description: "For tire inflation access",
        icon: "🎈",
        preselected: true,
        required: false,
      };

    default:
      return null;
  }
}

// ============================================================================
// Component
// ============================================================================

export function AccessoryAttachModal({
  isOpen,
  onClose,
  accessories,
  onConfirm,
  onSkip,
  wheelInfo,
}: AccessoryAttachModalProps) {
  // Track selected items (initially set based on preselected flag)
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Initialize selection when modal opens
  useEffect(() => {
    if (isOpen) {
      const preselected = new Set<string>();
      for (const opt of accessories) {
        if (opt.preselected) {
          preselected.add(opt.item.sku);
        }
      }
      setSelected(preselected);
    }
  }, [isOpen, accessories]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleSkip();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const toggleItem = useCallback((sku: string, required: boolean) => {
    if (required) return; // Can't toggle required items
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) {
        next.delete(sku);
      } else {
        next.add(sku);
      }
      return next;
    });
  }, []);

  const handleAddAll = useCallback(() => {
    // Select all items
    const all = accessories.map((opt) => opt.item);
    onConfirm(all);
    onClose();
  }, [accessories, onConfirm, onClose]);

  const handleAddSelected = useCallback(() => {
    const selectedItems = accessories
      .filter((opt) => selected.has(opt.item.sku))
      .map((opt) => opt.item);
    onConfirm(selectedItems);
    onClose();
  }, [accessories, selected, onConfirm, onClose]);

  const handleSkip = useCallback(() => {
    onSkip?.();
    onClose();
  }, [onSkip, onClose]);

  if (!isOpen || accessories.length === 0) return null;

  // Calculate totals
  const selectedTotal = accessories
    .filter((opt) => selected.has(opt.item.sku))
    .reduce((sum, opt) => sum + opt.item.unitPrice * opt.item.quantity, 0);

  const allTotal = accessories.reduce(
    (sum, opt) => sum + opt.item.unitPrice * opt.item.quantity,
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="accessory-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleSkip}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md max-h-[90vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="border-b border-neutral-100 bg-gradient-to-br from-green-50 to-emerald-50/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500 text-white shadow-lg shadow-green-500/30">
              <span className="text-lg">✓</span>
            </div>
            <div>
              <h2 id="accessory-modal-title" className="text-lg font-bold text-neutral-900">
                Complete Your Setup
              </h2>
              {wheelInfo && (
                <p className="text-sm text-neutral-600">
                  For your set of {wheelInfo.quantity} {wheelInfo.name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: "calc(90vh - 200px)" }}>
          {/* Accessory Options */}
          <div className="space-y-3">
            {accessories.map((opt) => {
              const isSelected = selected.has(opt.item.sku);
              const itemTotal = opt.item.unitPrice * opt.item.quantity;

              return (
                <button
                  key={opt.item.sku}
                  onClick={() => toggleItem(opt.item.sku, opt.required)}
                  disabled={opt.required}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                    isSelected
                      ? "border-green-500 bg-green-50/50"
                      : "border-neutral-200 bg-white hover:border-neutral-300"
                  } ${opt.required ? "cursor-default" : "cursor-pointer"}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div
                      className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded ${
                        isSelected
                          ? "bg-green-500 text-white"
                          : "border-2 border-neutral-300"
                      }`}
                    >
                      {isSelected && (
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>

                    {/* Icon */}
                    <span className="text-2xl">{opt.icon}</span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-900">{opt.label}</span>
                        {opt.required && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-600">{opt.description}</p>
                      <div className="mt-1 flex items-center gap-2 text-sm">
                        <span className="font-semibold text-neutral-900">
                          ${itemTotal.toFixed(2)}
                        </span>
                        <span className="text-neutral-400">
                          ({opt.item.quantity}× ${opt.item.unitPrice.toFixed(2)})
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bundle hint */}
          <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-blue-800">
              <span>💡</span>
              <span>
                Adding all accessories now saves time during installation
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-4 space-y-2">
          {/* Primary: Add All */}
          <button
            onClick={handleAddAll}
            className="w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 transition-colors shadow-lg shadow-green-600/30"
          >
            Add All Recommended — ${allTotal.toFixed(2)}
          </button>

          {/* Secondary: Add Selected */}
          {selected.size !== accessories.length && (
            <button
              onClick={handleAddSelected}
              className="w-full rounded-xl border-2 border-neutral-200 bg-white py-3 text-sm font-bold text-neutral-900 hover:bg-neutral-50 transition-colors"
            >
              Add Selected — ${selectedTotal.toFixed(2)}
            </button>
          )}

          {/* Tertiary: Skip */}
          <button
            onClick={handleSkip}
            className="w-full py-2 text-sm font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Export
// ============================================================================

export default AccessoryAttachModal;
