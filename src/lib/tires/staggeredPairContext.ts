/**
 * Staggered tire pair context for the tire PDPs (2026-09-20, Codex live check).
 *
 * The /tires results "Select Staggered Set" link carries rearSku + rearSize
 * (+ staggeredPair), but every PDP surface ignored them and the bare-URL cache
 * redirect (/tires/<sku> -> /tires/km/<sku>?size=...) dropped them, so "Add Set
 * of 4" put FOUR FRONT tires in the cart for a 19/20 wheel set.
 *
 * Contract: a PDP opened with a pair sells exactly 2 front + 2 rear at each
 * axle's own catalog price, or sells nothing (rear unresolved -> call to order).
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

export type StaggeredPairParams = { rearSku: string; rearSize: string; pairId?: string };

/**
 * Any of staggeredPair / rearSku / rearSize on the URL is pair INTENT. A complete pair
 * (rearSku + rearSize) can be resolved; an incomplete one must still fail closed - the
 * square "Add Set of 4" must never re-appear because a parameter was dropped.
 */
export type StaggeredPairIntent =
  | { kind: "none" }
  | { kind: "complete"; pair: StaggeredPairParams }
  | { kind: "incomplete"; present: string[]; missing: string[] };

const one = (v: string | string[] | undefined): string => String(Array.isArray(v) ? v[0] ?? "" : v ?? "").trim();

export function readStaggeredPairIntent(sp: RawSearchParams): StaggeredPairIntent {
  const rearSku = one(sp.rearSku);
  const rearSize = one(sp.rearSize);
  const pairId = one(sp.staggeredPair);
  if (!rearSku && !rearSize && !pairId) return { kind: "none" };
  if (rearSku && rearSize) return { kind: "complete", pair: { rearSku, rearSize, pairId: pairId || undefined } };
  const present = [pairId && "staggeredPair", rearSku && "rearSku", rearSize && "rearSize"].filter(Boolean) as string[];
  const missing = [!rearSku && "rearSku", !rearSize && "rearSize"].filter(Boolean) as string[];
  return { kind: "incomplete", present, missing };
}

/** Complete pair or null. Callers that need fail-closed behaviour use readStaggeredPairIntent. */
export function readStaggeredPairParams(sp: RawSearchParams): StaggeredPairParams | null {
  const intent = readStaggeredPairIntent(sp);
  return intent.kind === "complete" ? intent.pair : null;
}

/** Params a PDP redirect must carry forward so the pair (and vehicle) survive the hop. */
export const PAIR_FORWARD_KEYS = ["year", "make", "model", "trim", "modification", "staggeredPair", "rearSku", "rearSize"] as const;

/**
 * The ONE href a tire-results pair card may link to (Select Staggered Set AND View Details).
 * Carries the full pair (staggeredPair + rearSku + rearSize) plus the vehicle incl. trim/modification,
 * so the PDP resolves the rear axle instead of falling back to a square set of 4 fronts.
 * Mirrors PAIR_FORWARD_KEYS so what the card sends is exactly what the redirect forwards.
 */
export function buildStaggeredPairHref(p: {
  frontPartNumber: string;
  frontSize: string;
  pairId: string;
  rearPartNumber: string;
  rearSize: string;
  year?: string | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  modification?: string | null;
}): string {
  const q = new URLSearchParams();
  q.set("size", p.frontSize);
  for (const [k, v] of [["year", p.year], ["make", p.make], ["model", p.model], ["trim", p.trim], ["modification", p.modification]] as const) {
    if (v) q.set(k, v);
  }
  q.set("staggeredPair", p.pairId);
  q.set("rearSku", p.rearPartNumber);
  q.set("rearSize", p.rearSize);
  return `/tires/${encodeURIComponent(p.frontPartNumber)}?${q.toString()}`;
}

