/**
 * AI Wheel Normalization API
 * 
 * Converts angled/3-quarter view wheel images to front-facing visualizer-ready assets.
 * Uses AI image generation to regenerate the wheel while preserving design language.
 * 
 * Supported backends (configured via env vars):
 * - REPLICATE_API_TOKEN: Use Replicate API
 * - OPENAI_API_KEY: Use OpenAI DALL-E (image editing)
 * - RUNPOD_API_KEY: Use RunPod Serverless
 * 
 * NO REGRESSION: This is an isolated admin/lab API. Does not affect production.
 */

import { NextRequest, NextResponse } from "next/server";

interface NormalizeRequest {
  sourceImage: string;  // Base64 data URL
  prompt?: string;
  sku?: string;
  name?: string;
  outputSize?: number;
}

// Check which AI backend is configured
function getConfiguredBackend(): "replicate" | "openai" | "runpod" | "mock" | null {
  if (process.env.REPLICATE_API_TOKEN) return "replicate";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.RUNPOD_API_KEY) return "runpod";
  // For development/testing, use mock mode
  if (process.env.NODE_ENV === "development" || process.env.AI_NORMALIZE_MOCK === "true") return "mock";
  return null;
}

// Generate using Replicate (SDXL or similar)
async function generateWithReplicate(
  sourceImage: string,
  prompt: string,
  outputSize: number
): Promise<{ imageUrl: string; model: string }> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN not configured");
  
  // Use SDXL img2img model
  const model = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b";
  
  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: model.split(":")[1],
      input: {
        image: sourceImage,
        prompt: prompt,
        negative_prompt: "blurry, low quality, distorted, angled, perspective, 3/4 view, tire, rubber, mounted",
        num_inference_steps: 30,
        guidance_scale: 7.5,
        strength: 0.75,  // How much to transform (0.75 = significant change while preserving structure)
        width: outputSize,
        height: outputSize,
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Replicate API error: ${error.detail || response.status}`);
  }
  
  const prediction = await response.json();
  
  // Poll for completion
  let result = prediction;
  while (result.status !== "succeeded" && result.status !== "failed") {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const pollResponse = await fetch(result.urls.get, {
      headers: { "Authorization": `Token ${token}` },
    });
    result = await pollResponse.json();
  }
  
  if (result.status === "failed") {
    throw new Error(`Replicate generation failed: ${result.error || "Unknown error"}`);
  }
  
  return {
    imageUrl: Array.isArray(result.output) ? result.output[0] : result.output,
    model: "replicate/sdxl",
  };
}

// Generate using OpenAI DALL-E
async function generateWithOpenAI(
  sourceImage: string,
  prompt: string,
  outputSize: number
): Promise<{ imageUrl: string; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  
  // DALL-E 3 doesn't support img2img, so we use the prompt only
  // For true img2img, would need to use DALL-E 2 edit endpoint
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: `${prompt}. Create a photorealistic front-facing automotive wheel render, perfectly centered, transparent background, studio product photography, high detail.`,
      n: 1,
      size: outputSize >= 1024 ? "1024x1024" : "512x512",
      response_format: "url",
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${error.error?.message || response.status}`);
  }
  
  const result = await response.json();
  
  return {
    imageUrl: result.data[0].url,
    model: "openai/dall-e-3",
  };
}

// Generate using RunPod Serverless
async function generateWithRunPod(
  sourceImage: string,
  prompt: string,
  outputSize: number
): Promise<{ imageUrl: string; model: string }> {
  const apiKey = process.env.RUNPOD_API_KEY;
  const endpointId = process.env.RUNPOD_ENDPOINT_ID;
  
  if (!apiKey) throw new Error("RUNPOD_API_KEY not configured");
  if (!endpointId) throw new Error("RUNPOD_ENDPOINT_ID not configured");
  
  const response = await fetch(`https://api.runpod.ai/v2/${endpointId}/runsync`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt: prompt,
        negative_prompt: "blurry, low quality, distorted, angled, perspective, tire, rubber",
        init_image: sourceImage,
        strength: 0.7,
        width: outputSize,
        height: outputSize,
        num_inference_steps: 30,
        guidance_scale: 7.5,
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`RunPod API error: ${error.error || response.status}`);
  }
  
  const result = await response.json();
  
  if (result.status === "FAILED") {
    throw new Error(`RunPod generation failed: ${result.error || "Unknown error"}`);
  }
  
  return {
    imageUrl: result.output?.image || result.output?.[0],
    model: "runpod/custom",
  };
}

// Mock generation for development/testing
async function generateMock(
  sourceImage: string,
  prompt: string,
  outputSize: number
): Promise<{ imageUrl: string; model: string }> {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Return the source image as-is (for testing the workflow)
  // In production, this would be replaced with actual AI output
  return {
    imageUrl: sourceImage,
    model: "mock/passthrough",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: NormalizeRequest = await request.json();
    
    // Validate input
    if (!body.sourceImage) {
      return NextResponse.json({ error: "sourceImage is required" }, { status: 400 });
    }
    
    // Check configured backend
    const backend = getConfiguredBackend();
    if (!backend) {
      return NextResponse.json(
        { 
          error: "No AI backend configured. Set REPLICATE_API_TOKEN, OPENAI_API_KEY, or RUNPOD_API_KEY.",
          hint: "For development, set AI_NORMALIZE_MOCK=true to use mock mode."
        },
        { status: 503 }
      );
    }
    
    // Build prompt
    const wheelName = body.name || body.sku || "alloy wheel";
    const defaultPrompt = `Front-facing automotive wheel, studio product photography, perfectly centered on pure white background, professional lighting, clean isolated wheel face view, high detail, no tire, no perspective distortion, ${wheelName}`;
    const prompt = body.prompt || defaultPrompt;
    const outputSize = body.outputSize || 512;
    
    console.log(`[ai-normalize] Using backend: ${backend}, wheel: ${wheelName}`);
    
    // Generate based on backend
    let result: { imageUrl: string; model: string };
    
    switch (backend) {
      case "replicate":
        result = await generateWithReplicate(body.sourceImage, prompt, outputSize);
        break;
      case "openai":
        result = await generateWithOpenAI(body.sourceImage, prompt, outputSize);
        break;
      case "runpod":
        result = await generateWithRunPod(body.sourceImage, prompt, outputSize);
        break;
      case "mock":
        result = await generateMock(body.sourceImage, prompt, outputSize);
        break;
      default:
        throw new Error(`Unknown backend: ${backend}`);
    }
    
    console.log(`[ai-normalize] Generation complete: ${result.model}`);
    
    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      model: result.model,
      prompt: prompt,
      sku: body.sku,
      name: body.name,
    });
    
  } catch (error) {
    console.error("[ai-normalize] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI normalization failed" },
      { status: 500 }
    );
  }
}

// GET endpoint for checking configuration status
export async function GET() {
  const backend = getConfiguredBackend();
  
  return NextResponse.json({
    configured: !!backend,
    backend: backend || "none",
    availableBackends: {
      replicate: !!process.env.REPLICATE_API_TOKEN,
      openai: !!process.env.OPENAI_API_KEY,
      runpod: !!process.env.RUNPOD_API_KEY,
      mock: process.env.NODE_ENV === "development" || process.env.AI_NORMALIZE_MOCK === "true",
    },
    hint: backend 
      ? `Using ${backend} for AI wheel normalization`
      : "Configure REPLICATE_API_TOKEN, OPENAI_API_KEY, or RUNPOD_API_KEY to enable AI normalization",
  });
}
