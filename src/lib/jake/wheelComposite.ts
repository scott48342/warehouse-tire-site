/**
 * Jake Wheel Composite — "accuracy pass"
 *
 * After Flux generates the base vehicle mockup, this module composites the REAL
 * wheel product image onto the rendered wheels using a 4-point perspective warp
 * (homography). Because it transplants the actual product pixels instead of
 * letting a model redraw the wheel, brand-critical detail (spoke geometry,
 * finish, logo) is preserved verbatim.
 *
 * Pipeline:
 *   1. Vision (GPT-4o) detects each wheel face as 4 ellipse extreme points.
 *   2. Build a destination quad from those points (scaled to fully cover).
 *   3. Homography-warp the real wheel image onto the quad.
 *   4. Feathered alpha composite — no generative redraw.
 *
 * @created 2026-06-17
 */

import OpenAI from "openai";
import sharp from "sharp";

export type Point = [number, number];

export interface WheelDetection {
  top: Point;
  right: Point;
  bottom: Point;
  left: Point;
}

export interface DetectedWheels {
  front?: WheelDetection;
  rear?: WheelDetection;
}

// ───────────────────────────────────────────────────────────────────────────
// Homography (pure JS) — map source unit square -> destination quad, inverted
// for backward sampling.
// ───────────────────────────────────────────────────────────────────────────

function computeInverseHomography(dst: Point[]): number[][] {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = dst; // TL, TR, BR, BL
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let a13: number, a23: number;
  if (dx3 === 0 && dy3 === 0) {
    a13 = 0; a23 = 0;
  } else {
    const den = dx1 * dy2 - dx2 * dy1;
    a13 = (dx3 * dy2 - dx2 * dy3) / den;
    a23 = (dx1 * dy3 - dx3 * dy1) / den;
  }
  const a11 = x1 - x0 + a13 * x1;
  const a21 = x3 - x0 + a23 * x3;
  const a31 = x0;
  const a12 = y1 - y0 + a13 * y1;
  const a22 = y3 - y0 + a23 * y3;
  const a32 = y0;
  const H = [[a11, a21, a31], [a12, a22, a32], [a13, a23, 1]];
  return invert3(H);
}

function invert3(m: number[][]): number[][] {
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
  const A = e * i - f * h, B = -(b * i - c * h), C = b * f - c * e;
  const D = -(d * i - f * g), E = a * i - c * g, F = -(a * f - c * d);
  const G = d * h - e * g, Hh = -(a * h - b * g), I = a * e - b * d;
  const det = a * A + b * D + c * G;
  return [[A / det, B / det, C / det], [D / det, E / det, F / det], [G / det, Hh / det, I / det]];
}

/**
 * Circular-mask a (roughly square) wheel product image so only the round wheel
 * survives and the white/background corners become transparent. Without this,
 * warping maps the whole square (including background) onto the quad and pastes
 * a rectangular thumbnail. Returns an RGBA PNG buffer.
 */
async function circularMaskWheel(srcBuf: Buffer): Promise<Buffer> {
  // Product photos are typically a wheel centered on a WHITE background with a
  // margin. If we circular-mask the raw square, the white background between
  // the wheel edge and the circle survives as a bright halo ring on the
  // composite. So first TRIM the white/near-uniform border so the wheel fills
  // the frame, then center-crop to a square, then apply the circular mask.
  let prepped: Buffer;
  try {
    prepped = await sharp(srcBuf)
      .ensureAlpha()
      // flatten any transparent areas to white so trim has a uniform border
      .flatten({ background: "#ffffff" })
      // trim near-white border (threshold tolerant of JPEG noise/soft shadow)
      .trim({ background: "#ffffff", threshold: 30 })
      .png()
      .toBuffer();
  } catch {
    prepped = await sharp(srcBuf).ensureAlpha().png().toBuffer();
  }

  const meta = await sharp(prepped).metadata();
  const w = meta.width || 0, h = meta.height || 0;
  if (!w || !h) return sharp(srcBuf).ensureAlpha().png().toBuffer();
  const side = Math.min(w, h);
  const left = Math.floor((w - side) / 2), top = Math.floor((h - side) / 2);
  const squareBuf = await sharp(prepped)
    .ensureAlpha()
    .extract({ left, top, width: side, height: side })
    .resize(500, 500, { fit: "fill" })
    .png()
    .toBuffer();
  // Mask slightly inside the edge so any residual border pixels are clipped.
  const maskSvg = Buffer.from(
    `<svg width="500" height="500"><circle cx="250" cy="250" r="244" fill="white"/></svg>`
  );
  return sharp(squareBuf)
    .composite([{ input: maskSvg, blend: "dest-in" }])
    .png()
    .toBuffer();
}

