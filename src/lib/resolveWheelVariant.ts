/**
 * Shared helper to resolve the correct wheel variant from a list of variants.
 * Used by both PDP and any future flows that need variant resolution.
 * 
 * Priority:
 * 1. Exact SKU match
 * 2. Match by diameter + width (+ optionally boltPattern/offset)
 * 3. Fallback to first variant or undefined
 */

export type WheelVariant = {
  sku: string;
  diameter?: string;
  width?: string;
  boltPattern?: string;
  offset?: string;
  finish?: string;
};

export type ResolveOptions = {
  sku?: string;
  diameter?: string;
  width?: string;
  boltPattern?: string;
  offset?: string;
  finish?: string;
};

function normNum(v?: string | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? String(n) : s;
}

function matchesSpec(variant: WheelVariant, spec: ResolveOptions): boolean {
  const vDia = normNum(variant.diameter);
  const vWidth = normNum(variant.width);
  const vOffset = normNum(variant.offset);
  
  const sDia = normNum(spec.diameter);
  const sWidth = normNum(spec.width);
  const sOffset = normNum(spec.offset);
  
  // If spec has diameter, variant must match
  if (sDia && vDia !== sDia) return false;
  // If spec has width, variant must match
  if (sWidth && vWidth !== sWidth) return false;
  // If spec has bolt pattern, variant must match
  if (spec.boltPattern && variant.boltPattern !== spec.boltPattern) return false;
  // If spec has offset, variant must match
  if (sOffset && vOffset !== sOffset) return false;
  // If spec has finish, variant must match
  if (spec.finish && variant.finish !== spec.finish) return false;
  
  return true;
}

/**
 * Resolves the best matching variant from a list.
 * Returns the variant and whether it was an exact match.
 */
export function resolveWheelVariant(
  variants: WheelVariant[],
  options: ResolveOptions
): { variant: WheelVariant | undefined; exact: boolean } {
  if (!variants.length) {
    return { variant: undefined, exact: false };
  }

  // 1. Exact SKU match (highest priority)
  if (options.sku) {
    const exactSku = variants.find((v) => v.sku === options.sku);
    if (exactSku) {
      return { variant: exactSku, exact: true };
    }
  }

  // 2. Match by diameter + width + optional other specs
  if (options.diameter && options.width) {
    // Try full match first (all specified fields)
    const fullMatch = variants.find((v) => matchesSpec(v, options));
    if (fullMatch) {
      return { variant: fullMatch, exact: true };
    }
    
    // Try diameter + width only
    const sizeMatch = variants.find((v) => 
      normNum(v.diameter) === normNum(options.diameter) &&
      normNum(v.width) === normNum(options.width)
    );
    if (sizeMatch) {
      return { variant: sizeMatch, exact: false };
    }
  }

  // 3. Match by diameter only
  if (options.diameter) {
    const diaMatch = variants.find((v) => 
      normNum(v.diameter) === normNum(options.diameter)
    );
    if (diaMatch) {
      return { variant: diaMatch, exact: false };
    }
  }

  // 4. Fallback to first variant
  return { variant: variants[0], exact: false };
}

/**
 * Find the SKU that best matches the given specs.
 * Convenience wrapper that just returns the SKU string.
 */
export function resolveWheelSku(
  variants: WheelVariant[],
  options: ResolveOptions
): string | undefined {
  const { variant } = resolveWheelVariant(variants, options);
  return variant?.sku;
}

/**
 * Build URL search params that preserve wheel variant selection.
 * Use this when navigating to ensure variant info is not lost.
 */
export function buildWheelVariantParams(
  variant: WheelVariant | undefined,
  existingParams?: Record<string, string | undefined>
): URLSearchParams {
  const sp = new URLSearchParams();
  
  // Copy existing params (vehicle info, etc.)
  if (existingParams) {
    for (const [k, v] of Object.entries(existingParams)) {
      if (v) sp.set(k, v);
    }
  }
  
  // Add variant-specific params
  if (variant) {
    if (variant.sku) sp.set("wheelSku", variant.sku);
    if (variant.diameter) sp.set("wheelDia", variant.diameter);
    if (variant.width) sp.set("wheelWidth", variant.width);
    if (variant.offset) sp.set("wheelOffset", variant.offset);
    if (variant.boltPattern) sp.set("wheelBolt", variant.boltPattern);
  }
  
  return sp;
}
