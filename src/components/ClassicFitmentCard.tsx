"use client";

import Link from "next/link";

/**
 * ClassicFitmentCard
 * 
 * Displays platform-based fitment info for classic/legacy vehicles (1990s era).
 * Designed to feel premium, knowledgeable, and enthusiast-friendly.
 * 
 * Shows:
 * - Platform identification (SN95, F-Body, XJ, etc.)
 * - Factory baseline fitment
 * - Safe wheel diameter range
 * - Clear CTAs to shop wheels/tires
 */

export interface ClassicFitmentData {
  platform: {
    code: string;
    name: string;
    generationName?: string | null;
    yearRange: string;
  };
  vehicle: {
    year: number;
    make: string;
    model: string;
  };
  specs: {
    boltPattern: string;
    centerBore: number | null;
    threadSize: string | null;
    seatType: string | null;
  };
  stockReference: {
    wheelDiameter: number | null;
    wheelWidth: number | null;
    tireSize: string | null;
  };
  recommendedRange: {
    diameter: {
      min: number;
      max: number;
    };
    width: {
      min: number;
      max: number;
    };
    offset: {
      min: number;
      max: number;
    };
  };
  confidence: "high" | "medium" | "low";
  fitmentStyle: string;
  verificationRequired?: boolean;
  verificationNote?: string | null;
  notes?: string | null;
}

interface ClassicFitmentCardProps {
  data: ClassicFitmentData;
  /** Current product context - affects which CTA is primary */
  productType?: "wheels" | "tires";
}

export function ClassicFitmentCard({ data, productType = "wheels" }: ClassicFitmentCardProps) {
  const { platform, vehicle, specs, stockReference, recommendedRange, confidence, notes } = data;
  
  // Build URL params for shopping CTAs
  const vehicleParams = new URLSearchParams({
    year: String(vehicle.year),
    make: vehicle.make,
    model: vehicle.model,
    classicPlatform: platform.code,
  }).toString();

  const wheelsUrl = `/wheels?${vehicleParams}`;
  const tiresUrl = `/tires?${vehicleParams}`;

  // Format vehicle title
  const vehicleTitle = `${vehicle.year} ${capitalize(vehicle.make)} ${capitalize(vehicle.model)}`;
  
  // Confidence styling
  const isHighConfidence = confidence === "high";
  const confidenceBadgeClass = isHighConfidence
    ? "bg-green-100 text-green-800"
    : "bg-amber-100 text-amber-800";
  const confidenceLabel = isHighConfidence ? "Verified" : "Estimated";

  return (
    <div className="max-w-2xl mx-auto">
      {/* Main Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-neutral-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 px-6 py-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-amber-400 text-sm font-medium tracking-wide uppercase">
              Classic Fitment Identified
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${confidenceBadgeClass}`}>
              {confidenceLabel}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">{vehicleTitle}</h1>
          <p className="text-neutral-300 mt-1">
            {platform.name}
            {platform.generationName && ` • ${platform.generationName}`}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          
          {/* Factory Baseline */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">
              Factory Baseline Fitment
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-50 rounded-xl p-4">
                <div className="text-xs text-neutral-500 mb-1">Stock Tire Size</div>
                <div className="text-lg font-bold text-neutral-900">
                  {stockReference.tireSize || "—"}
                </div>
              </div>
              <div className="bg-neutral-50 rounded-xl p-4">
                <div className="text-xs text-neutral-500 mb-1">Stock Wheel</div>
                <div className="text-lg font-bold text-neutral-900">
                  {stockReference.wheelDiameter ? `${stockReference.wheelDiameter}"` : "—"}
                  {stockReference.wheelWidth && ` × ${stockReference.wheelWidth}"`}
                </div>
              </div>
            </div>
          </div>

          {/* Specs */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">
              Bolt Pattern & Specs
            </h3>
            <div className="flex flex-wrap gap-3">
              <SpecBadge label="Bolt Pattern" value={specs.boltPattern} />
              {specs.centerBore && <SpecBadge label="Center Bore" value={`${specs.centerBore}mm`} />}
              {specs.threadSize && <SpecBadge label="Lug Thread" value={specs.threadSize} />}
              {specs.seatType && <SpecBadge label="Seat Type" value={capitalize(specs.seatType)} />}
            </div>
          </div>

          {/* Safe Upgrade Range */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">
              Safe Upgrade Range
            </h3>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold text-blue-900">Popular Wheel Sizes</span>
              </div>
              <p className="text-blue-800">
                <span className="font-bold">{recommendedRange.diameter.min}" – {recommendedRange.diameter.max}"</span>
                {" "}diameter wheels commonly fit this platform
              </p>
              <p className="text-sm text-blue-700 mt-1">
                Width: {recommendedRange.width.min}" – {recommendedRange.width.max}" • 
                Offset: {recommendedRange.offset.min}mm to +{recommendedRange.offset.max}mm
              </p>
            </div>
          </div>

          {/* Notes */}
          {notes && (
            <div className="text-sm text-neutral-600 bg-neutral-50 rounded-lg p-3">
              <span className="font-medium">Note:</span> {notes}
            </div>
          )}

          {/* Caution for medium confidence */}
          {!isHighConfidence && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <span className="font-medium">Verify fitment:</span> This is estimated baseline data. 
              Modified vehicles may require different specs. Confirm clearance before purchase.
            </div>
          )}

          {/* Standard messaging */}
          <p className="text-xs text-neutral-500">
            Factory baseline fitment shown. Modified vehicles may vary. 
            Always verify clearance for aftermarket setups.
          </p>
        </div>

        {/* CTAs */}
        <div className="px-6 pb-6">
          <div className="flex gap-3">
            <Link
              href={wheelsUrl}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold text-center transition-colors ${
                productType === "wheels"
                  ? "bg-neutral-900 text-white hover:bg-neutral-800"
                  : "bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
              }`}
            >
              Shop Wheels
            </Link>
            <Link
              href={tiresUrl}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold text-center transition-colors ${
                productType === "tires"
                  ? "bg-neutral-900 text-white hover:bg-neutral-800"
                  : "bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
              }`}
            >
              Shop Tires
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-2 bg-neutral-100 rounded-lg px-3 py-2">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="font-semibold text-neutral-900">{value}</span>
    </div>
  );
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
