"use client";

import { useCompare } from "@/context/CompareContext";

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function CompareFloatingBadge() {
  const { items, itemCount, activeType, openPanel, isPanelOpen } = useCompare();

  // Don't render if no items or panel is open
  if (itemCount === 0 || isPanelOpen) {
    return null;
  }

  const typeLabel = activeType === "wheel" ? "Wheels" : activeType === "tire" ? "Tires" : "";

  return (
    <button
      type="button"
      onClick={openPanel}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-full bg-blue-600 px-5 py-3 text-white font-semibold shadow-xl shadow-blue-600/30 transition-all duration-300 ease-out hover:bg-blue-700 hover:shadow-2xl hover:shadow-blue-600/40 hover:scale-105 active:scale-95 animate-slide-up"
      aria-label={`Compare ${itemCount} ${typeLabel}`}
    >
      {/* Compare icon */}
      <svg
        className="h-5 w-5"
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

      {/* Count badge */}
      <span className="flex items-center gap-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-blue-600 text-sm font-bold">
          {itemCount}
        </span>
        <span className="text-sm">{typeLabel}</span>
      </span>

      {/* Preview thumbnails */}
      <div className="flex -space-x-2 ml-1">
        {items.slice(0, 3).map((item) => (
          <div
            key={item.id}
            className="h-8 w-8 rounded-full border-2 border-white bg-neutral-100 overflow-hidden"
          >
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt=""
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-neutral-400 text-xs">
                ⚙️
              </div>
            )}
          </div>
        ))}
        {itemCount > 3 && (
          <div className="h-8 w-8 rounded-full border-2 border-white bg-blue-500 flex items-center justify-center text-xs font-bold">
            +{itemCount - 3}
          </div>
        )}
      </div>

      {/* Arrow indicator */}
      <svg
        className="h-4 w-4 ml-1"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION KEYFRAMES (add to global CSS if not present)
// ═══════════════════════════════════════════════════════════════════════════════
// 
// @keyframes slide-up {
//   from {
//     opacity: 0;
//     transform: translateY(20px);
//   }
//   to {
//     opacity: 1;
//     transform: translateY(0);
//   }
// }
// 
// .animate-slide-up {
//   animation: slide-up 0.3s ease-out;
// }
