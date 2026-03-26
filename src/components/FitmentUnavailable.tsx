"use client";

import Link from "next/link";

/**
 * FitmentUnavailable Component
 * 
 * Displayed when the fitment API returns `blocked: true`, meaning
 * we don't have enough confidence in the fitment data to show wheel results.
 * 
 * This protects customers from ordering wheels that might not fit.
 * 
 * @module FitmentUnavailable
 */

export interface FitmentUnavailableProps {
  /** Vehicle info for display */
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  };
  
  /** Reason why fitment was blocked (from API) */
  blockReason?: string;
  
  /** Suggested actions for the user */
  suggestions?: string[];
  
  /** Additional context from confidence calculation */
  confidenceReasons?: string[];
  
  /** Phone number for customer support */
  supportPhone?: string;
  
  /** Whether to show alternative options */
  showAlternatives?: boolean;
  
  /** Additional CSS classes */
  className?: string;
}

const DEFAULT_SUGGESTIONS = [
  "Try selecting a different trim level if available",
  "Contact our fitment specialists for manual lookup",
  "Check your owner's manual for wheel specifications",
];

/**
 * FitmentUnavailable Component
 * 
 * Friendly error state when wheel results can't be shown.
 * Provides helpful alternatives and support contact.
 */
export function FitmentUnavailable({
  vehicle,
  blockReason,
  suggestions = DEFAULT_SUGGESTIONS,
  confidenceReasons = [],
  supportPhone = "(248) 332-4120",
  showAlternatives = true,
  className = "",
}: FitmentUnavailableProps) {
  const vehicleLabel = vehicle
    ? [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ")
    : "your vehicle";

  return (
    <div className={`rounded-2xl border-2 border-amber-200 bg-gradient-to-b from-amber-50 to-white p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-2xl">
          🔍
        </div>
        
        <div className="flex-1">
          <h2 className="text-xl font-extrabold text-neutral-900">
            Wheel Fitment Data Unavailable
          </h2>
          
          <p className="mt-1 text-neutral-700">
            We don't have verified fitment data for {vehicleLabel} at this time.
          </p>
          
          {blockReason && (
            <p className="mt-2 text-sm text-amber-800 bg-amber-100 rounded-lg px-3 py-2">
              <span className="font-semibold">Reason:</span> {blockReason}
            </p>
          )}
        </div>
      </div>

      {/* Safety Message */}
      <div className="mt-5 rounded-xl bg-white border border-neutral-200 p-4">
        <div className="flex items-start gap-3">
          <span className="text-green-600 text-lg">✓</span>
          <div>
            <h3 className="font-bold text-neutral-900">Your safety matters</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Rather than showing wheels that might not fit, we prefer to connect you 
              with our fitment experts who can manually verify compatibility for your vehicle.
            </p>
          </div>
        </div>
      </div>

      {/* What You Can Do */}
      {showAlternatives && (
        <div className="mt-5">
          <h3 className="font-bold text-neutral-900">What you can do</h3>
          
          <ul className="mt-3 space-y-2">
            {suggestions.map((suggestion, idx) => (
              <li 
                key={idx}
                className="flex items-start gap-2 text-sm text-neutral-700"
              >
                <span className="text-amber-600 font-bold">→</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Contact CTA */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <a
          href={`tel:${supportPhone.replace(/[^0-9]/g, "")}`}
          className="flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-neutral-800 transition-colors"
        >
          <span>📞</span>
          <span>Call {supportPhone}</span>
        </a>
        
        <Link
          href="/contact"
          className="flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50 transition-colors"
        >
          <span>✉️</span>
          <span>Send a Message</span>
        </Link>
      </div>

      {/* Alternative Actions */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-neutral-200">
        <Link
          href="/tires"
          className="text-sm font-semibold text-neutral-600 hover:text-neutral-900 underline"
        >
          Browse Tires Instead
        </Link>
        
        <span className="text-neutral-300">|</span>
        
        <Link
          href="/wheels"
          className="text-sm font-semibold text-neutral-600 hover:text-neutral-900 underline"
        >
          Browse All Wheels
        </Link>
        
        <span className="text-neutral-300">|</span>
        
        <Link
          href="/"
          className="text-sm font-semibold text-neutral-600 hover:text-neutral-900 underline"
        >
          Change Vehicle
        </Link>
      </div>

      {/* Debug info (only shown when reasons are provided) */}
      {confidenceReasons.length > 0 && process.env.NODE_ENV === "development" && (
        <details className="mt-6 text-xs text-neutral-500">
          <summary className="cursor-pointer font-semibold hover:text-neutral-700">
            Technical details (dev only)
          </summary>
          <ul className="mt-2 ml-4 space-y-1 font-mono">
            {confidenceReasons.map((reason, idx) => (
              <li key={idx}>• {reason}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * Compact version for inline use (e.g., in sidebars)
 */
export function FitmentUnavailableCompact({
  vehicle,
  supportPhone = "(248) 332-4120",
  className = "",
}: Pick<FitmentUnavailableProps, "vehicle" | "supportPhone" | "className">) {
  const vehicleLabel = vehicle
    ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")
    : "this vehicle";

  return (
    <div className={`rounded-xl border border-amber-200 bg-amber-50 p-4 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">🔍</span>
        <span className="font-semibold text-amber-900 text-sm">
          Fitment data unavailable
        </span>
      </div>
      
      <p className="mt-2 text-xs text-amber-800">
        We don't have verified wheel fitment data for {vehicleLabel}. 
        Please call <a href={`tel:${supportPhone.replace(/[^0-9]/g, "")}`} className="font-bold underline">{supportPhone}</a> for assistance.
      </p>
    </div>
  );
}

/**
 * Medium confidence warning banner
 * Used when we CAN show results but with a warning
 */
export function FitmentMediumConfidenceWarning({
  message = "Hub ring compatibility cannot be verified. Please confirm center bore compatibility before installation.",
  className = "",
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-amber-200 bg-amber-50 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="text-amber-600 text-lg">⚠</span>
        <div>
          <h4 className="font-bold text-amber-900 text-sm">Partial Fitment Data</h4>
          <p className="mt-1 text-xs text-amber-800">{message}</p>
        </div>
      </div>
    </div>
  );
}

export default FitmentUnavailable;
