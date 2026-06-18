/**
 * Pricing Module
 * 
 * Centralized pricing calculation for all products.
 * 
 * @created 2026-04-03
 */

export {
  calculateSellPrice,
  calculateWheelSellPrice,
  calculateWheelSellPriceSafe,
  resolveWheelMsrp,
  calculateTireSellPrice,
  pricingService,
  type ProductType,
  type PricingInput,
  type PricingResult,
} from "./pricingService";

export {
  getWheelMsrpOverride,
  WHEEL_MSRP_OVERRIDES,
} from "./wheelPriceOverrides";

export {
  sanitizeWheelMsrp,
  sanitizeWheelMsrpSync,
  warmWheelSiblingIndex,
  resetWheelSiblingIndex,
} from "./wheelPriceSanity";