export function appendForwardedPairParams(redirectUrl: string, sp: RawSearchParams): string {
  const [path, existing = ""] = redirectUrl.split("?");
  const params = new URLSearchParams(existing);
  for (const k of PAIR_FORWARD_KEYS) {
    const v = one(sp[k]);
    if (v && !params.has(k)) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export type ResolvedRearTire = {
  sku: string;
  size: string;
  brand?: string;
  model?: string;
  source?: string;
  /** Per-tire sell price from the live feed; null when the feed has no usable price. */
  price: number | null;
};

const normalizePn = (v: unknown) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Same sell-price rule the tire PDPs use for the front tire. */
export function tireSellPrice(t: { price?: unknown; cost?: unknown }): number | null {
  const cost = typeof t.cost === "number" && t.cost > 0 ? t.cost : null;
  const price = typeof t.price === "number" && t.price > 0 ? t.price : null;
  if (price && cost && price > cost) return price;
  if (cost) return Math.round((cost + 50) * 100) / 100;
  return null;
}

/**
 * Resolve the REAR tire of a pair from the live search feed by exact part number
 * within its own size. Returns null when the part is not found - callers fail closed.
 */
export async function resolveRearTire(
  pair: StaggeredPairParams,
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ResolvedRearTire | null> {
  const target = normalizePn(pair.rearSku);
  const attempt = async (qs: string): Promise<any | null> => {
    try {
      const r = await fetchImpl(`${baseUrl}/api/tires/search?${qs}`, { cache: "no-store" } as RequestInit);
      if (!r.ok) return null;
      const j = await r.json();
      const rows: any[] = Array.isArray(j?.results) ? j.results : [];
      return rows.find((t) => normalizePn(t?.partNumber) === target || normalizePn(t?.mfgPartNumber) === target) ?? null;
    } catch {
      return null;
    }
  };
  const row =
    (await attempt(`size=${encodeURIComponent(pair.rearSize)}&partNumber=${encodeURIComponent(pair.rearSku)}&pageSize=500`)) ??
    (await attempt(`size=${encodeURIComponent(pair.rearSize)}&pageSize=500`));
  if (!row) return null;
  return {
    sku: String(row.partNumber || pair.rearSku),
    size: String(row.size || pair.rearSize),
    brand: row.brand ? String(row.brand) : undefined,
    model: row.model ? String(row.model) : undefined,
    source: row.rawSource || row.source ? String(row.rawSource || row.source) : undefined,
    price: tireSellPrice(row),
  };
}

/** What the buy surfaces render. `sellable` only when the rear is resolved WITH a price. */
export type StaggeredTireSet = {
  rearSku: string;
  rearSize: string;
  rearUnitPrice: number | null;
  rearResolved: boolean;
  sellable: boolean;
  /** Pair intent was on the URL but incomplete (dropped param): nothing sellable, square Add withheld. */
  incomplete?: boolean;
};

export function toStaggeredTireSet(pair: StaggeredPairParams, rear: ResolvedRearTire | null): StaggeredTireSet {
  const rearUnitPrice = rear?.price ?? null;
  return {
    rearSku: rear?.sku ?? pair.rearSku,
    rearSize: rear?.size ?? pair.rearSize,
    rearUnitPrice,
    rearResolved: rear !== null,
    sellable: rear !== null && rearUnitPrice !== null && rearUnitPrice > 0,
  };
}

/** Set for an incomplete pair intent: fail closed, nothing sellable, square Add withheld. */
export function incompleteStaggeredTireSet(intent: Extract<StaggeredPairIntent, { kind: "incomplete" }>, sp: RawSearchParams): StaggeredTireSet {
  return {
    rearSku: one(sp.rearSku) || "unknown",
    rearSize: one(sp.rearSize) || "unknown",
    rearUnitPrice: null,
    rearResolved: false,
    sellable: false,
    incomplete: true,
  };
}

/**
 * One call for the PDPs: null when no pair intent; otherwise a StaggeredTireSet that is sellable
 * only for a complete pair whose rear resolved with a price.
 */
export async function loadStaggeredTireSet(sp: RawSearchParams, baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<StaggeredTireSet | null> {
  const intent = readStaggeredPairIntent(sp);
  if (intent.kind === "none") return null;
  if (intent.kind === "incomplete") return incompleteStaggeredTireSet(intent, sp);
  return toStaggeredTireSet(intent.pair, await resolveRearTire(intent.pair, baseUrl, fetchImpl));
}

export function staggeredSetTotal(frontUnitPrice: number, rearUnitPrice: number): number {
  return Math.round((2 * frontUnitPrice + 2 * rearUnitPrice) * 100) / 100;
}
