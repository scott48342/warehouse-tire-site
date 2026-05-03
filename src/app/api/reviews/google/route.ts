import { NextResponse } from "next/server";
import { getAllStoreReviews } from "@/lib/google/placesService";

export const runtime = "nodejs";

// Cache reviews for 24 hours
let cachedReviews: Awaited<ReturnType<typeof getAllStoreReviews>> | null = null;
let cacheTime = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get("refresh") === "1";
  
  const now = Date.now();
  
  // Return cached reviews if valid
  if (!refresh && cachedReviews && (now - cacheTime) < CACHE_TTL) {
    return NextResponse.json(cachedReviews, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "X-Cache": "HIT",
      },
    });
  }
  
  try {
    const reviews = await getAllStoreReviews();
    
    // Update cache
    cachedReviews = reviews;
    cacheTime = now;
    
    return NextResponse.json(reviews, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "X-Cache": "MISS",
      },
    });
  } catch (error: any) {
    console.error("[api/reviews/google] Error:", error);
    
    // Return cached data even if stale
    if (cachedReviews) {
      return NextResponse.json(cachedReviews, {
        headers: {
          "Cache-Control": "public, max-age=60",
          "X-Cache": "STALE",
        },
      });
    }
    
    return NextResponse.json(
      { error: error?.message || "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}
