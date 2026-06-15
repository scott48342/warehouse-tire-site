/**
 * Jake Streaming Chat
 * 
 * Streams Jake's responses as Server-Sent Events for instant perceived response.
 * 
 * Event types:
 * - status: UI status update (e.g., "Checking vehicle specs...")
 * - text: Incremental text chunk
 * - products: Product data (sent at end)
 * - vehicle: Detected vehicle (sent at end)
 * - done: Stream complete
 * - error: Error occurred
 * 
 * @created 2026-06-14
 */

import Anthropic from "@anthropic-ai/sdk";
import { JAKE_SYSTEM_PROMPT } from "./systemPrompt";
import { JAKE_TOOLS, executeTool } from "./tools";
import { fitmentCache } from "./fitmentCache";

const client = new Anthropic();

/**
 * Sanitize Jake's text output to remove markdown images
 * Jake sometimes outputs ![alt](url) syntax which should be handled by JakeMockupCard instead
 */
function sanitizeText(text: string): string {
  // Remove markdown image syntax: ![any text](any url)
  // This can appear when Jake tries to "show" the mockup in text
  return text.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
}

export interface JakeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SavedVehicleContext {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  modification?: string;
}

// Status messages for different operations (Phase 2 - better customer messaging)
const STATUS_MESSAGES: Record<string, string> = {
  thinking: "Thinking...",
  lookup_tire_sizes: "Checking your vehicle specs...",
  lookup_wheel_fitment: "Verifying fitment...",
  search_tires: "Searching tire options...",
  search_wheels: "Searching wheel options...",
  list_trims: "Looking up trim levels...",
  get_platform_context: "Checking platform specs...",
  // Phase 2: Better mockup status messaging (20-40 seconds expected)
  generate_wheel_mockup: "🎨 Generating visual mockup... This takes 20-40 seconds",
  processing: "Processing results...",
  generating: "Jake is typing...",
};

export type StreamEvent = 
  | { type: "status"; status: string }
  | { type: "text"; text: string }
  | { type: "products"; products: { tires?: any[]; wheels?: any[]; staggeredPairs?: any[] } }
  | { type: "vehicle"; vehicle: { year?: number; make?: string; model?: string; trim?: string } }
  | { type: "cartUrl"; cartUrl: string }
  | { type: "mockup"; mockup: { 
      imageUrl: string; 
      disclaimer: string; 
      vehicle: string; 
      wheelStyle: string;
      // Phase 4: Analytics data
      generationTime?: number;
      cached?: boolean;
      generationMethod?: "gpt-image" | "cached";
      // Phase 2/3 Enhancement: Confidence level and product data
      confidence?: "high" | "medium" | "concept";
      tireBrand?: string;
      tireModel?: string;
      // Phase 3: Image lookup tracking
      wheelImageFound?: boolean;
      tireImageFound?: boolean;
      vehicleColor?: string;
    } 
  }
  | { type: "done"; meta: { duration_ms: number; toolsUsed: string[] } }
  | { type: "error"; error: string };

// Gallery build context from "Build Something Similar"
export interface GalleryBuildContext {
  galleryBuild?: {
    vehicle: string;
    wheel: string;
    wheelSize: string;
    tire: string;
    tireSize: string;
    style: string;
    liftLevel?: string;
  };
}

/**
 * Stream Jake's response as events
 */
