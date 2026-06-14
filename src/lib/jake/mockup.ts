/**
 * Jake Visual Mockup Generator
 * 
 * Generates visual inspiration mockups showing wheel/tire setups on vehicles.
 * Uses gpt-image-1 (GPT-4o image generation) as the primary generator.
 * 
 * IMPORTANT: These are for VISUAL INSPIRATION ONLY, not fitment verification.
 * Always include disclaimer with generated images.
 */

import OpenAI from "openai";
import { put, list } from "@vercel/blob";
import crypto from "crypto";
import { db } from "@/lib/fitment-db/db";
import { galleryBuilds, generateBuildSlug } from "@/lib/fitment-db/schema-gallery";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface MockupRequest {
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string;
    color: string;
  };
  build: {
    style: "stock" | "leveled" | "lifted-2" | "lifted-4" | "lifted-6" | "lowered";
    wheelStyle: string; // "Fuel Rebel D679 Matte Black"
    wheelSize: number;  // 20
    tireStyle: "all-terrain" | "mud-terrain" | "highway" | "performance" | "all-season";
    tireSize?: string;  // "35x12.50R20" (optional context)
  };
  sessionId?: string; // For analytics tracking
}

export interface MockupResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  errorCode?: string;
  disclaimer: string;
  generationMethod: "gpt-image" | "cached";
  cached: boolean;
  generationTime?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DISCLAIMER = "Mockup is for visual inspiration only. Actual product appearance may vary. Fitment will be verified before checkout.";

// Use gpt-image-1 which is available on the account
const IMAGE_MODEL = "gpt-image-1";
const IMAGE_SIZE = "1024x1024"; // gpt-image-1 supports: 1024x1024, 1024x1536, 1536x1024

const BUILD_STYLE_PROMPTS: Record<string, string> = {
  "stock": "factory height, standard ride height",
  "leveled": "with a leveling kit, aggressive stance with rake removed",
  "lifted-2": "with a 2-inch lift, slightly raised stance",
  "lifted-4": "with a 4-inch lift, elevated aggressive stance",
  "lifted-6": "with a 6-inch lift kit, towering aggressive stance",
  "lowered": "lowered suspension, aggressive low stance, tucked fitment",
};

const TIRE_STYLE_PROMPTS: Record<string, string> = {
  "all-terrain": "rugged all-terrain tires with aggressive sidewall text",
  "mud-terrain": "aggressive mud-terrain tires with deep lugs and chunky tread",
  "highway": "highway touring tires with smooth tread pattern",
  "performance": "low-profile performance tires, sticky rubber, minimal sidewall",
  "all-season": "all-season touring tires with balanced tread",
};

// Error codes for analytics
const ERROR_CODES = {
  NO_API_KEY: "MOCKUP_NO_API_KEY",
  API_ERROR: "MOCKUP_API_ERROR",
  RATE_LIMIT: "MOCKUP_RATE_LIMIT",
  INVALID_REQUEST: "MOCKUP_INVALID_REQUEST",
  NO_IMAGE_DATA: "MOCKUP_NO_IMAGE_DATA",
  CACHE_ERROR: "MOCKUP_CACHE_ERROR",
  BLOB_ERROR: "MOCKUP_BLOB_ERROR",
  UNKNOWN: "MOCKUP_UNKNOWN_ERROR",
};

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
// CACHE KEY GENERATION
// ═══════════════════════════════════════════════════════════════════════════

function generateCacheKey(request: MockupRequest): string {
  const keyParts = [
    request.vehicle.year,
    request.vehicle.make.toLowerCase().replace(/\s+/g, "-"),
    request.vehicle.model.toLowerCase().replace(/\s+/g, "-"),
    request.vehicle.trim?.toLowerCase().replace(/\s+/g, "-") || "base",
    request.vehicle.color.toLowerCase().replace(/\s+/g, "-"),
    request.build.style,
    request.build.wheelSize,
    request.build.tireStyle,
    // Hash the wheel style to keep key manageable
    crypto.createHash("md5").update(request.build.wheelStyle.toLowerCase()).digest("hex").substring(0, 8),
  ].join("-");
  
  return `mockups/${keyParts}.png`;
}

