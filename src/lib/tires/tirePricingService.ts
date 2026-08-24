/**
 * Tire Pricing Service
 * 
 * Single source of truth for tire pricing across all WTD systems.
 * Used by:
 * - /api/tires/search (normal shopping)
 * - Saved Quote validation (verifyPricing)
 * - Saved Quote resume (revalidation)
 * 
 * Pricing formula:
 * - Standard tires: cost + $50 (STANDARD_TIRE_ADDER)
 * - Commercial/medium-truck tires: cost + $165 (COMMERCIAL_TIRE_ADDER)
 * 
 * @created 2026-08-24
 */

import { searchTiresTireWeb, tireWebTireToUnified, type UnifiedTire } from "@/lib/tirewire/client";
import { checkStockBySize as checkStockUSAF, getStatus as getUSAFStatus, type USAutoForceStockItem } from "@/lib/usautoforce";

// ============================================================================
// Pricing Constants
// ============================================================================

/** Standard tire margin: cost + $50 */
export const STANDARD_TIRE_ADDER = 50;

/** Commercial/medium-truck margin: cost + $165 */
export const COMMERCIAL_TIRE_ADDER = 165;

// ============================================================================
// Commercial Size Detection
// ============================================================================

/**
 * Detect if a tire size is commercial/medium-truck (uses higher margin).
 * Commercial sizes: LT prefix, decimal rims (19.5, 22.5, 24.5), ST prefix
 */
export function isCommercialTruckSize(size: string): boolean {
  if (!size) return false;
  const s = size.toUpperCase();
  
  // LT prefix (light truck)
  if (/^LT\s?\d/.test(s)) return true;
  
  // Decimal rim diameters (medium truck): 19.5, 22.5, 24.5
  if (/R?\d{2}\.5\b/.test(s)) return true;
  
  // Special trailer (ST prefix)
  if (/^ST\s?\d/.test(s)) return true;
  
  // Very large flotation sizes (commercial use)
  const flotMatch = s.match(/^(\d{2,3})[X\/]/);
  if (flotMatch && parseInt(flotMatch[1], 10) >= 40) return true;
  
  return false;
}

// ============================================================================
// Price Calculation
// ============================================================================

/**
 * Calculate sell price from cost.
 * Returns null if cost is invalid.
 */
export function calculateTireSellPrice(
  cost: number | null | undefined,
  size: string
): number | null {
  if (cost == null || cost <= 0) return null;
  
  const marginAdder = isCommercialTruckSize(size) ? COMMERCIAL_TIRE_ADDER : STANDARD_TIRE_ADDER;
  const price = cost + marginAdder;
  
  // Round to 2 decimal places
  return Math.round(price * 100) / 100;
}

// ============================================================================
// Tire Lookup Result
// ============================================================================

export interface TireLookupResult {
  found: boolean;
  partNumber: string;
  mfgPartNumber: string | null;
  brand: string;
  model: string;
  size: string;
  cost: number | null;
  price: number | null;
  quantity: {
    primary: number;
    alternate: number;
    national: number;
  };
  imageUrl: string | null;
  source: string;
}

// ============================================================================
// Simple Size Conversion
// ============================================================================

function toSimpleSize(s: string): string {
  const v = String(s || "").trim().toUpperCase();
  
  // Medium-truck decimal rims: 225/70R19.5 → 22570195
  const md = v.match(/(\d{3})\s*\/\s*(\d{2})\s*[A-Z]*\s*R?\s*(\d{2})\.5/i);
  if (md) return `${md[1]}${md[2]}${md[3]}5`;
  
  // Metric sizes: 245/50R18 → 2455018
  const m = v.match(/(\d{3})\s*\/\s*(\d{2})\s*[A-Z]*\s*R?\s*(\d{2})/i);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  
  // Flotation/LT sizes: 37x12.50R22 → 37125022
  const f = v.match(/^(\d{2,3})\s*[X\/\-]\s*(\d{1,2})\.?(\d{0,2})\s*R?\s*(\d{2})/i);
  if (f) {
    const dia = f[1];
    const widthWhole = f[2];
    const widthDecimal = f[3] || "00";
    const rim = f[4];
    return `${dia}${widthWhole}${widthDecimal.padEnd(2, "0")}${rim}`;
  }
  
  // Already in simple format (7 or 8 digits)
  const m2 = v.match(/^(\d{7,8})$/);
  if (m2) return m2[1];
  
  return "";
}

