/**
 * Trim-gate link for /tires (2026-09-20, Codex live check follow-through).
 *
 * The tires page fails closed when a Y/M/M has several trims with different tire
 * sizes and no `modification` was given. Its trim buttons used to rebuild the URL
 * from year/make/model + modification only, throwing away everything the cart or
 * wheel PDP handed over: wheelSku, wheelDia/Width, wheelSkuRear, wheelDiaFront/
 * Rear, wheelWidthFront/Rear, setup=staggered, lifted context, size. A shopper
 * with a 19x8.5 / 20x9.5 wheel set in the cart would land on the trim's OEM
 * (19/19) tire sizes. The gate must ADD the trim's modification and keep the rest.
 */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Keys the gate may not carry forward: the gate's own trim inputs are replaced by `modification`. */
const DROP_AT_GATE = new Set(["trim", "modification", "page"]);

export function trimGateHref(sp: RawSearchParams, modificationId: string): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (DROP_AT_GATE.has(k)) continue;
    const val = Array.isArray(v) ? v[0] : v;
    if (val == null || val === "") continue;
    params.set(k, val);
  }
  params.set("modification", modificationId);
  return `/tires?${params.toString()}`;
}
