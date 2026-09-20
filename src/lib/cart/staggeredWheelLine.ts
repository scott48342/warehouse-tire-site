/**
 * Staggered wheel line: per-axle specs and the tires hand-off URL.
 *
 * 2026-09-20 (Codex live check, after hotfix 2c304b73): a mixed-diameter set
 * (VORS TR4 19x8.5 front / 20x9.5 rear on a 2020 Mustang GT PP) was added from
 * the PDP with the correct 2+2 prices, but the cart labelled the rear
 * "19x9.5" and the cart's "Add Tires" link carried only wheelDia=19 + the
 * front SKU. `CartWheelItem` had no `rearDiameter`, so every consumer
 * (cart page, slide-out, checkout summary, package review, order-record spec,
 * tires URL) printed the FRONT diameter for the rear axle.
 *
 * Rule (Codex review of the first draft): a missing rear field is NOT evidence
 * of a same-diameter set. Nothing here infers rear diameter/width/offset from
 * the front. A staggered line whose rear axle is not fully described (legacy
 * persisted carts) is `rearConfirmed: false`: the UI shows "rear size not
 * confirmed", and the tires hand-off is withheld until the shopper re-adds the
 * set from the product page (which stamps the rear record).
 */

export type StaggeredWheelLineLike = {
  sku: string;
  rearSku?: string;
  staggered?: boolean;
  diameter?: string;
  width?: string;
  offset?: string;
  rearDiameter?: string;
  rearWidth?: string;
  rearOffset?: string;
};

export type AxleSpec = {
  sku: string;
  diameter?: string;
  width?: string;
  offset?: string;
};

export type RearAxleSpec = AxleSpec & {
  /** True only when the line carries the rear record's own diameter AND width. */
  rearConfirmed: boolean;
};

export function isStaggeredWheelLine(item: StaggeredWheelLineLike | null | undefined): item is StaggeredWheelLineLike & { rearSku: string } {
  return Boolean(item && item.staggered && item.rearSku);
}

export function frontAxleSpec(item: StaggeredWheelLineLike): AxleSpec {
  return { sku: item.sku, diameter: item.diameter, width: item.width, offset: item.offset };
}

const present = (v: string | undefined | null): v is string => v != null && String(v).trim() !== "";

/**
 * Rear axle record, from REAR fields only. `diameter`/`width`/`offset` are
 * undefined when the line never recorded them - never the front values.
 */
export function rearAxleSpec(item: StaggeredWheelLineLike): RearAxleSpec {
  const diameter = present(item.rearDiameter) ? item.rearDiameter : undefined;
  const width = present(item.rearWidth) ? item.rearWidth : undefined;
  const offset = present(item.rearOffset) ? item.rearOffset : undefined;
  return {
    sku: item.rearSku ?? item.sku,
    diameter,
    width,
    offset,
    rearConfirmed: diameter !== undefined && width !== undefined,
  };
}

/** `20x9.5`; empty string when either dimension is unknown (callers show "not confirmed"). */
export function axleSizeLabel(spec: { diameter?: string; width?: string }): string {
  const d = present(spec.diameter) ? String(spec.diameter).replace(/[^0-9.]/g, "") : "";
  const w = present(spec.width) ? String(spec.width).replace(/[^0-9.]/g, "") : "";
  return d && w ? `${d}x${w}` : "";
}

export const REAR_SIZE_UNCONFIRMED_COPY = "Rear wheel size not confirmed - re-add this set from the product page";

/** True when both axles are described and differ in diameter (19 front / 20 rear). */
export function isMixedDiameterLine(item: StaggeredWheelLineLike): boolean {
  if (!isStaggeredWheelLine(item)) return false;
  const rear = rearAxleSpec(item);
  if (!rear.rearConfirmed || !present(item.diameter)) return false;
  return Number(rear.diameter) !== Number(item.diameter);
}

export type TiresUrlVehicle = { year: string; make: string; model: string; trim?: string; modification?: string };

export type TiresHandoff =
  | { ok: true; params: URLSearchParams }
  /** Staggered line with an unconfirmed rear axle: no tires URL. `reAddHref` returns the shopper to the PDP for this set. */
  | { ok: false; reason: "rear_unconfirmed"; reAddHref: string };

/**
 * Query for /tires from a wheel line. Staggered lines hand the tires page BOTH
 * axles using the names it keys staggered mode off (wheelSkuRear,
 * wheelDiaFront/Rear, wheelWidthFront/Rear, setup=staggered) - audit H4 did
 * this on the PDP; the cart and slide-out never did.
 *
 * The tires page resolves `wheelDiaRear || wheelDia` for the rear axle, so a
 * staggered hand-off WITHOUT a confirmed rear diameter would let it assert the
 * front diameter for the rear. Such lines get no hand-off (`ok: false`).
 */
export function buildTiresHandoff(
  wheel: StaggeredWheelLineLike | null | undefined,
  vehicle?: TiresUrlVehicle | null,
): TiresHandoff {
  const params = new URLSearchParams();
  if (vehicle) {
    params.set("year", vehicle.year);
    params.set("make", vehicle.make);
    params.set("model", vehicle.model);
    if (vehicle.trim) params.set("trim", vehicle.trim);
    if (vehicle.modification) params.set("modification", vehicle.modification);
  }
  if (!wheel) return { ok: true, params };

  if (isStaggeredWheelLine(wheel)) {
    const rear = rearAxleSpec(wheel);
    if (!rear.rearConfirmed || !present(wheel.diameter) || !present(wheel.width)) {
      const pdp = new URLSearchParams(params);
      pdp.set("rearSku", rear.sku);
      return { ok: false, reason: "rear_unconfirmed", reAddHref: `/wheels/${encodeURIComponent(wheel.sku)}?${pdp.toString()}` };
    }
    params.set("wheelSku", wheel.sku);
    params.set("wheelDia", wheel.diameter);
    params.set("wheelWidth", wheel.width);
    params.set("setup", "staggered");
    params.set("staggered", "true");
    params.set("wheelSkuRear", rear.sku);
    params.set("wheelDiaFront", wheel.diameter);
    params.set("wheelWidthFront", wheel.width);
    params.set("wheelDiaRear", rear.diameter as string);
    params.set("wheelWidthRear", rear.width as string);
    if (rear.offset) params.set("wheelOffsetRear", rear.offset);
    return { ok: true, params };
  }

  params.set("wheelSku", wheel.sku);
  if (present(wheel.diameter)) params.set("wheelDia", wheel.diameter);
  if (present(wheel.width)) params.set("wheelWidth", wheel.width);
  return { ok: true, params };
}
