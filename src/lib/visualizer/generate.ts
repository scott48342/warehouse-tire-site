/**
 * Vehicle Image Generation & Analysis
 * 
 * Uses OpenAI DALL-E 3 for generation and GPT-4 Vision for wheel detection
 */

import OpenAI from "openai";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import {
  buildGenerationPrompt,
  buildSlug,
  buildDisplayName,
  DEFAULT_POSITIONS,
  type VehicleCategory,
} from "./prompts";
import type { WheelPosition } from "./schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateVehicleParams {
  year: number;
  make: string;
  model: string;
  category: VehicleCategory;
}

interface GenerateVehicleResult {
  slug: string;
  vehicle: string;
  imagePath: string;
  prompt: string;
  frontWheel: WheelPosition;
  rearWheel: WheelPosition;
  analysisNotes?: string;
}

/**
 * Generate a vehicle image and analyze wheel positions
 */
export async function generateVehicleAsset(
  params: GenerateVehicleParams
): Promise<GenerateVehicleResult> {
  const { year, make, model, category } = params;
  const slug = buildSlug(year, make, model);
  const vehicle = buildDisplayName(year, make, model);
  const prompt = buildGenerationPrompt(params);

  console.log(`[Generate] Starting generation for ${vehicle}`);
  console.log(`[Generate] Prompt: ${prompt.substring(0, 100)}...`);

  // 1. Generate image with DALL-E 3
  const imageUrl = await generateImage(prompt);
  console.log(`[Generate] Image generated, downloading...`);

  // 2. Download and save image
  const imagePath = await saveGeneratedImage(imageUrl, slug);
  console.log(`[Generate] Image saved to ${imagePath}`);

  // 3. Analyze image for wheel positions
  const analysis = await analyzeWheelPositions(imageUrl, category);
  console.log(`[Generate] Analysis complete:`, analysis);

  return {
    slug,
    vehicle,
    imagePath,
    prompt,
    frontWheel: analysis.frontWheel,
    rearWheel: analysis.rearWheel,
    analysisNotes: analysis.notes,
  };
}

/**
 * Generate image using DALL-E 3
 */
async function generateImage(prompt: string): Promise<string> {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1792x1024", // Wide format for side profile
    quality: "hd",
    response_format: "url",
  });

  const url = response.data[0]?.url;
  if (!url) {
    throw new Error("No image URL returned from DALL-E");
  }

  return url;
}

/**
 * Download and save generated image to public folder
 */
async function saveGeneratedImage(
  imageUrl: string,
  slug: string
): Promise<string> {
  // Ensure directory exists
  const dir = path.join(process.cwd(), "public", "visualizer", "vehicles", "generated");
  await mkdir(dir, { recursive: true });

  // Download image
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // Save with timestamp to allow versioning
  const timestamp = Date.now();
  const filename = `${slug}-v${timestamp}.png`;
  const filepath = path.join(dir, filename);

  await writeFile(filepath, buffer);

  // Return the public URL path
  return `/visualizer/vehicles/generated/${filename}`;
}

/**
 * Analyze image to detect wheel well positions using GPT-4 Vision
 */
async function analyzeWheelPositions(
  imageUrl: string,
  category: VehicleCategory
): Promise<{ frontWheel: WheelPosition; rearWheel: WheelPosition; notes?: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a computer vision expert analyzing vehicle images for a wheel visualizer tool.
          
Your task: Identify the EXACT center positions of the front and rear wheel wells in this side-profile vehicle image.

Output positions as percentages:
- "top": vertical position from top (0% = top edge, 100% = bottom edge)
- "left": horizontal position from left (0% = left edge, 100% = right edge)
- "size": estimated wheel diameter in pixels (typically 80-120 for standard images)

The vehicle is shown in side profile. The FRONT wheel well is on the RIGHT side of the image. The REAR wheel well is on the LEFT side.

Be precise. The wheel overlay will be centered exactly at the coordinates you provide.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this ${category} vehicle image and provide the wheel well positions.

Return ONLY a JSON object in this exact format, no other text:
{
  "frontWheel": { "top": <number>, "left": <number>, "size": <number> },
  "rearWheel": { "top": <number>, "left": <number>, "size": <number> },
  "notes": "<any observations about the image quality or positioning>"
}`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || "";
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[Analyze] Could not parse vision response, using defaults");
      return {
        ...DEFAULT_POSITIONS[category],
        front: DEFAULT_POSITIONS[category].front,
        rear: DEFAULT_POSITIONS[category].rear,
        frontWheel: DEFAULT_POSITIONS[category].front,
        rearWheel: DEFAULT_POSITIONS[category].rear,
        notes: "Vision analysis failed, using category defaults",
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      frontWheel: {
        top: Math.round(parsed.frontWheel?.top ?? DEFAULT_POSITIONS[category].front.top),
        left: Math.round(parsed.frontWheel?.left ?? DEFAULT_POSITIONS[category].front.left),
        size: Math.round(parsed.frontWheel?.size ?? DEFAULT_POSITIONS[category].front.size),
      },
      rearWheel: {
        top: Math.round(parsed.rearWheel?.top ?? DEFAULT_POSITIONS[category].rear.top),
        left: Math.round(parsed.rearWheel?.left ?? DEFAULT_POSITIONS[category].rear.left),
        size: Math.round(parsed.rearWheel?.size ?? DEFAULT_POSITIONS[category].rear.size),
      },
      notes: parsed.notes || undefined,
    };
  } catch (error) {
    console.error("[Analyze] Vision analysis error:", error);
    
    // Fallback to category defaults
    return {
      frontWheel: DEFAULT_POSITIONS[category].front,
      rearWheel: DEFAULT_POSITIONS[category].rear,
      notes: `Vision analysis failed: ${error instanceof Error ? error.message : "Unknown error"}. Using category defaults.`,
    };
  }
}

/**
 * Regenerate just the image for an existing config
 */
export async function regenerateVehicleImage(
  year: number,
  make: string,
  model: string,
  category: VehicleCategory,
  existingSlug: string
): Promise<{ imagePath: string; prompt: string }> {
  const prompt = buildGenerationPrompt({ year, make, model, category });
  
  const imageUrl = await generateImage(prompt);
  const imagePath = await saveGeneratedImage(imageUrl, existingSlug);
  
  return { imagePath, prompt };
}
