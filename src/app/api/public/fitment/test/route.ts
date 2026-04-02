/**
 * Fitment API Test Endpoint
 * 
 * GET /api/public/fitment/test
 * 
 * Simple endpoint to verify API key is working.
 * Returns a sample response without requiring vehicle parameters.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/fitment-api/apiKeys";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // Get API key from header
  const apiKey = request.headers.get("X-API-Key") || request.headers.get("Authorization")?.replace("Bearer ", "");
  
  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "API key required",
        hint: "Include your API key in the X-API-Key header",
        example: "curl -H 'X-API-Key: your_key_here' https://shop.warehousetiredirect.com/api/public/fitment/test",
      },
      { status: 401 }
    );
  }
  
  // Validate API key
  const validation = await validateApiKey(apiKey, "/api/public/fitment/test", {
    ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
    userAgent: request.headers.get("user-agent") || undefined,
  });
  
  if (!validation.valid) {
    const errorMessages: Record<string, { message: string; status: number }> = {
      invalid_key_format: { message: "Invalid API key format", status: 401 },
      key_not_found: { message: "API key not found", status: 401 },
      key_inactive: { message: "API key is inactive", status: 403 },
      key_expired: { message: "API key has expired", status: 403 },
      rate_limit_exceeded: { message: "Rate limit exceeded", status: 429 },
      validation_error: { message: "Error validating API key", status: 500 },
    };
    
    const err = errorMessages[validation.error || "validation_error"];
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.status }
    );
  }
  
  const responseTimeMs = Date.now() - startTime;
  
  // Return success with sample data
  return NextResponse.json({
    success: true,
    message: "🎉 Your API key is working!",
    keyInfo: {
      prefix: validation.key?.keyPrefix,
      plan: validation.key?.plan,
      monthlyUsage: validation.key?.monthlyRequestCount,
      monthlyLimit: validation.key?.monthlyLimit,
    },
    sampleData: {
      description: "This is what a fitment response looks like:",
      example: {
        boltPattern: "6x135",
        centerBore: 87.1,
        threadSize: "M14x1.5",
        offsetRange: [20, 44],
        wheelSizes: ["17x7.5", "18x8", "20x9"],
        tireSizes: ["265/70R17", "275/65R18"],
        staggered: false,
      },
    },
    nextSteps: {
      1: "Try /api/public/fitment/specs?year=2020&make=Ford&model=F-150",
      2: "Build a year/make/model selector using /years, /makes, /models endpoints",
      3: "Check out the full docs at https://shop.warehousetiredirect.com/fitment-api#endpoints",
    },
    meta: {
      responseTimeMs,
      timestamp: new Date().toISOString(),
    },
  });
}
