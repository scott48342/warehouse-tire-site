/**
 * Jake Visual Mockup Generator (Phase 3 Enhanced)
 * 
 * Generates visual inspiration mockups showing wheel/tire setups on vehicles.
 * Uses gpt-image-1 (GPT-4o image generation) as the primary generator.
 * 
 * Phase 3 Enhancements:
 * - Product image lookup by part number
 * - GPT-4o Vision analysis of actual product images
 * - Vehicle color as hard requirement
 * - Enhanced analytics tracking
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
  parseWheelStyle,
  type WheelProduct,
  type TireProduct,
} from "./productVisuals";
import { analyzeProducts, type ProductAnalysisResult } from "./productImageAnalysis";

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
    // Phase 3: Part numbers for image lookup
    wheelPartNumber?: string;
    tirePartNumber?: string;
    // Phase 4: Direct wheel image URL (customer-provided, takes precedence)
    wheelImageUrl?: string;
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
  // Phase 2/3: Confidence tracking
  confidence?: "high" | "medium" | "concept";
  // Phase 3: Enhanced product metadata for analytics
  productMeta?: {
    wheelBrand?: string;
    wheelModel?: string;
    wheelSku?: string;
    wheelImageFound?: boolean;
    tireBrand?: string;
    tireModel?: string;
    tireSku?: string;
    tireImageFound?: boolean;
    vehicleColor?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DISCLAIMER = "Here's an AI visual mockup. Final fitment and appearance may vary based on size, offset, tire, trim, and suspension.";

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

// Phase 3: Vehicle color enforcement
const COLOR_REQUIREMENTS: Record<string, string> = {
  "black": "IMPORTANT: Vehicle paint color MUST be pure black. Do not use dark gray or charcoal. The vehicle is BLACK.",
  "white": "IMPORTANT: Vehicle paint color MUST be pure white. Do not use cream or off-white. The vehicle is WHITE.",
  "red": "IMPORTANT: Vehicle paint color MUST be red. Do not substitute with maroon or burgundy. The vehicle is RED.",
  "blue": "IMPORTANT: Vehicle paint color MUST be blue. Match the specified shade. The vehicle is BLUE.",
  "silver": "IMPORTANT: Vehicle paint color MUST be silver/metallic silver. The vehicle is SILVER.",
  "gray": "IMPORTANT: Vehicle paint color MUST be gray/charcoal. The vehicle is GRAY.",
  "grey": "IMPORTANT: Vehicle paint color MUST be gray/charcoal. The vehicle is GRAY.",
  "green": "IMPORTANT: Vehicle paint color MUST be green. The vehicle is GREEN.",
  "orange": "IMPORTANT: Vehicle paint color MUST be orange. The vehicle is ORANGE.",
  "yellow": "IMPORTANT: Vehicle paint color MUST be yellow. The vehicle is YELLOW.",
  "brown": "IMPORTANT: Vehicle paint color MUST be brown. The vehicle is BROWN.",
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
    // Phase 3: Include part numbers in cache key if provided
    request.build.wheelPartNumber ? crypto.createHash("md5").update(request.build.wheelPartNumber).digest("hex").substring(0, 4) : "x",
    request.build.tirePartNumber ? crypto.createHash("md5").update(request.build.tirePartNumber).digest("hex").substring(0, 4) : "x",
    // Phase 4: Include wheel image URL hash if provided (customer-provided images)
    request.build.wheelImageUrl ? crypto.createHash("md5").update(request.build.wheelImageUrl).digest("hex").substring(0, 6) : "x",
  ].join("-");
  
  // v5: Phase 4 - customer-provided wheel image support
  return `mockups/v5/${keyParts}.png`;
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
// PHASE 4: FALLBACK SKU LOOKUP (when Jake forgets to pass part numbers)
// ═══════════════════════════════════════════════════════════════════════════

const getBaseUrl = () => {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_BASE_URL || "https://shop.warehousetiredirect.com";
};

/**
 * Try to find a wheel SKU by searching for brand + model
 * This is a fallback for when Jake doesn't pass wheelPartNumber
 */
