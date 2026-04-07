"use client";

import {
  type FitmentLevel,
  type BuildRequirement,
  FITMENT_LEVEL_CONFIG,
  BUILD_REQUIREMENT_CONFIG,
} from "@/lib/fitment/guidance";

// ═══════════════════════════════════════════════════════════════════════════════
// FITMENT LEVEL BADGE
// Shows: Perfect Fit / Recommended / Popular Upgrade / Aggressive Fitment
// ═══════════════════════════════════════════════════════════════════════════════

export function FitmentLevelBadge({
  level,
  variant = "default",
  showIcon = true,
  className = "",
}: {
  level: FitmentLevel;
  variant?: "default" | "compact" | "full";
  showIcon?: boolean;
  className?: string;
}) {
  const config = FITMENT_LEVEL_CONFIG[level];
  
  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}`}
        title={config.description}
      >
        {showIcon && <span className="text-[9px]">{config.icon}</span>}
        {config.label}
      </span>
    );
  }
  
  if (variant === "full") {
    return (
      <div className={`rounded-lg border p-2 ${config.bgColor} ${config.borderColor} ${className}`}>
        <div className="flex items-center gap-2">
          {showIcon && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm">
              {config.icon}
            </span>
          )}
          <div>
            <div className={`text-sm font-bold ${config.textColor}`}>
              {config.label}
            </div>
            <div className="text-xs text-neutral-600">
              {config.description}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Default variant
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}`}
      title={config.description}
    >
      {showIcon && <span>{config.icon}</span>}
      {config.label}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD REQUIREMENT BADGE
// Shows: Works with Stock / Requires Level / Requires Lift / May Require Trimming
// ═══════════════════════════════════════════════════════════════════════════════

export function BuildRequirementBadge({
  requirement,
  variant = "default",
  showIcon = true,
  className = "",
}: {
  requirement: BuildRequirement;
  variant?: "default" | "compact" | "full";
  showIcon?: boolean;
  className?: string;
}) {
  const config = BUILD_REQUIREMENT_CONFIG[requirement];
  
  // Don't show "Works with Stock" in compact mode - it's the default
  if (variant === "compact" && requirement === "stock") {
    return null;
  }
  
  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}`}
        title={config.description}
      >
        {showIcon && <span className="text-[9px]">{config.icon}</span>}
        {config.label}
      </span>
    );
  }
  
  if (variant === "full") {
    return (
      <div className={`rounded-lg border p-2 ${config.bgColor} ${config.borderColor} ${className}`}>
        <div className="flex items-center gap-2">
          {showIcon && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm">
              {config.icon}
            </span>
          )}
          <div>
            <div className={`text-sm font-semibold ${config.textColor}`}>
              {config.label}
            </div>
            <div className="text-xs text-neutral-600">
              {config.description}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Default variant
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}`}
      title={config.description}
    >
      {showIcon && <span>{config.icon}</span>}
      {config.label}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED FITMENT GUIDANCE STRIP
// Shows both badges in a horizontal strip for wheel cards
// ═══════════════════════════════════════════════════════════════════════════════

export function FitmentGuidanceStrip({
  level,
  buildRequirement,
  variant = "default",
  className = "",
}: {
  level: FitmentLevel;
  buildRequirement: BuildRequirement;
  variant?: "compact" | "default" | "stacked";
  className?: string;
}) {
  if (variant === "stacked") {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <FitmentLevelBadge level={level} variant="default" />
        {buildRequirement !== "stock" && (
          <BuildRequirementBadge requirement={buildRequirement} variant="default" />
        )}
      </div>
    );
  }
  
  if (variant === "compact") {
    return (
      <div className={`flex flex-wrap items-center gap-1 ${className}`}>
        <FitmentLevelBadge level={level} variant="compact" />
        <BuildRequirementBadge requirement={buildRequirement} variant="compact" />
      </div>
    );
  }
  
  // Default: horizontal with gap
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <FitmentLevelBadge level={level} variant="default" />
      {buildRequirement !== "stock" && (
        <BuildRequirementBadge requirement={buildRequirement} variant="default" />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FITMENT GUIDANCE CARD (for PDP or detailed views)
// ═══════════════════════════════════════════════════════════════════════════════

export function FitmentGuidanceCard({
  level,
  buildRequirement,
  wheelSpecs,
  oemSpecs,
  className = "",
}: {
  level: FitmentLevel;
  buildRequirement: BuildRequirement;
  wheelSpecs?: { diameter?: number; width?: number; offset?: number };
  oemSpecs?: { minDiameter?: number; maxDiameter?: number; minWidth?: number; maxWidth?: number; minOffset?: number; maxOffset?: number };
  className?: string;
}) {
  const levelConfig = FITMENT_LEVEL_CONFIG[level];
  const buildConfig = BUILD_REQUIREMENT_CONFIG[buildRequirement];
  
  return (
    <div className={`rounded-xl border bg-white p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${levelConfig.bgColor} text-lg`}>
          {levelConfig.icon}
        </span>
        <div>
          <h3 className={`text-base font-bold ${levelConfig.textColor}`}>
            {levelConfig.label}
          </h3>
          <p className="text-xs text-neutral-500">
            {levelConfig.description}
          </p>
        </div>
      </div>
      
      {/* Build requirement */}
      <div className={`rounded-lg p-2 mb-3 ${buildConfig.bgColor} ${buildConfig.borderColor} border`}>
        <div className="flex items-center gap-2">
          <span>{buildConfig.icon}</span>
          <div>
            <span className={`text-sm font-semibold ${buildConfig.textColor}`}>
              {buildConfig.label}
            </span>
            <span className="text-xs text-neutral-500 ml-2">
              {buildConfig.description}
            </span>
          </div>
        </div>
      </div>
      
      {/* Specs comparison (if available) */}
      {wheelSpecs && oemSpecs && (
        <div className="space-y-2 text-xs">
          <div className="font-semibold text-neutral-700 mb-1">Specs vs OEM:</div>
          
          {wheelSpecs.diameter !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Diameter</span>
              <span className="font-medium">
                {wheelSpecs.diameter}"
                <span className="text-neutral-400 ml-1">
                  (OEM: {oemSpecs.minDiameter}-{oemSpecs.maxDiameter}")
                </span>
              </span>
            </div>
          )}
          
          {wheelSpecs.width !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Width</span>
              <span className="font-medium">
                {wheelSpecs.width}"
                <span className="text-neutral-400 ml-1">
                  (OEM: {oemSpecs.minWidth}-{oemSpecs.maxWidth}")
                </span>
              </span>
            </div>
          )}
          
          {wheelSpecs.offset !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Offset</span>
              <span className="font-medium">
                {wheelSpecs.offset}mm
                <span className="text-neutral-400 ml-1">
                  (OEM: {oemSpecs.minOffset}-{oemSpecs.maxOffset}mm)
                </span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
