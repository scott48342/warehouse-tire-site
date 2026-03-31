"use client";

/**
 * Classic Mode Banner
 * 
 * Displayed at the top of wheel/tire pages when viewing a classic vehicle.
 * Provides clear messaging about platform-based fitment.
 * 
 * TRIGGER: Only shown when isClassicVehicle = true from classic API
 */

// Using emoji instead of lucide-react icons for zero dependencies

export interface ClassicModeBannerProps {
  /** Vehicle display name */
  vehicleName: string;
  /** Platform name (e.g., "GM F-Body 2nd Generation") */
  platformName: string;
  /** Whether to show compact version */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function ClassicModeBanner({
  vehicleName,
  platformName,
  compact = false,
  className = "",
}: ClassicModeBannerProps) {
  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 ${className}`}
      >
        <span className="text-amber-600">🏎️</span>
        <span className="text-sm font-medium text-amber-900">
          Classic Vehicle Mode — {platformName}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-4 sm:p-6 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-2xl">
          🏎️
        </div>
        <div className="flex-1">
          <h2 className="flex items-center gap-2 text-lg font-bold text-amber-900">
            <span>Classic Vehicle Mode</span>
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
              {platformName}
            </span>
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-800">
            Fitment data for your <strong>{vehicleName}</strong> is based on stock
            platform specifications. Many classic vehicles have brake, suspension,
            axle, or body modifications that affect wheel clearance.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-amber-900">
            <span>⚠️</span>
            <span>Verify clearance before ordering</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ClassicModeBanner;
