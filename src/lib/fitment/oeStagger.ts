/**
 * OE stagger + load-index scope assessment (audit L1 / H5 interim, 2026-09-19).
 *
 * Decides, from the vehicle RECORD only, whether the factory fitment is
 * staggered and whether the record's single stored load index may be used as
 * a minimum.
 *
 *   oemStaggered
 *     true  - the record SAYS so: oem_tire_sizes is a {front, rear} object with
 *             differing sides, or oem_wheel_sizes carries axle-tagged
 *             front/rear entries whose diameters differ.
 *     false - every OE tire/wheel size shares one rim diameter and there is no
 *             axle split.
 *     null  - a flat list spanning several rim diameters with no axle info.
 *             2016 Fusion 215/60R16 + 225/50R17 are trim OPTIONS; 2022 M4
 *             275/35R19 + 285/30R20 is a true stagger. Several alternative rim
 *             sizes alone do NOT prove different front/rear factory fitment,
 *             so this is "unknown" and callers fail closed.
 *
 *   loadScopeSingle
 *     true only when the record lists exactly ONE OE tire size and no axle
 *     split. Otherwise the single stored load index describes one of several
 *     OE tires (alternative sizes, same- or mixed-diameter stagger) and must
 *     not be presented as "the minimum". Eligibility follows explicit
 *     size/axle provenance, never a diameter count.
 */

export interface OeStaggerInput {
  /** Flat OE tire size list as resolved (may already include front+rear). */
  tireSizes: string[];
  /** Explicit front/rear object from the record, when stored that way. */
  oemTireSizesStaggered?: { front: string[]; rear: string[] } | null;
  /** OE wheel sizes; `axle` is "front" | "rear" | "both" (or missing). */
  oemWheelSizes?: Array<{ diameter: number; axle?: string | null }> | null;
}

export interface OeStaggerAssessment {
  oemStaggered: boolean | null;
  /** OE rim diameters per axle (populated only when oemStaggered === true). */
  frontDiameters: number[];
  rearDiameters: number[];
  /** Distinct rim diameters across all OE tire/wheel sizes. */
  rimDiameters: number[];
  /** Distinct OE tire sizes (case/whitespace-normalized). */
  oeSizeCount: number;
  /** May the single stored load index be used as the minimum? */
  loadScopeSingle: boolean;
}

export function rimDiameterOf(size: string): number | null {
  // Tire sizes only (P-metric, LT, flotation). Wheel diameters arrive via oemWheelSizes.diameter.
  const m = String(size).match(/R\s?(\d{2}(?:\.5)?)\b/i);
  if (!m) return null;
  const d = parseFloat(m[1]);
  return Number.isFinite(d) && d > 0 ? d : null;
}

export function assessOeStagger(input: OeStaggerInput): OeStaggerAssessment {
  const sizes = (input.tireSizes || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
  const rim = new Set<number>();
  for (const s of sizes) {
    const d = rimDiameterOf(s);
    if (d) rim.add(d);
  }
  const wheels = input.oemWheelSizes || [];
  for (const w of wheels) {
    if (w && w.diameter > 0) rim.add(w.diameter);
  }

  const stg = input.oemTireSizesStaggered ?? null;
  const stgFront = (stg?.front || []).map((s) => s.trim().toUpperCase()).filter(Boolean);
  const stgRear = (stg?.rear || []).map((s) => s.trim().toUpperCase()).filter(Boolean);
  const explicitTireStagger = stgFront.length > 0 && stgRear.length > 0 && stgFront.join("|") !== stgRear.join("|");

  const frontWheelDias = new Set(wheels.filter((w) => w.axle === "front" && w.diameter > 0).map((w) => w.diameter));
  const rearWheelDias = new Set(wheels.filter((w) => w.axle === "rear" && w.diameter > 0).map((w) => w.diameter));
  const explicitWheelStagger =
    frontWheelDias.size > 0 && rearWheelDias.size > 0 && [...rearWheelDias].some((d) => !frontWheelDias.has(d));

  let oemStaggered: boolean | null;
  const fd = new Set<number>(frontWheelDias);
  const rd = new Set<number>(rearWheelDias);
  if (explicitTireStagger || explicitWheelStagger) {
    oemStaggered = true;
    for (const s of stgFront) { const d = rimDiameterOf(s); if (d) fd.add(d); }
    for (const s of stgRear) { const d = rimDiameterOf(s); if (d) rd.add(d); }
  } else if (rim.size <= 1) {
    oemStaggered = false;
  } else {
    oemStaggered = null;
  }

  const oeSizeCount = new Set(sizes).size;
  const loadScopeSingle = oeSizeCount === 1 && !explicitTireStagger && !explicitWheelStagger;

  return {
    oemStaggered,
    frontDiameters: oemStaggered === true ? [...fd] : [],
    rearDiameters: oemStaggered === true ? [...rd] : [],
    rimDiameters: [...rim],
    oeSizeCount,
    loadScopeSingle,
  };
}
