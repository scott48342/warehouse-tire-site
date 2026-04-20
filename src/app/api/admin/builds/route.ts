/**
 * Admin Build Management API
 * 
 * GET /api/admin/builds - List submissions
 * PATCH /api/admin/builds - Update submission status
 */

import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db/pool";

interface BuildRow {
  id: number;
  submission_id: string;
  status: string;
  customer_email: string | null;
  customer_name: string | null;
  order_id: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_trim: string | null;
  vehicle_type: string | null;
  lift_type: string | null;
  lift_inches: number | null;
  lift_brand: string | null;
  wheel_brand: string | null;
  wheel_model: string | null;
  tire_brand: string | null;
  tire_model: string | null;
  tire_size: string | null;
  build_notes: string | null;
  instagram_handle: string | null;
  moderator_notes: string | null;
  is_featured: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ImageRow {
  id: number;
  build_id: number;
  original_url: string;
  thumbnail_url: string | null;
  cdn_url: string | null;
  angle: string | null;
  is_primary: boolean;
}

// Simple admin auth check (replace with proper auth)
function isAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get("Authorization");
  const adminKey = process.env.ADMIN_API_KEY;
  
  if (!adminKey) return false;
  return authHeader === `Bearer ${adminKey}`;
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const offset = (page - 1) * limit;
  
  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }
  
  try {
    // Get builds
    const buildsQuery = `
      SELECT * FROM customer_builds
      WHERE status = $1
      ORDER BY 
        CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
        created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const buildsResult = await pool.query<BuildRow>(buildsQuery, [status, limit, offset]);
    
    // Get total count
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM customer_builds WHERE status = $1`,
      [status]
    );
    const total = parseInt(countResult.rows[0]?.count || "0");
    
    // Get images for each build
    const buildIds = buildsResult.rows.map((b) => b.id);
    let imagesMap: Record<number, ImageRow[]> = {};
    
    if (buildIds.length > 0) {
      const imagesResult = await pool.query<ImageRow>(
        `SELECT * FROM customer_build_images WHERE build_id = ANY($1) ORDER BY sort_order`,
        [buildIds]
      );
      
      for (const img of imagesResult.rows) {
        if (!imagesMap[img.build_id]) imagesMap[img.build_id] = [];
        imagesMap[img.build_id].push(img);
      }
    }
    
    // Format response
    const builds = buildsResult.rows.map((b) => ({
      id: b.id,
      submissionId: b.submission_id,
      status: b.status,
      customer: {
        email: b.customer_email,
        name: b.customer_name,
        orderId: b.order_id,
        instagram: b.instagram_handle,
      },
      vehicle: {
        year: b.vehicle_year,
        make: b.vehicle_make,
        model: b.vehicle_model,
        trim: b.vehicle_trim,
        type: b.vehicle_type,
      },
      build: {
        liftType: b.lift_type,
        liftInches: b.lift_inches,
        liftBrand: b.lift_brand,
      },
      products: {
        wheelBrand: b.wheel_brand,
        wheelModel: b.wheel_model,
        tireBrand: b.tire_brand,
        tireModel: b.tire_model,
        tireSize: b.tire_size,
      },
      notes: b.build_notes,
      moderatorNotes: b.moderator_notes,
      isFeatured: b.is_featured,
      images: (imagesMap[b.id] || []).map((img) => ({
        id: img.id,
        url: img.cdn_url || img.original_url,
        thumbnail: img.thumbnail_url,
        angle: img.angle,
        isPrimary: img.is_primary,
      })),
      createdAt: b.created_at,
    }));
    
    return NextResponse.json({
      builds,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
    
  } catch (error) {
    console.error("[admin/builds] Error:", error);
    return NextResponse.json({ error: "Failed to fetch builds" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { id, status, moderatorNotes, isFeatured, rejectionReason } = body;
    
    if (!id) {
      return NextResponse.json({ error: "Build ID required" }, { status: 400 });
    }
    
    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }
    
    const updates: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    let paramIndex = 1;
    
    if (status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
      
      if (status !== "pending") {
        updates.push(`moderated_at = NOW()`);
      }
    }
    
    if (moderatorNotes !== undefined) {
      updates.push(`moderator_notes = $${paramIndex++}`);
      values.push(moderatorNotes);
    }
    
    if (isFeatured !== undefined) {
      updates.push(`is_featured = $${paramIndex++}`);
      values.push(isFeatured);
    }
    
    if (rejectionReason !== undefined) {
      updates.push(`rejection_reason = $${paramIndex++}`);
      values.push(rejectionReason);
    }
    
    updates.push(`updated_at = NOW()`);
    
    values.push(id);
    
    await pool.query(
      `UPDATE customer_builds SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      values
    );
    
    // If approved, sync to gallery_assets
    if (status === "approved") {
      await syncBuildToGallery(pool, id);
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("[admin/builds] PATCH Error:", error);
    return NextResponse.json({ error: "Failed to update build" }, { status: 500 });
  }
}

// Sync approved build to gallery_assets table
async function syncBuildToGallery(pool: ReturnType<typeof getDbPool>, buildId: number) {
  if (!pool) return;
  
  // Get build details
  const buildResult = await pool.query<BuildRow>(
    `SELECT * FROM customer_builds WHERE id = $1`,
    [buildId]
  );
  const build = buildResult.rows[0];
  if (!build) return;
  
  // Get images
  const imagesResult = await pool.query<ImageRow>(
    `SELECT * FROM customer_build_images WHERE build_id = $1 AND is_approved = true`,
    [buildId]
  );
  
  // Insert each image into gallery_assets
  for (const img of imagesResult.rows) {
    await pool.query(
      `INSERT INTO gallery_assets (
        source_asset_id,
        source_album_name,
        source_url,
        thumbnail_url,
        media_type,
        wheel_brand,
        wheel_model,
        vehicle_year,
        vehicle_make,
        vehicle_model,
        vehicle_trim,
        vehicle_type,
        lift_level,
        parse_confidence,
        parse_notes
      ) VALUES (
        $1, $2, $3, $4, 'image', $5, $6, $7, $8, $9, $10, $11, $12, 'verified', 'Customer submission'
      )
      ON CONFLICT (source_asset_id, wheel_brand) DO NOTHING`,
      [
        `customer-${build.submission_id}-${img.id}`,
        `Customer Build: ${build.vehicle_year || ""} ${build.vehicle_make} ${build.vehicle_model}`.trim(),
        img.cdn_url || img.original_url,
        img.thumbnail_url,
        build.wheel_brand,
        build.wheel_model,
        build.vehicle_year,
        build.vehicle_make,
        build.vehicle_model,
        build.vehicle_trim,
        build.vehicle_type,
        build.lift_type === "lifted" ? build.lift_inches?.toString() : build.lift_type,
      ]
    );
  }
}
