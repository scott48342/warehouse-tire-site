/**
 * Jake AI Wheel Mockup Generator
 * 
 * Direct OpenAI image generation for wheel mockups.
 * Simple, clean, no legacy visualizer dependencies.
 * 
 * @created 2026-06-15
 */

import OpenAI from "openai";
import { put } from "@vercel/blob";
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
    size: number; // diameter in inches
  };
  tire?: {
    size?: string; // e.g., "35x12.50R20"
  };
  lift?: string; // e.g., "stock", "leveled", "4 inch lift"
}

export interface WheelMockupResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  cached: boolean;
  generationTimeMs?: number;
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
    // Hash the wheel image URL for uniqueness
    crypto.createHash("md5").update(req.wheel.imageUrl).digest("hex").substring(0, 8),
  ].join("-");
  
  return `jake-mockups/${parts}.png`;
}

// Simple in-memory cache check via Vercel Blob list
async function checkCache(cacheKey: string): Promise<string | null> {
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: cacheKey.replace(".png", ""), limit: 1 });
    
    if (blobs.length > 0) {
      const blob = blobs[0];
      // 7 day TTL
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
// WHEEL IMAGE ANALYSIS (GPT-4o Vision)
// ═══════════════════════════════════════════════════════════════════════════

async function analyzeWheelImage(imageUrl: string, wheelName: string): Promise<string> {
  const openai = getOpenAI();
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Describe this ${wheelName} wheel in 2-3 sentences for image generation. Focus on: spoke pattern, finish/color, lip style, overall aesthetic. Be specific and visual.`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    });
    
    return response.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("[wheelMockup] Vision analysis failed:", error);
    return "";
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD PROMPT
// ═══════════════════════════════════════════════════════════════════════════

function buildPrompt(req: WheelMockupRequest, wheelDescription: string): string {
  const { vehicle, wheel, tire, lift } = req;
  
  // Determine stance
  let stance = "factory ride height";
  if (lift) {
    const liftLower = lift.toLowerCase();
    if (liftLower.includes("level")) {
      stance = "leveled stance with leveling kit";
    } else if (liftLower.includes("6")) {
      stance = "6-inch suspension lift, aggressive lifted stance";
    } else if (liftLower.includes("4")) {
      stance = "4-inch suspension lift, lifted stance";
    } else if (liftLower.includes("2") || liftLower.includes("3")) {
      stance = "2-3 inch lift, mild lift";
    } else if (liftLower.includes("lower")) {
      stance = "lowered stance, dropped suspension";
    }
  }
  
  // Tire description
  let tireDesc = "matching tires";
  if (tire?.size) {
    tireDesc = `${tire.size} tires`;
    if (tire.size.includes("12.50") || tire.size.includes("13.50")) {
      tireDesc += ", aggressive all-terrain look";
    }
  }
  
  const prompt = `Professional dealership photograph of a ${vehicle.color} ${vehicle.year} ${vehicle.make} ${vehicle.model}.

VEHICLE: ${vehicle.color} paint, ${stance}, clean and detailed.

WHEELS: ${wheel.size}-inch ${wheel.brand} ${wheel.model} aftermarket wheels. ${wheelDescription || "Custom aftermarket wheel design."}

TIRES: ${tireDesc}.

PHOTOGRAPHY: Front three-quarter angle, outdoor natural lighting, clean background, dealership/showroom quality. Sharp focus on wheels and vehicle details. Realistic proportions and shadows.

Single vehicle only. No text, watermarks, or logos. Photorealistic.`;

  return prompt;
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE MOCKUP
// ═══════════════════════════════════════════════════════════════════════════

export async function generateWheelMockup(req: WheelMockupRequest): Promise<WheelMockupResult> {
  const startTime = Date.now();
  
  console.log(`[wheelMockup] ═══════════════════════════════════════════════════`);
  console.log(`[wheelMockup] ${req.vehicle.color} ${req.vehicle.year} ${req.vehicle.make} ${req.vehicle.model}`);
  console.log(`[wheelMockup] Wheel: ${req.wheel.size}" ${req.wheel.brand} ${req.wheel.model}`);
  console.log(`[wheelMockup] Lift: ${req.lift || "stock"}, Tire: ${req.tire?.size || "stock"}`);
  
  try {
    // Check cache first
    const cacheKey = getCacheKey(req);
    const cached = await checkCache(cacheKey);
    if (cached) {
      console.log(`[wheelMockup] ✅ Cache hit`);
      return { success: true, imageUrl: cached, cached: true, generationTimeMs: Date.now() - startTime };
    }
    
    // Analyze wheel image with GPT-4o Vision
    console.log(`[wheelMockup] Analyzing wheel image...`);
    const wheelDescription = await analyzeWheelImage(
      req.wheel.imageUrl,
      `${req.wheel.brand} ${req.wheel.model}`
    );
    console.log(`[wheelMockup] Wheel: ${wheelDescription.substring(0, 80)}...`);
    
    // Build prompt
    const prompt = buildPrompt(req, wheelDescription);
    console.log(`[wheelMockup] Generating image...`);
    
    // Generate with OpenAI
    const openai = getOpenAI();
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: "1536x1024", // Landscape for vehicle
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
    
    // Save to Vercel Blob
    console.log(`[wheelMockup] Saving to CDN...`);
    const blob = await put(cacheKey, imageBuffer, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: false,
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`[wheelMockup] ✅ Done in ${elapsed}ms: ${blob.url}`);
    console.log(`[wheelMockup] ═══════════════════════════════════════════════════`);
    
    return {
      success: true,
      imageUrl: blob.url,
      cached: false,
      generationTimeMs: elapsed,
    };
    
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[wheelMockup] ❌ Failed after ${elapsed}ms:`, error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Generation failed",
      cached: false,
      generationTimeMs: elapsed,
    };
  }
}
