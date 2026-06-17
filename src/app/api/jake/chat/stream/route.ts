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
import { streamChat, JakeMessage, SavedVehicleContext, StreamEvent } from "@/lib/jake/stream";
import { streamChatV2 } from "@/lib/jake/streamV2";
import { captureEmailsFromMessage, trackBuildAndLink } from "@/lib/jake/capture";

export const runtime = "nodejs";
export const maxDuration = 180; // Mockup generation can take 30-40s, plus Claude processing

/**
 * Engine flag: default v1 (old Jake). v2 (new lean engine) runs ONLY when
 * explicitly requested via ?engine=v2 query param or JAKE_ENGINE=v2 env.
 */
function resolveEngine(req: NextRequest, body: any): "v1" | "v2" {
  try {
    const q = req.nextUrl?.searchParams?.get("engine");
    if (q === "v2") return "v2";
    if (q === "v1") return "v1";
    if (typeof body?.engine === "string" && body.engine === "v2") return "v2";
    if (process.env.JAKE_ENGINE === "v2") return "v2";
  } catch {
    /* fall through to default */
  }
  return "v1";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, history = [], isLocal = false, vehicle, galleryBuildContext } = body;
    const engine = resolveEngine(req, body);
    
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
    console.log(`[Jake Stream API] Engine: ${engine} | History: ${history.length} messages, isLocal: ${isLocal}`);
    if (vehicle) {
      console.log(`[Jake Stream API] Vehicle context: ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}`);
    }
    if (galleryBuildContext?.galleryBuild) {
      console.log(`[Jake Stream API] Gallery build context: ${galleryBuildContext.galleryBuild.vehicle} with ${galleryBuildContext.galleryBuild.wheel}`);
    }
    
    // Non-blocking capture context (extracted from non-stream route).
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      undefined;
    const userAgent = req.headers.get("user-agent") || undefined;
    const hostname = req.headers.get("host");

    // Fire email capture immediately (fail-safe, awaited but guarded so it can
    // never throw). Email capture is cheap and benefits from running up-front.
    let capturedEmails: string[] = [];
    try {
      capturedEmails = await captureEmailsFromMessage(query, vehicle, ipAddress, userAgent);
    } catch (err) {
      console.error("[Jake Stream API] email capture error (ignored):", err);
      capturedEmails = [];
    }

    // Create readable stream from async generator
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        // Accumulate artifacts as events flow so we can track the build AFTER
        // the stream closes — without ever blocking the response.
        const collected: {
          products?: { wheels?: any[]; tires?: any[]; staggeredPairs?: any[] };
          vehicle?: { year?: number; make?: string; model?: string; trim?: string };
          cartUrl?: string;
          toolsUsed: string[];
        } = { toolsUsed: [] };

        try {
          const generator =
            engine === "v2"
              ? streamChatV2(
                  query,
                  history as JakeMessage[],
                  isLocal,
                  vehicle as SavedVehicleContext | undefined,
                  galleryBuildContext
                )
              : streamChat(
                  query,
                  history as JakeMessage[],
                  isLocal,
                  vehicle as SavedVehicleContext | undefined,
                  galleryBuildContext
                );
          
          for await (const event of generator as AsyncGenerator<StreamEvent>) {
            // Observe artifacts for capture (never affects what we emit).
            try {
              if (event.type === "products") collected.products = event.products;
              else if (event.type === "vehicle") collected.vehicle = event.vehicle;
              else if (event.type === "cartUrl") collected.cartUrl = event.cartUrl;
              else if (event.type === "done") collected.toolsUsed = event.meta?.toolsUsed || [];
            } catch {
              /* observation must never break streaming */
            }

            // Format as SSE
            const sseMessage = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(sseMessage));
          }
          
          controller.close();

          // Fire-and-forget build tracking AFTER the response is sent.
          // Wrapped + guarded; can never throw into the stream.
          try {
            trackBuildAndLink(
              {
                conversationId: body.conversationId || body.sessionId,
                sessionId: body.sessionId,
                query,
                historyLength: Array.isArray(history) ? history.length : 0,
                isLocalHostname: hostname,
                vehicle,
                resolvedVehicle: collected.vehicle,
                products: collected.products,
                toolsUsed: collected.toolsUsed,
                cartUrl: collected.cartUrl,
                ipAddress,
                userAgent,
              },
              capturedEmails
            );
          } catch (err) {
            console.error("[Jake Stream API] trackBuildAndLink error (ignored):", err);
          }
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
