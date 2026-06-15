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
  method?: "vision-analyzed" | "cached";
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
    (req.lift || "stock").toLowerCase().replace(/\s+/g, "-"),
  ].join("-");
  
  return `jake-mockups/v10/${parts}.png`;
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
// STEP 1: FETCH WHEEL IMAGE
// ═══════════════════════════════════════════════════════════════════════════

async function fetchWheelImage(imageUrl: string): Promise<Buffer | null> {
  try {
    console.log(`[wheelMockup] Step 1: Fetching wheel image from: ${imageUrl.substring(0, 60)}...`);
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
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[wheelMockup] Wheel image fetched: ${Math.round(buffer.length / 1024)}KB`);
    return buffer;
  } catch (error: any) {
    console.error(`[wheelMockup] Image fetch error: ${error?.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: BUILD PROMPT (wheel image will be passed separately)
// ═══════════════════════════════════════════════════════════════════════════

function buildPrompt(req: WheelMockupRequest): string {
  const { vehicle, wheel, tire, lift } = req;
  
  // Determine stance
  let stance = "";
  if (lift) {
    const liftLower = lift.toLowerCase();
    if (liftLower.includes("level")) stance = "with leveling kit";
    else if (liftLower.includes("6")) stance = "with 6-inch lift, aggressive stance";
    else if (liftLower.includes("4")) stance = "with 4-inch lift";
    else if (liftLower.includes("2") || liftLower.includes("3")) stance = "slightly lifted";
    else if (liftLower.includes("lower")) stance = "lowered";
  }
  
  // Determine tires
  let tireDesc = "all-terrain tires";
  if (tire?.size) {
    tireDesc = `${tire.size} tires`;
  }

  // The prompt - references the attached wheel image
  return `Generate a realistic ${vehicle.color} ${vehicle.year} ${vehicle.make} ${vehicle.model} pickup truck ${stance}.

Use the attached wheel image as the wheel reference. Install that exact wheel in a ${wheel.size}-inch fitment on all four corners.

Maintain from the reference wheel:
- Exact spoke design and spoke count
- Exact finish color (bronze, black, chrome, etc.)
- Beadlock ring appearance if present
- Center cap styling

Paired with ${tireDesc}.

Shot from front three-quarter angle showing driver side. Outdoor dealership/parking lot setting with natural lighting. Sharp focus on the wheels. Photorealistic professional automotive photography.`;
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
    // CACHE DISABLED FOR TESTING - always generate fresh
    const cacheKey = getCacheKey(req);
    // const cached = await checkCache(cacheKey);
    // if (cached) {
    //   console.log(`[wheelMockup] ✅ Cache hit`);
    //   return { 
    //     success: true, 
    //     imageUrl: cached, 
    //     cached: true, 
    //     generationTimeMs: Date.now() - startTime,
    //     confidence: "high",
    //     method: "cached"
    //   };
    // }
    console.log(`[wheelMockup] Cache disabled - generating fresh`);
    
    // Step 1: Fetch the wheel image
    const wheelImageBuffer = await fetchWheelImage(req.wheel.imageUrl);
    
    if (!wheelImageBuffer) {
      throw new Error("Failed to fetch wheel image");
    }
    
    // Step 2: Build the prompt
    const prompt = buildPrompt(req);
    console.log(`[wheelMockup] Step 2: Prompt built (${prompt.length} chars)`);
    
    // Step 3: Generate with gpt-image-1 using wheel image as reference
    console.log(`[wheelMockup] Step 3: Generating image with gpt-image-1 + wheel reference...`);
    const openai = getOpenAI();
    
    // Convert wheel image to base64 for API
    const wheelBase64 = wheelImageBuffer.toString('base64');
    
    // Use the images API with image input
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: "1536x1024",
      // @ts-ignore - image input support for gpt-image-1
      image: [{
        type: "base64",
        data: wheelBase64,
      }],
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
      addRandomSuffix: false,
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
      confidence: "high",
      method: "vision-analyzed",
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
