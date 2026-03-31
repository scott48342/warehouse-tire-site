"use client";

/**
 * Classic Mode Section
 * 
 * Composite component that renders the full Classic Mode UI when a classic
 * vehicle is detected. Combines banner, fitment card, and modification warning.
 * 
 * USAGE:
 * ```tsx
 * // Only render if isClassicVehicle is true
 * {classicData?.isClassicVehicle && (
 *   <ClassicModeSection
 *     vehicleName="1969 Chevrolet Camaro"
 *     classicData={classicData}
 *   />
 * )}
 * ```
 * 
 * TRIGGER: Only shown when isClassicVehicle = true
 */

import { ClassicModeBanner } from "./ClassicModeBanner";
import { ClassicFitmentCard, type ClassicFitmentData } from "./ClassicFitmentCard";
import { ClassicModificationWarning, type ModificationRisk } from "./ClassicModificationWarning";

export interface ClassicApiResponse {
  isClassicVehicle: boolean;
  fitmentMode: "classic" | "not_classic";
  platform: {
    code: string;
    name: string;
    generationName?: string;
    yearRange: string;
  };
  vehicle: {
    year: number;
    make: string;
    model: string;
  };
  fitmentStyle: string;
  confidence: "high" | "medium" | "low";
  verificationRequired: boolean;
  verificationNote?: string;
  commonModifications?: string[];
  modificationRisk?: ModificationRisk;
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

export interface ClassicModeSectionProps {
  /** Vehicle display name (e.g., "1969 Chevrolet Camaro") */
  vehicleName: string;
  /** Classic API response data */
  classicData: ClassicApiResponse;
  /** Whether to show compact versions */
  compact?: boolean;
  /** Whether to show the modification warning */
  showModificationWarning?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Transform API response to ClassicFitmentData format
 */
function toFitmentData(data: ClassicApiResponse): ClassicFitmentData {
  return {
    platform: data.platform,
    confidence: data.confidence,
    specs: data.specs,
    recommendedRange: data.recommendedRange,
    stockReference: data.stockReference,
  };
}

export function ClassicModeSection({
  vehicleName,
  classicData,
  compact = false,
  showModificationWarning = true,
  className = "",
}: ClassicModeSectionProps) {
  // Safety check - don't render for non-classic vehicles
  if (!classicData?.isClassicVehicle) {
    return null;
  }

  const fitmentData = toFitmentData(classicData);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Banner */}
      <ClassicModeBanner
        vehicleName={vehicleName}
        platformName={classicData.platform.name}
        compact={compact}
      />

      {/* Fitment Card */}
      <ClassicFitmentCard
        fitment={fitmentData}
        vehicleName={vehicleName}
        compact={compact}
      />

      {/* Modification Warning */}
      {showModificationWarning && (
        <ClassicModificationWarning
          verificationNote={classicData.verificationNote}
          commonModifications={classicData.commonModifications}
          modificationRisk={classicData.modificationRisk}
          expanded={!compact}
        />
      )}
    </div>
  );
}

export default ClassicModeSection;