/** Warp a source image onto a destination quad on a transparent canvas (RGBA). */
async function warpToQuad(srcBuf: Buffer, dstQuad: Point[], canvasW: number, canvasH: number): Promise<Buffer> {
  const { data, info } = await sharp(srcBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const sw = info.width, sh = info.height, sc = info.channels;
  const Hinv = computeInverseHomography(dstQuad);

  const xs = dstQuad.map((p) => p[0]), ys = dstQuad.map((p) => p[1]);
  const minX = Math.max(0, Math.floor(Math.min(...xs))), maxX = Math.min(canvasW, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys))), maxY = Math.min(canvasH, Math.ceil(Math.max(...ys)));

  const out = Buffer.alloc(canvasW * canvasH * 4, 0);

  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const w = Hinv[2][0] * x + Hinv[2][1] * y + Hinv[2][2];
      const u = (Hinv[0][0] * x + Hinv[0][1] * y + Hinv[0][2]) / w;
      const v = (Hinv[1][0] * x + Hinv[1][1] * y + Hinv[1][2]) / w;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      const fx = u * (sw - 1), fy = v * (sh - 1);
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const x1 = Math.min(x0 + 1, sw - 1), y1 = Math.min(y0 + 1, sh - 1);
      const dx = fx - x0, dy = fy - y0;
      const idx = (xx: number, yy: number) => (yy * sw + xx) * sc;
      const sample = (ch: number) => {
        const a = data[idx(x0, y0) + ch], b = data[idx(x1, y0) + ch];
        const c = data[idx(x0, y1) + ch], d = data[idx(x1, y1) + ch];
        return (a * (1 - dx) + b * dx) * (1 - dy) + (c * (1 - dx) + d * dx) * dy;
      };
      const o = (y * canvasW + x) * 4;
      out[o] = sample(0);
      out[o + 1] = sample(1);
      out[o + 2] = sample(2);
      out[o + 3] = sc === 4 ? sample(3) : 255;
    }
  }
  return sharp(out, { raw: { width: canvasW, height: canvasH, channels: 4 } }).png().toBuffer();
}

/** Build a destination quad from 4 ellipse extreme points, scaled to cover the wheel. */
function quadFromDetection(d: WheelDetection, scale = 1.13): Point[] {
  const cx = (d.left[0] + d.right[0]) / 2;
  const cy = (d.top[1] + d.bottom[1]) / 2;
  const corner = (a: Point, b: Point): Point => [a[0] + b[0] - cx, a[1] + b[1] - cy];
  let TL = corner(d.top, d.left), TR = corner(d.top, d.right), BR = corner(d.bottom, d.right), BL = corner(d.bottom, d.left);
  const qcx = (TL[0] + TR[0] + BR[0] + BL[0]) / 4, qcy = (TL[1] + TR[1] + BR[1] + BL[1]) / 4;
  const grow = (pt: Point): Point => [qcx + (pt[0] - qcx) * scale, qcy + (pt[1] - qcy) * scale];
  return [grow(TL), grow(TR), grow(BR), grow(BL)];
}

// ───────────────────────────────────────────────────────────────────────────
// Deskew an angled catalog wheel image to a head-on (orthographic) circle.
//
// Problem: WheelPros "Standard" product photos are shot at a ~30-40deg 3/4
// angle, so the rim is an ELLIPSE (lug holes are ovals, the barrel depth shows
// on one side). When this is pasted onto the flat broadside render the wheel
// looks "turned". For these Standard images there is NO -FACE-/-A1- variant to
// swap to, so we synthesize the head-on view here.
//
// Approach (best-effort, returns null on any failure so caller keeps original):
//   1. Flatten to white + measure the tight non-white content bbox of the
//      wheel (the product is a wheel centered on a near-white background).
//   2. The bbox gives the ellipse extent W_e x H_e. Build the 4 ellipse
//      extreme points (top, right, bottom, left) at the bbox edge midpoints.
//   3. Perspective-warp those 4 points onto a SQUARE of side max(W_e, H_e) so
//      the foreshortened axis is stretched back out to a circle (de-skew).
//   4. Flatten onto white and return a PNG. circularMaskWheel downstream then
//      clips it to the round wheel.
// ───────────────────────────────────────────────────────────────────────────

