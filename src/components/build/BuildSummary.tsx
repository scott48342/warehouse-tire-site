"use client";

import { useBuild } from "./BuildContext";
import { useCart } from "@/lib/cart/CartContext";
import { useRouter } from "next/navigation";
import { useState } from "react";

// ============================================================================
// BuildSummary - Sticky side panel showing build details
// ============================================================================

export function BuildSummary() {
  const { state, totalPrice, monthlyPrice, savingsEstimate, isComplete } = useBuild();
  const { addItem } = useCart();
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  
  const vehicleLabel = state.vehicle 
    ? `${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model}`
    : null;
  
  // Typical retail estimate for price anchoring
  const typicalRetailPrice = Math.round(totalPrice * 1.25);
  
  const handleComplete = async () => {
    if (!isComplete || !state.wheel || !state.tire || !state.vehicle) return;
    
    setIsAdding(true);
    
    try {
      // Add wheel to cart
      addItem({
        type: "wheel",
        sku: state.wheel.sku,
        rearSku: state.wheel.rearSku,
        brand: state.wheel.brand,
        model: state.wheel.model,
        finish: state.wheel.finish,
        diameter: state.wheel.diameter,
        width: state.wheel.width,
        rearWidth: state.wheel.rearWidth,
        offset: state.wheel.offset,
        rearOffset: state.wheel.rearOffset,
        boltPattern: state.wheel.boltPattern,
        imageUrl: state.wheel.imageUrl,
        unitPrice: state.wheel.unitPrice,
        quantity: 4,
        fitmentClass: state.wheel.fitmentClass,
        staggered: state.wheel.staggered,
        vehicle: {
          year: state.vehicle.year,
          make: state.vehicle.make,
          model: state.vehicle.model,
          trim: state.vehicle.trim,
          modification: state.vehicle.modification,
        },
      });
      
      // Add tire to cart
      addItem({
        type: "tire",
        sku: state.tire.sku,
        rearSku: state.tire.rearSku,
        brand: state.tire.brand,
        model: state.tire.model,
        size: state.tire.size,
        rearSize: state.tire.rearSize,
        imageUrl: state.tire.imageUrl,
        unitPrice: state.tire.unitPrice,
        quantity: 4,
        loadIndex: state.tire.loadIndex,
        speedRating: state.tire.speedRating,
        staggered: state.tire.staggered,
        vehicle: {
          year: state.vehicle.year,
          make: state.vehicle.make,
          model: state.vehicle.model,
          trim: state.vehicle.trim,
          modification: state.vehicle.modification,
        },
      });
      
      // Navigate to cart
      router.push("/cart");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="sticky top-24 rounded-2xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-neutral-800 to-neutral-900 px-5 py-4 text-white">
        <h3 className="text-base font-bold">Your Build</h3>
        {vehicleLabel && (
          <p className="text-sm text-neutral-300 mt-0.5">{vehicleLabel}</p>
        )}
      </div>
      
      {/* Content */}
      <div className="p-5 space-y-4">
        {/* Wheels */}
        <div className="flex items-start gap-3">
          {state.wheel?.imageUrl ? (
            <img 
              src={state.wheel.imageUrl} 
              alt={state.wheel.model} 
              className="h-14 w-14 rounded-lg border border-neutral-200 object-contain bg-white"
            />
          ) : (
            <div className="h-14 w-14 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 flex items-center justify-center">
              <span className="text-xl text-neutral-300">⚙️</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs text-neutral-500 uppercase tracking-wide">Wheels</div>
            {state.wheel ? (
              <>
                <div className="text-sm font-semibold text-neutral-900 truncate">
                  {state.wheel.brand} {state.wheel.model}
                </div>
                <div className="text-xs text-neutral-500">
                  {state.wheel.diameter}" × {state.wheel.width}" • {state.wheel.finish}
                </div>
                <div className="text-sm font-bold text-neutral-800 mt-0.5">
                  ${state.wheel.setPrice.toLocaleString()}
                </div>
              </>
            ) : (
              <div className="text-sm text-neutral-400">Not selected yet</div>
            )}
          </div>
        </div>
        
        {/* Tires */}
        <div className="flex items-start gap-3">
          {state.tire?.imageUrl ? (
            <img 
              src={state.tire.imageUrl} 
              alt={state.tire.model} 
              className="h-14 w-14 rounded-lg border border-neutral-200 object-contain bg-white"
            />
          ) : (
            <div className="h-14 w-14 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 flex items-center justify-center">
              <span className="text-xl text-neutral-300">🛞</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs text-neutral-500 uppercase tracking-wide">Tires</div>
            {state.tire ? (
              <>
                <div className="text-sm font-semibold text-neutral-900 truncate">
                  {state.tire.brand} {state.tire.model}
                </div>
                <div className="text-xs text-neutral-500">{state.tire.size}</div>
                <div className="text-sm font-bold text-neutral-800 mt-0.5">
                  ${state.tire.setPrice.toLocaleString()}
                </div>
              </>
            ) : (
              <div className="text-sm text-neutral-400">
                {state.wheel ? "Select next" : "Select wheels first"}
              </div>
            )}
          </div>
        </div>
        
        {/* Included items */}
        <div className="pt-3 border-t border-neutral-100">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Included</div>
          <div className="space-y-1.5 text-xs text-neutral-600">
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>TPMS Sensors (4)</span>
              <span className="ml-auto text-neutral-400">$280</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Mount & Balance</span>
              <span className="ml-auto text-neutral-400">$80</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Hardware Kit</span>
              <span className="ml-auto text-neutral-400">Incl.</span>
            </div>
          </div>
        </div>
        
        {/* Price anchoring - FIX #1: Don't show real price before selection */}
        <div className="pt-3 border-t border-neutral-100">
          {!state.wheel ? (
            // No selection yet - show placeholder
            <div className="text-center py-2">
              <div className="text-xs text-neutral-400 uppercase tracking-wide">Your Build Total</div>
              <div className="text-2xl font-bold text-neutral-300 mt-1">—</div>
              <div className="text-xs text-neutral-400 mt-1">Select wheels to start</div>
            </div>
          ) : (
            // Selection made - show real pricing
            <>
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>Typical installed price</span>
                <span className="line-through">${typicalRetailPrice.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-bold text-emerald-700">Your Price</span>
                <span className="text-xl font-black text-emerald-700">${totalPrice.toLocaleString()}</span>
              </div>
              {savingsEstimate > 0 && (
                <div className="text-right text-xs text-emerald-600 font-medium">
                  You save ${savingsEstimate.toLocaleString()}+
                </div>
              )}
              {monthlyPrice > 0 && (
                <div className="text-right text-xs text-neutral-400 mt-1">
                  As low as ${monthlyPrice}/mo
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Trust signals */}
        <div className="pt-3 border-t border-neutral-100 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <span className="text-green-500">✓</span>
            <span>Guaranteed Fit</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <span className="text-green-500">✓</span>
            <span>Free Shipping</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <span className="text-green-500">✓</span>
            <span>Easy Returns</span>
          </div>
        </div>
        
        {/* CTA */}
        <button
          onClick={handleComplete}
          disabled={!isComplete || isAdding}
          className={`w-full mt-4 py-3.5 rounded-xl font-bold text-sm transition-all ${
            isComplete
              ? "bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-600 shadow-md shadow-red-500/20 active:scale-[0.99]"
              : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
          }`}
        >
          {isAdding ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Adding to Cart...
            </span>
          ) : isComplete ? (
            "Complete My Build"
          ) : (
            "Select wheels and tires"
          )}
        </button>
      </div>
    </div>
  );
}
