/**
 * Jake Visual Mockup Generator (Phase 2 Enhanced)
 * 
 * Generates visual inspiration mockups showing wheel/tire setups on vehicles.
 * Uses gpt-image-1 (GPT-4o image generation) as the primary generator.
 * 
 * Phase 2 Enhancements:
 * - Rich product descriptions for better visual accuracy
 * - Product image references when available
 * - Confidence level tracking
 * - Product metadata storage
 * 
 * IMPORTANT: These are for VISUAL INSPIRATION ONLY, not fitment verification.
 * Always include disclaimer with generated images.
 * 
 * @updated 2026-06-15
 */

import OpenAI from "openai";
import { put, list } from "@vercel/blob";
import * as crypto from "crypto";
import { db } from "@/lib/fitment-db/db";
import { galleryBuilds, generateBuildSlug } from "@/lib/fitment-db/schema-gallery";
import {
  buildWheelVisualDescription,
  buildTireVisualDescription,
  getMockupConfidence,
  parseWheelStyle,
  type WheelProduct,
  type TireProduct,
} from "./productVisuals";

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
    tireBrand?: string; // "Nitto" (optional for better accuracy)
    tireModel?: string; // "Terra Grappler G2" (optional for better accuracy)
  };
  // Phase 2: Product metadata for better accuracy
  product?: {
    wheel?: WheelProduct;
    tire?: TireProduct;
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
  // Phase 2: Confidence tracking
  confidence?: "high" | "medium" | "concept";
  // Phase 2: Product metadata for analytics
  productMeta?: {
    wheelBrand?: string;
    wheelModel?: string;
    wheelSku?: string;
    tireBrand?: string;
    tireModel?: string;
    tireSku?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DISCLAIMER = "Mockup is for visual inspiration only. Actual product appearance may vary. Fitment will be verified before checkout.";

// Use gpt-image-1 which is available on the account
const IMAGE_MODEL = "gpt-image-1";
const IMAGE_SIZE = "1024x1024"; // gpt-image-1 supports: 1024x1024, 1024x1536, 1536x1024

const BUILD_STYLE_PROMPTS: Record<string, string> = {
  "stock": "factory suspension height, standard ride height stance",
  "leveled": "leveling kit installed, aggressive stance with rake removed, front and rear level",
  "lifted-2": "2-inch suspension lift, slightly raised aggressive stance",
  "lifted-4": "4-inch suspension lift, elevated aggressive stance, room for larger tires",
  "lifted-6": "6-inch suspension lift kit, towering aggressive stance, significant ground clearance",
  "lowered": "lowered suspension, aggressive low stance, tucked wheel fitment",
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
    // Phase 2: Include tire brand/model in cache key if provided
    request.build.tireBrand ? crypto.createHash("md5").update(request.build.tireBrand.toLowerCase()).digest("hex").substring(0, 4) : "x",
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
// PHASE 2: ENHANCED PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════

interface PromptBuildResult {
  prompt: string;
  confidence: "high" | "medium" | "concept";
  wheelMeta: WheelProduct;
  tireMeta: TireProduct;
}

function buildEnhancedPrompt(request: MockupRequest): PromptBuildResult {
  const { vehicle, build, product } = request;
  
  // Parse wheel style into structured data
  const parsedWheel = parseWheelStyle(build.wheelStyle);
  const wheelProduct: WheelProduct = product?.wheel || {
    ...parsedWheel,
    size: `${build.wheelSize}x9`, // Assume common width
  };
  
  // Build tire product info
  const tireProduct: TireProduct = product?.tire || {
    brand: build.tireBrand || "Premium",
    model: build.tireModel || build.tireStyle.replace("-", " "),
    terrain: build.tireStyle,
    size: build.tireSize,
  };
  
  // Get rich visual descriptions
  const wheelDesc = buildWheelVisualDescription(wheelProduct);
  const tireDesc = buildTireVisualDescription(tireProduct);
  const confidence = getMockupConfidence(wheelDesc, tireDesc);
  
  console.log(`[mockup] Wheel description: ${wheelDesc.prompt.substring(0, 80)}...`);
  console.log(`[mockup] Tire description: ${tireDesc.prompt.substring(0, 80)}...`);
  console.log(`[mockup] Confidence level: ${confidence}`);
  
  // Build vehicle context
  const modelLower = vehicle.model.toLowerCase();
  const isFullSizeTruck = /silverado|sierra|f-?150|f-?250|f-?350|ram|tundra|titan/i.test(modelLower);
  const isMidSizeTruck = /colorado|canyon|tacoma|ranger|gladiator|frontier/i.test(modelLower);
  const isJeep = /wrangler|gladiator|cherokee/i.test(modelLower);
  const isSUV = /tahoe|suburban|yukon|expedition|4runner|durango|escalade/i.test(modelLower);
  const isMuscle = /mustang|camaro|challenger|charger|corvette/i.test(modelLower);
  
  let vehicleContext = "";
  if (isFullSizeTruck) vehicleContext = "full-size American pickup truck, crew cab";
  else if (isMidSizeTruck) vehicleContext = "mid-size pickup truck";
  else if (isJeep) vehicleContext = "off-road capable SUV, rugged body styling";
  else if (isSUV) vehicleContext = "full-size SUV, premium appearance";
  else if (isMuscle) vehicleContext = "American muscle car, aggressive body lines";
  
  const buildContext = BUILD_STYLE_PROMPTS[build.style] || BUILD_STYLE_PROMPTS.stock;
  
  // Phase 2: New prompt structure prioritizing wheel/tire accuracy
  const promptParts = [
    // Photography instruction first
    "Professional automotive photography of a",
    
    // Vehicle
    `${vehicle.color} ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    vehicle.trim ? `${vehicle.trim} trim` : null,
    vehicleContext ? vehicleContext : null,
    
    // Suspension/stance
    buildContext,
    
    // MOST IMPORTANT: Wheel description (detailed)
    `WHEELS: ${wheelDesc.prompt}`,
    
    // MOST IMPORTANT: Tire description (detailed)
    `TIRES: ${tireDesc.prompt}`,
    
    // Photography requirements
    "front three-quarter view angle showing wheel and tire detail",
    "natural outdoor lighting with subtle shadows",
    "clean outdoor background, subtle gradient",
    "photorealistic rendering",
    "showroom quality detail",
    "highly detailed wheel spokes and tire tread pattern",
    
    // Negatives
    "no text overlays",
    "no watermarks",
    "no logos on image",
    "single vehicle only",
  ];
  
  return {
    prompt: promptParts.filter(Boolean).join(". ") + ".",
    confidence,
    wheelMeta: wheelProduct,
    tireMeta: tireProduct,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE GENERATION (gpt-image-1)
// ═══════════════════════════════════════════════════════════════════════════

async function generateImage(prompt: string): Promise<Buffer> {
  const openai = getOpenAI();
  
  console.log(`[mockup] Generating with ${IMAGE_MODEL}`);
  console.log(`[mockup] Prompt length: ${prompt.length} chars`);
  console.log(`[mockup] Prompt preview: ${prompt.substring(0, 200)}...`);
  
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
  console.log(`[mockup] Starting mockup generation (Phase 2 Enhanced)`);
  console.log(`[mockup] Session: ${sessionId}`);
  console.log(`[mockup] Vehicle: ${request.vehicle.year} ${request.vehicle.make} ${request.vehicle.model}`);
  console.log(`[mockup] Build: ${request.build.wheelSize}" ${request.build.wheelStyle}`);
  console.log(`[mockup] Style: ${request.build.style}, Tires: ${request.build.tireStyle}`);
  if (request.build.tireBrand) {
    console.log(`[mockup] Tire brand/model: ${request.build.tireBrand} ${request.build.tireModel || ""}`);
  }
  
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
        confidence: "concept",
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
        confidence: "medium", // Cache doesn't know original confidence
      };
    }
    
    console.log(`[mockup] Cache miss, generating new image...`);
    
    // Phase 2: Build enhanced prompt with rich descriptions
    const { prompt, confidence, wheelMeta, tireMeta } = buildEnhancedPrompt(request);
    
    // Generate image
    const imageBuffer = await generateImage(prompt);
    console.log(`[mockup] Image generated, size: ${imageBuffer.length} bytes`);
    
    // Save to blob cache
    const imageUrl = await saveToBlobCache(imageBuffer, cacheKey);
    
    // Save to gallery (non-blocking)
    saveToGallery(request, imageUrl, wheelMeta, tireMeta).catch(err => {
      console.error("[mockup] Gallery save error (non-blocking):", err);
    });
    
    const totalTime = Date.now() - startTime;
    console.log(`[mockup] ✅ Complete in ${totalTime}ms`);
    console.log(`[mockup] Image URL: ${imageUrl}`);
    console.log(`[mockup] Confidence: ${confidence}`);
    console.log(`[mockup] ═══════════════════════════════════════════════════════`);
    
    return {
      success: true,
      imageUrl,
      disclaimer: DISCLAIMER,
      generationMethod: "gpt-image",
      cached: false,
      generationTime: totalTime,
      confidence,
      productMeta: {
        wheelBrand: wheelMeta.brand,
        wheelModel: wheelMeta.model,
        wheelSku: wheelMeta.sku,
        tireBrand: tireMeta.brand,
        tireModel: tireMeta.model,
        tireSku: tireMeta.sku,
      },
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
      confidence: "concept",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE TO GALLERY (Phase 2: Include product metadata)
// ═══════════════════════════════════════════════════════════════════════════

async function saveToGallery(
  request: MockupRequest, 
  imageUrl: string,
  wheelMeta: WheelProduct,
  tireMeta: TireProduct
): Promise<void> {
  try {
    const { vehicle, build } = request;
    
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
    
    const title = `${vehicle.year} ${vehicle.make} ${vehicle.model} with ${wheelMeta.brand} ${wheelMeta.model}`;
    
    const slugBase = generateBuildSlug({
      vehicleYear: vehicle.year,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      wheelBrand: wheelMeta.brand,
      wheelModel: wheelMeta.model,
      tireBrand: tireMeta.brand,
      tireModel: tireMeta.model,
    });
    
    const slug = `${slugBase}-jake-${Date.now().toString(36)}`;
    
    await db.insert(galleryBuilds).values({
      slug,
      title,
      description: `AI-generated mockup created by Jake showing ${build.wheelSize}" ${wheelMeta.brand} ${wheelMeta.model} wheels with ${tireMeta.brand} ${tireMeta.model} tires on a ${vehicle.color} ${vehicle.year} ${vehicle.make} ${vehicle.model}.`,
      vehicleYear: vehicle.year,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      vehicleTrim: vehicle.trim,
      buildStyle,
      liftLevel: liftLevelMap[build.style] || "stock",
      wheelBrand: wheelMeta.brand,
      wheelModel: wheelMeta.model,
      wheelSize: `${build.wheelSize}`,
      wheelFinish: wheelMeta.finish,
      tireBrand: tireMeta.brand,
      tireModel: tireMeta.model,
      tireSize: build.tireSize || tireMeta.size || `${build.wheelSize}"`,
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
