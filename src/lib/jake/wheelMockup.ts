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

import OpenAI from "openai";
import { put, list } from "@vercel/blob";
import * as crypto from "crypto";

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
  method?: "vision-analyzed" | "cached" | "text-fallback";
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
  ].join("-");
  
  return `jake-mockups/v13/${parts}.png`;
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
    tireDesc = body.isTruckOrSuv ? `${sizePrefix}all-terrain tires` : `${sizePrefix}${defaultTireDesc}`;
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

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3: GENERATE IMAGE
// ═══════════════════════════════════════════════════════════════════════════

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
    console.log(`[wheelMockup] Step 3: Generating image with gpt-image-1...`);
    const openai = getOpenAI();
    
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: "1536x1024",
    });
    
    const imageData = response.data?.[0];
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
      // If we couldn't analyze the real image, the wheel is a text-based guess.
      confidence: usedFallbackDescription ? "low" : "high",
      method: usedFallbackDescription ? "text-fallback" : "vision-analyzed",
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
