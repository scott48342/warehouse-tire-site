/**
 * Image Proxy API
 * 
 * Proxies external images to avoid CORS issues when using them in canvas operations.
 * Used by visualizer lab tools for wheel image normalization.
 * 
 * NO REGRESSION: This is a utility endpoint for lab tools only.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }
  
  try {
    // Validate URL
    const parsedUrl = new URL(url);
    
    // Only allow http/https
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
    }
    
    // Fetch the image
    const response = await fetch(url, {
      headers: {
        "User-Agent": "WTD-Visualizer/1.0",
      },
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status }
      );
    }
    
    // Get content type
    const contentType = response.headers.get("content-type") || "image/png";
    
    // Verify it's an image
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "URL is not an image" }, { status: 400 });
    }
    
    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    
    // Return with proper headers for canvas use
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
    
  } catch (error) {
    console.error("[image-proxy] Error:", error);
    return NextResponse.json(
      { error: "Failed to proxy image" },
      { status: 500 }
    );
  }
}
