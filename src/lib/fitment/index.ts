/**
 * Fitment Module
 * 
 * Provides fitment-related utilities for wheels, tires, and accessories.
 */

// Accessory fitment (lug nuts, hub rings)
export {
  getAccessoryFitment,
  extractVehicleFitmentData,
  parseThreadSize,
  formatThreadSize,
  normalizeSeatType,
  getLugCount,
  calculateHubRingSpec,
  formatHubRingSpec,
  formatAccessoryForUI,
  type VehicleFitmentData,
  type WheelData,
  type LugNutSpec,
  type HubRingSpec,
  type AccessoryMatch,
  type AccessoryRecommendation,
  type AccessoryFitmentResult,
  type GetAccessoryFitmentOptions,
} from "./accessories";