async function lookupWheelSkuByName(brand: string, model: string, diameter: number): Promise<string | null> {
  if (!brand || !model) return null;
  
  try {
    const query = `${brand} ${model}`.trim();
    const url = `${getBaseUrl()}/api/search?q=${encodeURIComponent(query)}&type=wheels&limit=5`;
    
    console.log(`[mockup] Fallback SKU lookup: "${query}"`);
    
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.log(`[mockup] SKU lookup failed: ${res.status}`);
      return null;
    }
    
    const data = await res.json();
    const wheels = data.results || [];
    
    // Find a matching wheel with the right diameter
    for (const wheel of wheels) {
      const wheelDiam = parseFloat(wheel.properties?.diameter || wheel.diameter || "0");
      if (Math.abs(wheelDiam - diameter) < 1) {
        console.log(`[mockup] Found fallback SKU: ${wheel.sku}`);
        return wheel.sku;
      }
    }
    
    // If no exact diameter match, return first result
    if (wheels.length > 0) {
      console.log(`[mockup] Using first result SKU: ${wheels[0].sku}`);
      return wheels[0].sku;
    }
    
    console.log(`[mockup] No fallback SKU found for "${query}"`);
    return null;
  } catch (error) {
    console.error(`[mockup] SKU lookup error:`, error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3: ENHANCED PROMPT BUILDER WITH IMAGE ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

interface PromptBuildResult {
  prompt: string;
  confidence: "high" | "medium" | "concept";
  wheelMeta: WheelProduct;
  tireMeta: TireProduct;
  wheelImageFound: boolean;
  tireImageFound: boolean;
  effectiveWheelSku?: string;  // SKU used (may be from fallback lookup)
}

async function buildEnhancedPrompt(request: MockupRequest): Promise<PromptBuildResult> {
  const { vehicle, build, product } = request;
  
  // Parse wheel style into structured data
  const parsedWheel = parseWheelStyle(build.wheelStyle);
  const wheelProduct: WheelProduct = product?.wheel || {
    ...parsedWheel,
    size: `${build.wheelSize}x9`, // Assume common width
    sku: build.wheelPartNumber,
  };
  
  // Build tire product info
  const tireProduct: TireProduct = product?.tire || {
    brand: build.tireBrand || "Premium",
    model: build.tireModel || build.tireStyle.replace("-", " "),
    terrain: build.tireStyle,
    size: build.tireSize,
    sku: build.tirePartNumber,
  };
  
  // Phase 4: Determine wheel image source (priority: direct URL > part number > fallback lookup)
  let effectiveWheelPartNumber = build.wheelPartNumber;
  let directWheelImageUrl = build.wheelImageUrl;
  
  if (directWheelImageUrl) {
    console.log(`[mockup] ✅ Using customer-provided wheel image URL`);
  } else if (!effectiveWheelPartNumber && wheelProduct.brand && wheelProduct.model) {
    console.log(`[mockup] ⚠️ No wheelPartNumber provided - attempting fallback lookup`);
    effectiveWheelPartNumber = await lookupWheelSkuByName(
      wheelProduct.brand, 
      wheelProduct.model, 
      build.wheelSize
    ) || undefined;
    
    if (effectiveWheelPartNumber) {
      console.log(`[mockup] ✅ Fallback found SKU: ${effectiveWheelPartNumber}`);
    } else {
      console.log(`[mockup] ❌ Fallback lookup failed - will use description-only generation`);
    }
  }
  
  // Phase 3/4: Analyze actual product images
  let wheelDescription: string;
  let tireDescription: string;
  let wheelImageFound = false;
  let tireImageFound = false;
  let analysisConfidence: "high" | "medium" | "concept" = "concept";
  
  // Phase 4: If we have a direct wheel image URL, analyze it directly
  if (directWheelImageUrl) {
    console.log(`[mockup] Phase 4: Analyzing customer-provided wheel image...`);
    const { analyzeWheelImage } = await import("./productImageAnalysis");
    
    try {
      const wheelAnalysis = await analyzeWheelImage(directWheelImageUrl, build.wheelStyle);
      if (wheelAnalysis.analyzed && wheelAnalysis.description) {
        wheelDescription = wheelAnalysis.description;
        wheelImageFound = true;
        analysisConfidence = "high";
        console.log(`[mockup] ✅ Customer wheel image analyzed successfully`);
      } else {
        const fallback = buildWheelVisualDescription(wheelProduct);
        wheelDescription = fallback.prompt;
      }
    } catch (error) {
      console.error(`[mockup] Failed to analyze customer wheel image:`, error);
      const fallback = buildWheelVisualDescription(wheelProduct);
      wheelDescription = fallback.prompt;
    }
    
    // Still check tire part number
    if (build.tirePartNumber) {
      const { analyzeProducts } = await import("./productImageAnalysis");
      const tireAnalysis = await analyzeProducts(
        undefined,
        build.tirePartNumber,
        "",
        `${tireProduct.brand} ${tireProduct.model}`
      );
      if (tireAnalysis.tire?.analyzed && tireAnalysis.tire.description) {
        tireDescription = tireAnalysis.tire.description;
        tireImageFound = true;
      } else {
        const fallback = buildTireVisualDescription(tireProduct);
        tireDescription = fallback.prompt;
      }
    } else {
      const fallback = buildTireVisualDescription(tireProduct);
      tireDescription = fallback.prompt;
    }
  } else if (effectiveWheelPartNumber || build.tirePartNumber) {
    // Phase 3: Use part numbers for image lookup
    console.log(`[mockup] Phase 3: Analyzing product images...`);
    const analysis = await analyzeProducts(
      effectiveWheelPartNumber,  // Use effective (may be from fallback lookup)
      build.tirePartNumber,
      `${wheelProduct.brand} ${wheelProduct.model}`,
      `${tireProduct.brand} ${tireProduct.model}`
    );
    
    wheelImageFound = analysis.wheelImageFound;
    tireImageFound = analysis.tireImageFound;
    analysisConfidence = analysis.overallConfidence;
    
    // Use vision-analyzed descriptions if available
    if (analysis.wheel?.analyzed && analysis.wheel.description) {
      wheelDescription = analysis.wheel.description;
      console.log(`[mockup] Using vision-analyzed wheel description`);
    } else {
      const fallback = buildWheelVisualDescription(wheelProduct);
      wheelDescription = fallback.prompt;
    }
    
    if (analysis.tire?.analyzed && analysis.tire.description) {
      tireDescription = analysis.tire.description;
      console.log(`[mockup] Using vision-analyzed tire description`);
    } else {
      const fallback = buildTireVisualDescription(tireProduct);
      tireDescription = fallback.prompt;
    }
  } else {
    // Fall back to Phase 2 descriptions
    const wheelDesc = buildWheelVisualDescription(wheelProduct);
    const tireDesc = buildTireVisualDescription(tireProduct);
    wheelDescription = wheelDesc.prompt;
    tireDescription = tireDesc.prompt;
    analysisConfidence = wheelDesc.confidence === "high" || tireDesc.confidence === "high" ? "medium" : "concept";
  }
  
  console.log(`[mockup] Wheel description: ${wheelDescription.substring(0, 80)}...`);
  console.log(`[mockup] Tire description: ${tireDescription.substring(0, 80)}...`);
  console.log(`[mockup] Confidence level: ${analysisConfidence}`);
  
  // Build vehicle context
  const modelLower = vehicle.model.toLowerCase();
  const isFullSizeTruck = /silverado|sierra|f-?150|f-?250|f-?350|ram|tundra|titan/i.test(modelLower);
  const isMidSizeTruck = /colorado|canyon|tacoma|ranger|gladiator|frontier/i.test(modelLower);
  const isJeep = /wrangler|gladiator|cherokee/i.test(modelLower);
  const isSUV = /tahoe|suburban|yukon|expedition|4runner|durango|escalade/i.test(modelLower);
  const isMuscle = /mustang|camaro|challenger|charger|corvette/i.test(modelLower);
  
  let vehicleContext = "";
  if (isFullSizeTruck) vehicleContext = "full-size American pickup truck, crew cab body style";
  else if (isMidSizeTruck) vehicleContext = "mid-size pickup truck";
  else if (isJeep) vehicleContext = "off-road capable SUV, rugged body styling";
  else if (isSUV) vehicleContext = "full-size SUV, premium appearance";
  else if (isMuscle) vehicleContext = "American muscle car, aggressive body lines";
  
  const buildContext = BUILD_STYLE_PROMPTS[build.style] || BUILD_STYLE_PROMPTS.stock;
  
  // Phase 3: Vehicle color enforcement
  const colorLower = vehicle.color.toLowerCase();
  const colorRequirement = COLOR_REQUIREMENTS[colorLower] || 
    `IMPORTANT: Vehicle paint color MUST be ${vehicle.color}. Do not change or substitute the color.`;
  
  // Phase 3: New prompt structure prioritizing wheel/tire accuracy with color enforcement
  const promptParts = [
    // Photography instruction first
    "Create a photorealistic professional automotive photograph of a",
    
    // Vehicle with color enforcement
    `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    vehicle.trim ? `${vehicle.trim} trim` : null,
    vehicleContext ? vehicleContext : null,
    
    // COLOR REQUIREMENT (Phase 3 - hard requirement)
    colorRequirement,
    
    // Suspension/stance
    buildContext,
    
    // WHEEL REFERENCE (Phase 3 - from vision analysis or detailed description)
    `WHEEL REFERENCE: ${wheelProduct.brand} ${wheelProduct.model} ${build.wheelSize}-inch aftermarket wheel. ${wheelDescription}`,
    wheelImageFound ? "Use the wheel design exactly as described above - match the spoke pattern, finish, and lip style precisely." : null,
    
    // TIRE REFERENCE (Phase 3 - from vision analysis or detailed description)
    `TIRE REFERENCE: ${tireProduct.brand} ${tireProduct.model}. ${tireDescription}`,
    tireImageFound ? "Use the tire design exactly as described above - match the tread pattern, sidewall, and shoulder design precisely." : null,
    build.tireSize ? `Tire size: ${build.tireSize}` : null,
    
    // Photography requirements
    "PHOTOGRAPHY REQUIREMENTS:",
    "Front three-quarter view angle showing wheel and tire detail clearly",
    "Natural outdoor lighting with realistic shadows",
    "Clean outdoor background, subtle gradient",
    "Dealership-quality professional photography",
    "Highly detailed wheel spokes and tire tread pattern",
    "Realistic proportions and fitment",
    
    // Critical priorities
    "CRITICAL PRIORITIES (in order):",
    "1. Vehicle color must match exactly as specified",
    "2. Wheel design must match the reference description",
    "3. Tire appearance must match the reference description",
    "4. Realistic ride height and stance",
    
    // Negatives
    "Do NOT include: text overlays, watermarks, logos, multiple vehicles, unrealistic elements",
  ];
  
  return {
    prompt: promptParts.filter(Boolean).join(". ") + ".",
    confidence: analysisConfidence,
    wheelMeta: wheelProduct,
    tireMeta: tireProduct,
    wheelImageFound,
    tireImageFound,
    effectiveWheelSku: effectiveWheelPartNumber,  // May be from fallback lookup
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE GENERATION (gpt-image-1)
// ═══════════════════════════════════════════════════════════════════════════

async function generateImage(prompt: string): Promise<Buffer> {
  const openai = getOpenAI();
  
  console.log(`[mockup] Generating with ${IMAGE_MODEL}`);
  console.log(`[mockup] Prompt length: ${prompt.length} chars`);
  console.log(`[mockup] Prompt preview: ${prompt.substring(0, 250)}...`);
  
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
  console.log(`[mockup] Starting mockup generation (Phase 4 - Customer Image Support)`);
  console.log(`[mockup] Session: ${sessionId}`);
  console.log(`[mockup] Vehicle: ${request.vehicle.color} ${request.vehicle.year} ${request.vehicle.make} ${request.vehicle.model}`);
  console.log(`[mockup] Build: ${request.build.wheelSize}" ${request.build.wheelStyle}`);
  console.log(`[mockup] Style: ${request.build.style}, Tires: ${request.build.tireStyle}`);
  if (request.build.wheelImageUrl) {
    console.log(`[mockup] 🖼️ Using CUSTOMER-PROVIDED wheel image URL`);
  } else if (request.build.wheelPartNumber) {
    console.log(`[mockup] Wheel PN: ${request.build.wheelPartNumber}`);
  }
  if (request.build.tirePartNumber) {
    console.log(`[mockup] Tire PN: ${request.build.tirePartNumber}`);
  }
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
    
    // Phase 3: Build enhanced prompt with image analysis
    const { prompt, confidence, wheelMeta, tireMeta, wheelImageFound, tireImageFound, effectiveWheelSku } = 
      await buildEnhancedPrompt(request);
    
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
    console.log(`[mockup] Wheel image found: ${wheelImageFound}, Tire image found: ${tireImageFound}`);
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
        wheelSku: effectiveWheelSku || request.build.wheelPartNumber,  // Use fallback SKU if found
        wheelImageFound,
        tireBrand: tireMeta.brand,
        tireModel: tireMeta.model,
        tireSku: request.build.tirePartNumber,
        tireImageFound,
        vehicleColor: request.vehicle.color,
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
// SAVE TO GALLERY (Phase 3: Include enhanced metadata)
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
    
    const title = `${vehicle.color} ${vehicle.year} ${vehicle.make} ${vehicle.model} with ${wheelMeta.brand} ${wheelMeta.model}`;
    
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
      tags: ["jake-generated", build.tireStyle, vehicle.make.toLowerCase(), buildStyle, vehicle.color.toLowerCase()],
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
