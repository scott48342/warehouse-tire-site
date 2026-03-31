"use client";

/**
 * Classic Fitment Summary Card
 * 
 * Shows comprehensive fitment data for classic vehicles including:
 * - Platform info
 * - Specs (bolt pattern, center bore, thread)
 * - Recommended ranges (diameter, width, offset)
 * - Stock reference
 * 
 * TRIGGER: Only shown when isClassicVehicle = true
 */

import { ClassicConfidenceBadge, type ClassicConfidenceLevel } from "./ClassicConfidenceBadge";

export interface ClassicFitmentData {
  platform: {
    code: string;
    name: string;
    generationName?: string;
    yearRange: string;
  };
  confidence: ClassicConfidenceLevel;
  specs: {
    boltPattern: string;
    centerBore?: number;
    threadSize?: string;
    seatType?: string;
  };
  recommendedRange: {
    diameter: { min: number; max: number };
    width: { min: number; max: number };
    offset: { min: number; max: number };
  };
  stockReference?: {
    wheelDiameter?: number;
    wheelWidth?: number;
    tireSize?: string;
  };
}

export interface ClassicFitmentCardProps {
  /** Classic fitment data from API */
  fitment: ClassicFitmentData;
  /** Vehicle display name */
  vehicleName: string;
  /** Whether to show compact version */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function ClassicFitmentCard({
  fitment,
  vehicleName,
  compact = false,
  className = "",
}: ClassicFitmentCardProps) {
  const { platform, confidence, specs, recommendedRange, stockReference } = fitment;

  if (compact) {
    return (
      <div className={`rounded-lg border border-neutral-200 bg-white p-4 ${className}`}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-semibold text-neutral-900 text-sm">
            {platform.name}
          </h3>
          <ClassicConfidenceBadge confidence={confidence} size="sm" />
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-neutral-500">Bolt Pattern</span>
            <p className="font-medium text-neutral-900">{specs.boltPattern}</p>
          </div>
          {specs.centerBore && (
            <div>
              <span className="text-neutral-500">Hub Bore</span>
              <p className="font-medium text-neutral-900">{specs.centerBore}mm</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">
              Classic Fitment Specifications
            </h3>
            <p className="mt-0.5 text-sm text-neutral-600">
              {platform.name}
              {platform.generationName && (
                <span className="text-neutral-400"> • {platform.generationName}</span>
              )}
            </p>
          </div>
          <ClassicConfidenceBadge confidence={confidence} size="md" />
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Primary Specs */}
        <div className="mb-6">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Platform Specifications
          </h4>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SpecItem label="Bolt Pattern" value={specs.boltPattern} primary />
            {specs.centerBore && (
              <SpecItem label="Center Bore" value={`${specs.centerBore}mm`} />
            )}
            {specs.threadSize && (
              <SpecItem label="Thread Size" value={specs.threadSize} />
            )}
            {specs.seatType && (
              <SpecItem label="Seat Type" value={capitalize(specs.seatType)} />
            )}
          </div>
        </div>

        {/* Recommended Ranges */}
        <div className="mb-6">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Recommended Wheel Ranges
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <RangeItem
              label="Diameter"
              min={recommendedRange.diameter.min}
              max={recommendedRange.diameter.max}
              unit='"'
            />
            <RangeItem
              label="Width"
              min={recommendedRange.width.min}
              max={recommendedRange.width.max}
              unit='"'
            />
            <RangeItem
              label="Offset"
              min={recommendedRange.offset.min}
              max={recommendedRange.offset.max}
              unit="mm"
            />
          </div>
        </div>

        {/* Stock Reference */}
        {stockReference && (stockReference.wheelDiameter || stockReference.tireSize) && (
          <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Stock Reference
            </h4>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {stockReference.wheelDiameter && stockReference.wheelWidth && (
                <div>
                  <span className="text-neutral-500">OE Wheel:</span>{" "}
                  <span className="font-medium text-neutral-900">
                    {stockReference.wheelDiameter}×{stockReference.wheelWidth}
                  </span>
                </div>
              )}
              {stockReference.tireSize && (
                <div>
                  <span className="text-neutral-500">OE Tire:</span>{" "}
                  <span className="font-medium text-neutral-900">
                    {stockReference.tireSize}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Year Range Footer */}
        <div className="mt-4 text-center text-xs text-neutral-400">
          Applies to {platform.yearRange} model years
        </div>
      </div>
    </div>
  );
}

// Helper components
function SpecItem({
  label,
  value,
  primary = false,
}: {
  label: string;
  value: string;
  primary?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div
        className={`font-semibold ${
          primary ? "text-lg text-neutral-900" : "text-neutral-800"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function RangeItem({
  label,
  min,
  max,
  unit,
}: {
  label: string;
  min: number;
  max: number;
  unit: string;
}) {
  return (
    <div className="rounded-lg bg-neutral-50 px-3 py-2 text-center">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="font-bold text-neutral-900">
        {min}–{max}
        <span className="text-neutral-500">{unit}</span>
      </div>
    </div>
  );
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default ClassicFitmentCard;