export async function deskewWheelToHeadOn(srcBuf: Buffer): Promise<Buffer | null> {
  try {
    // Flatten transparency to white so the bbox scan and final output share a
    // clean white background (matches what circularMaskWheel expects).
    const flat = await sharp(srcBuf).ensureAlpha().flatten({ background: "#ffffff" }).png().toBuffer();
    const { data, info } = await sharp(flat).raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, c = info.channels;
    if (!W || !H) return null;

    // Measure the tight bbox of non-white (wheel) content. Threshold tolerant
    // of JPEG noise / soft drop shadow.
    const WHITE_LUM = 235;
    const lum = (x: number, y: number) => {
      const i = (y * W + x) * c;
      return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    };
    let minx = W, miny = H, maxx = -1, maxy = -1, n = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (lum(x, y) < WHITE_LUM) {
          n++;
          if (x < minx) minx = x;
          if (x > maxx) maxx = x;
          if (y < miny) miny = y;
          if (y > maxy) maxy = y;
        }
      }
    }
    if (maxx < 0 || n < 500) return null; // no wheel content found

    const We = maxx - minx + 1; // horizontal extent (possibly foreshortened)
    const He = maxy - miny + 1; // vertical extent (possibly foreshortened)
    if (We < 40 || He < 40) return null;

    // If the wheel already reads as essentially circular (axes within ~6%),
    // there's nothing meaningful to deskew — bail so the caller keeps the
    // original (avoids a pointless resample / softening).
    const ratio = Math.max(We, He) / Math.min(We, He);
    if (ratio < 1.06) return null;

    const cx = (minx + maxx) / 2;
    const cy = (miny + maxy) / 2;
    const hx = We / 2; // half horizontal extent
    const hy = He / 2; // half vertical extent

    // Ellipse extreme points in source pixel space: top, right, bottom, left.
    const eTop: Point = [cx, cy - hy];
    const eRight: Point = [cx + hx, cy];
    const eBottom: Point = [cx, cy + hy];
    const eLeft: Point = [cx - hx, cy];

    // Target: a square canvas of side = max axis, with the de-foreshortened
    // circle inscribed. Map the 4 ellipse extremes to the 4 square-edge
    // midpoints (top-mid, right-mid, bottom-mid, left-mid).
    const side = Math.round(Math.max(We, He));
    const sMid = side / 2;
    const sqTop: Point = [sMid, 0];
    const sqRight: Point = [side, sMid];
    const sqBottom: Point = [sMid, side];
    const sqLeft: Point = [0, sMid];

    // warpToQuad maps the source UNIT SQUARE (its 4 corners TL,TR,BR,BL) onto a
    // destination quad. We instead want an arbitrary source quad (the 4 ellipse
    // extremes) mapped onto the square edge-midpoints. To reuse the existing
    // primitive we first crop the source to the ellipse bbox so the ellipse
    // extremes sit at the crop's edge midpoints, i.e. the crop's unit-square
    // corners correspond to the bbox corners. Then the de-foreshorten warp is a
    // mapping of the bbox (rectangle) onto the square — which is exactly what
    // warpToQuad does when given the square's 4 CORNERS as the destination quad.
    //
    // Cropping to [minx,miny,We,He] and warping that rectangle to a side x side
    // square stretches the shorter axis up to the longer axis length, turning
    // the foreshortened ellipse back into a circle. (The ellipse-extreme /
    // square-edge-midpoint correspondence is preserved by an affine bbox->square
    // stretch, so the explicit 4-point quad above reduces to this crop+stretch.)
    void eTop; void eRight; void eBottom; void eLeft;
    void sqTop; void sqRight; void sqBottom; void sqLeft;

    const cropped = await sharp(flat)
      .extract({ left: minx, top: miny, width: We, height: He })
      .png()
      .toBuffer();

    // Destination quad = the full square's 4 corners (TL, TR, BR, BL). warpToQuad
    // samples the source unit square (cropped bbox) across this quad, stretching
    // each axis independently to `side`.
    const sqQuad: Point[] = [
      [0, 0],
      [side, 0],
      [side, side],
      [0, side],
    ];
    const warped = await warpToQuad(cropped, sqQuad, side, side);

    // Flatten onto white (warp leaves transparent fringe outside the mapped
    // region) and emit a clean square PNG. Colors/finish are preserved verbatim
    // (bilinear resample only, no tint).
    const out = await sharp(warped).flatten({ background: "#ffffff" }).png().toBuffer();
    console.log(`[wheelComposite] deskew: ellipse ${We}x${He} (ratio ${ratio.toFixed(3)}) -> ${side}x${side} head-on`);
    return out;
  } catch (e: any) {
    console.warn(`[wheelComposite] deskewWheelToHeadOn failed: ${e?.message}`);
    return null;
  }
}

