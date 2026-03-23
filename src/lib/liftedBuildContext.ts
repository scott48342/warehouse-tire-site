/**
 * Lifted Build Context
 * 
 * Stores lifted build state to preserve recommended tire sizes through
 * the wheel → tire shopping flow.
 * 
 * IMPORTANT: This is an OVERLAY on top of stock fitment, not a replacement.
 * When lifted context exists, we use it for tire suggestions.
 * When it doesn't exist, stock fitment works normally.
 */

export type LiftedBuildContext = {
  source: "lifted";
  presetId: "daily" | "offroad" | "extreme";
  liftInches: number;
  vehicle: {
    year: string;
    make: string;
    model: string;
    trim?: string;
    modification?: string;
  };
  /** Selected wheel diameter (e.g., 20) */
  selectedWheelDiameter?: number;
  /** Recommended tire sizes for this lift level (e.g., ["35x12.50R20", "33x12.50R20"]) */
  recommendedTireSizes: string[];
  /** Tire diameter range in inches */
  tireDiameterMin: number;
  tireDiameterMax: number;
  /** Offset range for the selected lift level */
  offsetMin: number;
  offsetMax: number;
  /** Timestamp when context was created */
  createdAt: number;
};

const STORAGE_KEY = "wt_lifted_build";
const MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Save lifted build context to sessionStorage
 */
export function saveLiftedContext(ctx: Omit<LiftedBuildContext, "createdAt">): void {
  if (typeof window === "undefined") return;
  
  try {
    const fullCtx: LiftedBuildContext = {
      ...ctx,
      createdAt: Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fullCtx));
    console.log("[liftedBuildContext] Saved:", {
      presetId: ctx.presetId,
      liftInches: ctx.liftInches,
      vehicle: `${ctx.vehicle.year} ${ctx.vehicle.make} ${ctx.vehicle.model}`,
      tireSizes: ctx.recommendedTireSizes.length,
    });
  } catch (err) {
    console.warn("[liftedBuildContext] Failed to save:", err);
  }
}

/**
 * Load lifted build context from sessionStorage
 * Returns null if not found, expired, or invalid
 */
export function loadLiftedContext(): LiftedBuildContext | null {
  if (typeof window === "undefined") return null;
  
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const ctx = JSON.parse(stored) as LiftedBuildContext;
    
    // Validate structure
    if (ctx.source !== "lifted" || !ctx.presetId || !ctx.vehicle) {
      console.warn("[liftedBuildContext] Invalid structure");
      return null;
    }
    
    // Check expiration
    if (Date.now() - ctx.createdAt > MAX_AGE_MS) {
      console.log("[liftedBuildContext] Context expired");
      clearLiftedContext();
      return null;
    }
    
    return ctx;
  } catch (err) {
    console.warn("[liftedBuildContext] Failed to load:", err);
    return null;
  }
}

/**
 * Clear lifted build context from sessionStorage
 */
export function clearLiftedContext(): void {
  if (typeof window === "undefined") return;
  
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}

/**
 * Check if lifted context matches the current vehicle
 */
export function liftedContextMatchesVehicle(
  ctx: LiftedBuildContext | null,
  vehicle: { year: string; make: string; model: string }
): boolean {
  if (!ctx) return false;
  
  return (
    ctx.vehicle.year === vehicle.year &&
    ctx.vehicle.make.toLowerCase() === vehicle.make.toLowerCase() &&
    ctx.vehicle.model.toLowerCase() === vehicle.model.toLowerCase()
  );
}

/**
 * Get tire sizes for a specific wheel diameter from lifted context
 * Returns recommended sizes that match the wheel rim diameter
 */
export function getLiftedTireSizesForWheel(
  ctx: LiftedBuildContext | null,
  wheelDiameter: number
): string[] {
  if (!ctx || !ctx.recommendedTireSizes.length) return [];
  
  // Filter tire sizes that match the wheel diameter
  return ctx.recommendedTireSizes.filter((size) => {
    const rimMatch = size.match(/R(\d+)$/i) || size.match(/(\d+)$/);
    if (rimMatch) {
      return parseInt(rimMatch[1], 10) === wheelDiameter;
    }
    return false;
  });
}

/**
 * Build URL params for lifted context (for passing through navigation)
 */
export function buildLiftedUrlParams(ctx: LiftedBuildContext): URLSearchParams {
  const params = new URLSearchParams();
  params.set("liftedSource", "lifted");
  params.set("liftedPreset", ctx.presetId);
  params.set("liftedInches", String(ctx.liftInches));
  params.set("liftedTireSizes", ctx.recommendedTireSizes.join(","));
  params.set("liftedTireDiaMin", String(ctx.tireDiameterMin));
  params.set("liftedTireDiaMax", String(ctx.tireDiameterMax));
  return params;
}

/**
 * Parse lifted context from URL params
 */
export function parseLiftedUrlParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>
): Partial<LiftedBuildContext> | null {
  const get = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) {
      return params.get(key) || undefined;
    }
    const val = params[key];
    return Array.isArray(val) ? val[0] : val;
  };
  
  const source = get("liftedSource");
  if (source !== "lifted") return null;
  
  const presetId = get("liftedPreset") as LiftedBuildContext["presetId"];
  const liftInches = parseInt(get("liftedInches") || "0", 10);
  const tireSizesStr = get("liftedTireSizes") || "";
  const tireDiaMin = parseInt(get("liftedTireDiaMin") || "0", 10);
  const tireDiaMax = parseInt(get("liftedTireDiaMax") || "0", 10);
  
  if (!presetId || !liftInches) return null;
  
  return {
    source: "lifted",
    presetId,
    liftInches,
    recommendedTireSizes: tireSizesStr.split(",").filter(Boolean),
    tireDiameterMin: tireDiaMin,
    tireDiameterMax: tireDiaMax,
  };
}
