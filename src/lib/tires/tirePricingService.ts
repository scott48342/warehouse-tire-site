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
 * - Commercial/medium-truck tires: cost + $100 (COMMERCIAL_TIRE_ADDER)
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

/** Commercial/medium-truck margin: cost + $100 */
export const COMMERCIAL_TIRE_ADDER = 100;

// ============================================================================
// Commercial Size Detection
// ============================================================================

/**
 * Detect if a tire size is commercial/medium-truck (uses higher margin).
 * 
 * Commercial sizes include:
 * - LT prefix (light truck)
 * - ST prefix (special trailer)
 * - Decimal rim diameters (19.5, 22.5, 24.5) - medium truck
 * - Compact numeric formats for medium truck (11225, 22570195)
 * - Large flotation sizes (40"+ diameter)
 */
export function isCommercialTruckSize(size: string): boolean {
  if (!size) return false;
  const s = size.toUpperCase().trim();
  
  // LT prefix (light truck)
  if (/^LT\s?\d/.test(s)) return true;
  
  // ST prefix (special trailer)
  if (/^ST\s?\d/.test(s)) return true;
  
  // Decimal rim diameters (medium truck): 19.5, 22.5, 24.5
  // Matches: 225/70R19.5, 11R22.5, R22.5
  if (/R?\s*\d{2}\.5(?:[^0-9]|$)/.test(s)) return true;
  
  // Compact numeric format: 11225 (11R22.5 compressed)
  if (/^\d{5}$/.test(s)) return true;
  
  // Compact numeric format: 22570195 (225/70R19.5 compressed)
  // Pattern: width(3) + aspect(2) + rim with .5 (175, 195, 225, 245)
  if (/^\d{3}\d{2}(?:175|195|225|245)$/.test(s)) return true;
  
  // Very large flotation sizes (commercial use): 40"+ diameter
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

// Diagnostic SKU for debugging price doubling issue
const DIAGNOSTIC_SKU = "LXST2031655020";

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
  const isDiagnostic = sku === DIAGNOSTIC_SKU;
  
  if (isDiagnostic) {
    console.log(`\n========== SAVED QUOTE TIRE PRICING DIAGNOSTIC ==========`);
    console.log(`requested SKU: ${sku}`);
    console.log(`requested size: ${size}`);
  }
  
  const simpleSize = toSimpleSize(size);
  if (!simpleSize) {
    console.warn(`[tirePricingService] Invalid tire size: ${size}`);
    return null;
  }
  
  // Collect all candidates for diagnostic comparison
  const candidates: Array<{
    source: string;
    partNumber: string;
    rawBuyPrice: number;
    rawSellPrice: number | null;
    unifiedCost: number | null;
    unifiedPrice: number | null;
    matchReason: string;
  }> = [];
  
  // Search TireWeb (primary supplier)
  try {
    const tireWebResults = await searchTiresTireWeb(size);
    
    if (isDiagnostic) {
      console.log(`\nTireWeb returned ${tireWebResults.length} provider(s)`);
    }
    
    for (const result of tireWebResults) {
      if (isDiagnostic) {
        console.log(`  Provider: ${result.provider}, tires: ${result.tires.length}`);
      }
      
      for (const tire of result.tires) {
        const unified = tireWebTireToUnified(tire, result.provider);
        
        // Log ALL candidates for the diagnostic SKU
        if (isDiagnostic && (unified.partNumber === sku || unified.mfgPartNumber === sku)) {
          candidates.push({
            source: `tireweb:${result.provider}`,
            partNumber: unified.partNumber,
            rawBuyPrice: tire.buyPrice,
            rawSellPrice: tire.sellPrice,
            unifiedCost: unified.cost,
            unifiedPrice: unified.price,
            matchReason: unified.partNumber === sku ? 'partNumber match' : 'mfgPartNumber match',
          });
        }
        
        // Match by SKU or manufacturer part number
        if (unified.partNumber === sku || unified.mfgPartNumber === sku) {
          const cost = unified.cost;
          const isCommercial = isCommercialTruckSize(unified.size || size);
          const price = calculateTireSellPrice(cost, unified.size || size);
          
          if (isDiagnostic) {
            console.log(`\n--- MATCHED TIRE (TireWeb) ---`);
            console.log(`supplier: tireweb:${result.provider}`);
            console.log(`raw TireWeb buyPrice: ${tire.buyPrice}`);
            console.log(`raw TireWeb sellPrice: ${tire.sellPrice}`);
            console.log(`unified.cost: ${unified.cost}`);
            console.log(`unified.price: ${unified.price}`);
            console.log(`unified.source: ${unified.source}`);
            console.log(`unified.partNumber: ${unified.partNumber}`);
            console.log(`unified.size: ${unified.size}`);
            console.log(`isCommercialTruckSize result: ${isCommercial}`);
            console.log(`STANDARD_TIRE_ADDER: ${STANDARD_TIRE_ADDER}`);
            console.log(`COMMERCIAL_TIRE_ADDER: ${COMMERCIAL_TIRE_ADDER}`);
            console.log(`input passed to calculateTireSellPrice: cost=${cost}, size=${unified.size || size}`);
            console.log(`output from calculateTireSellPrice: ${price}`);
          }
          
          const result_obj = {
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
          
          if (isDiagnostic) {
            console.log(`\nfinal lookupTireDirect.price: ${result_obj.price}`);
            console.log(`final lookupTireDirect.cost: ${result_obj.cost}`);
            if (candidates.length > 1) {
              console.log(`\n--- ALL CANDIDATES FOR THIS SKU ---`);
              candidates.forEach((c, i) => {
                console.log(`  [${i}] ${c.source}: rawBuyPrice=${c.rawBuyPrice}, rawSellPrice=${c.rawSellPrice}, unifiedCost=${c.unifiedCost}, unifiedPrice=${c.unifiedPrice}`);
              });
            }
            console.log(`========== END DIAGNOSTIC ==========\n`);
          }
          
          return result_obj;
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
  const isDiagnostic = sku === DIAGNOSTIC_SKU;
  
  const result = await lookupTireDirect(sku, size);
  
  if (isDiagnostic) {
    console.log(`[getTirePrice] lookupTireDirect returned price: ${result?.price}`);
    console.log(`[getTirePrice] lookupTireDirect returned cost: ${result?.cost}`);
  }
  
  if (!result || !result.found) {
    return null;
  }
  
  // Price must be positive
  if (result.price == null || result.price <= 0) {
    console.warn(`[tirePricingService] Invalid price for ${sku}: ${result.price}`);
    return null;
  }
  
  if (isDiagnostic) {
    console.log(`[getTirePrice] final return: ${result.price}`);
  }
  
  return result.price;
}
