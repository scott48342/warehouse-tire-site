/**
 * Jake Chat API
 * 
 * POST /api/jake/chat
 * 
 * Main endpoint for Jake AI conversations.
 */

import { NextRequest, NextResponse } from "next/server";
import { chat, JakeMessage } from "@/lib/jake";
import { subscribe } from "@/lib/email/subscriberService";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow up to 60s for AI response

// Email regex - captures emails from conversational text
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

/**
 * Extract and auto-subscribe any emails found in the message
 * Consent is implied when customer provides email in conversation
 */
async function captureEmailsFromMessage(
  query: string,
  vehicle?: { year?: string; make?: string; model?: string; trim?: string },
  ipAddress?: string,
  userAgent?: string
): Promise<string[]> {
  const emails = query.match(EMAIL_REGEX);
  if (!emails || emails.length === 0) return [];
  
  const captured: string[] = [];
  
  for (const email of emails) {
    try {
      await subscribe({
        email,
        source: "jake",
        vehicle,
        marketingConsent: true, // Auto-consent when customer provides email
        ipAddress,
        userAgent,
      });
      captured.push(email);
      console.log(`[Jake API] Auto-subscribed email: ${email} (consent=true)`);
    } catch (err) {
      console.error(`[Jake API] Failed to capture email ${email}:`, err);
    }
  }
  
  return captured;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { query, history = [], isLocal = false, vehicle } = body;
    
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
    if (vehicle) {
      console.log(`[Jake API] Vehicle context: ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}`);
    }
    
    // Extract IP and user agent for subscriber tracking
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                      req.headers.get("x-real-ip") || 
                      undefined;
    const userAgent = req.headers.get("user-agent") || undefined;
    
    // Auto-capture any emails in the message (with consent)
    const capturedEmails = await captureEmailsFromMessage(query, vehicle, ipAddress, userAgent);
    if (capturedEmails.length > 0) {
      console.log(`[Jake API] Captured ${capturedEmails.length} email(s): ${capturedEmails.join(", ")}`);
    }
    
    // Call Jake with vehicle context
    const result = await chat(
      query,
      history as JakeMessage[],
      isLocal,
      vehicle as { year?: string; make?: string; model?: string; trim?: string } | undefined
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
