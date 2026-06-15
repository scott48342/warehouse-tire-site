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
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content: `You are creating a detailed wheel description for an AI image generator. Your description must be EXTREMELY PRECISE about colors and design so the generated image matches exactly.

OUTPUT FORMAT - describe the wheel with these exact sections:
1. FINISH COLOR: Be very specific (e.g., "matte bronze/copper colored spokes" NOT just "bronze")
2. SPOKE DESIGN: Count, shape, thickness
3. LIP/BARREL: Color, style (e.g., "black outer lip with simulated beadlock bolts")
4. CENTER CAP: Color, logo
5. OVERALL: Any two-tone effects

CRITICAL: The finish color is the most important detail. If the wheel has bronze/copper spokes, say "BRONZE/COPPER colored spokes". If black, say "BLACK". Be explicit.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Describe this ${wheelName} wheel precisely for image generation:`,
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

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: BUILD PROMPT WITH PRECISE WHEEL DESCRIPTION
// ═══════════════════════════════════════════════════════════════════════════

function buildPrompt(req: WheelMockupRequest, wheelDescription: string): string {
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
  let tireDesc = "all-terrain tires with black sidewalls";
  if (tire?.size) {
    tireDesc = `${tire.size} all-terrain tires`;
  }

  // The prompt with explicit wheel description
  return `Professional automotive photograph of a ${vehicle.color} ${vehicle.year} ${vehicle.make} ${vehicle.model} pickup truck ${stance}.

WHEEL SPECIFICATION (MUST MATCH EXACTLY):
${wheelDescription}

The truck has ${wheel.size}-inch aftermarket wheels matching the above specification on all four corners. Paired with ${tireDesc}.

CRITICAL: The wheel color/finish described above must be accurate. If the description says bronze/copper spokes, render bronze/copper. If it says black, render black.

Shot from front three-quarter angle showing driver side. Outdoor dealership setting with natural lighting. Sharp focus on wheels. Photorealistic.`;
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
    
    // Step 1: Fetch wheel image and analyze with GPT-4o Vision
    const base64Image = await fetchImageAsBase64(req.wheel.imageUrl);
    
    let wheelDescription = "";
    if (base64Image) {
      wheelDescription = await analyzeWheelForGeneration(
        base64Image,
        `${req.wheel.brand} ${req.wheel.model}`
      );
    }
    
    // Fallback if analysis failed
    if (!wheelDescription) {
      const finishDesc = req.wheel.finish || "aftermarket";
      wheelDescription = `${req.wheel.brand} ${req.wheel.model} wheel in ${finishDesc} finish with aggressive off-road styling`;
      console.log(`[wheelMockup] Using fallback description`);
    }
    
    // Step 2: Build the prompt with wheel description
    const prompt = buildPrompt(req, wheelDescription);
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