function validDetection(d: any): d is WheelDetection {
  const ok = (p: any) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && isFinite(n));
  return d && ok(d.top) && ok(d.right) && ok(d.bottom) && ok(d.left);
}

// ───────────────────────────────────────────────────────────────────────────
// Wheel detection via GPT-4o vision
// ───────────────────────────────────────────────────────────────────────────

export async function detectWheels(openai: OpenAI, mockupBuf: Buffer, width: number, height: number): Promise<DetectedWheels> {
  const dataUrl = `data:image/png;base64,${mockupBuf.toString("base64")}`;
  const prompt = `This is a ${width}x${height} pixel photo of a vehicle at a three-quarter angle (origin top-left, x increases right, y increases down).

For each clearly visible WHEEL (the round tire+wheel assembly), locate the CENTER of the wheel hub and the wheel's radius in pixels. Be precise: the center is the middle of the visible round wheel face, and the radius reaches the outer edge of the metal wheel (not the tire).

Identify the FRONT wheel (the one nearest the camera / largest) and, if clearly visible and not heavily cropped, the REAR wheel.

Because the vehicle is at an angle, give the horizontal radius (rx) and vertical radius (ry) separately if the wheel looks elliptical; otherwise set them equal.

Respond ONLY with strict JSON, no prose:
{"front":{"cx":<num>,"cy":<num>,"rx":<num>,"ry":<num>},"rear":{"cx":<num>,"cy":<num>,"rx":<num>,"ry":<num>}}
Omit "rear" entirely if not clearly visible.`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }] }],
      max_tokens: 400,
      temperature: 0,
    });
    let txt = res.choices?.[0]?.message?.content?.trim() || "";
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return {};
    const parsed = JSON.parse(m[0]);
    const toDet = (c: any): WheelDetection | undefined => {
      if (!c || typeof c.cx !== "number" || typeof c.cy !== "number") return undefined;
      const rx = typeof c.rx === "number" ? c.rx : c.r;
      const ry = typeof c.ry === "number" ? c.ry : c.r;
      if (typeof rx !== "number" || typeof ry !== "number" || rx <= 0 || ry <= 0) return undefined;
      return {
        top: [c.cx, c.cy - ry],
        right: [c.cx + rx, c.cy],
        bottom: [c.cx, c.cy + ry],
        left: [c.cx - rx, c.cy],
      };
    };
    const result: DetectedWheels = {};
    const f = toDet(parsed.front); if (f) result.front = f;
    const r = toDet(parsed.rear); if (r) result.rear = r;
    return result;
  } catch (e: any) {
    console.warn(`[wheelComposite] detectWheels failed: ${e?.message}`);
    return {};
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Main entry: composite the real wheel onto detected wheels.
// ───────────────────────────────────────────────────────────────────────────

export async function compositeRealWheels(opts: {
  mockupBuf: Buffer;
  wheelImageBuf: Buffer;
  wheels: DetectedWheels;
  scale?: number;
}): Promise<Buffer | null> {
  const { mockupBuf, wheelImageBuf, wheels } = opts;
  const scale = opts.scale ?? 1.13;
  const meta = await sharp(mockupBuf).metadata();
  const W = meta.width || 0, H = meta.height || 0;
  if (!W || !H) return null;

  // Circular-mask the wheel once (removes white background so only the round
  // wheel is transplanted, not a rectangular thumbnail).
  const maskedWheel = await circularMaskWheel(wheelImageBuf);

  const layers: sharp.OverlayOptions[] = [];
  for (const det of [wheels.front, wheels.rear]) {
    if (!det) continue;
    try {
      const quad = quadFromDetection(det, scale);
      const warped = await warpToQuad(maskedWheel, quad, W, H);
      // No RGB blur (it bleeds the transparent/white edge into a halo). The warp
      // already anti-aliases the edge via bilinear sampling, so composite as-is.
      layers.push({ input: warped, left: 0, top: 0 });
    } catch (e: any) {
      console.warn(`[wheelComposite] warp failed for a wheel: ${e?.message}`);
    }
  }
  if (layers.length === 0) return null;
  return sharp(mockupBuf).composite(layers).png().toBuffer();
}

// ───────────────────────────────────────────────────────────────────────────
// LOCKED-POSE composite (the reliable path).
//
// Insight (Scott, 2026-06-17): if every vehicle is rendered in the SAME locked
// orthographic broadside pose, the wheels land in PREDICTABLE positions — so we
// can composite the real wheel at FIXED, pre-calibrated circle positions with
// NO per-image vision detection (which was the unreliable part). In a true
// broadside the wheels are perfect circles, so it's a clean circular paste —
// no homography warp needed.
//
// Empirically validated across body types (3 renders per pose held front.cx to
// ±2px; cross-body the front anchor held ~320-329 while rear-X and radius
// shifted predictably by class). Templates are stored as fractions of the
// render width/height so they're resolution-independent.
// ───────────────────────────────────────────────────────────────────────────

export type BodyClass = "sedan" | "truck" | "lifted" | "suv";

export interface FixedWheel {
  /** center x as fraction of render width */
  cx: number;
  /** center y as fraction of render height */
  cy: number;
  /** radius as fraction of render width */
  r: number;
}

export interface PoseTemplate {
  front: FixedWheel;
  rear: FixedWheel;
}

/**
 * Calibrated fixed-wheel templates (normalized to render W/H). Derived from the
 * locked orthographic broadside pose (aspect 16:9). Front anchor is nearly
 * universal; rear-X and radius vary by class (wheelbase + tire size).
 * Re-calibrate if the locked pose prompt changes.
 */
export const LOCKED_POSE_TEMPLATES: Record<BodyClass, PoseTemplate> = {
  // Honda Accord render: front 328/556 r108, rear 1010/556 r108 @ 1392x752
  sedan: {
    front: { cx: 0.2356, cy: 0.7394, r: 0.0776 },
    rear: { cx: 0.7256, cy: 0.7394, r: 0.0776 },
  },
  // XD852 F-150 baseline: front 329/531 r92, rear 1013/531 r92 @ 1392x752
  truck: {
    front: { cx: 0.2364, cy: 0.7062, r: 0.0661 },
    rear: { cx: 0.7278, cy: 0.7062, r: 0.0661 },
  },
  // Lifted F-250 render: front 320/520 r120, rear 960/520 r120 @ 1392x752
  lifted: {
    front: { cx: 0.2299, cy: 0.6915, r: 0.0862 },
    rear: { cx: 0.6897, cy: 0.6915, r: 0.0862 },
  },
  // Jeep Grand Cherokee render: front 320/520 r110, rear 960/520 r110 @ 1392x752
  suv: {
    front: { cx: 0.2299, cy: 0.6915, r: 0.079 },
    rear: { cx: 0.6897, cy: 0.6915, r: 0.079 },
  },
};

/** Resolve absolute pixel circles for a render of the given dimensions. */
function resolveTemplate(t: PoseTemplate, W: number, H: number) {
  const px = (fw: FixedWheel) => ({
    cx: Math.round(fw.cx * W),
    cy: Math.round(fw.cy * H),
    r: Math.round(fw.r * W),
  });
  return { front: px(t.front), rear: px(t.rear) };
}

/**
 * The locked broadside composition prompt. Use this (instead of the 3/4 hero
 * prompt) when locked-pose composite mode is enabled, so wheel positions match
 * the calibrated templates. The caller supplies the vehicle description and the
 * wheel/tire reference instructions.
 */
export function buildLockedPosePrompt(vehicleDesc: string, wheelInstr: string, tireInstr: string): string {
  return `Create a photorealistic automotive photograph of a ${vehicleDesc} fitted with the wheels from the reference image on all four corners. ${wheelInstr}

STRICT FIXED COMPOSITION — orthographic side elevation (blueprint-style), must be identical every time:
- TRUE 90-degree broadside side profile. Driver side faces camera. Vehicle points to the RIGHT. Zero three-quarter angle, zero perspective, flat orthographic side view.
- Camera dead level at wheel-hub height, perfectly perpendicular to the vehicle's side.
- The entire vehicle is centered and fills the frame horizontally with a small even margin on each side. Both wheels fully visible and the SAME size (perfect circles, no foreshortening).
- Plain flat neutral light-grey seamless background. Even soft studio lighting. No props, people, text, or shadows on the background.
- Tires have solid matte black rubber sidewalls (plain blackwall). Never whitewalls, never white stripes, never raised white lettering.

${tireInstr} Sharp focus on the wheels. Photorealistic.`;
}

/**
 * LOCAL SNAP: refine an expected wheel circle by finding the dark tire/wheel
 * blob within a constrained search window around the template position. On a
 * plain light-grey studio background (which the locked pose enforces), the
 * tire+wheel are markedly darker than everything around them, so a simple dark-
 * pixel centroid + spread within the window reliably locates the real wheel.
 *
 * This is FAR more robust than global LLM vision because the search is bounded
 * (we already know roughly where the wheel is) and the background is clean.
 * Returns refined {cx, cy, r}, or the input expectation if the snap is weak.
 */
function snapToWheel(
  rawData: Buffer,
  W: number,
  H: number,
  channels: number,
  expect: { cx: number; cy: number; r: number }
): { cx: number; cy: number; r: number } {
  // Search window: generous around the expected circle (covers framing drift).
  const pad = Math.round(expect.r * 1.8);
  const x0 = Math.max(0, expect.cx - pad), x1 = Math.min(W - 1, expect.cx + pad);
  const y0 = Math.max(0, expect.cy - pad), y1 = Math.min(H - 1, expect.cy + pad);

  // Estimate background luminance from the window corners (grey bg).
  const lum = (x: number, y: number) => {
    const i = (y * W + x) * channels;
    return 0.299 * rawData[i] + 0.587 * rawData[i + 1] + 0.114 * rawData[i + 2];
  };
  const cornerSamples = [
    lum(x0, y0), lum(x1, y0), lum(x0, y1), lum(x1, y1),
    lum(x0, Math.round((y0 + y1) / 2)), lum(x1, Math.round((y0 + y1) / 2)),
  ];
  const bg = cornerSamples.reduce((a, b) => a + b, 0) / cornerSamples.length;
  // A pixel is "wheel" if notably darker than background.
  const thresh = bg - 45;

  let sumX = 0, sumY = 0, count = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (lum(x, y) < thresh) { sumX += x; sumY += y; count++; }
    }
  }
  // Weak signal (mostly background, e.g. window landed off the wheel) -> keep expectation.
  const windowArea = (x1 - x0 + 1) * (y1 - y0 + 1);
  if (count < windowArea * 0.04) return expect;

  const cx = Math.round(sumX / count);
  const cy = Math.round(sumY / count);
  // Radius from the dark-blob spread (std-dev based; tire is roughly circular).
  let varSum = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (lum(x, y) < thresh) { varSum += (x - cx) * (x - cx) + (y - cy) * (y - cy); }
    }
  }
  const rms = Math.sqrt(varSum / count);
  // Empirically, for the locked broadside the dark tire+wheel mass gives
  // rms ≈ actual wheel radius (validated: sedan rms 104 vs template r 108).
  let r = Math.round(rms * 1.05);
  // Clamp radius to a sane range around the template (guards against shadows/badges).
  r = Math.max(Math.round(expect.r * 0.7), Math.min(Math.round(expect.r * 1.4), r));
  // Clamp the snap so a bad detection can't fling the wheel far from expectation.
  const maxShift = expect.r * 1.5;
  const sx = Math.max(expect.cx - maxShift, Math.min(expect.cx + maxShift, cx));
  const sy = Math.max(expect.cy - maxShift, Math.min(expect.cy + maxShift, cy));
  return { cx: Math.round(sx), cy: Math.round(sy), r };
}

