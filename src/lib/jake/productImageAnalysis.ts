/**
 * Product Image Analysis for Mockup Generation (Phase 3)
 * 
 * Uses GPT-4o Vision to analyze actual product images and generate
 * detailed visual descriptions for more accurate mockup generation.
 * 
 * @created 2026-06-15
 */

import OpenAI from "openai";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ProductImageAnalysis {
  description: string;
  imageUrl: string;
  analyzed: boolean;
  confidence: "high" | "medium" | "concept";
}

export interface WheelImageAnalysis extends ProductImageAnalysis {
  spokePattern?: string;
  finishDescription?: string;
  lipStyle?: string;
  overallStyle?: string;
}

export interface TireImageAnalysis extends ProductImageAnalysis {
  treadPattern?: string;
  sidewallStyle?: string;
  shoulderDesign?: string;
  overallAppearance?: string;
}

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
// PRODUCT IMAGE LOOKUP
// ═══════════════════════════════════════════════════════════════════════════

const getBaseUrl = () => {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_BASE_URL || "https://shop.warehousetiredirect.com";
};

/**
 * Look up wheel product image by part number
 */
export async function lookupWheelImage(partNumber: string): Promise<string | null> {
  try {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/search?q=${encodeURIComponent(partNumber)}&type=wheels&limit=1`;
    
    console.log(`[ProductImage] Looking up wheel: ${partNumber}`);
    
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.log(`[ProductImage] Wheel lookup failed: ${res.status}`);
      return null;
    }
    
    const data = await res.json();
    const wheel = data.results?.[0] || data.wheels?.[0];
    
    if (wheel?.imageUrl || wheel?.images?.[0]?.imageUrlLarge) {
      const imageUrl = wheel.imageUrl || wheel.images?.[0]?.imageUrlLarge;
      console.log(`[ProductImage] Found wheel image: ${imageUrl.substring(0, 60)}...`);
      return imageUrl;
    }
    
    console.log(`[ProductImage] No wheel image found for ${partNumber}`);
    return null;
  } catch (error) {
    console.error(`[ProductImage] Wheel lookup error:`, error);
    return null;
  }
}

/**
 * Look up tire product image by part number
 */
export async function lookupTireImage(partNumber: string): Promise<string | null> {
  try {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/search?q=${encodeURIComponent(partNumber)}&type=tires&limit=1`;
    
    console.log(`[ProductImage] Looking up tire: ${partNumber}`);
    
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.log(`[ProductImage] Tire lookup failed: ${res.status}`);
      return null;
    }
    
    const data = await res.json();
    const tire = data.results?.[0] || data.tires?.[0];
    
    if (tire?.imageUrl) {
      console.log(`[ProductImage] Found tire image: ${tire.imageUrl.substring(0, 60)}...`);
      return tire.imageUrl;
    }
    
    console.log(`[ProductImage] No tire image found for ${partNumber}`);
    return null;
  } catch (error) {
    console.error(`[ProductImage] Tire lookup error:`, error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GPT-4O VISION ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze a wheel image using GPT-4o Vision
 */
export async function analyzeWheelImage(
  imageUrl: string,
  brandModel: string
): Promise<WheelImageAnalysis> {
  const openai = getOpenAI();
  
  console.log(`[ProductImage] Analyzing wheel image with GPT-4o Vision`);
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are analyzing a wheel/rim product image for use in AI image generation.

Describe this ${brandModel} wheel in VISUAL terms that would help an AI accurately recreate its appearance on a vehicle. Focus on:

1. SPOKE PATTERN: Number of spokes, spoke shape (thin/thick/split/twisted), spoke angles, any unique geometric patterns
2. FINISH: Color, gloss level, any two-tone effects, machined areas, milled accents
3. LIP STYLE: Deep dish vs flat, lip width, any painted/machined lip details
4. OVERALL STYLE: Aggressive/elegant/classic/modern, off-road vs luxury aesthetic

Respond in a single paragraph of 2-3 sentences that could be used directly in an image generation prompt. Be specific and visual.`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    });
    
    const description = response.choices[0]?.message?.content || "";
    console.log(`[ProductImage] Wheel analysis: ${description.substring(0, 100)}...`);
    
    return {
      description,
      imageUrl,
      analyzed: true,
      confidence: "high",
    };
  } catch (error) {
    console.error(`[ProductImage] Wheel analysis error:`, error);
    return {
      description: "",
      imageUrl,
      analyzed: false,
      confidence: "concept",
    };
  }
}

/**
 * Analyze a tire image using GPT-4o Vision
 */
export async function analyzeTireImage(
  imageUrl: string,
  brandModel: string
): Promise<TireImageAnalysis> {
  const openai = getOpenAI();
  
  console.log(`[ProductImage] Analyzing tire image with GPT-4o Vision`);
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are analyzing a tire product image for use in AI image generation.

Describe this ${brandModel} tire in VISUAL terms that would help an AI accurately recreate its appearance on a vehicle. Focus on:

1. TREAD PATTERN: Block shapes, groove patterns, aggressive vs smooth, any unique features
2. SIDEWALL: Text/branding style, raised lettering, serrated edges, protective ribs
3. SHOULDER: Lug design, wraparound tread, bite edges
4. OVERALL APPEARANCE: Rugged/refined, all-terrain vs highway, aggressive vs quiet look

Respond in a single paragraph of 2-3 sentences that could be used directly in an image generation prompt. Be specific and visual.`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    });
    
    const description = response.choices[0]?.message?.content || "";
    console.log(`[ProductImage] Tire analysis: ${description.substring(0, 100)}...`);
    
    return {
      description,
      imageUrl,
      analyzed: true,
      confidence: "high",
    };
  } catch (error) {
    console.error(`[ProductImage] Tire analysis error:`, error);
    return {
      description: "",
      imageUrl,
      analyzed: false,
      confidence: "concept",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMBINED ANALYSIS FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export interface ProductAnalysisResult {
  wheel: WheelImageAnalysis | null;
  tire: TireImageAnalysis | null;
  wheelImageFound: boolean;
  tireImageFound: boolean;
  overallConfidence: "high" | "medium" | "concept";
}

/**
 * Analyze both wheel and tire products
 */
export async function analyzeProducts(
  wheelPartNumber: string | undefined,
  tirePartNumber: string | undefined,
  wheelBrandModel: string,
  tireBrandModel: string
): Promise<ProductAnalysisResult> {
  let wheel: WheelImageAnalysis | null = null;
  let tire: TireImageAnalysis | null = null;
  let wheelImageFound = false;
  let tireImageFound = false;
  
  // Look up and analyze wheel
  if (wheelPartNumber) {
    const wheelImageUrl = await lookupWheelImage(wheelPartNumber);
    if (wheelImageUrl) {
      wheelImageFound = true;
      wheel = await analyzeWheelImage(wheelImageUrl, wheelBrandModel);
    }
  }
  
  // Look up and analyze tire
  if (tirePartNumber) {
    const tireImageUrl = await lookupTireImage(tirePartNumber);
    if (tireImageUrl) {
      tireImageFound = true;
      tire = await analyzeTireImage(tireImageUrl, tireBrandModel);
    }
  }
  
  // Determine overall confidence
  let overallConfidence: "high" | "medium" | "concept" = "concept";
  if (wheelImageFound && tireImageFound && wheel?.analyzed && tire?.analyzed) {
    overallConfidence = "high";
  } else if (wheelImageFound || tireImageFound) {
    overallConfidence = "medium";
  }
  
  return {
    wheel,
    tire,
    wheelImageFound,
    tireImageFound,
    overallConfidence,
  };
}

export default {
  lookupWheelImage,
  lookupTireImage,
  analyzeWheelImage,
  analyzeTireImage,
  analyzeProducts,
};
