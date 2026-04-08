import type { TemplateFamilyConfig, FamilyId, StanceMode } from "../types";
import { HALF_TON_TRUCK_V1, HALF_TON_TRUCK_V1_ASSETS } from "./half_ton_truck_v1";

// ─────────────────────────────────────────────────────────────────────────────
// Family Registry
// ─────────────────────────────────────────────────────────────────────────────

export const FAMILY_CONFIGS: Partial<Record<FamilyId, TemplateFamilyConfig>> = {
  half_ton_truck_v1: HALF_TON_TRUCK_V1,
  // Future families:
  // hd_truck_v1: HD_TRUCK_V1,
  // offroad_suv_v1: OFFROAD_SUV_V1,
  // performance_car_v1: PERFORMANCE_CAR_V1,
  // fullsize_suv_v1: FULLSIZE_SUV_V1,
  // midsize_truck_v1: MIDSIZE_TRUCK_V1,
  // sedan_crossover_v1: SEDAN_CROSSOVER_V1,
};

export const FAMILY_ASSETS: Partial<Record<FamilyId, Record<StanceMode, string>>> = {
  half_ton_truck_v1: HALF_TON_TRUCK_V1_ASSETS,
};

// ─────────────────────────────────────────────────────────────────────────────
// Family Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getFamilyConfig(familyId: FamilyId): TemplateFamilyConfig | null {
  return FAMILY_CONFIGS[familyId] ?? null;
}

export function getFamilyAssetPath(familyId: FamilyId, stance: StanceMode): string | null {
  return FAMILY_ASSETS[familyId]?.[stance] ?? null;
}

export function getAvailableFamilies(): FamilyId[] {
  return Object.keys(FAMILY_CONFIGS) as FamilyId[];
}

// Re-export for convenience
export { HALF_TON_TRUCK_V1, HALF_TON_TRUCK_V1_ASSETS };
