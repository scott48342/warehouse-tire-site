/**
 * Jake AI Service
 * 
 * The brain of Jake - handles conversation with Claude and tool execution.
 */

import Anthropic from "@anthropic-ai/sdk";
import { JAKE_SYSTEM_PROMPT } from "./systemPrompt";
import { JAKE_TOOLS, executeTool } from "./tools";

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

export interface JakeResponse {
  response: string;
  products?: {
    tires?: any[];
    wheels?: any[];
  };
  toolsUsed: string[];
  vehicle?: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
  };
}

export async function chat(
  query: string,
  history: JakeMessage[] = [],
  isLocal: boolean = false,
  savedVehicle?: SavedVehicleContext
): Promise<JakeResponse> {
  console.log(`\n[Jake] Query: "${query}"`);
  console.log(`[Jake] History: ${history.length} messages, isLocal: ${isLocal}`);
  if (savedVehicle) {
    console.log(`[Jake] Saved vehicle context: ${savedVehicle.year} ${savedVehicle.make} ${savedVehicle.model}`);
  }
  
  const toolsUsed: string[] = [];
  let collectedProducts: { tires?: any[]; wheels?: any[] } = {};
  let detectedVehicle: { year?: number; make?: string; model?: string } = {};
  
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
      
      // Pre-populate detected vehicle
      detectedVehicle = {
        year: parseInt(savedVehicle.year),
        make: savedVehicle.make,
        model: savedVehicle.model,
      };
    }
    
    // Add local mode context
    if (isLocal) {
      systemPrompt += `\n\nNOTE: This customer is on the LOCAL site (warehousetire.net). They can get installation at our Pontiac or Waterford locations. Mention installation is available when relevant.`;
    }
    
    console.log(`[Jake] Calling Claude...`);
    
    let response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: systemPrompt,
      tools: JAKE_TOOLS,
      messages,
    });
    
    console.log(`[Jake] Claude responded, stop_reason: ${response.stop_reason}`);
    
    // Handle tool calls in a loop
    while (response.stop_reason === "tool_use") {
      const assistantMessage = response.content;
      messages.push({ role: "assistant", content: assistantMessage });
      
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      
      for (const block of assistantMessage) {
        if (block.type === "tool_use") {
          console.log(`[Jake] Tool call: ${block.name}`, JSON.stringify(block.input).substring(0, 100));
          toolsUsed.push(block.name);
          
          // Track vehicle from tool inputs
          const input = block.input as Record<string, unknown>;
          if (input.year) detectedVehicle.year = Number(input.year);
          if (input.make) detectedVehicle.make = String(input.make);
          if (input.model) detectedVehicle.model = String(input.model);
          
          try {
            const result = await executeTool(block.name, input);
            
            // Collect products from results
            const resultObj = result as any;
            if (resultObj.tires?.length > 0) {
              collectedProducts.tires = resultObj.tires;
            }
            if (resultObj.wheels?.length > 0) {
              collectedProducts.wheels = resultObj.wheels;
            }
            
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          } catch (error: any) {
            console.error(`[Jake] Tool error:`, error);
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
      
      console.log(`[Jake] Sending tool results back...`);
      response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: systemPrompt,
        tools: JAKE_TOOLS,
        messages,
      });
      console.log(`[Jake] Claude responded, stop_reason: ${response.stop_reason}`);
    }
    
    // Extract final text response
    let finalResponse = "";
    for (const block of response.content) {
      if (block.type === "text") {
        finalResponse += block.text;
      }
    }
    
    console.log(`[Jake] Response ready. Tools used: ${toolsUsed.join(", ") || "none"}`);
    
    return {
      response: finalResponse,
      products: Object.keys(collectedProducts).length > 0 ? collectedProducts : undefined,
      toolsUsed,
      vehicle: Object.keys(detectedVehicle).length > 0 ? detectedVehicle : undefined,
    };
    
  } catch (error: any) {
    console.error(`[Jake] Error:`, error);
    return {
      response: `I'm having a bit of trouble right now. Try again in a sec, or give us a call at (248) 332-4120.`,
      toolsUsed: [],
    };
  }
}

export { JAKE_SYSTEM_PROMPT } from "./systemPrompt";
export { JAKE_TOOLS } from "./tools";