export async function* streamChat(
  query: string,
  history: JakeMessage[] = [],
  isLocal: boolean = false,
  savedVehicle?: SavedVehicleContext,
  galleryBuildContext?: GalleryBuildContext
): AsyncGenerator<StreamEvent> {
  const startTime = Date.now();
  console.log(`\n[Jake Stream] Query: "${query}"`);
  console.log(`[Jake Stream] History: ${history.length} messages, isLocal: ${isLocal}`);
  
  // Immediately yield initial status
  yield { type: "status", status: STATUS_MESSAGES.thinking };
  
  const toolsUsed: string[] = [];
  let collectedProducts: { tires?: any[]; wheels?: any[]; staggeredPairs?: any[] } = {};
  let detectedVehicle: { year?: number; make?: string; model?: string; trim?: string } = {};
  let cartUrl: string | undefined;
  
  try {
    // Build message history
    const messages: Anthropic.MessageParam[] = [
      ...history.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: query }
    ];
    
    // Build system prompt with context
    let systemPrompt = JAKE_SYSTEM_PROMPT;
    
    // Add vehicle context if customer has a saved vehicle
    if (savedVehicle?.year && savedVehicle?.make && savedVehicle?.model) {
      const vehicleStr = `${savedVehicle.year} ${savedVehicle.make} ${savedVehicle.model}${savedVehicle.trim ? ` ${savedVehicle.trim}` : ''}`;
      systemPrompt += `

═══════════════════════════════════════════════════════════════════════════════
CUSTOMER'S SAVED VEHICLE (IMPORTANT!)
═══════════════════════════════════════════════════════════════════════════════

This customer has already told us their vehicle: **${vehicleStr}**

YOU ALREADY KNOW THEIR VEHICLE. Do NOT ask them what vehicle they drive unless they explicitly say they want to change it or shop for a different vehicle.

When they ask about tires, wheels, or fitment - use this vehicle automatically:
- Year: ${savedVehicle.year}
- Make: ${savedVehicle.make}
- Model: ${savedVehicle.model}${savedVehicle.trim ? `\n- Trim: ${savedVehicle.trim}` : ''}

If they say "I want to change my vehicle" or "different car" - then ask for the new vehicle info.
Otherwise, assume all fitment questions are for the ${vehicleStr}.`;
      
      detectedVehicle = {
        year: parseInt(savedVehicle.year),
        make: savedVehicle.make,
        model: savedVehicle.model,
        trim: savedVehicle.trim,
      };
    }
    
    // Add local mode context
    if (isLocal) {
      systemPrompt += `\n\nNOTE: This customer is on the LOCAL site (warehousetire.net). They can get installation at our Pontiac or Waterford locations. Mention installation is available when relevant.`;
    }
    
    // Add gallery build context (from "Build Something Similar")
    if (galleryBuildContext?.galleryBuild) {
      const gb = galleryBuildContext.galleryBuild;
      systemPrompt += `

═══════════════════════════════════════════════════════════════════════════════
GALLERY BUILD INSPIRATION (from "Build Something Similar")
═══════════════════════════════════════════════════════════════════════════════

The customer clicked "Build Something Similar" on a build from our gallery. Here's what they liked:

INSPIRATION BUILD:
- Vehicle: ${gb.vehicle}
- Wheels: ${gb.wheel} (${gb.wheelSize})
- Tires: ${gb.tire} (${gb.tireSize})
- Style: ${gb.style}${gb.liftLevel ? `\n- Lift/Suspension: ${gb.liftLevel}` : ""}

IMPORTANT INSTRUCTIONS:
1. Open with something like: "I see you're looking at a ${gb.vehicle} build running ${gb.wheel} wheels and ${gb.tire} tires. Love that setup!"
2. Ask if they want something VERY close to this, or if they want to make some changes
3. If their vehicle is different from the inspiration, ask what THEY drive so you can adapt the build
4. The goal is to help them achieve a similar LOOK and VIBE, not necessarily the exact same parts
5. If the exact wheel/tire doesn't fit their vehicle, recommend alternatives with a similar aesthetic
6. Be excited about helping them recreate this style!

The customer is inspired and ready to build. Help them turn this inspiration into reality!`;
      
      console.log(`[Jake Stream] Gallery build context: ${gb.vehicle} with ${gb.wheel}`);
    }
    
    console.log(`[Jake Stream] Calling Claude...`);
    
    // Phase 6 FIX: Use non-streaming first to check if tools are needed
    // This prevents duplicate text from initial stream + final stream
    yield { type: "status", status: STATUS_MESSAGES.thinking };
    
    const initialResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: systemPrompt,
      tools: JAKE_TOOLS,
      messages,
    });
    
    let contentBlocks: Anthropic.ContentBlock[] = initialResponse.content;
    let stopReason: string | null = initialResponse.stop_reason;
    let currentText = "";
    
    // Extract text from initial response (only emit if NOT using tools)
    if (stopReason !== "tool_use") {
      yield { type: "status", status: STATUS_MESSAGES.generating };
      
      // No tools - stream the response for better UX
      const streamResponse = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: systemPrompt,
        tools: JAKE_TOOLS,
        messages,
        stream: true,
      });
      
      for await (const event of streamResponse) {
        if (event.type === "content_block_delta") {
          const delta = event.delta as any;
          if (delta.type === "text_delta" && delta.text) {
            // Sanitize text to remove any markdown image syntax
            const cleanText = sanitizeText(delta.text);
            if (cleanText) {
              currentText += cleanText;
              yield { type: "text", text: cleanText };
            }
          }
        } else if (event.type === "message_delta") {
          stopReason = (event.delta as any).stop_reason || null;
        }
      }
    } else {
      // Tools will be used - extract text from initial response (likely minimal or empty)
      for (const block of contentBlocks) {
        if (block.type === "text") {
          currentText = sanitizeText(block.text);
        }
      }
    }
    
    // Handle tool calls in a loop
    while (stopReason === "tool_use") {
      const assistantMessage = contentBlocks;
      messages.push({ role: "assistant", content: assistantMessage });
      
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      
      for (const block of assistantMessage) {
        if (block.type === "tool_use") {
          const toolName = block.name;
          console.log(`[Jake Stream] Tool call: ${toolName}`, JSON.stringify(block.input).substring(0, 100));
          toolsUsed.push(toolName);
          
          // Yield status for this tool
          yield { type: "status", status: STATUS_MESSAGES[toolName] || `Running ${toolName}...` };
          
          // Track vehicle from tool inputs
          const input = block.input as Record<string, unknown>;
          if (input.year) detectedVehicle.year = Number(input.year);
          if (input.make) detectedVehicle.make = String(input.make);
          if (input.model) detectedVehicle.model = String(input.model);
          if (input.trim) detectedVehicle.trim = String(input.trim);
          
          try {
            // Check cache for fitment lookups
            let result: any;
            const isFitmentLookup = toolName === "lookup_tire_sizes" || toolName === "lookup_wheel_fitment";
            
            if (isFitmentLookup && input.year && input.make && input.model) {
              const cacheKey = fitmentCache.key(
                Number(input.year),
                String(input.make),
                String(input.model),
                input.trim ? String(input.trim) : undefined
              );
              
              result = await fitmentCache.get(cacheKey);
              if (result) {
                console.log(`[Jake Stream] Cache HIT for ${cacheKey}`);
              } else {
                console.log(`[Jake Stream] Cache MISS for ${cacheKey}`);
                result = await executeTool(toolName, input);
                
                // Only cache successful responses
                if (result && !result.error && !result.trimRequired) {
                  await fitmentCache.set(cacheKey, result);
                }
              }
            } else {
              result = await executeTool(toolName, input);
            }
            
            // Collect products from results
            const resultObj = result as any;
            if (resultObj.tires?.length > 0) {
              collectedProducts.tires = resultObj.tires;
            }
            if (resultObj.wheels?.length > 0) {
              collectedProducts.wheels = resultObj.wheels;
            }
            if (resultObj.staggeredPairs?.length > 0) {
              collectedProducts.staggeredPairs = resultObj.staggeredPairs;
            }
            if (resultObj.cartUrl) {
              cartUrl = resultObj.cartUrl;
            }
            
            // Handle mockup results (Phase 4: Include analytics data, Phase 2/3: Include confidence and image tracking)
            if (toolName === "generate_wheel_mockup") {
              if (resultObj.success && resultObj.imageUrl) {
                console.log(`[Jake Stream] Mockup succeeded: method=${resultObj.method}, cached=${resultObj.cached}, time=${resultObj.generationTimeMs}ms, confidence=${resultObj.confidence}`);
                if (resultObj.productMeta) {
                  console.log(`[Jake Stream] Wheel image found: ${resultObj.productMeta.wheelImageFound}, Tire image found: ${resultObj.productMeta.tireImageFound}`);
                }
                yield {
                  type: "mockup",
                  mockup: {
                    imageUrl: resultObj.imageUrl,
                    disclaimer: resultObj.disclaimer,
                    vehicle: `${input.year} ${input.make} ${input.model}`,
                    wheelStyle: `${input.wheelBrand} ${input.wheelModel} ${input.wheelSize}"`,
                    // Phase 4: Analytics data
                    generationTime: resultObj.generationTimeMs || resultObj.generationTime,
                    cached: resultObj.cached,
                    // Pass through actual method: image-reference (high accuracy) vs text-only (may drift)
                    generationMethod: resultObj.method || (resultObj.cached ? "cached" : "generated"),
                    // Phase 2/3: Confidence and product info
                    confidence: resultObj.confidence || "medium",
                    tireBrand: input.tireBrand ? String(input.tireBrand) : undefined,
                    tireModel: input.tireModel ? String(input.tireModel) : undefined,
                    // Phase 3: Image lookup tracking
                    wheelImageFound: true, // We require wheelImageUrl
                    tireImageFound: false,
                    vehicleColor: String(input.color),
                  },
                } as any;
              } else {
                // Phase 4: Track failed mockups
                console.error(`[Jake Stream] Mockup failed: ${resultObj.errorCode} - ${resultObj.error}`);
              }
            }
            
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          } catch (error: any) {
            console.error(`[Jake Stream] Tool error:`, error);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify({ error: String(error) }),
              is_error: true,
            });
          }
        }
      }
      
      messages.push({ role: "user", content: toolResults });
      
      yield { type: "status", status: STATUS_MESSAGES.generating };
      console.log(`[Jake Stream] Sending tool results back...`);
      
      // Stream the final response after tools
      const streamResponse = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: systemPrompt,
        tools: JAKE_TOOLS,
        messages,
        stream: true,
      });
      
      currentText = "";
      contentBlocks = [];
      stopReason = null;
      
      for await (const event of streamResponse) {
        if (event.type === "content_block_delta") {
          const delta = event.delta as any;
          if (delta.type === "text_delta" && delta.text) {
            // Sanitize text to remove any markdown image syntax
            const cleanText = sanitizeText(delta.text);
            if (cleanText) {
              currentText += cleanText;
              yield { type: "text", text: cleanText };
            }
          }
        } else if (event.type === "message_delta") {
          stopReason = (event.delta as any).stop_reason || null;
        }
      }
      
      // Check if we need another tool round
      if (stopReason === "tool_use") {
        const checkResponse = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          system: systemPrompt,
          tools: JAKE_TOOLS,
          messages,
        });
        contentBlocks = checkResponse.content;
        stopReason = checkResponse.stop_reason;
      }
    }
    
    // Yield products if we have any
    if (Object.keys(collectedProducts).length > 0) {
      yield { type: "products", products: collectedProducts };
    }
    
    // Yield vehicle if detected
    if (Object.keys(detectedVehicle).length > 0) {
      yield { type: "vehicle", vehicle: detectedVehicle };
    }
    
    // Yield cart URL if present
    if (cartUrl) {
      yield { type: "cartUrl", cartUrl };
    }
    
    const duration = Date.now() - startTime;
    console.log(`[Jake Stream] Complete in ${duration}ms. Tools used: ${toolsUsed.join(", ") || "none"}`);
    
    yield { 
      type: "done", 
      meta: { 
        duration_ms: duration, 
        toolsUsed 
      } 
    };
    
  } catch (error: any) {
    console.error(`[Jake Stream] Error:`, error);
    yield { 
      type: "error", 
      error: "I'm having a bit of trouble right now. Try again in a sec, or give us a call at (248) 332-4120." 
    };
  }
}
