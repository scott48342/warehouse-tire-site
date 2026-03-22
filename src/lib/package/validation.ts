/**
 * Package Validation Utilities
 * 
 * Ensures cart totals match, quantities are normalized, and packages are complete.
 */

import type { CartWheelItem, CartTireItem, CartAccessoryItem, CartItem } from "@/lib/cart/CartContext";

export type PackageValidationResult = {
  isValid: boolean;
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  normalized: {
    wheels: CartWheelItem[];
    tires: CartTireItem[];
    accessories: CartAccessoryItem[];
  };
  totals: {
    wheelSubtotal: number;
    tireSubtotal: number;
    accessorySubtotal: number;
    subtotal: number;
    shipping: number;
    estimatedTax: number;
    total: number;
  };
};

/**
 * Standard package quantities
 * Most vehicles need 4 wheels and 4 tires
 */
export const STANDARD_QUANTITIES = {
  wheels: 4,
  tires: 4,
  lugNutsPerWheel: 5, // Most common, varies by vehicle
} as const;

/**
 * Validate and normalize a package from cart items
 */
export function validatePackage(items: CartItem[]): PackageValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Separate by type
  const wheels = items.filter((i): i is CartWheelItem => i.type === "wheel");
  const tires = items.filter((i): i is CartTireItem => i.type === "tire");
  const accessories = items.filter((i): i is CartAccessoryItem => i.type === "accessory");

  // Check for duplicates (same SKU appearing multiple times)
  const wheelSkus = new Set<string>();
  const tireSkus = new Set<string>();
  
  wheels.forEach((w) => {
    if (wheelSkus.has(w.sku)) {
      warnings.push(`Duplicate wheel SKU: ${w.sku}`);
    }
    wheelSkus.add(w.sku);
  });
  
  tires.forEach((t) => {
    if (tireSkus.has(t.sku)) {
      warnings.push(`Duplicate tire SKU: ${t.sku}`);
    }
    tireSkus.add(t.sku);
  });

  // Validate wheel quantities
  const totalWheelQty = wheels.reduce((sum, w) => sum + w.quantity, 0);
  if (totalWheelQty > 0 && totalWheelQty !== STANDARD_QUANTITIES.wheels) {
    if (totalWheelQty < STANDARD_QUANTITIES.wheels) {
      warnings.push(`Only ${totalWheelQty} wheel(s) in cart. Most vehicles need ${STANDARD_QUANTITIES.wheels}.`);
    } else if (totalWheelQty > STANDARD_QUANTITIES.wheels && totalWheelQty !== 5) {
      // 5 is OK (spare wheel)
      warnings.push(`${totalWheelQty} wheels in cart. Standard is ${STANDARD_QUANTITIES.wheels} (or 5 with spare).`);
    }
  }

  // Validate tire quantities
  const totalTireQty = tires.reduce((sum, t) => sum + t.quantity, 0);
  if (totalTireQty > 0 && totalTireQty !== STANDARD_QUANTITIES.tires) {
    if (totalTireQty < STANDARD_QUANTITIES.tires) {
      warnings.push(`Only ${totalTireQty} tire(s) in cart. Most vehicles need ${STANDARD_QUANTITIES.tires}.`);
    } else if (totalTireQty > STANDARD_QUANTITIES.tires && totalTireQty !== 5) {
      warnings.push(`${totalTireQty} tires in cart. Standard is ${STANDARD_QUANTITIES.tires} (or 5 with spare).`);
    }
  }

  // Validate wheel/tire diameter match (if both present)
  if (wheels.length > 0 && tires.length > 0) {
    const wheelDiameters = new Set(wheels.map((w) => w.diameter).filter(Boolean));
    
    tires.forEach((tire) => {
      // Extract diameter from tire size (e.g., "245/45R18" → 18)
      const tireDiaMatch = tire.size.match(/R(\d{2})/i);
      if (tireDiaMatch) {
        const tireDia = tireDiaMatch[1];
        if (wheelDiameters.size > 0 && !wheelDiameters.has(tireDia)) {
          errors.push(`Tire size ${tire.size} doesn't match wheel diameter (${[...wheelDiameters].join(", ")})`);
        }
      }
    });
  }

  // Validate required accessories
  const requiredAccessories = accessories.filter((a) => a.required);
  if (wheels.length > 0 && requiredAccessories.length === 0) {
    warnings.push("No required accessories (lug nuts/hub rings) detected. Technician will verify.");
  }

  // Calculate totals with precision
  const wheelSubtotal = wheels.reduce((sum, w) => sum + w.unitPrice * w.quantity, 0);
  const tireSubtotal = tires.reduce((sum, t) => sum + t.unitPrice * t.quantity, 0);
  const accessorySubtotal = accessories.reduce((sum, a) => sum + a.unitPrice * a.quantity, 0);
  const subtotal = wheelSubtotal + tireSubtotal + accessorySubtotal;
  
  // Shipping (free over $500)
  const shipping = subtotal >= 500 ? 0 : 49.99;
  
  // Estimated tax (placeholder - actual calculated at checkout)
  const estimatedTax = 0;
  
  const total = subtotal + shipping + estimatedTax;

  // Determine completeness
  const hasWheels = wheels.length > 0;
  const hasTires = tires.length > 0;
  const isComplete = hasWheels && hasTires;
  const isValid = errors.length === 0;

  return {
    isValid,
    isComplete,
    errors,
    warnings,
    normalized: {
      wheels,
      tires,
      accessories,
    },
    totals: {
      wheelSubtotal: roundCurrency(wheelSubtotal),
      tireSubtotal: roundCurrency(tireSubtotal),
      accessorySubtotal: roundCurrency(accessorySubtotal),
      subtotal: roundCurrency(subtotal),
      shipping: roundCurrency(shipping),
      estimatedTax: roundCurrency(estimatedTax),
      total: roundCurrency(total),
    },
  };
}

/**
 * Round to 2 decimal places for currency
 */
function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Verify cart total matches calculated total
 */
export function verifyTotalMatch(
  cartTotal: number,
  calculatedTotal: number,
  tolerance: number = 0.01
): { matches: boolean; difference: number } {
  const diff = Math.abs(cartTotal - calculatedTotal);
  return {
    matches: diff <= tolerance,
    difference: roundCurrency(diff),
  };
}

/**
 * Normalize quantities for standard package
 * Returns adjusted items if quantities need fixing
 */
export function normalizeQuantities(items: CartItem[]): {
  adjusted: boolean;
  items: CartItem[];
  changes: string[];
} {
  const changes: string[] = [];
  let adjusted = false;
  
  const result = items.map((item) => {
    if (item.type === "wheel" && item.quantity !== STANDARD_QUANTITIES.wheels) {
      // Don't auto-adjust, just flag
      changes.push(`Wheel ${item.sku}: qty ${item.quantity} (standard: ${STANDARD_QUANTITIES.wheels})`);
    }
    if (item.type === "tire" && item.quantity !== STANDARD_QUANTITIES.tires) {
      changes.push(`Tire ${item.sku}: qty ${item.quantity} (standard: ${STANDARD_QUANTITIES.tires})`);
    }
    return item;
  });

  adjusted = changes.length > 0;
  return { adjusted, items: result, changes };
}
