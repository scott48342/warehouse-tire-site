/**
 * Jake Chat API
 * 
 * POST /api/jake/chat
 * 
 * Main endpoint for Jake AI conversations.
 */

import { NextRequest, NextResponse } from "next/server";
import { chat, JakeMessage } from "@/lib/jake";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow up to 60s for AI response

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { query, history = [], isLocal = false } = body;
    
    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'query' field" },
        { status: 400 }
      );
    }
    
    if (query.length > 1000) {
      return NextResponse.json(
        { error: "Query too long. Max 1000 characters." },
        { status: 400 }
      );
    }
    
    console.log(`\n${"=".repeat(60)}`);
    console.log(`[Jake API] POST /api/jake/chat`);
    console.log(`[Jake API] Query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
    console.log(`[Jake API] History: ${history.length} messages, isLocal: ${isLocal}`);
    
    // Call Jake
    const result = await chat(
      query,
      history as JakeMessage[],
      isLocal
    );
    
    const duration = Date.now() - startTime;
    console.log(`[Jake API] Response in ${duration}ms`);
    
    return NextResponse.json({
      response: result.response,
      products: result.products,
      vehicle: result.vehicle,
      meta: {
        duration_ms: duration,
        toolsUsed: result.toolsUsed,
        timestamp: new Date().toISOString(),
      }
    });
    
  } catch (error) {
    console.error("[Jake API] Error:", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        response: "I'm having trouble right now. Give us a call at (248) 332-4120 and we'll help you out.",
      },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "jake-chat",
    timestamp: new Date().toISOString(),
  });
}
