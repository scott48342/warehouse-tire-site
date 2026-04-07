/**
 * Fitment Guidance System
 * 
 * Provides user-friendly fitment labels and build requirement badges
 * WITHOUT hiding/blocking any valid wheels from the catalog.
 * 
 * Philosophy:
 * - Show ALL compatible wheels
 * - Label fitment quality clearly
 * - Indicate build requirements honestly
 * - Let customers make informed decisions
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type FitmentLevel = 
  | "perfect"     // OEM-equivalent or near-OEM sizing
  | "recommended" // Safe aftermarket upgrade, minimal or no mods
  | "popular"     // Common upgrade, may need minor mods
  | "aggressive"; // Significant deviation, requires mods

export type BuildRequirement = 
  | "stock"           // Works with stock suspension
  | "level"           // Requires leveling kit (1-2")
  | "lift-small"      // Requires lift (3-4")
  | "lift-large"      // Requires lift (6"+)
  | "may-trim";       // May require fender trimming

export type FitmentGuidance = {
  level: FitmentLevel;
  levelLabel: string;
  levelDescription: string;
  levelColor: string;
  levelIcon: string;
  
  buildRequirement: BuildRequirement;
  buildLabel: string;
  buildDescription: string;
  buildColor: string;
  buildIcon: string;
  
  // Debug info
  reasoning: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// UI CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

export const FITMENT_LEVEL_CONFIG: Record<FitmentLevel, {
  label: string;
  description: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: string;
}> = {
  perfect: {
    label: "Perfect Fit",
    description: "Matches OEM specifications exactly",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    borderColor: "border-green-200",
    icon: "✓",
  },
  recommended: {
    label: "Recommended",
    description: "Safe upgrade with minimal changes",
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
    borderColor: "border-blue-200",
    icon: "👍",
  },
  popular: {
    label: "Popular Upgrade",
    description: "Common size upgrade, may need minor mods",
    bgColor: "bg-amber-100",
    textColor: "text-amber-800",
    borderColor: "border-amber-200",
    icon: "⭐",
  },
  aggressive: {
    label: "Aggressive Fitment",
    description: "Requires modifications for proper fit",
    bgColor: "bg-orange-100",
    textColor: "text-orange-800",
    borderColor: "border-orange-200",
    icon: "⚡",
  },
};

export const BUILD_REQUIREMENT_CONFIG: Record<BuildRequirement, {
  label: string;
  description: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: string;
}> = {
  stock: {
    label: "Works with Stock",
    description: "No suspension changes needed",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    borderColor: "border-green-200",
    icon: "✓",
  },
  level: {
    label: "Requires Level (1-2\")",
    description: "Leveling kit recommended",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    icon: "↕",
  },
  "lift-small": {
    label: "Best with 3-4\" Lift",
    description: "Lift kit recommended",
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
    borderColor: "border-amber-200",
    icon: "⬆",
  },
  "lift-large": {
    label: "Best with 6\"+ Lift",
    description: "Significant lift recommended",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
    borderColor: "border-orange-200",
    icon: "⬆⬆",
  },
  "may-trim": {
    label: "May Require Trimming",
    description: "Fender modification may be needed",
    bgColor: "bg-neutral-100",
    textColor: "text-neutral-700",
    borderColor: "border-neutral-200",
    icon: "✂",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GUIDANCE CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

export interface WheelSpecs {
  diameter: number;
  width: number;
  offset: number;
}

export interface OEMBaseline {
  minDiameter: number;
  maxDiameter: number;
  minWidth: number;
  maxWidth: number;
  minOffset: number;
  maxOffset: number;
  vehicleType?: "truck" | "suv" | "car";
}

/**
 * Calculate fitment guidance for a wheel based on OEM baseline specs.
 * 
 * This function NEVER blocks/hides wheels - it only provides guidance labels.
 * All valid bolt-pattern-matching wheels should be shown with appropriate labels.
 * 
 * POKE CALCULATION (2026-04-07):
 * Real fitment requirements are driven primarily by POKE - how far the wheel
 * sticks out from the hub face. Poke is affected by:
 * - Offset decrease (lower offset = more poke)
 * - Width increase (wider wheel = more poke on outside edge)
 * 
 * Formula: poke = ((wheelWidth - oemWidth) / 2 * 25.4) + (oemOffset - wheelOffset)
 * Result is in mm. Positive = sticks out more, negative = tucked in.
 */