// ═══════════════════════════════════════════════════════════════════════════
// CACHE CHECK
// ═══════════════════════════════════════════════════════════════════════════

async function checkCache(cacheKey: string): Promise<string | null> {
  try {
    // Check if blob exists
    const { blobs } = await list({ prefix: cacheKey.replace(".png", ""), limit: 1 });
    
    if (blobs.length > 0) {
      // Check age (7 day TTL)
      const blob = blobs[0];
      const ageMs = Date.now() - new Date(blob.uploadedAt).getTime();
      const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (ageMs < maxAgeMs) {
        console.log(`[mockup] Cache valid, age: ${Math.round(ageMs / 1000 / 60)}min`);
        return blob.url;
      }
      console.log(`[mockup] Cache expired, age: ${Math.round(ageMs / 1000 / 60 / 60)}h`);
    }
    
    return null;
  } catch (error) {
    console.error("[mockup] Cache check failed:", error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════

function buildPrompt(request: MockupRequest): string {
  const { vehicle, build } = request;
  
  const buildContext = BUILD_STYLE_PROMPTS[build.style] || BUILD_STYLE_PROMPTS.stock;
  const tireContext = TIRE_STYLE_PROMPTS[build.tireStyle] || TIRE_STYLE_PROMPTS["all-terrain"];
  
  // Detect vehicle category for context
  const modelLower = vehicle.model.toLowerCase();
  const isFullSizeTruck = /silverado|sierra|f-?150|f-?250|f-?350|ram|tundra|titan/i.test(modelLower);
  const isMidSizeTruck = /colorado|canyon|tacoma|ranger|gladiator|frontier/i.test(modelLower);
  const isJeep = /wrangler|gladiator|cherokee/i.test(modelLower);
  const isSUV = /tahoe|suburban|yukon|expedition|4runner|durango|escalade/i.test(modelLower);
  const isMuscle = /mustang|camaro|challenger|charger|corvette/i.test(modelLower);
  
  let vehicleContext = "";
  if (isFullSizeTruck) vehicleContext = "full-size American pickup truck";
  else if (isMidSizeTruck) vehicleContext = "mid-size pickup truck";
  else if (isJeep) vehicleContext = "off-road capable SUV";
  else if (isSUV) vehicleContext = "full-size SUV";
  else if (isMuscle) vehicleContext = "American muscle car";
  
  const promptParts = [
    // Vehicle first
    `A ${vehicle.color} ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    vehicle.trim ? vehicle.trim : null,
    vehicleContext ? `(${vehicleContext})` : null,
    
    // Build context
    buildContext,
    
    // Wheels
    `equipped with ${build.wheelSize}-inch ${build.wheelStyle} aftermarket wheels`,
    
    // Tires
    `mounted with ${tireContext}`,
    build.tireSize ? `in size ${build.tireSize}` : null,
    
    // Photography style
    "Professional automotive photography",
    "front three-quarter view angle",
    "studio lighting with soft shadows",
    "clean white to gray gradient background",
    "highly detailed",
    "high quality",
    "no watermarks",
    "no text overlays",
    "single vehicle only",
    "showroom quality",
  ];
  
  return promptParts.filter(Boolean).join(". ") + ".";
}

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE GENERATION (gpt-image-1)
// ═══════════════════════════════════════════════════════════════════════════

async function generateImage(prompt: string): Promise<Buffer> {
  const openai = getOpenAI();
  
  console.log(`[mockup] Generating with ${IMAGE_MODEL}`);
  console.log(`[mockup] Prompt: ${prompt.substring(0, 100)}...`);
  
  const startTime = Date.now();
  
  const response = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt,
    n: 1,
    size: IMAGE_SIZE,
  });
  
  const elapsed = Date.now() - startTime;
  console.log(`[mockup] OpenAI responded in ${elapsed}ms`);
  
  // gpt-image-1 returns b64_json by default
  const imageData = response.data?.[0];
  
  if (!imageData) {
    throw new Error("No image data in response");
  }
  
  // Handle both URL and base64 responses
  if (imageData.b64_json) {
    console.log(`[mockup] Received base64 image data`);
    return Buffer.from(imageData.b64_json, "base64");
  } else if (imageData.url) {
    console.log(`[mockup] Received image URL, downloading...`);
    const imgResponse = await fetch(imageData.url);
    if (!imgResponse.ok) {
      throw new Error(`Failed to download image: ${imgResponse.status}`);
    }
    return Buffer.from(await imgResponse.arrayBuffer());
  }
  
  throw new Error("No image URL or base64 data in response");
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE TO BLOB CACHE
// ═══════════════════════════════════════════════════════════════════════════

async function saveToBlobCache(imageBuffer: Buffer, cacheKey: string): Promise<string> {
  console.log(`[mockup] Uploading to blob: ${cacheKey}`);
  
  const blob = await put(cacheKey, imageBuffer, {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: false,
  });
  
  console.log(`[mockup] Blob uploaded: ${blob.url}`);
  return blob.url;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN GENERATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export async function generateMockup(request: MockupRequest): Promise<MockupResult> {
  const startTime = Date.now();
  const sessionId = request.sessionId || "unknown";
  
  console.log(`[mockup] ═══════════════════════════════════════════════════════`);
  console.log(`[mockup] Starting mockup generation`);
  console.log(`[mockup] Session: ${sessionId}`);
  console.log(`[mockup] Vehicle: ${request.vehicle.year} ${request.vehicle.make} ${request.vehicle.model}`);
  console.log(`[mockup] Build: ${request.build.wheelSize}" ${request.build.wheelStyle}`);
  console.log(`[mockup] Style: ${request.build.style}, Tires: ${request.build.tireStyle}`);
  
  try {
    // Check API key early
    if (!process.env.OPENAI_API_KEY) {
      console.error(`[mockup] OPENAI_API_KEY not configured`);
      return {
        success: false,
        error: "Image generation service not configured",
        errorCode: ERROR_CODES.NO_API_KEY,
        disclaimer: DISCLAIMER,
        generationMethod: "gpt-image",
        cached: false,
        generationTime: Date.now() - startTime,
      };
    }
    
    const cacheKey = generateCacheKey(request);
    console.log(`[mockup] Cache key: ${cacheKey}`);
    
    // Check cache first
    const cachedUrl = await checkCache(cacheKey);
    if (cachedUrl) {
      console.log(`[mockup] ✅ Cache hit!`);
      return {
        success: true,
        imageUrl: cachedUrl,
        disclaimer: DISCLAIMER,
        generationMethod: "cached",
        cached: true,
        generationTime: Date.now() - startTime,
      };
    }
    
    console.log(`[mockup] Cache miss, generating new image...`);
    
    // Build prompt
    const prompt = buildPrompt(request);
    
    // Generate image
    const imageBuffer = await generateImage(prompt);
    console.log(`[mockup] Image generated, size: ${imageBuffer.length} bytes`);
    
    // Save to blob cache
    const imageUrl = await saveToBlobCache(imageBuffer, cacheKey);
    
    // Save to gallery (non-blocking)
    saveToGallery(request, imageUrl).catch(err => {
      console.error("[mockup] Gallery save error (non-blocking):", err);
    });
    
    const totalTime = Date.now() - startTime;
    console.log(`[mockup] ✅ Complete in ${totalTime}ms`);
    console.log(`[mockup] Image URL: ${imageUrl}`);
    console.log(`[mockup] ═══════════════════════════════════════════════════════`);
    
    return {
      success: true,
      imageUrl,
      disclaimer: DISCLAIMER,
      generationMethod: "gpt-image",
      cached: false,
      generationTime: totalTime,
    };
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[mockup] ❌ Generation failed after ${totalTime}ms`);
    
    // Parse error for better reporting
    let errorMessage = "Unknown error";
    let errorCode = ERROR_CODES.UNKNOWN;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Detect specific error types
      if (error.message.includes("rate limit") || error.message.includes("429")) {
        errorCode = ERROR_CODES.RATE_LIMIT;
        errorMessage = "Image generation rate limit reached. Please try again in a moment.";
      } else if (error.message.includes("API key") || error.message.includes("401")) {
        errorCode = ERROR_CODES.NO_API_KEY;
        errorMessage = "Image generation service authentication failed.";
      } else if (error.message.includes("400") || error.message.includes("invalid")) {
        errorCode = ERROR_CODES.INVALID_REQUEST;
      } else if (error.message.includes("blob") || error.message.includes("storage")) {
        errorCode = ERROR_CODES.BLOB_ERROR;
        errorMessage = "Failed to save generated image.";
      }
      
      console.error(`[mockup] Error type: ${error.constructor.name}`);
      console.error(`[mockup] Error message: ${error.message}`);
      
      // Log additional OpenAI error details if available
      if ("status" in error) {
        console.error(`[mockup] HTTP status: ${(error as { status: number }).status}`);
      }
      if ("code" in error) {
        console.error(`[mockup] Error code: ${(error as { code: string }).code}`);
      }
    }
    
    console.error(`[mockup] Final error code: ${errorCode}`);
    console.log(`[mockup] ═══════════════════════════════════════════════════════`);
    
    return {
      success: false,
      error: errorMessage,
      errorCode,
      disclaimer: DISCLAIMER,
      generationMethod: "gpt-image",
      cached: false,
      generationTime: totalTime,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE TO GALLERY
// ═══════════════════════════════════════════════════════════════════════════

async function saveToGallery(request: MockupRequest, imageUrl: string): Promise<void> {
  try {
    const { vehicle, build } = request;
    
    // Parse wheel style into brand/model (best effort)
    const wheelParts = build.wheelStyle.split(" ");
    const wheelBrand = wheelParts[0] || "Custom";
    const wheelModel = wheelParts.slice(1, -2).join(" ") || wheelParts.slice(1).join(" ") || "Wheel";
    const wheelFinish = wheelParts.slice(-2).join(" ") || undefined;
    
    // Map build style to gallery lift level
    const liftLevelMap: Record<string, string> = {
      "stock": "stock",
      "leveled": "leveled",
      "lifted-2": "2-inch",
      "lifted-4": "4-inch", 
      "lifted-6": "6-inch",
      "lowered": "lowered",
    };
    
    // Map tire style to gallery build style
    const buildStyleMap: Record<string, string> = {
      "all-terrain": "off-road",
      "mud-terrain": "off-road",
      "highway": "daily-driver",
      "performance": "aggressive-street",
      "all-season": "daily-driver",
    };
    
    let buildStyle = buildStyleMap[build.tireStyle] || "daily-driver";
    if (build.style.startsWith("lifted")) {
      buildStyle = "lifted";
    } else if (build.style === "lowered") {
      buildStyle = "aggressive-street";
    }
    
    const title = `${vehicle.year} ${vehicle.make} ${vehicle.model} with ${wheelBrand} ${wheelModel}`;
    
    const slugBase = generateBuildSlug({
      vehicleYear: vehicle.year,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      wheelBrand,
      wheelModel,
      tireBrand: build.tireStyle,
      tireModel: build.tireSize || `${build.wheelSize}"`,
    });
    
    const slug = `${slugBase}-jake-${Date.now().toString(36)}`;
    
    await db.insert(galleryBuilds).values({
      slug,
      title,
      description: `AI-generated mockup created by Jake showing ${build.wheelSize}" ${build.wheelStyle} wheels with ${build.tireStyle} tires on a ${vehicle.color} ${vehicle.year} ${vehicle.make} ${vehicle.model}.`,
      vehicleYear: vehicle.year,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      vehicleTrim: vehicle.trim,
      buildStyle,
      liftLevel: liftLevelMap[build.style] || "stock",
      wheelBrand,
      wheelModel,
      wheelSize: `${build.wheelSize}`,
      wheelFinish,
      tireBrand: build.tireStyle.charAt(0).toUpperCase() + build.tireStyle.slice(1).replace("-", " "),
      tireModel: build.tireSize || `${build.tireStyle} tire`,
      tireSize: build.tireSize || `${build.wheelSize}"`,
      heroImageUrl: imageUrl,
      tags: ["jake-generated", build.tireStyle, vehicle.make.toLowerCase(), buildStyle],
      isFeatured: false,
      isPopular: false,
      isActive: true,
      sourceType: "jake",
      sourceAttribution: "Created by Jake AI",
    });
    
    console.log(`[mockup] Saved to gallery: ${slug}`);
    
  } catch (error) {
    console.error("[mockup] Failed to save to gallery:", error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { DISCLAIMER as MOCKUP_DISCLAIMER };
export { ERROR_CODES as MOCKUP_ERROR_CODES };
