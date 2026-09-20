/**
 * Staggered pair integrity (2026-09-20, Codex live check hotfix).
 *
 * A staggered card sells 2 front + 2 rear. It may only present itself as a
 * set when BOTH axles are fully described by the catalog: SKU, diameter,
 * width and a positive sell price on each side. Anything less and the UI
 * would back-fill the missing axle from the card's own size/price - which is
 * exactly how a 20x9.5 rear card advertised a "20x9.5 front" at 4 x rear
 * price while linking to a 19x8.5 front SKU.
 *
 * Pure; shared by the wheels SRP server mapping and the grid selection bar.
 */

export type StaggeredAxle = {
  sku?: string | null;
  diameter?: number | string | null;
  width?: number | string | null;
  offset?: number | string | null;
  finish?: string | null;
  price?: number | null;
};

export type StaggeredPairLike = {
  staggered?: boolean;
  role?: string;
  front?: StaggeredAxle | null;
  rear?: StaggeredAxle | null;
  setPrice?: number | null;
};

function positiveNumber(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return false;
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

/** True only when both axles carry sku + diameter + width + positive price. */
export function isCompleteStaggeredPair(pair: StaggeredPairLike | null | undefined): pair is StaggeredPairLike & {
  staggered: true;
  front: StaggeredAxle & { sku: string; price: number };
  rear: StaggeredAxle & { sku: string; price: number };
} {
  if (!pair || pair.staggered !== true) return false;
  const f = pair.front;
  const r = pair.rear;
  if (!f || !r) return false;
  if (!f.sku || !r.sku) return false;
  if (!positiveNumber(f.diameter) || !positiveNumber(r.diameter)) return false;
  if (!positiveNumber(f.width) || !positiveNumber(r.width)) return false;
  if (!positiveNumber(f.price) || !positiveNumber(r.price)) return false;
  return true;
}

/** 2 x front + 2 x rear, rounded to cents; null when the pair is incomplete. */
export function staggeredSetPrice(pair: StaggeredPairLike | null | undefined): number | null {
  if (!isCompleteStaggeredPair(pair)) return null;
  return Math.round((pair.front.price * 2 + pair.rear.price * 2) * 100) / 100;
}

/**
 * The size a card/link may show for the FRONT axle of a pair. Never falls back
 * to another SKU's size: an incomplete pair yields nulls so callers render the
 * plain (square) card instead.
 */
export function pairFrontSize(pair: StaggeredPairLike | null | undefined): { diameter: string; width: string } | null {
  if (!isCompleteStaggeredPair(pair)) return null;
  return { diameter: String(pair.front.diameter), width: String(pair.front.width) };
}

export type SizeFilter = { diameter?: string | number | null; width?: string | number | null };

/**
 * Whether one catalog record satisfies the shopper's diameter/width filter.
 * Mirrors the SRP hard filter: a record with an unknown dimension is not
 * excluded by that dimension. `undefined` record (partner not in the pool) fails.
 */
export function recordPassesSizeFilter(
  record: { diameter?: unknown; width?: unknown } | null | undefined,
  filter: SizeFilter,
): boolean {
  if (!record) return false;
  if (filter.diameter != null && filter.diameter !== "" && record.diameter && Number(record.diameter) !== Number(filter.diameter)) return false;
  if (filter.width != null && filter.width !== "" && record.width && Number(record.width) !== Number(filter.width)) return false;
  return true;
}

/**
 * A staggered set may be offered under a size filter only when BOTH axles pass
 * it. Under diameter=20 a 19x8.5 front + 20x9.5 rear is not a 20" set: the
 * rear item stays in the results as a plain candidate, without the pair.
 */
export function pairSatisfiesSizeFilter(
  front: { diameter?: unknown; width?: unknown } | null | undefined,
  rear: { diameter?: unknown; width?: unknown } | null | undefined,
  filter: SizeFilter,
): boolean {
  return recordPassesSizeFilter(front, filter) && recordPassesSizeFilter(rear, filter);
}
