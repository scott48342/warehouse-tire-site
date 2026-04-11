/**
 * Wheel Visualizer - Generate Endpoint (SD WebUI + LoRA)
 * 
 * POST /api/wheel-viz/generate
 * 
 * Generates a visualization of a specific wheel on a vehicle using
 * Stable Diffusion with trained wheel LoRAs. Separate from the admin
 * DALL-E visualizer at /api/admin/visualizer/.
 * 
 * Request body:
 * {
 *   vehicle: { year, make, model, trim? },
 *   color: string,
 *   wheel: { sku, name, lora?, triggerWord? }
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   imageUrl?: string,  // Base64 data URL
 *   error?: string,
 *   cached?: boolean,
 *   generationTime?: number
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { SDWebUIClient, GenerationRequest } from '@/lib/visualizer/sdwebui-client';
import { Redis } from '@upstash/redis';

// Initialize Redis for caching (optional - graceful fallback if not configured)
let redis: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch (e) {
  console.warn('[wheel-viz] Redis not configured, caching disabled');
}

// Cache TTL: 30 days
const CACHE_TTL = 60 * 60 * 24 * 30;

function generateCacheKey(request: GenerationRequest): string {
  const { vehicle, color, wheel } = request;
  return `wheel-viz:${vehicle.make}:${vehicle.model}:${vehicle.year}:${color}:${wheel.sku}`.toLowerCase().replace(/\s+/g, '-');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate request
    const { vehicle, color, wheel } = body as GenerationRequest;
    
    if (!vehicle?.year || !vehicle?.make || !vehicle?.model) {
      return NextResponse.json(
        { success: false, error: 'Missing vehicle information (year, make, model required)' },
        { status: 400 }
      );
    }

    if (!color) {
      return NextResponse.json(
        { success: false, error: 'Missing color' },
        { status: 400 }
      );
    }

    if (!wheel?.sku || !wheel?.name) {
      return NextResponse.json(
        { success: false, error: 'Missing wheel information (sku, name required)' },
        { status: 400 }
      );
    }

    const request: GenerationRequest = { vehicle, color, wheel };
    const cacheKey = generateCacheKey(request);

    // Check cache first
    if (redis) {
      try {
        const cached = await redis.get<string>(cacheKey);
        if (cached) {
          console.log(`[wheel-viz] Cache hit for ${cacheKey}`);
          return NextResponse.json({
            success: true,
            imageUrl: cached,
            cached: true,
            generationTime: 0,
          });
        }
      } catch (e) {
        console.warn('[wheel-viz] Cache read failed:', e);
      }
    }

    // Generate image
    const sdwebuiUrl = process.env.SDWEBUI_URL;
    if (!sdwebuiUrl) {
      return NextResponse.json(
        { success: false, error: 'SD WebUI not configured (SDWEBUI_URL missing)' },
        { status: 503 }
      );
    }

    const client = new SDWebUIClient(sdwebuiUrl);
    const result = await client.generate(request);

    if (!result.success || !result.imageBase64) {
      return NextResponse.json(
        { success: false, error: result.error || 'Generation failed' },
        { status: 500 }
      );
    }

    // Create data URL
    const imageUrl = `data:image/png;base64,${result.imageBase64}`;

    // Cache the result
    if (redis) {
      try {
        await redis.set(cacheKey, imageUrl, { ex: CACHE_TTL });
        console.log(`[wheel-viz] Cached result for ${cacheKey}`);
      } catch (e) {
        console.warn('[wheel-viz] Cache write failed:', e);
      }
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      cached: false,
      generationTime: result.generationTime,
    });

  } catch (error) {
    console.error('[wheel-viz] Request failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  const sdwebuiUrl = process.env.SDWEBUI_URL;
  
  if (!sdwebuiUrl) {
    return NextResponse.json({
      status: 'unconfigured',
      message: 'SDWEBUI_URL not set',
    });
  }

  const client = new SDWebUIClient(sdwebuiUrl);
  const healthy = await client.healthCheck();
  const loras = healthy ? await client.getAvailableLoras() : [];

  return NextResponse.json({
    status: healthy ? 'healthy' : 'unhealthy',
    sdwebuiUrl: sdwebuiUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'), // Hide credentials if any
    availableLoras: loras,
  });
}
