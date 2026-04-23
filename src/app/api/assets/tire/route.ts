/**
 * Tire Asset Image Lookup
 * 
 * GET /api/assets/tire?km=<partNumber>
 * GET /api/assets/tire?sizeRaw=<tireSize>
 * 
 * Looks up tire images from km_image_mappings table.
 * Replaces the Railway package-engine proxy.
 * 
 * @migrated 2025-07-21 - moved from Railway to direct DB query
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { kmImageMappings } from "@/lib/fitment-db/schema";
import { eq, like, sql } from "drizzle-orm";

export const runtime = "nodejs";

interface TireAssetResult {
  part_number: string;
  prodline: string | null;
  folder_id: string | null;
  image_url: string | null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const km = url.searchParams.get("km");
  const sizeRaw = url.searchParams.get("sizeRaw");

  // Need at least one parameter
  if (!km && !sizeRaw) {
    return NextResponse.json(
      { error: "km_or_sizeRaw_required" },
      { status: 400 }
    );
  }

  try {
    let results: TireAssetResult[] = [];

    if (km) {
      // Look up by K&M part number (exact match or pattern match)
      const normalizedKm = km.trim();
      
      // Try exact match first
      const exactMatch = await db
        .select({
          part_number: kmImageMappings.partNumber,
          prodline: kmImageMappings.prodline,
          folder_id: kmImageMappings.folderId,
          image_url: kmImageMappings.imageUrl,
        })
        .from(kmImageMappings)
        .where(eq(kmImageMappings.partNumber, normalizedKm))
        .limit(1);

      if (exactMatch.length > 0) {
        results = exactMatch;
      } else {
        // Try pattern match (K&M descriptions sometimes have extra chars)
        const patternMatch = await db
          .select({
            part_number: kmImageMappings.partNumber,
            prodline: kmImageMappings.prodline,
            folder_id: kmImageMappings.folderId,
            image_url: kmImageMappings.imageUrl,
          })
          .from(kmImageMappings)
          .where(like(kmImageMappings.partNumber, `%${normalizedKm}%`))
          .limit(5);

        results = patternMatch;
      }
    } else if (sizeRaw) {
      // Look up by tire size - search in part numbers that might contain the size
      const normalizedSize = sizeRaw.trim().replace(/\s+/g, "");
      
      const sizeMatch = await db
        .select({
          part_number: kmImageMappings.partNumber,
          prodline: kmImageMappings.prodline,
          folder_id: kmImageMappings.folderId,
          image_url: kmImageMappings.imageUrl,
        })
        .from(kmImageMappings)
        .where(like(kmImageMappings.partNumber, `%${normalizedSize}%`))
        .limit(5);

      results = sizeMatch;
    }

    return NextResponse.json(
      { results },
      {
        headers: {
          "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (err: any) {
    console.error("[api/assets/tire] Error:", err);
    // Fail-open: UI can load without images
    return NextResponse.json(
      { results: [], error: "lookup_failed" },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  }
}
