"use client";

/**
 * Classic Verification Checkbox
 * 
 * Requires user acknowledgment before adding classic vehicle wheels to cart.
 * Used in:
 * - Add to cart flow
 * - Checkout flow
 * 
 * TRIGGER: Only shown when cart contains classic vehicle items
 */

import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export interface ClassicVerificationCheckboxProps {
  /** Callback when checkbox state changes */
  onVerificationChange: (verified: boolean) => void;
  /** Initial checked state */
  initialChecked?: boolean;
  /** Platform name for context */
  platformName?: string;
  /** Vehicle name for context */
  vehicleName?: string;
  /** Compact variant for inline use */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function ClassicVerificationCheckbox({
  onVerificationChange,
  initialChecked = false,
  platformName,
  vehicleName,
  compact = false,
  className = "",
}: ClassicVerificationCheckboxProps) {
  const [isChecked, setIsChecked] = useState(initialChecked);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsChecked(checked);
    onVerificationChange(checked);
  };

  if (compact) {
    return (
      <label
        className={`flex items-start gap-3 cursor-pointer ${className}`}
      >
        <input
          type="checkbox"
          checked={isChecked}
          onChange={handleChange}
          className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
        />
        <span className="text-sm text-neutral-700">
          I understand this is a classic vehicle and fitment may vary based on modifications
        </span>
      </label>
    );
  }

  return (
    <div
      className={`rounded-xl border-2 ${
        isChecked
          ? "border-green-300 bg-green-50"
          : "border-amber-300 bg-amber-50"
      } p-4 transition-colors ${className}`}
    >
      <label className="flex items-start gap-4 cursor-pointer">
        <div className="pt-1">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={handleChange}
            className="h-5 w-5 rounded border-2 border-amber-400 text-green-600 focus:ring-green-500 focus:ring-offset-0"
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {isChecked ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            )}
            <span
              className={`font-semibold ${
                isChecked ? "text-green-900" : "text-amber-900"
              }`}
            >
              {isChecked ? "Verification Confirmed" : "Classic Vehicle Acknowledgment Required"}
            </span>
          </div>
          <p
            className={`mt-2 text-sm ${
              isChecked ? "text-green-800" : "text-amber-800"
            }`}
          >
            {vehicleName && (
              <>
                Your <strong>{vehicleName}</strong>
                {platformName && <> ({platformName})</>} is a classic vehicle.{" "}
              </>
            )}
            I acknowledge that:
          </p>
          <ul
            className={`mt-2 ml-4 space-y-1 text-sm ${
              isChecked ? "text-green-700" : "text-amber-700"
            }`}
          >
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>
                Fitment is based on stock platform specifications
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>
                Modifications (brakes, suspension, body) may affect clearance
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>
                I am responsible for verifying fitment before installation
              </span>
            </li>
          </ul>
        </div>
      </label>
    </div>
  );
}

/**
 * Hook to manage classic verification state
 */
export function useClassicVerification() {
  const [isVerified, setIsVerified] = useState(false);
  
  return {
    isVerified,
    setIsVerified,
    requiresVerification: true,
    VerificationCheckbox: (props: Omit<ClassicVerificationCheckboxProps, "onVerificationChange">) => (
      <ClassicVerificationCheckbox
        {...props}
        onVerificationChange={setIsVerified}
        initialChecked={isVerified}
      />
    ),
  };
}

export default ClassicVerificationCheckbox;