// ───────────────────────────────────────────────────────────────────────────
// SAM 3 wheel detection (the reliable detector).
//
// fal-ai/sam-3/image segments by TEXT prompt ("wheel") and returns one mask PNG
// per detected instance. Unlike LLM coordinate-guessing or a brightness snap,
// it actually finds the wheels (validated on the hard truck case: both hubs
// located precisely, ignoring grille/bumper). We derive each wheel's circle
// (center + radius) from its mask's bounding box, then assign front/rear by x.
// Cost ~$0.002/image.
// ───────────────────────────────────────────────────────────────────────────

export interface WheelCircle { cx: number; cy: number; r: number }
export interface SamWheels { front?: WheelCircle; rear?: WheelCircle; all: WheelCircle[] }

async function falUploadPng(key: string, buf: Buffer): Promise<string | null> {
  try {
    const init = await fetch(
      "https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3",
      {
        method: "POST",
        headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content_type: "image/png", file_name: "render.png" }),
      }
    );
    if (!init.ok) return null;
    const { upload_url, file_url } = await init.json();
    const put = await fetch(upload_url, { method: "PUT", headers: { "Content-Type": "image/png" }, body: new Uint8Array(buf) });
    if (!put.ok) return null;
    return file_url as string;
  } catch {
    return null;
  }
}

