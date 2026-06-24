/**
 * Supplier-Neutral Ranking Engine (v3 - 2026-06-24)
 *
 * Replaces the v2 brandTier-based scoring with fitmentClass-based scoring.
 *
 * KEY CHANGE FROM v2:
 *   v2: brandTierScore (0.20 weight) — hardcoded WheelPros brand codes at Tier 1
 *       → systematically buried Wheel-1 since most brands were unknown (score=50)
 *   v3: fitmentClassScore (0.20 weight) — surefit/specfit/extended from fitment validation
 *       → supplier-neutral: a Wheel-1 surefit scores the same as WheelPros surefit
 *
 * Additionally adds:
 *   - customerValueScore (0.10 weight): free shipping + inventory depth signals
 *   - Supplier diversity cap in merchandising: prevents any single supplier
 *     from exceeding SUPPLIER_DIVERSITY_CAP of top-50 results
 *
 * SUPPLIER NEUTRALITY CONTRACT:
 *   - Score factors NEVER check `_supplier` field
 *   - Supplier diversity tracking in merchandising uses `_supplier` only for
 *     COUNTING representation — never as a quality or ranking advantage
 *   - This ensures WheelPros and Wheel-1 (and future suppliers) compete on:
 *     fitment confidence, availability, price, images, and customer value
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** Popular finish keywords that drive conversion (finish boost score factor). */
export const PREMIUM_FINISHES = [
  "BLACK", "MATTE BLACK", "GLOSS BLACK", "MACHINED", "MILLED", "BRONZE", "GUNMETAL",
];

/**
 * fitmentClass → base score contribution (0-100).
 *
 * These scores reflect FITMENT CONFIDENCE, not supplier identity:
 *   surefit  = all hard rules pass, within OEM diameter/width/offset ranges
 *   specfit  = hard rules pass, minor deviation or missing data (e.g. centerbore)
 *   extended = hard rules pass, major size deviation from OEM
 */
export const FITMENT_CLASS_SCORES: Readonly<Record<string, number>> = {
  surefit:  100,
  specfit:   80,
  extended:  55,
};

/**
 * Score weights for v3 ranking formula (must sum to 1.0).
 *
 * Changes from v2:
 *   - brandTier (0.20) → fitmentClass (0.20)   [supplier-neutral quality signal]
 *   - fitmentQuality 0.20 → 0.15               [reduced: was WheelPros-biased]
 *   - priceRange 0.15 → 0.10                   [reduced to make room for customerValue]
 *   - customerValue 0.10 (NEW)                  [free shipping + inventory depth]
 */
export const SCORE_WEIGHTS = {
  availability:   0.25,
  fitmentClass:   0.20,
  fitmentQuality: 0.15,
  visualQuality:  0.15,
  priceRange:     0.10,
  customerValue:  0.10,
  finishBoost:    0.05,
} as const;

/**
 * Maximum fraction of top-50 results from any single supplier source.
 * When a supplier exceeds this, soft penalty applies to its additional results.
 * This prevents page 1 from being 100% one supplier even if that supplier
 * has objectively better-scoring products by volume.
 *
 * 0.65 = 65%: allows majority presence but guarantees room for other suppliers.
 */
export const SUPPLIER_DIVERSITY_CAP = 0.65;

// ─── Types ───────────────────────────────────────────────────────────────────

/** Score breakdown fields for v3. Debug-only in API response. */
export interface ScoreBreakdownV2 {
  availability:   number;
  fitmentClass:   number;  // replaces brandTier from v2
  fitmentQuality: number;
  visualQuality:  number;
  priceRange:     number;
  customerValue:  number;
  finishBoost:    number;
}

/**
 * Minimal shape required by applySupplierNeutralMerchandising.
 * The T generic lets callers keep their full ScoredCandidate type.
 */
export interface MerchandisingItem {
  score:     number;
  modelKey:  string;
  priceTier: "value" | "mid" | "premium";
  candidate: {
    brand_cd?: string | null | undefined;
    [key: string]: unknown;
  };
}

// ─── Scoring helpers ─────────────────────────────────────────────────────────

/**
 * Score contribution from fitmentClass (0-100).
 * Unknown classes default to 50 (neutral, not penalized).
 */
export function computeFitmentClassScore(fitmentClass: string): number {
  return FITMENT_CLASS_SCORES[fitmentClass] ?? 50;
}

/**
 * Customer-value signals score (0-100).
 *
 * Uses only wheel PROPERTIES, never checks supplier identity:
 *   - _freeShipping = true  → +50 pts (shipping baked into price = better perceived value)
 *   - _inventoryQty ≥ 20   → +25 pts (reliable fulfillment, fast ship)
 *   - _inventoryQty ≥ 8    → +10 pts (adequate stock)
 *
 * WheelPros wheels typically have neither flag, scoring 0 here unless they
 * happen to have _freeShipping set. Wheel-1 has _freeShipping: true and
 * real _inventoryQty from DB. This intentionally rewards free-shipping +
 * well-stocked products regardless of supplier.
 */
export function computeCustomerValueScore(candidate: Record<string, unknown>): number {
  let score = 0;

  if (candidate._freeShipping === true) score += 50;

  const qty = candidate._inventoryQty as number | null | undefined;
  if (qty != null) {
    if (qty >= 20)      score += 25;
    else if (qty >= 8)  score += 10;
  }

  return Math.min(100, score);
}

// ─── Merchandising ───────────────────────────────────────────────────────────

