"use client";

/**
 * Classic Modification Warning
 * 
 * Shows modification awareness information for classic vehicles:
 * - Verification note from platform data
 * - Common modifications that affect fitment
 * - Modification risk level
 * 
 * TRIGGER: Only shown when isClassicVehicle = true
 */

import { AlertTriangle, Wrench, Info } from "lucide-react";

export type ModificationRisk = "low" | "medium" | "high";

export interface ClassicModificationWarningProps {
  /** Verification note from classic API */
  verificationNote?: string;
  /** List of common modifications */
  commonModifications?: string[];
  /** Risk level */
  modificationRisk?: ModificationRisk;
  /** Whether to show in expanded state */
  expanded?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const RISK_CONFIG = {
  low: {
    label: "Low Risk",
    description: "Well-documented platform with predictable fitment",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    borderColor: "border-green-200",
  },
  medium: {
    label: "Medium Risk",
    description: "Common modifications may affect fitment — verify before ordering",
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
    borderColor: "border-amber-200",
  },
  high: {
    label: "High Risk",
    description: "Many variants exist — professional fitment verification recommended",
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    borderColor: "border-red-200",
  },
} as const;

export function ClassicModificationWarning({
  verificationNote,
  commonModifications,
  modificationRisk = "medium",
  expanded = true,
  className = "",
}: ClassicModificationWarningProps) {
  const riskConfig = RISK_CONFIG[modificationRisk];

  // Don't render if no content
  if (!verificationNote && (!commonModifications || commonModifications.length === 0)) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border ${riskConfig.borderColor} ${riskConfig.bgColor} overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-neutral-200/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${riskConfig.textColor}`} />
            <h3 className="font-semibold text-neutral-900">Modification Awareness</h3>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${riskConfig.bgColor} ${riskConfig.textColor} border ${riskConfig.borderColor}`}
          >
            {riskConfig.label}
          </span>
        </div>
        <p className="mt-1 text-sm text-neutral-600">{riskConfig.description}</p>
      </div>

      {expanded && (
        <div className="px-5 py-4 space-y-4">
          {/* Verification Note */}
          {verificationNote && (
            <div className="flex gap-3">
              <Info className="h-4 w-4 mt-0.5 shrink-0 text-neutral-400" />
              <p className="text-sm text-neutral-700">{verificationNote}</p>
            </div>
          )}

          {/* Common Modifications */}
          {commonModifications && commonModifications.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="h-4 w-4 text-neutral-400" />
                <h4 className="text-sm font-medium text-neutral-700">
                  Common Modifications
                </h4>
              </div>
              <ul className="ml-6 space-y-1">
                {commonModifications.map((mod, index) => (
                  <li key={index} className="text-sm text-neutral-600 flex items-start gap-2">
                    <span className="text-neutral-400">•</span>
                    <span>{mod}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ClassicModificationWarning;
