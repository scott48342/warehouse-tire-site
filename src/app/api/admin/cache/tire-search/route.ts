/**
 * Admin API: Clear tire search cache
 * POST /api/admin/cache/tire-search?size=33125022
 */
import { NextResponse } from "next/server";
import { clearSizeCache } from "@/lib/tires/searchCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const size = url.searchParams.get("size");
  
  if (!size) {
    return NextResponse.json(
      { error: "Missing size parameter" },
      { status: 400 }
    );
  }
  
  try {
    const cleared = await clearSizeCache(size);
    
    return NextResponse.json({
      success: cleared,
      size,
      message: cleared 
        ? `Cache cleared for size ${size}` 
        : "Cache not cleared (Redis may not be connected)",
    });
  } catch (err: any) {
    console.error("[admin/cache/tire-search] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
