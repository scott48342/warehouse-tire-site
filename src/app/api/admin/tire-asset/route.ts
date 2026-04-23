/**
 * Admin: Tire Asset Management
 * 
 * POST /api/admin/tire-asset
 * Upserts a K&M tire image mapping into the database.
 * 
 * Replaces the Railway package-engine proxy.
 * 
 * @migrated 2025-07-21 - moved from Railway to direct DB query
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { kmImageMappings } from "@/lib/fitment-db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

interface TireAssetInput {
  kmDescription: string;      // K&M part number/description (used as primary key)
  tireSizeRaw?: string;       // Raw tire size (for reference)
  imageUrl?: string;          // Image URL to cache
  displayName?: string;       // Human-readable name
  prodline?: string;          // Product line code
  folderId?: string;          // K&M folder ID
  source?: string;            // Source of the data (tireconnect, manual, etc.)
}

export async function POST(req: Request) {
  // Auth check
  const adminKey = (process.env.ADMIN_KEY || "").trim();
  if (!adminKey) {
    return NextResponse.json(
      { error: "Missing ADMIN_KEY (set in Vercel env)" },
      { status: 500 }
    );
  }

  const got = req.headers.get("x-admin-key") || "";
  if (got !== adminKey) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as TireAssetInput;

    if (!body.kmDescription?.trim()) {
      return NextResponse.json(
        { error: "kmDescription is required" },
        { status: 400 }
      );
    }

    const partNumber = body.kmDescription.trim();

    // Check if exists
    const [existing] = await db
      .select()
      .from(kmImageMappings)
      .where(eq(kmImageMappings.partNumber, partNumber))
      .limit(1);

    if (existing) {
      // Update
      await db
        .update(kmImageMappings)
        .set({
          imageUrl: body.imageUrl || existing.imageUrl,
          prodline: body.prodline || existing.prodline,
          folderId: body.folderId || existing.folderId,
          fetchedAt: new Date(),
        })
        .where(eq(kmImageMappings.partNumber, partNumber));

      return NextResponse.json({
        success: true,
        action: "updated",
        partNumber,
      });
    } else {
      // Insert
      await db.insert(kmImageMappings).values({
        partNumber,
        imageUrl: body.imageUrl || null,
        prodline: body.prodline || null,
        folderId: body.folderId || null,
      });

      return NextResponse.json({
        success: true,
        action: "created",
        partNumber,
      });
    }
  } catch (err: any) {
    console.error("[api/admin/tire-asset] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to save tire asset" },
      { status: 500 }
    );
  }
}
