/**
 * SD WebUI API Client for Wheel Visualizer
 * 
 * This client connects to a Stable Diffusion WebUI instance to generate
 * wheel visualization images. Currently uses RunPod-hosted instance,
 * can be swapped to RunPod Serverless for production.
 * 
 * @module visualizer/sdwebui-client
 */

export interface GenerationRequest {
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string;
  };
  color: string;
  wheel: {
    sku: string;
    name: string;
    lora?: string;      // Legacy: LoRA key for LEGACY_LORA_MAP lookup
    loraName?: string;  // New: Direct LoRA filename (e.g., "asanti_black_ab039_mogul_5_wheel")
    triggerWord?: string; // Trigger word for prompt (e.g., "asantiblackab039mogul5_wheel")
  };
}

export interface GenerationResponse {
  success: boolean;
  imageBase64?: string;
  error?: string;
  cached?: boolean;
  generationTime?: number;
}

interface SDWebUITxt2ImgRequest {
  prompt: string;
  negative_prompt: string;
  width: number;
  height: number;
  steps: number;
  cfg_scale: number;
  sampler_name: string;
  seed: number;
}

interface SDWebUITxt2ImgResponse {
  images: string[];  // Base64 encoded images
  parameters: Record<string, unknown>;
  info: string;
}

/**
 * Dynamic LoRA resolution
 * 
 * Wheels should pass loraName and triggerWord directly from the catalog.
 * These are generated during batch training and stored in wheel-styles-for-training.json
 * 
 * Format:
 * - loraName: "asanti_black_ab039_mogul_5_wheel" (filename without .safetensors)
 * - triggerWord: "asantiblackab039mogul5_wheel" (used in prompts)
 */

// Legacy mapping for backwards compatibility with test wheels
const LEGACY_LORA_MAP: Record<string, { lora: string; trigger: string }> = {
  'fuel_flame': { lora: 'fuel_flame_wheel', trigger: 'fuelflame_wheel' },
  'fuel_puma': { lora: 'fuel_puma_wheel', trigger: 'fuelpuma_wheel' },
  'fuel_reaction': { lora: 'fuel_reaction_wheel', trigger: 'fuelreaction_wheel' },
};

/**
 * Resolve LoRA info from wheel data
 * Priority:
 * 1. Direct loraName/triggerWord from wheel object
 * 2. Legacy lora key lookup
 * 3. Generate from wheel name (fallback)
 */
function resolveLoraInfo(wheel: GenerationRequest['wheel']): { lora: string; trigger: string } | null {
  // 1. Direct values passed from catalog (preferred)
  if (wheel.loraName && wheel.triggerWord) {
    return { lora: wheel.loraName, trigger: wheel.triggerWord };
  }
  
  // 2. Legacy key lookup
  if (wheel.lora && LEGACY_LORA_MAP[wheel.lora]) {
    return LEGACY_LORA_MAP[wheel.lora];
  }
  
  // 3. No LoRA available
  return null;
}

// Color normalization
const COLOR_MAP: Record<string, string> = {
  'white': 'white',
  'black': 'black',
  'red': 'red',
  'blue': 'blue',
  'silver': 'silver metallic',
  'gray': 'gray metallic',
  'grey': 'gray metallic',
  'green': 'green',
  'yellow': 'yellow',
  'orange': 'orange',
  'brown': 'brown',
  'gold': 'gold metallic',
  'bronze': 'bronze metallic',
};

