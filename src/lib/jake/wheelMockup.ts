/**
 * Jake AI Wheel Mockup Generator
 * 
 * Same approach Clawd uses:
 * 1. GPT-4o Vision analyzes the wheel image in detail
 * 2. gpt-image-1 generates the mockup with that description
 * 
 * @created 2026-06-15
 * @updated 2026-06-15 - Simplified flow, no experimental APIs
 */

import OpenAI, { toFile } from "openai";
import { put, list } from "@vercel/blob";
import * as crypto from "crypto";
import sharp from "sharp";
import { detectWheels, compositeRealWheels, compositeFixedWheels, buildLockedPosePrompt, toBodyClass } from "./wheelComposite";

/** Convert a data: URL (or base64 string) to a Buffer for image edit references. */
function dataUrlToBuffer(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Buffer.from(b64, "base64");
}

/**
 * Derive the FACE-ON variant URL of a WheelPros product image.
 *
 * Why: catalog wheel photos default to a 3/4 angled shot (filename token
 * `-A1-`, `-A2-`, ...). When we composite that 3/4 wheel onto the LOCKED-POSE
 * broadside render (a flat 90-degree side profile where wheels are perfect
 * circles), the angled rim looks "turned" and odd. WheelPros also publishes a
 * true head-on `-FACE-` variant (perfect circle, round lug holes), which is
 * what the broadside composite actually wants.
 *
 * The `media.wheelpros.com` host keeps the SAME media id for every angle, so we
 * can string-swap the angle token to `FACE`. The `assets.wheelpros.com/transform`
 * host uses a different UUID per angle, but the filename token still carries the
 * angle, so we attempt the same swap defensively. Returns the candidate URL, or
 * null when the URL has no swappable angle token / isn't a WheelPros image.
 */
function faceWheelImageCandidate(url: string): string | null {
  if (!url) return null;
  if (!/wheelpros\.com/i.test(url)) return null;
  if (!/-A\d+-png/i.test(url)) return null;
  const swapped = url.replace(/-A\d+-png/i, "-FACE-png");
  return swapped === url ? null : swapped;
}

/**
 * Resolve a face-on wheel image URL: if a `-FACE-` variant exists (HEAD 200),
 * return it; otherwise return the original. Best-effort, never throws.
 */
async function resolveFaceWheelImageUrl(originalUrl: string): Promise<string> {
  const candidate = faceWheelImageCandidate(originalUrl);
  if (!candidate) return originalUrl;
  try {
    const head = await fetch(candidate, { method: "HEAD" });
    if (head.ok) {
      console.log(`[wheelMockup] ✅ Using FACE-on wheel variant for composite`);
      return candidate;
    }
  } catch (e: any) {
    console.warn(`[wheelMockup] FACE variant HEAD check failed (${e?.message}); using original`);
  }
  return originalUrl;
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface WheelMockupRequest {
  vehicle: {
    year: number;
    make: string;
    model: string;
    color: string;
  };
  wheel: {
    brand: string;
    model: string;
    imageUrl: string;
    finish?: string;
    size: number;
  };
  tire?: {
    size?: string;
    brand?: string;
    model?: string;
    imageUrl?: string;
    terrain?: string;
  };
  lift?: string;
}

export interface WheelMockupResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  cached: boolean;
  generationTimeMs?: number;
  confidence?: "high" | "medium" | "low";
  method?: "vision-analyzed" | "cached" | "text-fallback" | "image-reference" | "flux-kontext";
  /** True when the real wheel pixels were composited onto the render (accuracy pass). */
  composited?: boolean;
}

export const MOCKUP_DISCLAIMER = "AI visual mockup only. Wheel shown is a representation and may not be exact. Final appearance may vary by trim, wheel size, offset, tire size, suspension, and lighting.";

// ═══════════════════════════════════════════════════════════════════════════
// OPENAI CLIENT
// ═══════════════════════════════════════════════════════════════════════════

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// ═══════════════════════════════════════════════════════════════════════════
// FLUX KONTEXT (fal.ai) — PRIMARY GENERATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════
//
// Bake-off (2026-06-17) across 4 wheel finishes showed Flux Kontext Max best
// reproduces the real wheel's spoke geometry AND finish/color, beating
// gpt-image-2 (which drifted spoke patterns) and Gemini (which lost finish
// color). Flux is reference-guided edit, takes public image URLs.
//
// Returns PNG bytes on success, or null to let the caller fall back to OpenAI.

async function falUploadImage(buf: Buffer): Promise<string | null> {
  const key = process.env.FAL_KEY || process.env.FAL_API_KEY;
  if (!key) return null;
  try {
    const init = await fetch(
      "https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3",
      {
        method: "POST",
        headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content_type: "image/png", file_name: "wheel.png" }),
      }
    );
    if (!init.ok) {
      console.warn(`[wheelMockup][flux] upload initiate failed ${init.status}`);
      return null;
    }
    const { upload_url, file_url } = await init.json();
    const put = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: new Uint8Array(buf),
    });
    if (!put.ok) {
      console.warn(`[wheelMockup][flux] upload PUT failed ${put.status}`);
      return null;
    }
    return file_url as string;
  } catch (e: any) {
    console.warn(`[wheelMockup][flux] upload error: ${e?.message}`);
    return null;
  }
}

