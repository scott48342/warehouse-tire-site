/**
 * Jake Visual Mockup Generator
 * 
 * Generates visual inspiration mockups showing wheel/tire setups on vehicles.
 * Uses DALL-E 3 as primary generator, SD WebUI as optional enhanced quality.
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
}

export interface MockupResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  disclaimer: string;
  generationMethod: "dalle3" | "sdwebui" | "cached";
  cached: boolean;
  generationTime?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DISCLAIMER = "Mockup is for visual inspiration only. Actual product appearance may vary. Fitment will be verified before checkout.";

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
        return blob.url;
      }
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
    "8K quality",
    "no watermarks",
    "no text overlays",
    "single vehicle only",
    "showroom quality",
  ];
  
  return promptParts.filter(Boolean).join(". ") + ".";
}

// ═══════════════════════════════════════════════════════════════════════════
// DALL-E 3 GENERATION
// ═══════════════════════════════════════════════════════════════════════════

async function generateWithDalle(prompt: string): Promise<string> {
  const openai = getOpenAI();
  
  console.log(`[mockup] DALL-E prompt: ${prompt.substring(0, 150)}...`);
  
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1792x1024", // Wide format
    quality: "hd",
    // Note: URL is the default response format for DALL-E 3
  });
  
  const imageUrl = response.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error("No image URL returned from DALL-E");
  }
  
  return imageUrl;
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE TO CACHE
// ═══════════════════════════════════════════════════════════════════════════

async function saveToCache(imageUrl: string, cacheKey: string): Promise<string> {
  // Download image
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  
  const buffer = Buffer.from(await response.arrayBuffer());
  
  // Upload to Vercel Blob
  const blob = await put(cacheKey, buffer, {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: false,
  });
  
  return blob.url;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN GENERATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export async function generateMockup(request: MockupRequest): Promise<MockupResult> {
  const startTime = Date.now();
  
  try {
    const cacheKey = generateCacheKey(request);
    
    // Check cache first
    const cachedUrl = await checkCache(cacheKey);
    if (cachedUrl) {
      console.log(`[mockup] Cache hit: ${cacheKey}`);
      return {
        success: true,
        imageUrl: cachedUrl,
        disclaimer: DISCLAIMER,
        generationMethod: "cached",
        cached: true,
        generationTime: Date.now() - startTime,
      };
    }
    
    console.log(`[mockup] Cache miss, generating: ${cacheKey}`);
    
    // Build prompt
    const prompt = buildPrompt(request);
    
    // Generate with DALL-E 3
    const dalleUrl = await generateWithDalle(prompt);
    
    // Save to cache
    const cachedImageUrl = await saveToCache(dalleUrl, cacheKey);
    
    // Save to gallery (non-blocking)
    saveToGallery(request, cachedImageUrl).catch(err => {
      console.error("[mockup] Gallery save error (non-blocking):", err);
    });
    
    return {
      success: true,
      imageUrl: cachedImageUrl,
      disclaimer: DISCLAIMER,
      generationMethod: "dalle3",
      cached: false,
      generationTime: Date.now() - startTime,
    };
    
  } catch (error) {
    console.error("[mockup] Generation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      disclaimer: DISCLAIMER,
      generationMethod: "dalle3",
      cached: false,
      generationTime: Date.now() - startTime,
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
    // Input like "Fuel Rebel D679 Matte Black" → brand: "Fuel", model: "Rebel D679", finish: "Matte Black"
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
    
    // Determine build style based on lift + tire combo
    let buildStyle = buildStyleMap[build.tireStyle] || "daily-driver";
    if (build.style.startsWith("lifted")) {
      buildStyle = "lifted";
    } else if (build.style === "lowered") {
      buildStyle = "aggressive-street";
    }
    
    // Create title
    const title = `${vehicle.year} ${vehicle.make} ${vehicle.model} with ${wheelBrand} ${wheelModel}`;
    
    // Generate slug base
    const slugBase = generateBuildSlug({
      vehicleYear: vehicle.year,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      wheelBrand,
      wheelModel,
      tireBrand: build.tireStyle, // Use style as brand placeholder for Jake builds
      tireModel: build.tireSize || `${build.wheelSize}"`,
    });
    
    // Add random suffix to ensure uniqueness
    const slug = `${slugBase}-jake-${Date.now().toString(36)}`;
    
    // Insert into gallery
    await db.insert(galleryBuilds).values({
      slug,
      title,
      description: `AI-generated mockup created by Jake showing ${build.wheelSize}" ${build.wheelStyle} wheels with ${build.tireStyle} tires on a ${vehicle.color} ${vehicle.year} ${vehicle.make} ${vehicle.model}.`,
      
      // Vehicle
      vehicleYear: vehicle.year,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      vehicleTrim: vehicle.trim,
      
      // Build specs
      buildStyle,
      liftLevel: liftLevelMap[build.style] || "stock",
      
      // Wheel info (best effort from style string)
      wheelBrand,
      wheelModel,
      wheelSize: `${build.wheelSize}`,
      wheelFinish,
      
      // Tire info (limited for Jake-generated)
      tireBrand: build.tireStyle.charAt(0).toUpperCase() + build.tireStyle.slice(1).replace("-", " "),
      tireModel: build.tireSize || `${build.tireStyle} tire`,
      tireSize: build.tireSize || `${build.wheelSize}"`,
      
      // Image
      heroImageUrl: imageUrl,
      
      // Metadata
      tags: ["jake-generated", build.tireStyle, vehicle.make.toLowerCase(), buildStyle],
      isFeatured: false,
      isPopular: false,
      isActive: true,
      
      // Source attribution
      sourceType: "jake",
      sourceAttribution: "Created by Jake AI",
    });
    
    console.log(`[mockup] Saved to gallery: ${slug}`);
    
  } catch (error) {
    // Don't fail the mockup if gallery save fails
    console.error("[mockup] Failed to save to gallery:", error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT DISCLAIMER FOR USE ELSEWHERE
// ═══════════════════════════════════════════════════════════════════════════

export { DISCLAIMER as MOCKUP_DISCLAIMER };