export class SDWebUIClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl?: string, timeout = 30000) {
    this.baseUrl = baseUrl || process.env.SDWEBUI_URL || 'http://localhost:7860';
    this.timeout = timeout;
  }

  /**
   * Build the prompt for wheel visualization
   */
  buildPrompt(request: GenerationRequest): { prompt: string; negativePrompt: string; hasLora: boolean } {
    const { vehicle, color, wheel } = request;
    
    // Get LoRA info (may be null if wheel doesn't have a trained LoRA)
    const loraInfo = resolveLoraInfo(wheel);

    // Normalize color
    const normalizedColor = COLOR_MAP[color.toLowerCase()] || color;

    // Build prompt parts
    const promptParts: string[] = [];
    
    // Add LoRA tag first (weight varies by training type)
    // Legacy wheels (trained on vehicle images) use 1.0
    // Batch-trained wheels (trained on standalone wheel images) use 0.6
    const isBatchTrained = !wheel.lora && wheel.loraName;
    if (loraInfo) {
      const loraWeight = isBatchTrained ? 0.6 : 1.0;
      promptParts.push(`<lora:${loraInfo.lora}:${loraWeight}>`);
    }
    
    // VEHICLE FIRST - this is what we want to generate
    // Add era hints for older vehicles (SD doesn't know specific year designs)
    const year = vehicle.year;
    let eraHint = '';
    if (year < 1980) {
      eraHint = 'classic vintage 1970s car, retro';
    } else if (year < 1990) {
      eraHint = '1980s car, boxy styling, retro 80s';
    } else if (year < 2000) {
      eraHint = '1990s car, 90s styling, rounded boxy';
    } else if (year < 2010) {
      eraHint = '2000s car, early 2000s styling';
    }
    // 2010+ uses modern styling which SD handles well
    
    promptParts.push(`${normalizedColor} ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
    if (vehicle.trim) {
      promptParts.push(vehicle.trim);
    }
    if (eraHint) {
      promptParts.push(eraHint);
    }
    
    // Style modifiers that emphasize "car with wheels"
    promptParts.push(
      'front three quarter view',
      'white studio background',
      'solo',
      '1car',
      'product photography',
      'professional automotive photography'
    );
    
    // Wheel reference AFTER vehicle description
    if (loraInfo) {
      // For batch-trained, use wheel name instead of trigger word in main description
      // The trigger word is still picked up by the LoRA
      if (isBatchTrained) {
        promptParts.push(`aftermarket wheels`);
        promptParts.push(loraInfo.trigger);  // Trigger at end for LoRA to pick up
      } else {
        promptParts.push(`with ${loraInfo.trigger} aftermarket wheels`);
      }
    } else {
      promptParts.push(`with ${wheel.name} aftermarket wheels`);
    }
    
    promptParts.push('8k', 'highly detailed wheels');

    const prompt = promptParts.filter(Boolean).join(', ');

    const negativePrompt = [
      'multiple cars',
      'two cars', 
      'multiple vehicles',
      'collage',
      'split image',
      'diptych',
      'side by side',
      'duplicate',
      'clone',
      'blurry',
      'distorted',
      'low quality',
      'watermark',
      'text',
    ].join(', ');

    return { prompt, negativePrompt, hasLora: !!loraInfo };
  }

  /**
   * Generate a wheel visualization image
   */
  async generate(request: GenerationRequest): Promise<GenerationResponse> {
    const startTime = Date.now();
    
    try {
      const { prompt, negativePrompt, hasLora } = this.buildPrompt(request);

      const payload: SDWebUITxt2ImgRequest = {
        prompt,
        negative_prompt: negativePrompt,
        width: 512,  // Native SD 1.5 resolution - no duplicates
        height: 512,
        steps: 20,
        cfg_scale: 12,  // Higher CFG for stronger prompt adherence
        sampler_name: 'DPM++ 2M',
        seed: -1,  // Random seed
      };

      console.log(`[visualizer] Generating image ${hasLora ? 'with LoRA' : 'WITHOUT LoRA'}: ${prompt.substring(0, 100)}...`);

      const response = await fetch(`${this.baseUrl}/sdapi/v1/txt2img`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SD WebUI API error: ${response.status} - ${errorText}`);
      }

      const result: SDWebUITxt2ImgResponse = await response.json();

      if (!result.images || result.images.length === 0) {
        throw new Error('No images returned from SD WebUI');
      }

      const generationTime = Date.now() - startTime;
      console.log(`[visualizer] Generated image in ${generationTime}ms`);

      return {
        success: true,
        imageBase64: result.images[0],
        generationTime,
      };

    } catch (error) {
      console.error('[visualizer] Generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        generationTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if the SD WebUI service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/sdapi/v1/sd-models`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get list of available LoRAs
   */
  async getAvailableLoras(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/sdapi/v1/loras`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return [];
      const loras = await response.json();
      return loras.map((l: { name: string }) => l.name);
    } catch {
      return [];
    }
  }
}

// Singleton instance
let clientInstance: SDWebUIClient | null = null;

export function getSDWebUIClient(): SDWebUIClient {
  if (!clientInstance) {
    clientInstance = new SDWebUIClient();
  }
  return clientInstance;
}