/**
 * Generate the mockup with Flux Kontext Max via fal.ai using the real wheel
 * image as a reference. Flux Kontext takes a single image_url, so we use the
 * wheel reference (the most identity-critical element). Returns PNG bytes or null.
 */
async function generateWithFluxKontext(
  wheelRefBuf: Buffer | null,
  prompt: string,
): Promise<Buffer | null> {
  const key = process.env.FAL_KEY || process.env.FAL_API_KEY;
  if (!key || !wheelRefBuf) return null;
  try {
    const imageUrl = await falUploadImage(wheelRefBuf);
    if (!imageUrl) return null;

    console.log(`[wheelMockup][flux] Calling Flux Kontext Max...`);
    const res = await fetch("https://fal.run/fal-ai/flux-pro/kontext/max", {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        image_url: imageUrl,
        num_images: 1,
        aspect_ratio: "16:9",
        output_format: "png",
        safety_tolerance: "6",
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.warn(`[wheelMockup][flux] generate failed ${res.status}: ${txt.slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    const outUrl: string | undefined = data?.images?.[0]?.url || data?.image?.url;
    if (!outUrl) {
      console.warn(`[wheelMockup][flux] no image url in response`);
      return null;
    }
    const imgRes = await fetch(outUrl);
    if (!imgRes.ok) return null;
    const buf = Buffer.from(await imgRes.arrayBuffer());
    console.log(`[wheelMockup][flux] ✅ Flux Kontext Max succeeded (${Math.round(buf.length / 1024)}KB)`);
    return buf;
  } catch (e: any) {
    console.warn(`[wheelMockup][flux] error: ${e?.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CACHE
// ═══════════════════════════════════════════════════════════════════════════

function getCacheKey(req: WheelMockupRequest): string {
  // Include finish in cache key so different colors get different cached images
  const finishKey = req.wheel.finish 
    ? req.wheel.finish.toLowerCase().replace(/[^a-z0-9]/g, "-").substring(0, 20)
    : "default";
  
  const parts = [
    req.vehicle.year,
    req.vehicle.make.toLowerCase().replace(/\s+/g, "-"),
    req.vehicle.model.toLowerCase().replace(/\s+/g, "-"),
    req.vehicle.color.toLowerCase().replace(/\s+/g, "-"),
    req.wheel.brand.toLowerCase().replace(/\s+/g, "-"),
    req.wheel.model.toLowerCase().replace(/\s+/g, "-"),
    finishKey,
    req.wheel.size,
    req.tire?.size?.replace(/[^a-z0-9]/gi, "") || "stock",
    // include tire identity so different tires don't collide in cache
    (req.tire?.model || req.tire?.terrain || "").toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 16) || "std",
    (req.lift || "stock").toLowerCase().replace(/\s+/g, "-"),
    // segment locked-pose renders so they don't collide with hero-shot ones
    // locked-pose (SAM composite) is the default; segment cache accordingly
    process.env.JAKE_WHEEL_LOCKED_POSE === "0" ? "hero" : "lp",
  ].join("-");
  
  // v20: FACE-ON wheel composite. Use WheelPros `-FACE-` image variant (true
  //       head-on shot) for the composite paste instead of the default 3/4
  //       angled catalog photo, so the pasted wheel matches the flat broadside
  //       render instead of looking "turned".
  // v19: LOCKED-POSE + SAM 3 composite (default). Render a fixed orthographic
  //       broadside, SAM 3 detects the wheels, composite the real wheel pixels
  //       at those positions. Validated 8/10 on trucks AND sedans.
  // v18: added ACCURACY PASS — composite the real wheel pixels onto the
  //       rendered wheels via 4-point perspective warp (transplants exact
  //       spoke geometry/finish/logo instead of letting the model redraw).
  // v17: switched PRIMARY engine to Flux Kontext Max (fal.ai). Bake-off across
  //       4 finishes: Flux best on spoke geometry + finish vs gpt-image-2/Gemini.
  //       gpt-image-2 remains the fallback when FAL_KEY is missing or Flux fails.
  // v16: hardened edit prompt to lock exact spoke geometry (gpt-image-2 was
  //       keeping the finish but drifting to a generic mesh spoke pattern).
  // v15: switched generation model to gpt-image-2 (better finish/color fidelity
  //       than gpt-image-1, which lost bronze/black/grey finishes).
  // v14: switched to images.edit with the real wheel/tire reference image
  //      (was redrawing from a text description, which mis-colored finishes).
  // v21: run Flux + real-wheel composite even when GPT-4o vision returns no
  //       description (image presence is enough). Fixes finish drift (e.g.
  //       satin black rendering as bronze) when a transient vision miss
  //       previously dropped to a generic text-only render. Invalidates the
  //       old finish-blind / non-composited cache entries.
  // v24: deskew angled catalog wheel photos toward head-on before compositing
  //       (Standard product shots are ~3/4 angled; reduces the "turned" look).
  // v23: stronger blackwall enforcement as a fixed composition rule in the
  //       locked-pose prompt (v22 whitewall suppression wasn't winning).
  // v22: default to black-sidewall tires when no tire is selected (was letting
  //       Flux invent whitewalls on wheel-only SRP mockups).
  return `jake-mockups/v24/${parts}.png`;
}

async function checkCache(cacheKey: string): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: cacheKey.replace(".png", ""), limit: 1 });
    if (blobs.length > 0) {
      const blob = blobs[0];
      const ageMs = Date.now() - new Date(blob.uploadedAt).getTime();
      if (ageMs < 7 * 24 * 60 * 60 * 1000) {
        return blob.url;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1: FETCH WHEEL IMAGE AND ANALYZE WITH GPT-4O VISION
// ═══════════════════════════════════════════════════════════════════════════

async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    console.log(`[wheelMockup] Fetching wheel image from: ${imageUrl.substring(0, 60)}...`);
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*',
      },
    });
    
    if (!response.ok) {
      console.error(`[wheelMockup] Image fetch failed: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/png';
    console.log(`[wheelMockup] Wheel image fetched: ${Math.round(arrayBuffer.byteLength / 1024)}KB`);
    return `data:${contentType};base64,${base64}`;
  } catch (error: any) {
    console.error(`[wheelMockup] Image fetch error: ${error?.message}`);
    return null;
  }
}

async function analyzeWheelForGeneration(base64Image: string, wheelName: string): Promise<string> {
  const openai = getOpenAI();
  
  console.log(`[wheelMockup] Step 1: Analyzing wheel with GPT-4o Vision...`);
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Describe this aftermarket wheel's visual appearance for an artist to recreate it. Focus on:
- Color/finish of the spokes (bronze, black, chrome, etc)
- Number of spokes and their shape
- Lip/barrel color
- Any accent details

Be specific about colors. Keep under 100 words.`,
            },
            {
              type: "image_url",
              image_url: { url: base64Image, detail: "high" },
            },
          ],
        },
      ],
    });
    
    const description = response.choices[0]?.message?.content || "";
    console.log(`[wheelMockup] Wheel analysis: ${description.substring(0, 200)}...`);
    return description;
  } catch (error: any) {
    console.error("[wheelMockup] Vision analysis failed:", error?.message);
    return "";
  }
}

