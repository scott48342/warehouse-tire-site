"use client";

import { useEffect, useState, useCallback } from "react";
import { useCart, type CartTireItem, type CartWheelItem } from "@/lib/cart/CartContext";
import { track } from "@/lib/analytics/events";

/**
 * Smart Tire Upsell Component
 * 
 * Shows after wheels are added to cart. Recommends the single best tire
 * that fits the selected wheels and vehicle, making it easy to add a set of 4.
 * 
 * Features:
 * - Vehicle-aware recommendations
 * - Category filtering (no AT tires for sedans)
 * - Single confident pick (not a wall of options)
 * - One-click add set of 4
 * - Non-blocking (skip always available)
 * 
 * @created 2026-04-14
 */

interface RecommendedTire {
  sku: string;
  rearSku?: string;
  brand: string;
  model: string;
  displayName: string;
  size: string;
  rearSize?: string;
  imageUrl: string | null;
  unitPrice: number;
  setPrice: number;
  reason: string;
  reasonType: string;
  inStock: boolean;
  confidence: "high" | "medium" | "low";
  source?: string;
}

interface SmartTireUpsellProps {
  /** Wheel item that was just added (for context) */
  wheel?: CartWheelItem | null;
  /** Callback when user skips the upsell */
  onSkip?: () => void;
  /** Callback when tires are added */
  onAdd?: () => void;
  /** Show as compact card (for sidebar placement) */
  compact?: boolean;
  /** Show as a modal/drawer overlay */
  overlay?: boolean;
}