/** Bounding circle of the "on" region of a SAM mask PNG (white/opaque blob). */
async function maskToCircle(maskBuf: Buffer): Promise<WheelCircle | null> {
  const { data, info } = await sharp(maskBuf).raw().toBuffer({ resolveWithObject: true });
  const c = info.channels;
  let minx = Infinity, miny = Infinity, maxx = -1, maxy = -1, n = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * c;
      const on = c === 4 ? data[i + 3] > 128 : data[i] > 128;
      if (on) { n++; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
    }
  }
  if (n < 200 || maxx < 0) return null;
  return {
    cx: Math.round((minx + maxx) / 2),
    cy: Math.round((miny + maxy) / 2),
    r: Math.round((maxx - minx + maxy - miny) / 4),
  };
}

/**
 * Detect the front/rear wheels in a render using SAM 3 (text prompt "wheel").
 * Returns null if FAL_KEY missing or detection fails so the caller can fall
 * back to template positions.
 */
export async function detectWheelsSAM(mockupBuf: Buffer): Promise<SamWheels | null> {
  const key = process.env.FAL_KEY || process.env.FAL_API_KEY;
  if (!key) return null;
  try {
    const url = await falUploadPng(key, mockupBuf);
    if (!url) return null;
    const res = await fetch("https://fal.run/fal-ai/sam-3/image", {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: url,
        prompt: "wheel",
        apply_mask: false,
        return_multiple_masks: true,
        max_masks: 6,
        output_format: "png",
      }),
    });
    if (!res.ok) {
      console.warn(`[wheelComposite] SAM3 failed ${res.status}`);
      return null;
    }
    const data = await res.json();
    const masks: Array<{ url: string }> = data?.masks || [];
    if (!masks.length) return null;

    const meta = await sharp(mockupBuf).metadata();
    const W = meta.width || 0, H = meta.height || 0;
    const minR = W * 0.025; // ignore tiny spurious masks (e.g. spare tire badge)
    const maxR = W * 0.18;

    const circles: WheelCircle[] = [];
    for (const m of masks) {
      try {
        const mb = Buffer.from(await (await fetch(m.url)).arrayBuffer());
        const circ = await maskToCircle(mb);
        if (circ && circ.r >= minR && circ.r <= maxR) circles.push(circleClamp(circ, W, H));
      } catch { /* skip bad mask */ }
    }
    if (!circles.length) return null;

    // Side profile = wheels at similar y. Take the two largest, assign by x.
    circles.sort((a, b) => b.r - a.r);
    const top = circles.slice(0, 2).sort((a, b) => a.cx - b.cx);
    const result: SamWheels = { all: circles };
    if (top.length === 2) {
      // Vehicle points right: front wheel is the right one (larger x), rear left.
      result.rear = top[0];
      result.front = top[1];
    } else if (top.length === 1) {
      result.front = top[0];
    }
    return result;
  } catch (e: any) {
    console.warn(`[wheelComposite] SAM3 error: ${e?.message}`);
    return null;
  }
}

