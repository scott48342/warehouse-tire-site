/**
 * Jake AI Wheel Mockup Generator
 * 
 * Uses GPT-4o Vision to analyze wheel + gpt-image-1 to generate mockup.
 * With detailed wheel analysis for accurate reproduction.
 * 
 * @created 2026-06-15
 * @updated 2026-06-15 - Use chat completions + images API (fallback from Responses API)
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
  method?: "image-reference" | "text-only" | "cached";
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
  const parts = [
    req.vehicle.year,
    req.vehicle.make.toLowerCase().replace(/\s+/g, "-"),
    req.vehicle.model.toLowerCase().replace(/\s+/g, "-"),
    req.vehicle.color.toLowerCase().replace(/\s+/g, "-"),
    req.wheel.brand.toLowerCase().replace(/\s+/g, "-"),
    req.wheel.model.toLowerCase().replace(/\s+/g, "-"),
    req.wheel.size,
    req.tire?.size?.replace(/[^a-z0-9]/gi, "") || "stock",
    (req.lift || "stock").toLowerCase().replace(/\s+/g, "-"),
    crypto.createHash("md5").update(req.wheel.imageUrl).digest("hex").substring(0, 8),
  ].join("-");
  
  return `jake-mockups/v8/${parts}.png`;
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
// WHEEL ANALYSIS WITH GPT-4O VISION (DETAILED)
// ═══════════════════════════════════════════════════════════════════════════

async function analyzeWheelImageDetailed(imageUrl: string, wheelName: string): Promise<string> {
  const openai = getOpenAI();
  
  console.log(`[wheelMockup] Analyzing wheel with GPT-4o Vision...`);
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: `You are a wheel design analyst. Describe wheels with extreme precision for image generation.
Focus on exact details that distinguish this wheel from others:
- Spoke count (e.g., "5 thick Y-spokes", "7 thin straight spokes", "6 split-spoke pairs")
- Spoke shape (straight, curved, twisted, forked, stepped)
- Finish and color (matte bronze, gloss black, machined silver, two-tone)
- Lip style (deep lip, flush, stepped, machined lip)
- Center cap design
- Any accents (milled edges, colored bolts, contrast details)
Be specific enough that an AI could recreate this exact wheel.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Describe this ${wheelName} wheel in precise detail for image generation. Include spoke count, spoke pattern/shape, finish color, lip style, and center cap. Be extremely specific so the wheel can be accurately reproduced.`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" },
            },
          ],
        },
      ],
    });
    
    const description = response.choices[0]?.message?.content || "";
    console.log(`[wheelMockup] Wheel analysis: ${description.substring(0, 150)}...`);
    return description;
  } catch (error: any) {
    console.error("[wheelMockup] Vision analysis failed:", error?.message || error);
    // Return basic description on failure
    return `${wheelName} aftermarket wheel`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD DETAILED PROMPT
// ═══════════════════════════════════════════════════════════════════════════

function buildPrompt(req: WheelMockupRequest, wheelDescription: string): string {
  const { vehicle, wheel, tire, lift } = req;
  
  let stance = "factory ride height";
  if (lift) {
    const liftLower = lift.toLowerCase();
    if (liftLower.includes("level")) stance = "leveled stance";
    else if (liftLower.includes("6")) stance = "6-inch lift, tall aggressive stance";
    else if (liftLower.includes("4")) stance = "4-inch lift, lifted stance";
    else if (liftLower.includes("2") || liftLower.includes("3")) stance = "2-3 inch lift";
    else if (liftLower.includes("lower")) stance = "lowered stance";
  }
  
  let tireDesc = "matching all-terrain tires";
  if (tire?.size) {
    tireDesc = `${tire.size} tires`;
    if (tire.size.includes("12.50") || tire.size.includes("13.50")) {
      tireDesc += " with aggressive all-terrain tread";
    }
  }

  return `Professional dealership photograph of a ${vehicle.color} ${vehicle.year} ${vehicle.make} ${vehicle.model}.

WHEEL (MUST MATCH EXACTLY):
${wheel.size}-inch ${wheel.brand} ${wheel.model} wheels.
${wheelDescription}
The wheels MUST have the exact spoke count, pattern, finish color, and design described above.

VEHICLE:
- Color: ${vehicle.color}
- Stance: ${stance}
- Tires: ${tireDesc}

PHOTOGRAPHY:
- Front three-quarter angle, driver side visible
- Outdoor natural lighting
- Clean background (showroom, parking lot, or scenic)
- Sharp focus on wheels
- Professional automotive quality
- Realistic proportions

Single vehicle. No text/watermarks. Photorealistic.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE MOCKUP
// ═══════════════════════════════════════════════════════════════════════════

export async function generateWheelMockup(req: WheelMockupRequest): Promise<WheelMockupResult> {
  const startTime = Date.now();
  
  console.log(`[wheelMockup] ═══════════════════════════════════════════════════`);
  console.log(`[wheelMockup] ${req.vehicle.color} ${req.vehicle.year} ${req.vehicle.make} ${req.vehicle.model}`);
  console.log(`[wheelMockup] Wheel: ${req.wheel.size}" ${req.wheel.brand} ${req.wheel.model}`);
  console.log(`[wheelMockup] Wheel image: ${req.wheel.imageUrl.substring(0, 60)}...`);
  console.log(`[wheelMockup] Lift: ${req.lift || "stock"}`);
  
  try {
    // Check cache
    const cacheKey = getCacheKey(req);
    const cached = await checkCache(cacheKey);
    if (cached) {
      console.log(`[wheelMockup] ✅ Cache hit (v8)`);
      return { 
        success: true, 
        imageUrl: cached, 
        cached: true, 
        generationTimeMs: Date.now() - startTime,
        confidence: "medium",
        method: "cached"
      };
    }
    
    // Step 1: Detailed wheel analysis with GPT-4o Vision
    const wheelDescription = await analyzeWheelImageDetailed(
      req.wheel.imageUrl,
      `${req.wheel.brand} ${req.wheel.model}`
    );
    
    // Step 2: Build detailed prompt
    const prompt = buildPrompt(req, wheelDescription);
    console.log(`[wheelMockup] Generating image with gpt-image-1...`);
    
    // Step 3: Try Responses API with image reference first, fall back to images.generate
    const openai = getOpenAI();
    let response: any;
    let usedResponsesAPI = false;
    
    try {
      // Try Responses API with input_fidelity for better wheel matching
      console.log(`[wheelMockup] Trying Responses API with input_fidelity:high...`);
      const responsesResult = await openai.responses.create({
        model: "gpt-4o",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { 
                type: "input_image", 
                image_url: req.wheel.imageUrl,
                detail: "high",
              }
            ]
          }
        ],
        tools: [{ 
          type: "image_generation",
          input_fidelity: "high",
          model: "gpt-image-1",
          size: "1536x1024",
        }],
      });
      
      // Extract image from response
      for (const item of responsesResult.output || []) {
        if (item.type === "image_generation_call" && (item as any).status === "completed") {
          const imgResult = (item as any).result;
          if (imgResult) {
            response = { data: [{ b64_json: imgResult }] };
            usedResponsesAPI = true;
            console.log(`[wheelMockup] ✅ Responses API succeeded!`);
            break;
          }
        }
      }
      
      if (!usedResponsesAPI) {
        throw new Error("No image in Responses API output");
      }
    } catch (responsesError: any) {
      console.error(`[wheelMockup] ⚠️ Responses API FAILED: ${responsesError?.message}`);
      console.log(`[wheelMockup] Falling back to text-only generation (wheel design may not match)`);
      console.log(`[wheelMockup] To fix: Ensure OpenAI org is verified at https://platform.openai.com/settings/organization/general`);
      response = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: "1536x1024",
      });
    }
    
    const imageData = response.data?.[0];
    if (!imageData?.b64_json && !imageData?.url) {
      throw new Error("No image data returned from generation");
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
    console.log(`[wheelMockup] ✅ Done in ${elapsed}ms: ${blob.url}`);
    console.log(`[wheelMockup] Method: detailed-vision-analysis (v8)`);
    console.log(`[wheelMockup] ═══════════════════════════════════════════════════`);
    
    return {
      success: true,
      imageUrl: blob.url,
      cached: false,
      generationTimeMs: elapsed,
      // High confidence if Responses API with image reference, medium for text-only
      confidence: usedResponsesAPI ? "high" : "medium",
      method: usedResponsesAPI ? "image-reference" : "text-only",
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
