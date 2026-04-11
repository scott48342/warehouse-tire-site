"use client";

import { useCallback, useState, useEffect } from "react";
import { useCompare, type CompareItem, type CompareItemType } from "@/context/CompareContext";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type AddToCompareButtonProps = {
  item: CompareItem;
  /** Visual variant */
  variant?: "icon" | "icon-label" | "text";
  /** Size variant */
  size?: "sm" | "md";
  /** Additional class names */
  className?: string;
  /** Callback when item is added */
  onAdd?: () => void;
  /** Callback when item is removed */
  onRemove?: () => void;
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AddToCompareButton({
  item,
  variant = "icon",
  size = "sm",
  className = "",
  onAdd,
  onRemove,
}: AddToCompareButtonProps) {
  const { isInCompare, canAdd, addItem, removeItem, activeType, itemCount } = useCompare();
  
  const isAdded = isInCompare(item.id);
  const canAddThis = canAdd(item.type);
  const isDisabled = !isAdded && !canAddThis;
  const isTypeMismatch = activeType !== null && activeType !== item.type;
  const isMaxReached = itemCount >= 4 && !isAdded;

  // Local state for animation feedback
  const [justChanged, setJustChanged] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Prevent card click propagation
      e.preventDefault();
      e.stopPropagation();

      if (isAdded) {
        removeItem(item.id);
        onRemove?.();
        setJustChanged(true);
      } else if (canAddThis) {
        const success = addItem(item);
        if (success) {
          onAdd?.();
          setJustChanged(true);
        }
      }
    },
    [isAdded, canAddThis, item, addItem, removeItem, onAdd, onRemove]
  );

  // Reset animation state
  useEffect(() => {
    if (justChanged) {
      const timer = setTimeout(() => setJustChanged(false), 300);
      return () => clearTimeout(timer);
    }
  }, [justChanged]);

  // Determine tooltip text
  let tooltipText = "Add to compare";
  if (isAdded) {
    tooltipText = "Remove from compare";
  } else if (isTypeMismatch) {
    tooltipText = `Clear ${activeType}s to compare ${item.type}s`;
  } else if (isMaxReached) {
    tooltipText = "Max 4 items in compare";
  }

  // Size classes
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
  };

  const iconSizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
  };

  // Build dynamic classes
  const getIconButtonClasses = () => {
    const base = "group relative flex items-center justify-center rounded-full transition-all duration-200";
    const sizeClass = sizeClasses[size];
    let stateClass = "";
    if (isAdded) {
      stateClass = "bg-blue-600 text-white shadow-md shadow-blue-600/25 hover:bg-blue-700";
    } else if (isDisabled) {
      stateClass = "bg-neutral-100 text-neutral-300 cursor-not-allowed";
    } else {
      stateClass = "bg-white text-neutral-500 border border-neutral-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50";
    }
    const scaleClass = justChanged ? "scale-110" : "scale-100";
    return `${base} ${sizeClass} ${stateClass} ${scaleClass} ${className}`.trim();
  };

  const getIconLabelButtonClasses = () => {
    const base = "group inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200";
    let stateClass = "";
    if (isAdded) {
      stateClass = "bg-blue-600 text-white hover:bg-blue-700";
    } else if (isDisabled) {
      stateClass = "bg-neutral-100 text-neutral-400 cursor-not-allowed";
    } else {
      stateClass = "bg-white text-neutral-600 border border-neutral-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50";
    }
    const scaleClass = justChanged ? "scale-105" : "scale-100";
    return `${base} ${stateClass} ${scaleClass} ${className}`.trim();
  };

  const getTextButtonClasses = () => {
    const base = "inline-flex items-center gap-1 text-xs font-medium transition-colors";
    let stateClass = "";
    if (isAdded) {
      stateClass = "text-blue-600 hover:text-blue-800";
    } else if (isDisabled) {
      stateClass = "text-neutral-300 cursor-not-allowed";
    } else {
      stateClass = "text-neutral-500 hover:text-blue-600";
    }
    return `${base} ${stateClass} ${className}`.trim();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ICON VARIANT (default - small circular button)
  // ═══════════════════════════════════════════════════════════════════════════
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        title={tooltipText}
        aria-label={tooltipText}
        aria-pressed={isAdded}
        className={getIconButtonClasses()}
      >
        {/* Compare icon (scale/balance) */}
        <svg
          className={`${iconSizeClasses[size]} transition-transform ${isAdded ? "scale-100" : "group-hover:scale-110"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          {isAdded ? (
            // Checkmark when added
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          ) : (
            // Scale/balance icon for compare
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
            />
          )}
        </svg>
      </button>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ICON-LABEL VARIANT (icon + text)
  // ═══════════════════════════════════════════════════════════════════════════
  if (variant === "icon-label") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        title={tooltipText}
        aria-pressed={isAdded}
        className={getIconLabelButtonClasses()}
      >
        <svg
          className={iconSizeClasses[size]}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          {isAdded ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
            />
          )}
        </svg>
        <span>{isAdded ? "Comparing" : "Compare"}</span>
      </button>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEXT VARIANT (link-style)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      title={tooltipText}
      aria-pressed={isAdded}
      className={getTextButtonClasses()}
    >
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        {isAdded ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
          />
        )}
      </svg>
      <span>{isAdded ? "Remove from compare" : "Add to compare"}</span>
    </button>
  );
}
