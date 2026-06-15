/**
 * Jake Streaming Chat API
 * 
 * POST /api/jake/chat/stream
 * 
 * Streams Jake's response as Server-Sent Events for instant perceived response.
 * 
 * Event format (SSE):
 *   event: <type>
 *   data: <json>
 * 
 * Event types:
 *   - status: UI status message (e.g., "Searching tires...")
 *   - text: Incremental text chunk
 *   - products: Product data
 *   - vehicle: Detected vehicle
 *   - cartUrl: Cart URL if generated
 *   - done: Stream complete with metadata
 *   - error: Error occurred
 * 
 * @created 2026-06-14
 */

import { NextRequest } from "next/server";
import { streamChat, JakeMessage, SavedVehicleContext } from "@/lib/jake/stream";

export const runtime = "nodejs";
export const maxDuration = 180; // Mockup generation can take 30-40s, plus Claude processing

// Email regex for auto-capture
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, history = [], isLocal = false, vehicle, galleryBuildContext } = body;
    
    if (!query || typeof query !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'query' field" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    if (query.length > 1000) {
      return new Response(
        JSON.stringify({ error: "Query too long. Max 1000 characters." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    console.log(`\n${"=".repeat(60)}`);
    console.log(`[Jake Stream API] POST /api/jake/chat/stream`);
    console.log(`[Jake Stream API] Query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
    console.log(`[Jake Stream API] History: ${history.length} messages, isLocal: ${isLocal}`);
    if (vehicle) {
      console.log(`[Jake Stream API] Vehicle context: ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}`);
    }
    if (galleryBuildContext?.galleryBuild) {
      console.log(`[Jake Stream API] Gallery build context: ${galleryBuildContext.galleryBuild.vehicle} with ${galleryBuildContext.galleryBuild.wheel}`);
    }
    
    // Create readable stream from async generator
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = streamChat(
            query,
            history as JakeMessage[],
            isLocal,
            vehicle as SavedVehicleContext | undefined,
            galleryBuildContext
          );
          
          for await (const event of generator) {
            // Format as SSE
            const sseMessage = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(sseMessage));
          }
          
          controller.close();
        } catch (error) {
          console.error("[Jake Stream API] Stream error:", error);
          const errorEvent = `event: error\ndata: ${JSON.stringify({ 
            type: "error", 
            error: "Stream error occurred" 
          })}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));
          controller.close();
        }
      },
    });
    
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    });
    
  } catch (error) {
    console.error("[Jake Stream API] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        message: "I'm having trouble right now. Give us a call at (248) 332-4120 and we'll help you out.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Health check
export async function GET() {
  return new Response(
    JSON.stringify({
      status: "ok",
      service: "jake-chat-stream",
      timestamp: new Date().toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
