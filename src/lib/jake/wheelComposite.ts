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
  const img = sharp(srcBuf).ensureAlpha();
  const meta = await img.metadata();
  const w = meta.width || 0, h = meta.height || 0;
  const side = Math.min(w, h);
  // center-crop to a square, then apply a circular alpha mask.
  const left = Math.floor((w - side) / 2), top = Math.floor((h - side) / 2);
  const squareBuf = await sharp(srcBuf).ensureAlpha().extract({ left, top, width: side, height: side }).png().toBuffer();
  const r = side / 2;
  const maskSvg = Buffer.from(
    `<svg width="${side}" height="${side}"><circle cx="${r}" cy="${r}" r="${r - 1}" fill="white"/></svg>`
  );
  const masked = await sharp(squareBuf)
    .composite([{ input: maskSvg, blend: "dest-in" }])
    .png()
    .toBuffer();
  return masked;
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
