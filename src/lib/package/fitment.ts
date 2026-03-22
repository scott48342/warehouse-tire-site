/**
 * Fitment Messaging System
 * 
 * Provides consistent fitment messaging across the checkout funnel.
 * 
 * Fitment Classes:
 * - surefit: OEM-equivalent, guaranteed perfect fit
 * - specfit: Within manufacturer specs, verified fit
 * - extended: Beyond OEM specs, may need modifications
 */

export type FitmentClass = "surefit" | "specfit" | "extended";

export type FitmentMessaging = {
  class: FitmentClass;
  label: string;
  shortLabel: string;
  description: string;
  guaranteeText: string;
  color: "green" | "blue" | "amber";
  icon: string;
  checkoutNote?: string;
  installNote?: string;
};

/**
 * Complete fitment messaging configuration
 */
export const FITMENT_MESSAGES: Record<FitmentClass, FitmentMessaging> = {
  surefit: {
    class: "surefit",
    label: "Guaranteed Fit",
    shortLabel: "Best Fit",
    description: "These wheels match your vehicle's OEM specifications exactly. No modifications needed.",
    guaranteeText: "If these don't fit perfectly, we'll pay for the return shipping and give you a full refund.",
    color: "green",
    icon: "✓",
    checkoutNote: "Direct bolt-on installation. No modifications required.",
    installNote: "Standard installation time. All hardware included.",
  },
  specfit: {
    class: "specfit",
    label: "Verified Fit",
    shortLabel: "Good Fit",
    description: "These wheels are within manufacturer specifications for your vehicle. Verified compatible.",
    guaranteeText: "We've verified these wheels work with your vehicle. Same return policy applies.",
    color: "blue",
    icon: "✓",
    checkoutNote: "Verified compatible with your vehicle specifications.",
    installNote: "Standard installation. Minor adjustments may be made for optimal fit.",
  },
  extended: {
    class: "extended",
    label: "Extended Fit",
    shortLabel: "Aggressive Fit",
    description: "These wheels are beyond OEM specs. May require minor modifications for optimal fitment.",
    guaranteeText: "Fitment verified for your vehicle. Modifications (if needed) are your responsibility.",
    color: "amber",
    icon: "⚡",
    checkoutNote: "Extended fitment — may require spacers, fender rolling, or suspension adjustments.",
    installNote: "Consult with technician before installation. Additional parts may be recommended.",
  },
};

/**
 * Get fitment messaging for a class (with fallback)
 */
export function getFitmentMessaging(fitmentClass?: FitmentClass | null): FitmentMessaging {
  if (fitmentClass && FITMENT_MESSAGES[fitmentClass]) {
    return FITMENT_MESSAGES[fitmentClass];
  }
  // Default to specfit if unknown
  return FITMENT_MESSAGES.specfit;
}

/**
 * Get Tailwind color classes for a fitment class
 */
export function getFitmentColors(fitmentClass?: FitmentClass | null): {
  bg: string;
  border: string;
  text: string;
  badge: string;
} {
  const messaging = getFitmentMessaging(fitmentClass);
  
  switch (messaging.color) {
    case "green":
      return {
        bg: "bg-green-50",
        border: "border-green-200",
        text: "text-green-800",
        badge: "bg-green-100 text-green-800",
      };
    case "blue":
      return {
        bg: "bg-blue-50",
        border: "border-blue-200",
        text: "text-blue-800",
        badge: "bg-blue-100 text-blue-800",
      };
    case "amber":
      return {
        bg: "bg-amber-50",
        border: "border-amber-200",
        text: "text-amber-800",
        badge: "bg-amber-100 text-amber-800",
      };
    default:
      return {
        bg: "bg-neutral-50",
        border: "border-neutral-200",
        text: "text-neutral-800",
        badge: "bg-neutral-100 text-neutral-800",
      };
  }
}

/**
 * Determine fitment class based on wheel specs vs vehicle specs
 */
export function determineFitmentClass(
  wheel: {
    diameter?: string | number;
    width?: string | number;
    offset?: string | number;
    boltPattern?: string;
  },
  vehicle: {
    oemDiameter?: number;
    oemWidth?: number;
    offsetMin?: number;
    offsetMax?: number;
    boltPattern?: string;
    hubBore?: number;
  }
): FitmentClass {
  // If bolt patterns don't match, it's not even extended
  if (wheel.boltPattern && vehicle.boltPattern) {
    const normalizedWheel = normalizeBoltPattern(wheel.boltPattern);
    const normalizedVehicle = normalizeBoltPattern(vehicle.boltPattern);
    if (normalizedWheel !== normalizedVehicle) {
      return "extended"; // Adapter needed
    }
  }

  const wheelDia = parseFloat(String(wheel.diameter || 0));
  const wheelWidth = parseFloat(String(wheel.width || 0));
  const wheelOffset = parseFloat(String(wheel.offset || 0));

  // Check if OEM specs exist
  if (!vehicle.oemDiameter || !vehicle.oemWidth) {
    return "specfit"; // Can't verify, assume good
  }

  // Diameter check
  const diaDiff = Math.abs(wheelDia - vehicle.oemDiameter);
  
  // Width check
  const widthDiff = Math.abs(wheelWidth - vehicle.oemWidth);
  
  // Offset check
  const offsetOk = !vehicle.offsetMin || !vehicle.offsetMax || 
    (wheelOffset >= vehicle.offsetMin && wheelOffset <= vehicle.offsetMax);

  // Surefit: exact OEM match
  if (diaDiff === 0 && widthDiff <= 0.5 && offsetOk) {
    return "surefit";
  }

  // Specfit: within reasonable range
  if (diaDiff <= 1 && widthDiff <= 1 && offsetOk) {
    return "specfit";
  }

  // Extended: outside normal range
  return "extended";
}

/**
 * Normalize bolt pattern for comparison
 * "5x114.3" → "5X114.3"
 * "5x4.5" → "5X114.3" (convert inches to mm)
 */
function normalizeBoltPattern(pattern: string): string {
  const upper = pattern.toUpperCase().replace(/\s/g, "");
  
  // Convert 5x4.5 (inches) to 5x114.3 (mm)
  const inchMatch = upper.match(/^(\d+)X(\d+\.?\d*)$/);
  if (inchMatch) {
    const studs = inchMatch[1];
    const pcd = parseFloat(inchMatch[2]);
    
    // If PCD is less than 20, it's probably inches
    if (pcd < 20) {
      const pcdMm = Math.round(pcd * 25.4 * 10) / 10;
      return `${studs}X${pcdMm}`;
    }
  }
  
  return upper;
}

/**
 * Generate fitment summary for display
 */
export function generateFitmentSummary(
  fitmentClass: FitmentClass,
  vehicle?: { year: string; make: string; model: string; trim?: string }
): string {
  const vehicleStr = vehicle 
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`
    : "your vehicle";

  switch (fitmentClass) {
    case "surefit":
      return `Perfect fit for ${vehicleStr}. Direct bolt-on, no modifications.`;
    case "specfit":
      return `Verified fit for ${vehicleStr}. Compatible with factory specs.`;
    case "extended":
      return `Extended fit for ${vehicleStr}. May require adjustments.`;
    default:
      return `Fitment verified for ${vehicleStr}.`;
  }
}
