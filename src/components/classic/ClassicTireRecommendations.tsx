"use client";

/**
 * Classic Tire Recommendations
 * 
 * Shows recommended tire sizes for a selected wheel diameter
 * on classic vehicles. Displays variance from stock OD.
 * 
 * TRIGGER: Only shown when isClassicVehicle = true
 */

export interface TireSizeRecommendation {
  size: string;
  width: number;
  aspectRatio: number;
  rimDiameter: number;
  overallDiameter: number;
  variancePercent: number;
  recommended: boolean;
}

export interface ClassicTireRecommendationsProps {
  /** Selected wheel diameter */
  wheelDiameter: number;
  /** Stock tire info */
  stockTire: {
    original: string;
    metric: string;
    overallDiameter: number;
  };
  /** Recommended tire sizes */
  recommendations: TireSizeRecommendation[];
  /** Callback when a tire size is selected */
  onSelectSize?: (size: string) => void;
  /** Currently selected size */
  selectedSize?: string;
  /** Compact mode */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function ClassicTireRecommendations({
  wheelDiameter,
  stockTire,
  recommendations,
  onSelectSize,
  selectedSize,
  compact = false,
  className = "",
}: ClassicTireRecommendationsProps) {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className={`rounded-lg border border-neutral-200 bg-neutral-50 p-4 ${className}`}>
        <p className="text-sm text-neutral-600">
          No compatible tire sizes found for {wheelDiameter}" wheels.
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`space-y-2 ${className}`}>
        <p className="text-sm font-medium text-neutral-700">
          Recommended for {wheelDiameter}" wheels:
        </p>
        <div className="flex flex-wrap gap-2">
          {recommendations.slice(0, 3).map((rec) => (
            <button
              key={rec.size}
              onClick={() => onSelectSize?.(rec.size)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                selectedSize === rec.size
                  ? "bg-amber-600 text-white"
                  : "bg-amber-100 text-amber-800 hover:bg-amber-200"
              }`}
            >
              {rec.size}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-neutral-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-neutral-50 px-5 py-4 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-neutral-900">
              Recommended Tires for {wheelDiameter}" Wheels
            </h3>
            <p className="text-sm text-neutral-600 mt-0.5">
              Based on stock {stockTire.original} ({stockTire.metric})
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-neutral-500">Target OD</p>
            <p className="font-mono font-semibold text-neutral-900">
              {stockTire.overallDiameter.toFixed(1)}"
            </p>
          </div>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="divide-y divide-neutral-100">
        {recommendations.map((rec, index) => {
          const isSelected = selectedSize === rec.size;
          const isTopPick = index === 0;
          
          return (
            <button
              key={rec.size}
              onClick={() => onSelectSize?.(rec.size)}
              className={`w-full px-5 py-3 flex items-center justify-between text-left transition-colors ${
                isSelected
                  ? "bg-amber-50"
                  : "hover:bg-neutral-50"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Rank/Status */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    isTopPick
                      ? "bg-green-100 text-green-700"
                      : rec.recommended
                      ? "bg-amber-100 text-amber-700"
                      : "bg-neutral-100 text-neutral-500"
                  }`}
                >
                  {isTopPick ? "✓" : index + 1}
                </div>

                {/* Size Info */}
                <div>
                  <p className="font-semibold text-neutral-900">{rec.size}</p>
                  <p className="text-xs text-neutral-500">
                    {rec.width}mm width • {rec.aspectRatio} series
                  </p>
                </div>
              </div>

              {/* Diameter & Variance */}
              <div className="text-right">
                <p className="font-mono text-sm text-neutral-900">
                  {rec.overallDiameter.toFixed(1)}"
                </p>
                <p
                  className={`text-xs font-medium ${
                    rec.variancePercent <= 1
                      ? "text-green-600"
                      : rec.variancePercent <= 2
                      ? "text-amber-600"
                      : "text-neutral-500"
                  }`}
                >
                  {rec.variancePercent <= 0.1
                    ? "Exact match"
                    : `${rec.variancePercent > 0 ? "+" : ""}${rec.variancePercent.toFixed(1)}%`}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer Note */}
      <div className="bg-neutral-50 px-5 py-3 border-t border-neutral-200">
        <p className="text-xs text-neutral-500">
          💡 Narrower widths provide better fender clearance on unmodified classics
        </p>
      </div>
    </div>
  );
}

export default ClassicTireRecommendations;