async function analyzeTireForGeneration(base64Image: string, tireName: string): Promise<string> {
  const openai = getOpenAI();

  console.log(`[wheelMockup] Analyzing tire with GPT-4o Vision...`);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 250,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Describe this tire's visual appearance for an artist recreating it on a vehicle. Focus ONLY on the tire (ignore any wheel shown):
- Tread aggressiveness: highway/street, all-terrain, or mud-terrain
- Tread block style (tight ribs vs chunky blocks vs deep lugs)
- Sidewall: black sidewall (BSW) or raised white lettering (RWL)? Any aggressive sidewall lugs/styling?
Keep under 70 words.`,
            },
            {
              type: "image_url",
              image_url: { url: base64Image, detail: "high" },
            },
          ],
        },
      ],
    });

    const description = response.choices[0]?.message?.content || "";
    console.log(`[wheelMockup] Tire analysis: ${description.substring(0, 160)}...`);
    return description;
  } catch (error: any) {
    console.error("[wheelMockup] Tire vision analysis failed:", error?.message);
    return "";
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: BUILD PROMPT WITH PRECISE WHEEL DESCRIPTION
// ═══════════════════════════════════════════════════════════════════════════

// Infer the vehicle body style so the mockup renders the correct shape
// instead of always assuming a pickup truck (which turned cars like a
// Camaro into a Frankenstein coupe-truck).
function inferBodyStyle(make: string, model: string): { noun: string; isTruckOrSuv: boolean } {
  const m = `${model}`.toLowerCase();
  const mk = `${make}`.toLowerCase();

  // Known pickup trucks
  const truckModels = ["f-150", "f150", "f-250", "f-350", "f-450", "silverado", "sierra", "ram", "1500", "2500", "3500", "tundra", "tacoma", "frontier", "titan", "ranger", "colorado", "canyon", "ridgeline", "gladiator", "maverick", "super duty", "superduty", "avalanche", "dakota", "hummer ev", "cybertruck", "lightning"];
  if (truckModels.some((t) => m.includes(t))) return { noun: "pickup truck", isTruckOrSuv: true };

  // Known SUVs / crossovers
  const suvModels = ["tahoe", "suburban", "yukon", "escalade", "expedition", "explorer", "bronco", "4runner", "4-runner", "sequoia", "highlander", "pilot", "wrangler", "grand cherokee", "cherokee", "durango", "telluride", "palisade", "tahoe", "traverse", "blazer", "equinox", "rav4", "cr-v", "crv", "escape", "edge", "pathfinder", "armada", "land cruiser", "defender", "range rover", "g-wagon", "g-class", "q7", "q5", "x5", "x7", "gx", "lx", "rx", "qx", "mdx", "rdx", "atlas", "tiguan", "outback", "forester", "ascent", "cx-5", "cx-9", "cx-50", "cx-90", "santa fe", "tucson", "sorento", "sportage", "rogue", "murano", "kicks", "bronco sport", "trailblazer", "trax", "suv"];
  if (suvModels.some((s) => m.includes(s))) return { noun: "SUV", isTruckOrSuv: true };

  // Coupes / sports cars
  const coupeModels = ["camaro", "mustang", "corvette", "challenger", "supra", "gt-r", "gtr", "86", "brz", "miata", "mx-5", "z4", "m4", "m2", "911", "cayman", "viper"];
  if (coupeModels.some((c) => m.includes(c))) return { noun: "coupe", isTruckOrSuv: false };

  // Charger/300/sedans
  const sedanModels = ["charger", "300", "camry", "accord", "civic", "corolla", "altima", "sentra", "malibu", "impala", "sonata", "elantra", "jetta", "passat", "3-series", "5-series", "c-class", "e-class", "a4", "a6", "model 3", "model s", "taycan", "sedan"];
  if (sedanModels.some((s) => m.includes(s))) return { noun: "sedan", isTruckOrSuv: false };

  // Vans
  if (m.includes("van") || m.includes("transit") || m.includes("sprinter") || m.includes("sienna") || m.includes("odyssey") || m.includes("pacifica")) {
    return { noun: "van", isTruckOrSuv: false };
  }

  // Jeep brand default (non-Wrangler) -> SUV
  if (mk === "jeep") return { noun: "SUV", isTruckOrSuv: true };

  // Default: generic vehicle, no forced body shape, not truck/suv
  return { noun: "vehicle", isTruckOrSuv: false };
}

function buildPrompt(req: WheelMockupRequest, wheelDescription: string, tireDescription?: string): string {
  const { vehicle, wheel, tire, lift } = req;

  const body = inferBodyStyle(vehicle.make, vehicle.model);

  // Determine stance. Lift language only makes sense for trucks/SUVs; for cars,
  // map lift requests to lowered/stock so we never render a lifted coupe.
  let stance = "";
  if (lift) {
    const liftLower = lift.toLowerCase();
    if (body.isTruckOrSuv) {
      if (liftLower.includes("level")) stance = "with leveling kit";
      else if (liftLower.includes("6")) stance = "with 6-inch lift, aggressive stance";
      else if (liftLower.includes("4")) stance = "with 4-inch lift";
      else if (liftLower.includes("2") || liftLower.includes("3")) stance = "slightly lifted";
      else if (liftLower.includes("lower")) stance = "lowered";
    } else {
      // Cars: never lift
      if (liftLower.includes("lower")) stance = "lowered stance";
      else stance = ""; // stock ride height
    }
  }
  
  // Determine tires. Prefer a vision-analyzed description of the actual tire
  // product image (most accurate). Fall back to terrain/size text. When nothing
  // is specified, pick a body-style-appropriate default (street/performance for
  // cars, all-terrain for trucks/SUVs) instead of always defaulting to A/T.
  const defaultTireDesc = body.isTruckOrSuv
    ? "all-terrain tires with black sidewalls"
    : (body.noun === "coupe"
        ? "low-profile performance summer tires with black sidewalls"
        : "low-profile all-season touring tires with black sidewalls");
  let tireDesc = defaultTireDesc;
  if (tireDescription && tireDescription.trim()) {
    const sizePrefix = tire?.size ? `${tire.size} tires. ` : "";
    tireDesc = `${sizePrefix}${tireDescription.trim()}`;
  } else if (tire?.terrain) {
    const sizePrefix = tire.size ? `${tire.size} ` : "";
    tireDesc = `${sizePrefix}${tire.terrain} tires with black sidewalls`;
  } else if (tire?.size) {
    const sizePrefix = `${tire.size} `;
    tireDesc = body.isTruckOrSuv ? `${sizePrefix}all-terrain tires with black sidewalls` : `${sizePrefix}${defaultTireDesc}`;
  }

  // Build an emphasized tire block when we have a real analyzed description,
  // otherwise a simple inline phrase. gpt-image-1 defaults tires to smooth/street
  // unless the prompt explicitly insists on the tread aggressiveness.
  const hasTireSpec = !!(tireDescription && tireDescription.trim());
  const tireBlock = hasTireSpec
    ? `

TIRE SPECIFICATION (MUST MATCH):
${tireDesc}

CRITICAL: Render the tire tread to match the aggressiveness described above. If it says all-terrain, show moderately blocky tread with visible voids and shoulder lugs. If it says mud-terrain, show large chunky deep lugs. If it says highway/touring, show smooth ribbed tread. Match the sidewall (black sidewall vs raised white lettering) as described.`
    : `

The wheels are paired with ${tireDesc}.`;

  // The prompt with explicit wheel + tire descriptions.
  // Body style is inferred from the vehicle so we render the correct shape
  // (a Camaro is a coupe, not a pickup).
  const vehiclePhrase = `${vehicle.color} ${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const stancePhrase = stance ? ` ${stance}` : "";
  return `Professional automotive photograph of a ${vehiclePhrase}, a ${body.noun}${stancePhrase}.

CRITICAL VEHICLE ACCURACY: Render the correct factory body style and proportions of a ${vehicle.year} ${vehicle.make} ${vehicle.model}. Do NOT change the body type. If it is a coupe, keep it a 2-door coupe; if a sedan, a 4-door sedan; if a pickup, a pickup; if an SUV, an SUV. Do not add a truck bed to a car.

WHEEL SPECIFICATION (MUST MATCH EXACTLY):
${wheelDescription}

The vehicle has ${wheel.size}-inch aftermarket wheels matching the above specification on all four corners.${tireBlock}

CRITICAL: The wheel color/finish described above must be accurate. If the description says bronze/copper spokes, render bronze/copper. If it says black, render black.

Shot from front three-quarter angle showing driver side. Outdoor dealership setting with natural lighting. Sharp focus on wheels and tires. Photorealistic.`;
}

/**
 * Prompt for the images.edit path. The model is GIVEN the real wheel (and
 * optionally tire) product image(s) as reference, so we instruct it to mount
 * THOSE EXACT wheels on the vehicle rather than invent a wheel. The vision
 * description is included as reinforcement, but the reference image is primary.
 */
function buildEditPrompt(
  req: WheelMockupRequest,
  wheelDescription: string,
  tireDescription?: string,
  hasTireRef?: boolean,
): string {
  const { vehicle, wheel, tire, lift } = req;
  const body = inferBodyStyle(vehicle.make, vehicle.model);

  let stance = "";
  if (lift) {
    const l = lift.toLowerCase();
    if (body.isTruckOrSuv) {
      if (l.includes("level")) stance = " with a leveling kit";
      else if (l.includes("6")) stance = " with a 6-inch lift and aggressive stance";
      else if (l.includes("4")) stance = " with a 4-inch lift";
      else if (l.includes("2") || l.includes("3")) stance = " slightly lifted";
      else if (l.includes("lower")) stance = " lowered";
    } else if (l.includes("lower")) {
      stance = " with a lowered stance";
    }
  }

  const refLine = hasTireRef
    ? "You are given two reference images: the FIRST is the exact aftermarket wheel, the SECOND is the exact tire. Reproduce BOTH faithfully on the vehicle."
    : "You are given a reference image of the exact aftermarket wheel. Reproduce that wheel faithfully on the vehicle.";

  const tireLine = hasTireRef
    ? "Mount the tire from the second reference image — match its tread pattern and sidewall styling exactly."
    : (tireDescription && tireDescription.trim())
        ? `Fit tires described as: ${tireDescription.trim()}.`
        : (tire?.terrain ? `Fit ${tire.terrain} tires.` : "");

  return `Create a photorealistic automotive photograph of a ${vehicle.color} ${vehicle.year} ${vehicle.make} ${vehicle.model}, a ${body.noun}${stance}, fitted with the wheels from the reference image on all four corners.

${refLine}

#1 PRIORITY — EXACT WHEEL REPLICATION (most important instruction):
The wheel mounted on the vehicle must be a faithful copy of the reference wheel image — treat it like you are photographing THAT SAME physical wheel bolted onto the truck, not designing a new one. Reproduce ALL of the following exactly:
- SPOKE PATTERN: the exact same number of spokes and the exact same spoke shape and arrangement (e.g. split/forked spokes stay split/forked; a bold chunky multi-spoke pattern stays chunky; a fine mesh stays mesh). Do NOT substitute a generic mesh or fan pattern. Count the spokes in the reference and match that count.
- WINDOW SHAPE: the openings between the spokes must have the same shape and proportions as the reference.
- FINISH & COLOR: identical (bronze stays bronze, gloss black stays gloss black, satin/grey stays satin/grey, machined stays machined, chrome stays chrome). Never default to silver/machined if the reference is colored.
- LIP/RING: same outer lip or simulated-beadlock ring, same bolt heads/accents and their color.
- CENTER CAP: same cap and logo.
Do NOT restyle, recolor, simplify, or substitute a different wheel model. If unsure, copy the reference more literally. ${wheelDescription ? `For reference, the wheel looks like: ${wheelDescription.trim()}` : ""}

These are ${wheel.size}-inch wheels. ${tireLine}

FRAMING: Compose the shot so the front and rear wheels are large and prominent in the frame with crisp, high-detail focus on the wheel faces — the wheel design must be clearly legible, not blurred or small.

CRITICAL — VEHICLE ACCURACY: Render the correct factory body style and proportions of a ${vehicle.year} ${vehicle.make} ${vehicle.model}. Keep the correct body type (coupe stays a 2-door coupe, sedan a 4-door, pickup a pickup, SUV an SUV). Do not add a truck bed to a car.

Front three-quarter angle, driver side. Outdoor dealership setting, natural lighting, sharp focus on the wheels and tires. Photorealistic.`;
}

// ═══════════════════════════════════════════════════════════════════
// STEP 3: GENERATE IMAGE
// ═══════════════════════════════════════════════════════════════════

export async function generateWheelMockup(req: WheelMockupRequest): Promise<WheelMockupResult> {
  const startTime = Date.now();
  
  console.log(`[wheelMockup] ════════════════════════════════════════════════`);
  console.log(`[wheelMockup] ${req.vehicle.color} ${req.vehicle.year} ${req.vehicle.make} ${req.vehicle.model}`);
  console.log(`[wheelMockup] Wheel: ${req.wheel.size}" ${req.wheel.brand} ${req.wheel.model}`);
  console.log(`[wheelMockup] Lift: ${req.lift || "stock"}`);
  
  try {
    const cacheKey = getCacheKey(req);
    const cached = await checkCache(cacheKey);
    if (cached) {
      console.log(`[wheelMockup] ✅ Cache hit`);
      return { 
        success: true, 
        imageUrl: cached, 
        cached: true, 
        generationTimeMs: Date.now() - startTime,
        confidence: "high",
        method: "cached"
      };
    }
    console.log(`[wheelMockup] Cache miss - generating fresh`);
    
    // Step 1: Fetch wheel image and analyze with GPT-4o Vision
    const base64Image = await fetchImageAsBase64(req.wheel.imageUrl);
    
    let wheelDescription = "";
    let usedFallbackDescription = false;
    if (base64Image) {
      wheelDescription = await analyzeWheelForGeneration(
        base64Image,
        `${req.wheel.brand} ${req.wheel.model}`
      );
    }
    
    // Fallback if analysis failed (image fetch failed OR vision returned nothing).
    // This path produces LOWER-fidelity mockups because we're guessing the wheel
    // from text instead of analyzing the real image - flag it so callers/UI know.
    if (!wheelDescription) {
      usedFallbackDescription = true;
      const finishDesc = req.wheel.finish || "aftermarket";
      wheelDescription = `${req.wheel.brand} ${req.wheel.model} wheel in ${finishDesc} finish with aggressive off-road styling`;
      console.warn(`[wheelMockup] ⚠️ FALLBACK DESCRIPTION USED - real wheel image not analyzed (fetch/vision failed). Mockup accuracy will be reduced. imageUrl=${req.wheel.imageUrl?.substring(0, 80)}`);
    }
    
    // Step 1b: If a tire product image is provided, analyze it too so the
    // mockup shows the actual tire (tread aggressiveness + sidewall style)
    // instead of a generic "all-terrain" guess.
    let tireDescription = "";
    if (req.tire?.imageUrl) {
      const tireBase64 = await fetchImageAsBase64(req.tire.imageUrl);
      if (tireBase64) {
        tireDescription = await analyzeTireForGeneration(
          tireBase64,
          `${req.tire.brand || ""} ${req.tire.model || ""}`.trim()
        );
      } else {
        console.warn(`[wheelMockup] ⚠️ Tire image fetch failed; using terrain/size fallback`);
      }
    }

    // Step 2: Build the prompt with wheel + tire description
    const prompt = buildPrompt(req, wheelDescription, tireDescription);
    console.log(`[wheelMockup] Step 2: Prompt built (${prompt.length} chars)`);
    
    // Step 3: Generate with gpt-image-1
    const openai = getOpenAI();

    // Step 3: Generate the mockup.
    // PREFERRED PATH: images.edit with the REAL wheel (and tire) product image as
    // visual references. This makes gpt-image-1 reproduce the actual wheel design
    // and finish instead of redrawing a generic wheel from a text description
    // (which previously turned a chrome wheel into a random bronze one).
    // Falls back to text-only images.generate if edit fails or no real image.
    let imageData: { b64_json?: string | null; url?: string | null } | undefined;
    let usedImageReference = false;
    let fluxBuffer: Buffer | null = null;

    // PRIMARY ENGINE: Flux Kontext Max (fal.ai). Best spoke-geometry + finish
    // fidelity in our bake-off. Uses the real wheel image as the reference.
    // Falls through to the OpenAI gpt-image-2 path below if Flux is unavailable
    // (no FAL_KEY) or fails.
    // LOCKED-POSE MODE: render the vehicle in a fixed orthographic broadside so
    // wheels land at calibrated positions, then composite the real wheel at
    // those positions (refined by a local snap) — no per-image vision detection.
    //
    // STATUS (2026-06-17): locked-pose + SAM 3 detection composite.
    // Pipeline: render the vehicle in a fixed orthographic broadside (wheels
    // become perfect circles), then SAM 3 ("wheel" text prompt) detects the
    // actual wheel positions and we composite the REAL wheel pixels there.
    // Validated 8/10 on BOTH trucks and sedans (placement locked, no halos).
    // This supersedes the brightness-snap (which was a render-to-render
    // coin-flip). Enabled by default; disable with JAKE_WHEEL_LOCKED_POSE=0,
    // force on with =1.
    const lockedPoseMode = process.env.JAKE_WHEEL_LOCKED_POSE !== "0";
    // ACCURATE PATH GATE (2026-06-18): run Flux + composite whenever we have the
    // real wheel image, EVEN IF GPT-4o vision returned no description. The vision
    // text is only flavor for the prompt; the composite pastes the REAL wheel
    // pixels and the locked-pose prompt already says "reproduce the reference
    // wheel faithfully." Previously this was gated on !usedFallbackDescription,
    // so a transient vision miss dropped us to a text-only render that invented a
    // generic finish (e.g. satin black -> bronze). Having the image is enough.
    const realWheelImage: string | null = base64Image;
    if (realWheelImage) {
      const wheelRefBuf = dataUrlToBuffer(realWheelImage);
      let promptForFlux: string;
      if (lockedPoseMode) {
        const vehDesc = `${req.vehicle.color} ${req.vehicle.year} ${req.vehicle.make} ${req.vehicle.model}`;
        const wheelInstr = `Reproduce the reference wheel faithfully (exact spoke count/shape, finish/color, lip ring, bolts, and center cap). Do not restyle or substitute a different wheel.${wheelDescription ? ` The wheel looks like: ${wheelDescription.trim()}` : ""}`;
        const tireInstr = `These are ${req.wheel.size}-inch wheels${tireDescription ? ` with ${tireDescription.trim()}` : " fitted with plain matte black-sidewall tires"}.`;
        promptForFlux = buildLockedPosePrompt(vehDesc, wheelInstr, tireInstr);
      } else {
        promptForFlux = buildEditPrompt(req, wheelDescription, tireDescription, false);
      }
      fluxBuffer = await generateWithFluxKontext(wheelRefBuf, promptForFlux);
      if (fluxBuffer) {
        usedImageReference = true;
        imageData = { b64_json: fluxBuffer.toString("base64") };
        console.log(`[wheelMockup] ✅ Using Flux Kontext Max output${lockedPoseMode ? " (locked-pose)" : ""}`);
      }
    }

    const refFiles: Array<Awaited<ReturnType<typeof toFile>>> = [];
    if (realWheelImage) {
      try {
        refFiles.push(await toFile(dataUrlToBuffer(realWheelImage), "wheel.png", { type: "image/png" }));
      } catch (e) {
        console.warn(`[wheelMockup] could not prepare wheel ref file: ${e}`);
      }
    }
    if (req.tire?.imageUrl) {
      const tireB64 = await fetchImageAsBase64(req.tire.imageUrl);
      if (tireB64) {
        try {
          refFiles.push(await toFile(dataUrlToBuffer(tireB64), "tire.png", { type: "image/png" }));
        } catch (e) {
          console.warn(`[wheelMockup] could not prepare tire ref file: ${e}`);
        }
      }
    }

    if (!imageData && refFiles.length > 0) {
      try {
        console.log(`[wheelMockup] Step 3: images.edit with ${refFiles.length} reference image(s)...`);
        const editPrompt = buildEditPrompt(req, wheelDescription, tireDescription, refFiles.length > 1);
        const editRes = await openai.images.edit({
          model: "gpt-image-2",
          image: refFiles,
          prompt: editPrompt,
          n: 1,
          size: "1536x1024",
        });
        const d = editRes.data?.[0];
        if (d?.b64_json || d?.url) {
          imageData = d;
          usedImageReference = true;
          console.log(`[wheelMockup] ✅ images.edit succeeded (real wheel reference used)`);
        } else {
          console.warn(`[wheelMockup] images.edit returned no data; falling back to generate`);
        }
      } catch (editErr: any) {
        console.warn(`[wheelMockup] images.edit failed (${editErr?.message}); falling back to text generate`);
      }
    }

    if (!imageData) {
      console.log(`[wheelMockup] Step 3: Generating image with gpt-image-2 (text prompt)...`);
      const response = await openai.images.generate({
        model: "gpt-image-2",
        prompt,
        n: 1,
        size: "1536x1024",
      });
      imageData = response.data?.[0];
    }

    if (!imageData?.b64_json && !imageData?.url) {
      throw new Error("No image data returned");
    }
    
    // Get image buffer
    let imageBuffer: Buffer;
    if (imageData.b64_json) {
      imageBuffer = Buffer.from(imageData.b64_json, "base64");
    } else {
      const imgRes = await fetch(imageData.url!);
      imageBuffer = Buffer.from(await imgRes.arrayBuffer());
    }

    // ── ACCURACY PASS ────────────────────────────────────────────────────
    // Composite the REAL wheel pixels onto the rendered wheels via 4-point
    // perspective warp. This transplants brand-critical detail (spoke
    // geometry, finish, logo) that any generative model would otherwise
    // approximate. Best-effort: on any failure we keep the base render.
    // Accuracy pass is OPT-IN. It is fully built and validated (9/10 fidelity
    // when fed correct coordinates), but wheel LOCALIZATION via GPT-4o vision is
    // currently unreliable (pixel coords drift 200px+ between calls), which can
    // misplace the composited wheel. Until a real detection model (segmentation/
    // SAM/YOLO) feeds accurate wheel boxes, keep this OFF by default and ship the
    // reliable Flux single-pass render. Flip on with JAKE_WHEEL_COMPOSITE=1.
    let usedComposite = false;

    // LOCKED-POSE composite (reliable): the render used the fixed broadside
    // pose, so composite the real wheel at calibrated FIXED positions — no
    // SAM 3 detects the actual wheel positions on the locked-pose render.
    if (lockedPoseMode && realWheelImage && fluxBuffer) {
      try {
        const body = inferBodyStyle(req.vehicle.make, req.vehicle.model);
        const bodyClass = toBodyClass(body.noun, body.isTruckOrSuv, req.lift);
        // Use the FACE-ON wheel variant for the composite paste. The default
        // catalog image is a 3/4 angled shot, which looks "turned" when pasted
        // onto the flat broadside render. The -FACE- variant is a true head-on
        // shot (perfect circle, round lug holes) that matches the side profile.
        let wheelRefBuf = dataUrlToBuffer(realWheelImage);
        const faceUrl = await resolveFaceWheelImageUrl(req.wheel.imageUrl);
        if (faceUrl !== req.wheel.imageUrl) {
          const faceB64 = await fetchImageAsBase64(faceUrl);
          if (faceB64) wheelRefBuf = dataUrlToBuffer(faceB64);
        }
        const composited = await compositeFixedWheels({ mockupBuf: imageBuffer, wheelImageBuf: wheelRefBuf, bodyClass, refine: "sam" });
        if (composited) {
          imageBuffer = composited;
          usedComposite = true;
          console.log(`[wheelMockup] ✅ Locked-pose composite applied (bodyClass=${bodyClass})`);
        }
      } catch (lpErr: any) {
        console.warn(`[wheelMockup] Locked-pose composite failed (${lpErr?.message}); keeping base render`);
      }
    }

    if (!usedComposite && realWheelImage && process.env.JAKE_WHEEL_COMPOSITE === "1") {
      try {
        const meta = await sharp(imageBuffer).metadata();
        const W = meta.width || 0, H = meta.height || 0;
        if (W && H) {
          console.log(`[wheelMockup] Accuracy pass: detecting wheels (${W}x${H})...`);
          const wheels = await detectWheels(openai, imageBuffer, W, H);
          if (wheels.front || wheels.rear) {
            const wheelRefBuf = dataUrlToBuffer(realWheelImage);
            const composited = await compositeRealWheels({ mockupBuf: imageBuffer, wheelImageBuf: wheelRefBuf, wheels });
            if (composited) {
              imageBuffer = composited;
              usedComposite = true;
              const which = [wheels.front && "front", wheels.rear && "rear"].filter(Boolean).join("+");
              console.log(`[wheelMockup] ✅ Accuracy pass composited real wheel onto: ${which}`);
            }
          } else {
            console.log(`[wheelMockup] Accuracy pass: no wheels detected, keeping base render`);
          }
        }
      } catch (compErr: any) {
        console.warn(`[wheelMockup] Accuracy pass failed (${compErr?.message}); keeping base render`);
      }
    }

    // Save to CDN
    console.log(`[wheelMockup] Saving to CDN (${Math.round(imageBuffer.length / 1024)}KB)...`);
    const blob = await put(cacheKey, imageBuffer, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: true,
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`[wheelMockup] ✅ Done in ${elapsed}ms`);
    console.log(`[wheelMockup] URL: ${blob.url}`);
    console.log(`[wheelMockup] ════════════════════════════════════════════════`);
    
    return {
      success: true,
      imageUrl: blob.url,
      cached: false,
      generationTimeMs: elapsed,
      // High only when we actually used the real product image as a reference;
      // medium when we redrew from a vision description; low on text-only fallback.
      confidence: usedFallbackDescription ? "low" : usedImageReference ? "high" : "medium",
      composited: usedComposite,
      method: usedFallbackDescription
        ? "text-fallback"
        : fluxBuffer
          ? "flux-kontext"
          : usedImageReference
            ? "image-reference"
            : "vision-analyzed",
    };
    
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[wheelMockup] ❌ Failed after ${elapsed}ms:`, error?.message || error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Generation failed",
      cached: false,
      generationTimeMs: elapsed,
      confidence: "low",
    };
  }
}