export function calculateFitmentGuidance(
  wheel: WheelSpecs,
  oem: OEMBaseline
): FitmentGuidance {
  const reasoning: string[] = [];
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: Calculate deviations from OEM
  // ─────────────────────────────────────────────────────────────────────────
  
  const isTruckOrSuv = oem.vehicleType === "truck" || oem.vehicleType === "suv";
  
  // Diameter deviation (positive = larger, negative = smaller)
  const diameterDelta = wheel.diameter - oem.maxDiameter;
  
  // Width deviation (positive = wider) - in inches
  const oemTypicalWidth = (oem.minWidth + oem.maxWidth) / 2; // Use midpoint as reference
  const widthDelta = wheel.width - oem.maxWidth;
  const widthDeltaFromTypical = wheel.width - oemTypicalWidth;
  
  // Offset deviation - raw difference
  const oemTypicalOffset = (oem.minOffset + oem.maxOffset) / 2; // Use midpoint as reference
  const offsetDeviation = oemTypicalOffset - wheel.offset; // positive = more poke
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: Calculate POKE (the key metric for trucks/SUVs)
  // ─────────────────────────────────────────────────────────────────────────
  // Poke = how far the wheel face extends beyond where OEM wheel would sit
  // 
  // Formula: poke = widthContribution + offsetContribution
  // - Width contribution: half of extra width (in mm) pushes outward
  // - Offset contribution: lower offset pushes the whole wheel outward
  //
  // Example: 20x12 -44 vs OEM 20x8 +18
  // - Width contribution: ((12 - 8) / 2) * 25.4 = 50.8mm
  // - Offset contribution: 18 - (-44) = 62mm  
  // - Total poke: 50.8 + 62 = 112.8mm (VERY aggressive!)
  
  const widthContributionMm = (widthDeltaFromTypical / 2) * 25.4; // Convert half-inch to mm
  const offsetContributionMm = oemTypicalOffset - wheel.offset;
  const totalPokeMm = widthContributionMm + offsetContributionMm;
  
  reasoning.push(`Diameter: ${wheel.diameter}" (OEM: ${oem.minDiameter}-${oem.maxDiameter}")`);
  reasoning.push(`Width: ${wheel.width}" (OEM: ${oem.minWidth}-${oem.maxWidth}", typical: ${oemTypicalWidth}")`);
  reasoning.push(`Offset: ${wheel.offset}mm (OEM: ${oem.minOffset}-${oem.maxOffset}mm, typical: ${oemTypicalOffset}mm)`);
  reasoning.push(`Width poke contribution: ${widthContributionMm.toFixed(1)}mm`);
  reasoning.push(`Offset poke contribution: ${offsetContributionMm.toFixed(1)}mm`);
  reasoning.push(`TOTAL POKE: ${totalPokeMm.toFixed(1)}mm`);
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: Determine Fitment Level (based on overall deviation)
  // ─────────────────────────────────────────────────────────────────────────
  
  let level: FitmentLevel = "perfect";
  
  // Check if within OEM range
  const inOemDiameter = wheel.diameter >= oem.minDiameter && wheel.diameter <= oem.maxDiameter;
  const inOemWidth = wheel.width >= oem.minWidth && wheel.width <= oem.maxWidth;
  const inOemOffset = wheel.offset >= oem.minOffset && wheel.offset <= oem.maxOffset;
  
  if (inOemDiameter && inOemWidth && inOemOffset) {
    level = "perfect";
    reasoning.push("→ Level: Perfect (within OEM specifications)");
  } else if (totalPokeMm <= 15 && diameterDelta <= 2) {
    // Minimal poke + reasonable diameter = Recommended
    level = "recommended";
    reasoning.push("→ Level: Recommended (minimal poke, safe upgrade)");
  } else if (totalPokeMm <= 35 && diameterDelta <= 4) {
    // Moderate poke = Popular
    level = "popular";
    reasoning.push("→ Level: Popular (moderate poke, common upgrade)");
  } else {
    // High poke or large diameter = Aggressive
    level = "aggressive";
    reasoning.push("→ Level: Aggressive (significant deviation from OEM)");
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4: Determine Build Requirement (POKE-DRIVEN for trucks)
  // ─────────────────────────────────────────────────────────────────────────
  // For trucks/SUVs, poke is the PRIMARY factor for clearance requirements.
  // Wider wheels (10"+, 12"+) increase the severity.
  
  let buildRequirement: BuildRequirement = "stock";
  let needsTrimming = false;
  
  if (isTruckOrSuv) {
    // ═══════════════════════════════════════════════════════════════════════
    // TRUCK/SUV BUILD REQUIREMENTS (POKE-DRIVEN)
    // ═══════════════════════════════════════════════════════════════════════
    // 
    // Width multiplier: wide wheels are more aggressive
    // 10"+ = 1.1x, 12"+ = 1.25x, 14"+ = 1.4x
    let widthMultiplier = 1.0;
    if (wheel.width >= 14) {
      widthMultiplier = 1.4;
    } else if (wheel.width >= 12) {
      widthMultiplier = 1.25;
    } else if (wheel.width >= 10) {
      widthMultiplier = 1.1;
    }
    
    // Apply width multiplier to poke for severity calculation
    const effectivePoke = totalPokeMm * widthMultiplier;
    
    // Add diameter contribution (secondary factor)
    // Large diameter wheels (+4"+) need more clearance even with low poke
    const diameterBonus = diameterDelta > 0 ? diameterDelta * 5 : 0; // 5mm per inch over OEM
    
    const totalSeverity = effectivePoke + diameterBonus;
    
    reasoning.push(`Width multiplier: ${widthMultiplier}x (wheel is ${wheel.width}")`);
    reasoning.push(`Effective poke: ${effectivePoke.toFixed(1)}mm`);
    reasoning.push(`Diameter bonus: ${diameterBonus.toFixed(1)}mm`);
    reasoning.push(`TOTAL SEVERITY: ${totalSeverity.toFixed(1)}mm`);
    
    // Thresholds for trucks (calibrated to real-world fitment):
    // 
    // Real-world examples on Silverado 1500 (OEM ~20x8 +18):
    // - 20x9 +18  → Stock (minimal poke ~12mm)
    // - 20x10 -18 → Level (moderate poke ~60-70mm)
    // - 20x12 -44 → Lift 3-4" (aggressive poke ~100-120mm)
    // - 22x12 -44 → Lift 6"+ (very aggressive, 120mm+ with diameter)
    //
    // Thresholds (after width multiplier and diameter bonus):
    // ≤20mm  → Stock (barely noticeable)
    // ≤45mm  → Stock (works but may rub at full lock)
    // ≤75mm  → Requires level (1-2")
    // ≤110mm → Requires lift (3-4")
    // >110mm → Requires lift (6"+)
    
    if (totalSeverity <= 20) {
      buildRequirement = "stock";
      reasoning.push("→ Build: Works with Stock (severity ≤20mm)");
    } else if (totalSeverity <= 45) {
      // Works stock but borderline - some rubbing possible
      buildRequirement = "stock";
      reasoning.push("→ Build: Works with Stock (may rub at full lock)");
    } else if (totalSeverity <= 75) {
      buildRequirement = "level";
      reasoning.push("→ Build: Requires Level 1-2\" (severity 46-75mm)");
    } else if (totalSeverity <= 110) {
      buildRequirement = "lift-small";
      reasoning.push("→ Build: Requires Lift 3-4\" (severity 76-110mm)");
    } else {
      buildRequirement = "lift-large";
      reasoning.push("→ Build: Requires Lift 6\"+ (severity >110mm)");
      // Very aggressive setups likely need trimming too
      if (totalSeverity > 130 || wheel.width >= 14) {
        needsTrimming = true;
      }
    }
    
    // Extra trimming check: very wide wheels with aggressive offset
    // 12"+ wheels with -24mm or worse offset almost always need trimming
    if (wheel.width >= 12 && wheel.offset <= -24) {
      needsTrimming = true;
      reasoning.push("→ Trimming flag: 12\"+ wheel with ≤-24mm offset");
    }
    
    // 22"+ diameter with aggressive poke also needs trimming
    if (wheel.diameter >= 22 && totalSeverity > 80) {
      needsTrimming = true;
      reasoning.push("→ Trimming flag: 22\"+ wheel with aggressive poke");
    }
    
  } else {
    // ═══════════════════════════════════════════════════════════════════════
    // CAR BUILD REQUIREMENTS (more conservative)
    // ═══════════════════════════════════════════════════════════════════════
    // Cars have less fender clearance, so thresholds are lower
    
    if (totalPokeMm <= 5 && diameterDelta <= 1) {
      buildRequirement = "stock";
      reasoning.push("→ Build (car): Works with Stock");
    } else if (totalPokeMm <= 15) {
      buildRequirement = "stock";
      reasoning.push("→ Build (car): Works with Stock (borderline)");
    } else if (totalPokeMm <= 25) {
      // Cars don't have "level" - they need coilovers or fender work
      needsTrimming = true;
      buildRequirement = "stock";
      reasoning.push("→ Build (car): May require fender rolling/trimming");
    } else {
      needsTrimming = true;
      buildRequirement = "stock";
      reasoning.push("→ Build (car): Likely requires fender work");
    }
  }
  
  // Apply trimming override if needed
  if (needsTrimming && buildRequirement !== "lift-large") {
    // Don't downgrade from lift-large to may-trim
    if (buildRequirement === "lift-small") {
      // Keep lift-small but note trimming is also needed
      reasoning.push("→ Note: Fender trimming may also be needed");
    } else {
      buildRequirement = "may-trim";
      reasoning.push("→ Build override: May require fender trimming");
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // STEP 5: Build response
  // ─────────────────────────────────────────────────────────────────────────
  
  const levelConfig = FITMENT_LEVEL_CONFIG[level];
  const buildConfig = BUILD_REQUIREMENT_CONFIG[buildRequirement];
  
  return {
    level,
    levelLabel: levelConfig.label,
    levelDescription: levelConfig.description,
    levelColor: `${levelConfig.bgColor} ${levelConfig.textColor} ${levelConfig.borderColor}`,
    levelIcon: levelConfig.icon,
    
    buildRequirement,
    buildLabel: buildConfig.label,
    buildDescription: buildConfig.description,
    buildColor: `${buildConfig.bgColor} ${buildConfig.textColor} ${buildConfig.borderColor}`,
    buildIcon: buildConfig.icon,
    
    reasoning,
  };
}

/**
 * Convert existing fitmentClass (surefit/specfit/extended) to fitment level.
 * This provides backward compatibility with the existing validation system.
 */
export function fitmentClassToLevel(fitmentClass: "surefit" | "specfit" | "extended" | string): FitmentLevel {
  switch (fitmentClass) {
    case "surefit":
      return "perfect";
    case "specfit":
      return "recommended";
    case "extended":
      return "popular";
    default:
      return "aggressive";
  }
}

/**
 * Quick guidance calculation when we only have fitmentClass and basic wheel specs.
 * Used when full OEM baseline isn't available.
 */
export function calculateQuickGuidance(
  fitmentClass: "surefit" | "specfit" | "extended" | string,
  wheel: Partial<WheelSpecs>,
  vehicleType?: "truck" | "suv" | "car"
): Pick<FitmentGuidance, "level" | "levelLabel" | "levelColor" | "levelIcon" | "buildRequirement" | "buildLabel" | "buildColor" | "buildIcon"> {
  const level = fitmentClassToLevel(fitmentClass);
  const levelConfig = FITMENT_LEVEL_CONFIG[level];
  
  // Estimate build requirement from fitment level and vehicle type
  let buildRequirement: BuildRequirement = "stock";
  
  if (level === "aggressive") {
    buildRequirement = vehicleType === "truck" ? "lift-small" : "may-trim";
  } else if (level === "popular") {
    buildRequirement = vehicleType === "truck" ? "level" : "stock";
  }
  
  // For trucks/SUVs with large wheels, suggest lift
  if (vehicleType === "truck" || vehicleType === "suv") {
    const wheelDia = wheel.diameter || 0;
    if (wheelDia >= 22) {
      buildRequirement = "level";
    }
    if (wheelDia >= 24) {
      buildRequirement = "lift-small";
    }
  }
  
  const buildConfig = BUILD_REQUIREMENT_CONFIG[buildRequirement];
  
  return {
    level,
    levelLabel: levelConfig.label,
    levelColor: `${levelConfig.bgColor} ${levelConfig.textColor} ${levelConfig.borderColor}`,
    levelIcon: levelConfig.icon,
    buildRequirement,
    buildLabel: buildConfig.label,
    buildColor: `${buildConfig.bgColor} ${buildConfig.textColor} ${buildConfig.borderColor}`,
    buildIcon: buildConfig.icon,
  };
}
