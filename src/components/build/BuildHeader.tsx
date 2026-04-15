"use client";

import { useBuild } from "./BuildContext";

// ============================================================================
// BuildHeader - Sticky header showing current build state
// ============================================================================

export function BuildHeader() {
  const { state, totalPrice, goToStep } = useBuild();
  
  const vehicleLabel = state.vehicle 
    ? `${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model}${state.vehicle.trim ? ` ${state.vehicle.trim}` : ""}`
    : "Select vehicle";
  
  const wheelLabel = state.wheel
    ? `${state.wheel.brand} ${state.wheel.model}`
    : "Not selected";
    
  const tireLabel = state.tire
    ? `${state.tire.brand} ${state.tire.model}`
    : "Not selected";

  return (
    <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-neutral-200 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-3">
        {/* Mobile: Compact view */}
        <div className="md:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🚗</span>
              <div>
                <div className="text-xs text-neutral-500">Your Build</div>
                <div className="text-sm font-bold text-neutral-900 truncate max-w-[200px]">
                  {state.vehicle ? vehicleLabel : "Start your build"}
                </div>
              </div>
            </div>
            {totalPrice > 0 && (
              <div className="text-right">
                <div className="text-xs text-neutral-500">Total</div>
                <div className="text-lg font-bold text-neutral-900">
                  ${totalPrice.toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Desktop: Full view */}
        <div className="hidden md:flex items-center justify-between gap-6">
          {/* Build label */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 text-white shadow-sm">
              🔧
            </div>
            <div>
              <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Your Build</div>
              <div className="text-base font-bold text-neutral-900">
                {state.vehicle ? vehicleLabel : "Start your build"}
              </div>
            </div>
          </div>
          
          {/* Progress items */}
          <div className="flex items-center gap-4">
            {/* Wheels */}
            <button
              onClick={() => state.vehicle && goToStep("wheels")}
              disabled={!state.vehicle}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                state.step === "wheels" 
                  ? "bg-blue-50 border border-blue-200" 
                  : state.wheel 
                    ? "bg-green-50 border border-green-200 hover:bg-green-100" 
                    : "bg-neutral-50 border border-neutral-200"
              } ${!state.vehicle ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span className={`text-sm ${state.wheel ? "text-green-600" : "text-neutral-400"}`}>
                {state.wheel ? "✓" : "○"}
              </span>
              <div className="text-left">
                <div className="text-[10px] text-neutral-500 uppercase tracking-wide">Wheels</div>
                <div className={`text-xs font-semibold truncate max-w-[120px] ${
                  state.wheel ? "text-green-700" : "text-neutral-600"
                }`}>
                  {wheelLabel}
                </div>
              </div>
            </button>
            
            {/* Connector */}
            <div className="w-4 h-px bg-neutral-300" />
            
            {/* Tires */}
            <button
              onClick={() => state.wheel && goToStep("tires")}
              disabled={!state.wheel}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                state.step === "tires" 
                  ? "bg-blue-50 border border-blue-200" 
                  : state.tire 
                    ? "bg-green-50 border border-green-200 hover:bg-green-100" 
                    : "bg-neutral-50 border border-neutral-200"
              } ${!state.wheel ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span className={`text-sm ${state.tire ? "text-green-600" : "text-neutral-400"}`}>
                {state.tire ? "✓" : "○"}
              </span>
              <div className="text-left">
                <div className="text-[10px] text-neutral-500 uppercase tracking-wide">Tires</div>
                <div className={`text-xs font-semibold truncate max-w-[120px] ${
                  state.tire ? "text-green-700" : "text-neutral-600"
                }`}>
                  {tireLabel}
                </div>
              </div>
            </button>
          </div>
          
          {/* Total */}
          <div className="flex items-center gap-4">
            {totalPrice > 0 ? (
              <div className="text-right">
                <div className="text-xs text-neutral-500">Package Total</div>
                <div className="text-xl font-black text-neutral-900">
                  ${totalPrice.toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="text-right">
                <div className="text-xs text-neutral-500">Package Total</div>
                <div className="text-sm font-medium text-neutral-400">—</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
