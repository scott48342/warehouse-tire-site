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

export const MOCKUP_DISCLAIMER = "AI visual mockup only. Final appearance may vary by trim, wheel size, offset, tire size, suspension, and lighting.";

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
// STEP 1: ANALYZE WHEEL WITH GPT-4O VISION
// ═══════════════════════════════════════════════════════════════════════════

async function analyzeWheel(imageUrl: string, wheelName: string, wheelFinish?: string): Promise<string> {
  const openai = getOpenAI();
  
  console.log(`[wheelMockup] Step 1: Analyzing wheel with GPT-4o Vision...`);
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content: `You are a wheel design expert. Describe wheels with extreme visual precision.

Your description will be used to generate an AI image, so be EXACT about:
- Spoke count (exact number)
- Spoke shape (straight, curved, Y-shaped, split, forked, etc.)
- Spoke thickness and taper
- Finish color (matte black, gloss black, bronze, machined silver, etc.)
- Lip style (deep lip, flush, stepped)
- Any two-tone or accent details
- Center cap style

Keep description under 100 words but highly specific.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Describe this ${wheelName} wheel's visual design precisely:`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" },
            },
          ],
        },
      ],
    });
    
    const description = response.choices[0]?.message?.content || `${wheelName} aftermarket wheel`;
    console.log(`[wheelMockup] Wheel analysis: ${description}`);
    return description;
  } catch (error: any) {
    console.error("[wheelMockup] Vision analysis failed:", error?.message);
    // Use finish description in fallback when vision fails
    const finishDesc = wheelFinish ? ` in ${wheelFinish} finish` : "";
    console.log(`[wheelMockup] Using fallback with finish: ${wheelFinish || 'none provided'}`);
    return `${wheelName} aftermarket wheel${finishDesc} with aggressive off-road styling, deep lip, and beadlock-style accents`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: BUILD PROMPT
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
  let tireDesc = "all-terrain tires";
  if (tire?.size) {
    tireDesc = `${tire.size} tires`;
  }

  // The prompt - simple, specific, photorealistic
  return `Professional automotive photograph of a ${vehicle.color} ${vehicle.year} ${vehicle.make} ${vehicle.model} ${stance}.

The truck has ${wheel.size}-inch ${wheel.brand} ${wheel.model} wheels: ${wheelDescription}

Paired with ${tireDesc}.

Shot from front three-quarter angle showing driver side. Outdoor setting with natural lighting. Sharp focus on the wheels. Clean professional dealership photo style. Photorealistic, high quality.`;
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
    // Check cache first
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
    
    // Step 1: Analyze wheel with GPT-4o Vision
    const wheelDescription = await analyzeWheel(
      req.wheel.imageUrl,
      `${req.wheel.brand} ${req.wheel.model}`,
      req.wheel.finish
    );
    
    // Step 2: Build the prompt
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