// ============================================================================
// Direct Tire Lookup (bypasses HTTP)
// ============================================================================

/**
 * Look up a specific tire by SKU and size.
 * 
 * Uses the same supplier search as normal shopping but filters to exact SKU.
 * This is the authoritative tire lookup for Saved Quote pricing.
 * 
 * @param sku - Tire SKU/part number
 * @param size - Tire size (e.g., "215/55R16")
 * @returns TireLookupResult or null if not found
 */
export async function lookupTireDirect(
  sku: string,
  size: string
): Promise<TireLookupResult | null> {
  const simpleSize = toSimpleSize(size);
  if (!simpleSize) {
    console.warn(`[tirePricingService] Invalid tire size: ${size}`);
    return null;
  }
  
  // Search TireWeb (primary supplier)
  try {
    const tireWebResults = await searchTiresTireWeb(size);
    
    for (const result of tireWebResults) {
      for (const tire of result.tires) {
        const unified = tireWebTireToUnified(tire, result.provider);
        
        // Match by SKU or manufacturer part number
        if (unified.partNumber === sku || unified.mfgPartNumber === sku) {
          const cost = unified.cost;
          const price = calculateTireSellPrice(cost, unified.size || size);
          
          return {
            found: true,
            partNumber: unified.partNumber,
            mfgPartNumber: unified.mfgPartNumber || unified.partNumber,
            brand: unified.brand || "Unknown",
            model: unified.model || "Unknown",
            size: unified.size || size,
            cost,
            price,
            quantity: unified.quantity,
            imageUrl: unified.imageUrl,
            source: `tireweb:${result.provider}`,
          };
        }
      }
    }
  } catch (err) {
    console.error("[tirePricingService] TireWeb search failed:", err);
  }
  
  // Search US AutoForce (secondary supplier)
  try {
    const usafStatus = getUSAFStatus();
    if (usafStatus.configured) {
      const usafResult = await checkStockUSAF(simpleSize, {
        quantity: 1,
        alternateBranches: ['4862', '4101', '4501', '4701'],
      });
      
      if (usafResult.success && usafResult.items) {
        for (const item of usafResult.items) {
          if (item.partNumber === sku) {
            const cost = item.cost > 0 ? item.cost : null;
            const displaySize = item.tireSize || size;
            const price = calculateTireSellPrice(cost, displaySize);
            
            // Sum up available quantities from all warehouses
            const totalQty = item.availability?.reduce((sum, wh) => sum + (wh.quantityAvailable || 0), 0) || 0;
            
            return {
              found: true,
              partNumber: item.partNumber,
              mfgPartNumber: item.partNumber,
              brand: item.brandCode || "Unknown",
              model: item.model || "Unknown",
              size: displaySize,
              cost,
              price,
              quantity: {
                primary: totalQty,
                alternate: 0,
                national: 0,
              },
              imageUrl: item.imageUrl || null,
              source: "usautoforce",
            };
          }
        }
      }
    }
  } catch (err) {
    console.error("[tirePricingService] USAF search failed:", err);
  }
  
  return null;
}

/**
 * Get authoritative tire price by SKU and size.
 * 
 * This is the single source of truth for tire pricing.
 * Returns null if tire not found or price cannot be determined.
 * 
 * NEVER returns $0 for a purchasable tire.
 */
export async function getTirePrice(
  sku: string,
  size: string
): Promise<number | null> {
  const result = await lookupTireDirect(sku, size);
  
  if (!result || !result.found) {
    return null;
  }
  
  // Price must be positive
  if (result.price == null || result.price <= 0) {
    console.warn(`[tirePricingService] Invalid price for ${sku}: ${result.price}`);
    return null;
  }
  
  return result.price;
}
