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

/** Rear/front axle context a staggered hand-off carries; every /tires size or trim link must keep it. */
export type StaggeredAxleParams = {
  wheelSkuRear?: string;
  wheelDiaFront?: string;
  wheelWidthFront?: string;
  wheelDiaRear?: string;
  wheelWidthRear?: string;
};

/**
 * Append the staggered axle params to a size/trim link. A link that keeps only wheelDia (front)
 * makes the tires page treat the set as square at the FRONT diameter - the OEM-19 fallback the
 * 2026-09-20 live check flagged. Adds nothing when the set is not staggered.
 */
export function appendStaggeredAxleParams(params: URLSearchParams, s: StaggeredAxleParams | null | undefined): URLSearchParams {
  if (!s || !s.wheelSkuRear) return params;
  params.set("setup", "staggered");
  params.set("staggered", "true");
  params.set("wheelSkuRear", s.wheelSkuRear);
  if (s.wheelDiaFront) params.set("wheelDiaFront", s.wheelDiaFront);
  if (s.wheelWidthFront) params.set("wheelWidthFront", s.wheelWidthFront);
  if (s.wheelDiaRear) params.set("wheelDiaRear", s.wheelDiaRear);
  if (s.wheelWidthRear) params.set("wheelWidthRear", s.wheelWidthRear);
  return params;
}