function circleClamp(c: WheelCircle, W: number, H: number): WheelCircle {
  return {
    cx: Math.max(0, Math.min(W, c.cx)),
    cy: Math.max(0, Math.min(H, c.cy)),
    r: c.r,
  };
}

/**
 * Composite the real wheel at template positions, refined by a local dark-blob
 * snap (no global vision detection). Requires the render to have been produced
 * with buildLockedPosePrompt so the wheels are near the template and the
 * background is the plain grey the snap relies on.
 */
export async function compositeFixedWheels(opts: {
  mockupBuf: Buffer;
  wheelImageBuf: Buffer;
  bodyClass: BodyClass;
  /** "sam" (default): SAM 3 detection. "snap": brightness snap. "template": fixed only. */
  refine?: "sam" | "snap" | "template";
}): Promise<Buffer | null> {
  const { mockupBuf, wheelImageBuf, bodyClass } = opts;
  const refine = opts.refine ?? "sam";
  const meta = await sharp(mockupBuf).metadata();
  const W = meta.width || 0, H = meta.height || 0;
  if (!W || !H) return null;

  const tmpl = LOCKED_POSE_TEMPLATES[bodyClass] || LOCKED_POSE_TEMPLATES.truck;
  let { front, rear } = resolveTemplate(tmpl, W, H);

  // PRIMARY: SAM 3 detection (reliable). Falls back to template positions for
  // any wheel SAM doesn't return.
  if (refine === "sam") {
    const sam = await detectWheelsSAM(mockupBuf);
    if (sam?.front) front = sam.front;
    if (sam?.rear) rear = sam.rear;
    console.log(`[wheelComposite] SAM -> front(${front.cx},${front.cy},r${front.r}) rear(${rear.cx},${rear.cy},r${rear.r}) [detected ${sam?.all.length ?? 0}]`);
  } else if (refine === "snap") {
    try {
      const { data, info } = await sharp(mockupBuf).raw().toBuffer({ resolveWithObject: true });
      front = snapToWheel(data, info.width, info.height, info.channels, front);
      rear = snapToWheel(data, info.width, info.height, info.channels, rear);
      console.log(`[wheelComposite] snap -> front(${front.cx},${front.cy},r${front.r}) rear(${rear.cx},${rear.cy},r${rear.r})`);
    } catch (e: any) {
      console.warn(`[wheelComposite] snap failed (${e?.message}); using template positions`);
    }
  }

  // Deskew the (often 3/4-angled) catalog wheel to a head-on circle BEFORE
  // masking so the pasted wheel reads dead-on flat on the broadside render.
  // Best-effort: keep the original image if deskew can't find/transform it.
  let sourceWheel = wheelImageBuf;
  try {
    const deskewed = await deskewWheelToHeadOn(wheelImageBuf);
    if (deskewed) {
      sourceWheel = deskewed;
      console.log(`[wheelComposite] ✅ Deskew-to-head-on applied to source wheel image`);
    }
  } catch (e: any) {
    console.warn(`[wheelComposite] deskew attempt failed (${e?.message}); using original wheel image`);
  }

  // Circular-mask the wheel once, then place a resized copy at each circle.
  const maskedWheel = await circularMaskWheel(sourceWheel);

  // SAM "wheel" returns roughly the rim+tire bound. Scale the pasted wheel a
  // touch inside it so a natural tire sidewall shows — more for low-profile
  // passenger cars, less for trucks (which run shorter sidewalls relative to
  // the big rim). Prevents the "rubber-band / wheel fills the arch" look.
  const wheelScale = bodyClass === "sedan" ? 0.86 : bodyClass === "suv" ? 0.92 : 0.95;

  const layers: sharp.OverlayOptions[] = [];
  for (const c of [front, rear]) {
    if (c.r <= 0) continue;
    const pr = Math.round(c.r * wheelScale);
    const d = pr * 2;
    try {
      const resized = await sharp(maskedWheel)
        .resize(d, d, { fit: "fill" })
        .png()
        .toBuffer();
      layers.push({ input: resized, left: c.cx - pr, top: c.cy - pr });
    } catch (e: any) {
      console.warn(`[wheelComposite] fixed paste failed: ${e?.message}`);
    }
  }
  if (layers.length === 0) return null;
  return sharp(mockupBuf).composite(layers).png().toBuffer();
}

/** Map a body noun (from inferBodyStyle) + lift flag to a pose body class. */
export function toBodyClass(bodyNoun: string, isTruckOrSuv: boolean, lift?: string): BodyClass {
  const lifted = !!lift && /lift|level|[2-9]\s*-?\s*(in|")|inch/i.test(lift) && !/lower/i.test(lift);
  const n = (bodyNoun || "").toLowerCase();
  if (isTruckOrSuv) {
    if (n.includes("suv")) return "suv";
    if (lifted) return "lifted";
    return "truck";
  }
  return "sedan";
}
