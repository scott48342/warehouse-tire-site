"use client";

import { useBuild } from "./BuildContext";
import { useCart } from "@/lib/cart/CartContext";
import { useRouter } from "next/navigation";
import { useState } from "react";

// ============================================================================
// ConfidenceLayer - Final confirmation before checkout
// ============================================================================

export function ConfidenceLayer() {
  const { state, totalPrice, monthlyPrice, savingsEstimate } = useBuild();
  const { addItem } = useCart();
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  
  if (!state.vehicle || !state.wheel || !state.tire) {
    return null;
  }
  
  const vehicleLabel = `${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model}`;
  const typicalRetailPrice = Math.round(totalPrice * 1.25);
  
  const handleComplete = async () => {
    setIsAdding(true);
    
    try {
      // Add wheel to cart
      addItem({
        type: "wheel",
        sku: state.wheel!.sku,
        rearSku: state.wheel!.rearSku,
        brand: state.wheel!.brand,
        model: state.wheel!.model,
        finish: state.wheel!.finish,
        diameter: state.wheel!.diameter,
        width: state.wheel!.width,
        rearWidth: state.wheel!.rearWidth,
        offset: state.wheel!.offset,
        rearOffset: state.wheel!.rearOffset,
        boltPattern: state.wheel!.boltPattern,
        imageUrl: state.wheel!.imageUrl,
        unitPrice: state.wheel!.unitPrice,
        quantity: 4,
        fitmentClass: state.wheel!.fitmentClass,
        staggered: state.wheel!.staggered,
        vehicle: {
          year: state.vehicle!.year,
          make: state.vehicle!.make,
          model: state.vehicle!.model,
          trim: state.vehicle!.trim,
          modification: state.vehicle!.modification,
        },
      });
      
      // Add tire to cart
      addItem({
        type: "tire",
        sku: state.tire!.sku,
        rearSku: state.tire!.rearSku,
        brand: state.tire!.brand,
        model: state.tire!.model,
        size: state.tire!.size,
        rearSize: state.tire!.rearSize,
        imageUrl: state.tire!.imageUrl,
        unitPrice: state.tire!.unitPrice,
        quantity: 4,
        loadIndex: state.tire!.loadIndex,
        speedRating: state.tire!.speedRating,
        staggered: state.tire!.staggered,
        vehicle: {
          year: state.vehicle!.year,
          make: state.vehicle!.make,
          model: state.vehicle!.model,
          trim: state.vehicle!.trim,
          modification: state.vehicle!.modification,
        },
      });
      
      // Navigate to cart
      router.push("/cart");
    } finally {
      setIsAdding(false);
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto">
      {/* Success header */}
      <div className="text-center mb-8">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-white text-3xl shadow-lg mb-4">
          ✓
        </div>
        <h2 className="text-2xl font-bold text-neutral-900">You're all set!</h2>
        <p className="text-neutral-600 mt-2">
          This setup will fit your {vehicleLabel} perfectly.
        </p>
      </div>
      
      {/* Build summary card */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-lg overflow-hidden mb-8">
        {/* Items */}
        <div className="p-6 space-y-4">
          {/* Wheels */}
          <div className="flex items-center gap-4">
            {state.wheel.imageUrl ? (
              <img 
                src={state.wheel.imageUrl} 
                alt={state.wheel.model}
                className="h-20 w-20 rounded-xl border border-neutral-200 object-contain bg-white"
              />
            ) : (
              <div className="h-20 w-20 rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-center">
                <span className="text-3xl text-neutral-300">⚙️</span>
              </div>
            )}
            <div className="flex-1">
              <div className="text-xs text-neutral-500 uppercase tracking-wide">Wheels (Set of 4)</div>
              <div className="text-base font-bold text-neutral-900">
                {state.wheel.brand} {state.wheel.model}
              </div>
              <div className="text-sm text-neutral-600">
                {state.wheel.diameter}" × {state.wheel.width}"
                {state.wheel.finish && ` • ${state.wheel.finish}`}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-neutral-900">
                ${state.wheel.setPrice.toLocaleString()}
              </div>
            </div>
          </div>
          
          {/* Divider */}
          <div className="border-t border-neutral-100" />
          
          {/* Tires */}
          <div className="flex items-center gap-4">
            {state.tire.imageUrl ? (
              <img 
                src={state.tire.imageUrl} 
                alt={state.tire.model}
                className="h-20 w-20 rounded-xl border border-neutral-200 object-contain bg-white"
              />
            ) : (
              <div className="h-20 w-20 rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-center">
                <span className="text-3xl text-neutral-300">🛞</span>
              </div>
            )}
            <div className="flex-1">
              <div className="text-xs text-neutral-500 uppercase tracking-wide">Tires (Set of 4)</div>
              <div className="text-base font-bold text-neutral-900">
                {state.tire.brand} {state.tire.model}
              </div>
              <div className="text-sm text-neutral-600">{state.tire.size}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-neutral-900">
                ${state.tire.setPrice.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
        
        {/* Included */}
        <div className="bg-neutral-50 border-t border-neutral-200 px-6 py-4">
          <div className="flex flex-wrap gap-4 text-sm text-neutral-600">
            <span className="flex items-center gap-1.5">
              <span className="text-green-500">✓</span> TPMS Sensors
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-green-500">✓</span> Mount & Balance
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-green-500">✓</span> Hardware Kit
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-green-500">✓</span> Free Shipping
            </span>
          </div>
        </div>
        
        {/* Price - FIX #3: Enhanced savings visibility */}
        <div className="bg-gradient-to-r from-neutral-800 to-neutral-900 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-neutral-400">Typical installed price</div>
              <div className="text-sm line-through text-neutral-500">${typicalRetailPrice.toLocaleString()}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-emerald-400 font-medium">Your Price</div>
              <div className="text-3xl font-black">${totalPrice.toLocaleString()}</div>
            </div>
          </div>
          {savingsEstimate > 0 && (
            <div className="mt-3 pt-3 border-t border-neutral-700 flex items-center justify-between">
              <span className="text-sm text-neutral-400">Your Savings</span>
              <span className="text-lg font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full">
                You Save ${savingsEstimate.toLocaleString()}+
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Confidence checklist */}
      <div className="rounded-xl bg-green-50 border border-green-200 p-5 mb-6">
        <h3 className="text-base font-bold text-green-800 mb-3">Ready for install</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-200 text-green-700 text-xs">✓</span>
            <span>Everything fits your {state.vehicle.model}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-green-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-200 text-green-700 text-xs">✓</span>
            <span>No extra parts needed</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-green-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-200 text-green-700 text-xs">✓</span>
            <span>Ships ready to mount</span>
          </div>
        </div>
      </div>
      
      {/* FIX #4: Emotional payoff line */}
      <p className="text-center text-neutral-600 mb-8">
        This setup will give your <span className="font-semibold">{state.vehicle.model}</span> a clean, upgraded look with zero fitment issues.
      </p>
      
      {/* CTA */}
      <button
        onClick={handleComplete}
        disabled={isAdding}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-lg hover:from-red-500 hover:to-red-600 shadow-lg shadow-red-500/25 active:scale-[0.99] transition-all disabled:opacity-70"
      >
        {isAdding ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Adding to Cart...
          </span>
        ) : (
          "Get This Setup"
        )}
      </button>
      
      {/* Financing note */}
      {monthlyPrice > 0 && (
        <p className="text-center text-sm text-neutral-500 mt-4">
          Or as low as <span className="font-semibold text-neutral-700">${monthlyPrice}/mo</span> with financing
        </p>
      )}
    </div>
  );
}