/**
 * Supplier-neutral merchandising pass (v3).
 *
 * Applies five rules via a greedy selection loop over the scored+sorted list:
 *
 * 1. Model-level deduping in top 20
 *    — prevents same model/style from monopolizing the first page
 *
 * 2. Brand concentration control in top 100
 *    — no brand > 25% of placed results
 *
 * 3. Price mix optimization in top 20
 *    — targets ~50% mid / ~25% value / ~25% premium distribution
 *
 * 4. Consecutive brand limit (max 2 in a row)
 *    — avoids visual monotony for shoppers browsing
 *
 * 5. Supplier diversity cap in top 50 (NEW in v3)
 *    — tracks by `_supplier` property (or 'wheelpros' for legacy WheelPros)
 *    — if one supplier > SUPPLIER_DIVERSITY_CAP of placed items, its further
 *      candidates receive a soft penalty until balance is restored
 *    — this is COUNTING only: supplier identity is NOT a quality signal
 *
 * Generic T ensures the caller's full ScoredCandidate type is preserved.
 */
export function applySupplierNeutralMerchandising<T extends MerchandisingItem>(
  items: T[]
): T[] {
  if (items.length <= 5) return items;

  const result: T[]    = [];
  const remaining: T[] = [...items];

  const modelCountInTop20     = new Map<string, number>();
  const brandCountInTop100    = new Map<string, number>();
  const priceTierCountInTop20 = { value: 0, mid: 0, premium: 0 };
  const supplierCountInTop50  = new Map<string, number>(); // v3: supplier diversity

  const priceMixTargets = { value: 5, mid: 10, premium: 5 };

  while (remaining.length > 0) {
    const currentPosition = result.length;
    const isTop20  = currentPosition < 20;
    const isTop50  = currentPosition < 50;
    const isTop100 = currentPosition < 100;

    let bestIdx   = 0;
    let bestScore = -Infinity;

    // Evaluate up to next 50 candidates (lookahead keeps performance bounded)
    for (let i = 0; i < Math.min(remaining.length, 50); i++) {
      const item = remaining[i];
      let adjustedScore = item.score;

      // ── Rule 1: Model-level deduping in top 20 ───────────────────────────
      if (isTop20) {
        const modelCount = modelCountInTop20.get(item.modelKey) ?? 0;
        if      (modelCount >= 2) adjustedScore -= 30; // 3rd+ of same model: heavy penalty
        else if (modelCount >= 1) adjustedScore -= 10; // 2nd of same model: mild penalty
      }

      // ── Rule 2: Brand concentration control in top 100 ───────────────────
      if (isTop100) {
        const brandKey   = item.candidate.brand_cd ?? "";
        const brandCount = brandCountInTop100.get(brandKey) ?? 0;
        const brandPct   = brandCount / Math.max(1, currentPosition);
        if (brandPct > 0.25 && brandCount >= 5) adjustedScore -= 15;
      }

      // ── Rule 3: Price mix optimization in top 20 ─────────────────────────
      if (isTop20) {
        const tierCount  = priceTierCountInTop20[item.priceTier];
        const tierTarget = priceMixTargets[item.priceTier];
        if      (tierCount < tierTarget)           adjustedScore += 5; // underrepresented → boost
        else if (tierCount >= tierTarget * 1.5)    adjustedScore -= 5; // overrepresented → penalize
      }

      // ── Rule 4: Consecutive brand limit (max 2) ───────────────────────────
      if (result.length >= 2) {
        const lastBrand       = result[result.length - 1].candidate.brand_cd;
        const secondLastBrand = result[result.length - 2].candidate.brand_cd;
        if (
          lastBrand &&
          lastBrand === secondLastBrand &&
          item.candidate.brand_cd === lastBrand
        ) {
          adjustedScore -= 50; // heavy penalty for 3rd consecutive same brand
        }
      }

      // ── Rule 5: Supplier diversity cap in top 50 (v3 NEW) ────────────────
      // Resolve supplier key from the candidate property — never hardcoded.
      // Falls back to 'wheelpros' for existing WheelPros candidates that
      // predate the _supplier field.
      if (isTop50 && currentPosition > 0) {
        const supplierKey   = (item.candidate._supplier as string | undefined) ?? "wheelpros";
        const supplierCount = supplierCountInTop50.get(supplierKey) ?? 0;
        const supplierShare = supplierCount / currentPosition;
        if (supplierShare > SUPPLIER_DIVERSITY_CAP) {
          // Soft penalty: doesn't exclude, just yields space to other suppliers
          adjustedScore -= 20;
        }
      }

      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestIdx   = i;
      }
    }

    // Place best candidate
    const selected = remaining[bestIdx];
    result.push(selected);
    remaining.splice(bestIdx, 1);

    // Update tracking counters
    if (result.length <= 20) {
      const mc = modelCountInTop20.get(selected.modelKey) ?? 0;
      modelCountInTop20.set(selected.modelKey, mc + 1);
      priceTierCountInTop20[selected.priceTier]++;
    }
    if (result.length <= 50) {
      const supplierKey = (selected.candidate._supplier as string | undefined) ?? "wheelpros";
      const sc = supplierCountInTop50.get(supplierKey) ?? 0;
      supplierCountInTop50.set(supplierKey, sc + 1);
    }
    if (result.length <= 100) {
      const brandKey = selected.candidate.brand_cd ?? "";
      const bc = brandCountInTop100.get(brandKey) ?? 0;
      brandCountInTop100.set(brandKey, bc + 1);
    }
  }

  return result;
}
