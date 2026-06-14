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

// Status messages for different operations
const STATUS_MESSAGES: Record<string, string> = {
  thinking: "Thinking...",
  lookup_tire_sizes: "Checking your vehicle specs...",
  lookup_wheel_fitment: "Verifying fitment...",
  search_tires: "Searching tire options...",
  search_wheels: "Searching wheel options...",
  list_trims: "Looking up trim levels...",
  get_platform_context: "Checking platform specs...",
  processing: "Processing results...",
  generating: "Jake is typing...",
};

export type StreamEvent = 
  | { type: "status"; status: string }
  | { type: "text"; text: string }
  | { type: "products"; products: { tires?: any[]; wheels?: any[]; staggeredPairs?: any[] } }
  | { type: "vehicle"; vehicle: { year?: number; make?: string; model?: string; trim?: string } }
  | { type: "cartUrl"; cartUrl: string }
  | { type: "done"; meta: { duration_ms: number; toolsUsed: string[] } }
  | { type: "error"; error: string };

/**
 * Stream Jake's response as events
 */
export async function* streamChat(
  query: string,
  history: JakeMessage[] = [],
  isLocal: boolean = false,
  savedVehicle?: SavedVehicleContext
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
    
    console.log(`[Jake Stream] Calling Claude...`);
    
    // Initial Claude call with streaming
    let response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: systemPrompt,
      tools: JAKE_TOOLS,
      messages,
      stream: true,
    });
    
    // Collect the streamed response
    let currentText = "";
    let contentBlocks: Anthropic.ContentBlock[] = [];
    let stopReason: string | null = null;
    
    yield { type: "status", status: STATUS_MESSAGES.generating };
    
    for await (const event of response) {
      if (event.type === "content_block_delta") {
        const delta = event.delta as any;
        if (delta.type === "text_delta" && delta.text) {
          currentText += delta.text;
          yield { type: "text", text: delta.text };
        }
      } else if (event.type === "content_block_stop") {
        // Block finished
      } else if (event.type === "message_delta") {
        stopReason = (event.delta as any).stop_reason || null;
      } else if (event.type === "message_stop") {
        // Message complete
      }
    }
    
    // Reconstruct content blocks for tool handling
    // We need to re-fetch without streaming to get proper tool_use blocks
    if (stopReason === "tool_use" || currentText === "") {
      // Need to handle tool calls - use non-streaming for tool loop
      const nonStreamResponse = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: systemPrompt,
        tools: JAKE_TOOLS,
        messages,
      });
      
      contentBlocks = nonStreamResponse.content;
      stopReason = nonStreamResponse.stop_reason;
      
      // Extract any text from non-streamed response
      for (const block of contentBlocks) {
        if (block.type === "text" && !currentText) {
          currentText = block.text;
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
        model: "claude-sonnet-4-20250514",
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
            currentText += delta.text;
            yield { type: "text", text: delta.text };
          }
        } else if (event.type === "message_delta") {
          stopReason = (event.delta as any).stop_reason || null;
        }
      }
      
      // Check if we need another tool round
      if (stopReason === "tool_use") {
        const checkResponse = await client.messages.create({
          model: "claude-sonnet-4-20250514",
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