export function SmartTireUpsell({ 
  wheel, 
  onSkip, 
  onAdd,
  compact = false,
  overlay = false,
}: SmartTireUpsellProps) {
  const { getWheels, addItem, hasTires } = useCart();
  
  const [recommendation, setRecommendation] = useState<RecommendedTire | null>(null);
  const [fallbackOptions, setFallbackOptions] = useState<RecommendedTire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [tireSize, setTireSize] = useState<string | null>(null);
  const [vehicleLabel, setVehicleLabel] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  // Get wheel context
  const wheels = getWheels();
  const primaryWheel = wheel || wheels[0];
  const vehicle = primaryWheel?.vehicle;
  const wheelDiameter = primaryWheel?.diameter;
  const wheelWidth = primaryWheel?.width;
  const staggered = primaryWheel?.staggered;
  const rearWidth = primaryWheel?.rearWidth;
  
  // Check if tires are in cart (must be after all hooks)
  const alreadyHasTires = hasTires();

  // Fetch recommendation
  useEffect(() => {
    if (!wheelDiameter || alreadyHasTires) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchRecommendation() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/recommendations/tire-for-wheels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wheelDiameter,
            wheelWidth,
            vehicle,
            staggered,
            rearWheelWidth: rearWidth,
          }),
        });

        if (cancelled) return;

        const data = await res.json();

        if (!res.ok || !data.ok) {
          setError(data.error || "Failed to get recommendation");
          setLoading(false);
          return;
        }

        setRecommendation(data.recommendation);
        setFallbackOptions(data.fallbackOptions || []);
        setTireSize(data.tireSize);
        setVehicleLabel(data.vehicleLabel);
        setLoading(false);

        // Track upsell shown
        if (data.recommendation && !shown) {
          setShown(true);
          track("smart_tire_upsell_shown", {
            wheelSku: primaryWheel?.sku,
            wheelDiameter,
            tireSize: data.tireSize,
            recommendedSku: data.recommendation.sku,
            reasonType: data.recommendation.reasonType,
            confidence: data.recommendation.confidence,
            vehicleMake: vehicle?.make,
            vehicleModel: vehicle?.model,
          });
        }

      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Failed to load recommendation");
        setLoading(false);
      }
    }

    fetchRecommendation();

    return () => {
      cancelled = true;
    };
  }, [wheelDiameter, wheelWidth, vehicle?.year, vehicle?.make, vehicle?.model, staggered, rearWidth]);

  // Handle add tires
  const handleAddTires = useCallback(async (tire: RecommendedTire) => {
    if (adding) return;
    
    setAdding(true);

    try {
      // Build cart item
      const tireItem: CartTireItem = {
        type: "tire",
        sku: tire.sku,
        rearSku: tire.rearSku,
        brand: tire.brand,
        model: tire.model,
        size: tire.size,
        rearSize: tire.rearSize,
        imageUrl: tire.imageUrl || undefined,
        unitPrice: tire.unitPrice,
        quantity: 4, // Always add set of 4
        vehicle: vehicle,
        staggered: !!tire.rearSku,
        source: tire.source,
      };

      // Add to cart
      addItem(tireItem, "smart_upsell");

      // Track acceptance
      track("smart_tire_upsell_accepted", {
        wheelSku: primaryWheel?.sku,
        tireSku: tire.sku,
        tireSize: tire.size,
        unitPrice: tire.unitPrice,
        setPrice: tire.setPrice,
        reasonType: tire.reasonType,
        confidence: tire.confidence,
        vehicleMake: vehicle?.make,
        vehicleModel: vehicle?.model,
      });

      // Callback
      onAdd?.();

    } catch (e) {
      console.error("[SmartTireUpsell] Failed to add tires:", e);
    } finally {
      setAdding(false);
    }
  }, [addItem, vehicle, primaryWheel, onAdd, adding]);

  // Handle skip
  const handleSkip = useCallback(() => {
    track("smart_tire_upsell_skipped", {
      wheelSku: primaryWheel?.sku,
      recommendedSku: recommendation?.sku,
      tireSize,
      vehicleMake: vehicle?.make,
      vehicleModel: vehicle?.model,
    });
    onSkip?.();
  }, [primaryWheel, recommendation, tireSize, vehicle, onSkip]);

  // Don't show if already has tires
  if (alreadyHasTires) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className={`rounded-xl border border-neutral-200 bg-white p-4 ${compact ? "" : "p-6"}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-1/2 bg-neutral-200 rounded" />
          <div className="flex gap-4">
            <div className="w-20 h-20 bg-neutral-200 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-neutral-200 rounded" />
              <div className="h-3 w-1/2 bg-neutral-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No recommendation
  if (!recommendation) {
    return null;
  }

  // Compact version (for sidebar)
  if (compact) {
    return (
      <div className="rounded-xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🛞</span>
          <span className="font-bold text-green-900 text-sm">Complete Your Setup</span>
        </div>

        {/* Recommendation */}
        <div className="flex gap-3">
          {/* Image */}
          <div className="w-16 h-16 rounded-lg border border-neutral-200 bg-white overflow-hidden flex-shrink-0">
            {recommendation.imageUrl ? (
              <img 
                src={recommendation.imageUrl} 
                alt={recommendation.displayName}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-400 text-2xl">🛞</div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-neutral-500">{recommendation.brand}</div>
            <div className="font-bold text-neutral-900 text-sm truncate">{recommendation.model}</div>
            <div className="text-xs text-neutral-600 mt-0.5">{recommendation.size}</div>
            <div className="text-xs text-green-700 mt-1">{recommendation.reason}</div>
          </div>
        </div>

        {/* Pricing */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-extrabold text-neutral-900">
            ${recommendation.setPrice.toFixed(0)}
          </span>
          <span className="text-xs text-neutral-500">
            for 4 (${recommendation.unitPrice.toFixed(0)} ea)
          </span>
        </div>

        {/* CTA */}
        <button
          onClick={() => handleAddTires(recommendation)}
          disabled={adding}
          className={`mt-3 w-full h-10 rounded-lg font-bold text-sm transition-colors ${
            adding
              ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {adding ? "Adding..." : "Add Tires (Set of 4)"}
        </button>

        {/* Skip */}
        <button
          onClick={handleSkip}
          className="mt-2 w-full text-center text-xs text-neutral-500 hover:text-neutral-700"
        >
          Skip for now
        </button>
      </div>
    );
  }

  // Full version
  return (
    <div className={`rounded-2xl border-2 border-green-200 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 ${overlay ? "shadow-2xl" : ""}`}>
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-green-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl">✨</span>
          <h3 className="text-lg font-extrabold text-green-900">Complete Your Setup</h3>
        </div>
        {vehicleLabel && (
          <p className="text-sm text-green-700 mt-1">
            Recommended tire for your {vehicleLabel}
          </p>
        )}
      </div>

      {/* Recommendation */}
      <div className="p-6">
        <div className="flex gap-4">
          {/* Image */}
          <div className="w-24 h-24 rounded-xl border border-neutral-200 bg-white overflow-hidden flex-shrink-0 shadow-sm">
            {recommendation.imageUrl ? (
              <img 
                src={recommendation.imageUrl} 
                alt={recommendation.displayName}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-400 text-4xl">🛞</div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1">
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide">{recommendation.brand}</div>
            <div className="text-xl font-extrabold text-neutral-900">{recommendation.model}</div>
            <div className="text-sm text-neutral-600 mt-1">{recommendation.size}</div>
            
            {/* Reason */}
            <div className="mt-2 text-sm text-green-800 font-medium">
              {recommendation.reason}
            </div>
          </div>
        </div>

        {/* Trust bullets */}
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-green-700">
            <span>✓</span>
            <span>Fits your selected wheels</span>
          </div>
          <div className="flex items-center gap-1.5 text-green-700">
            <span>✓</span>
            <span>No modifications needed</span>
          </div>
          {recommendation.inStock && (
            <div className="flex items-center gap-1.5 text-green-700">
              <span>✓</span>
              <span>In stock • Ships fast</span>
            </div>
          )}
        </div>

        {/* Pricing */}
        <div className="mt-5 p-4 rounded-xl bg-white border border-neutral-200">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-extrabold text-neutral-900">
                ${recommendation.setPrice.toLocaleString()}
              </span>
              <span className="text-neutral-500 ml-2">for a set of 4</span>
            </div>
            <div className="text-right">
              <span className="text-neutral-600">${recommendation.unitPrice.toFixed(2)}</span>
              <span className="text-neutral-400 text-sm"> each</span>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-5 space-y-3">
          <button
            onClick={() => handleAddTires(recommendation)}
            disabled={adding}
            className={`w-full h-14 rounded-xl font-extrabold text-base transition-all ${
              adding
                ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-600/25 hover:shadow-green-600/40"
            }`}
          >
            {adding ? "Adding to Package..." : "Add Tires (Set of 4)"}
          </button>

          <button
            onClick={handleSkip}
            className="w-full h-11 rounded-xl font-semibold text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
          >
            Skip for now
          </button>
        </div>

        {/* Fallback options (if low confidence) */}
        {fallbackOptions.length > 0 && recommendation.confidence === "low" && (
          <div className="mt-6 pt-5 border-t border-neutral-200">
            <p className="text-sm font-semibold text-neutral-700 mb-3">Other options:</p>
            <div className="space-y-2">
              {fallbackOptions.map((alt) => (
                <button
                  key={alt.sku}
                  onClick={() => handleAddTires(alt)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-neutral-200 bg-white hover:border-green-300 hover:bg-green-50 transition-colors text-left"
                >
                  {alt.imageUrl && (
                    <img src={alt.imageUrl} alt="" className="w-12 h-12 object-contain" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-neutral-900 truncate">{alt.displayName}</div>
                    <div className="text-sm text-neutral-600">${alt.setPrice.toFixed(0)} for 4</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Smart Tire Upsell for Cart Sidebar
 * Compact version that appears in cart when wheels are added but no tires
 */
export function CartSmartTireUpsell() {
  const { getWheels, hasTires } = useCart();
  const wheels = getWheels();

  // Don't show if no wheels or already has tires
  if (wheels.length === 0 || hasTires()) {
    return null;
  }

  return (
    <SmartTireUpsell 
      wheel={wheels[0]} 
      compact 
    />
  );
}
