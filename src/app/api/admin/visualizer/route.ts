/**
 * Visualizer Config API
 * 
 * GET - List all configs or get single config by slug
 * POST - Create/update config (upsert by slug)
 * DELETE - Delete config by slug
 */

import { NextRequest, NextResponse } from "next/server";
import { visualizerDb, schema } from "@/lib/visualizer/db";
import { eq, sql } from "drizzle-orm";

// Ensure table exists (auto-migrate)
async function ensureTable() {
  try {
    await visualizerDb.execute(sql`
      CREATE TABLE IF NOT EXISTS visualizer_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(255) NOT NULL UNIQUE,
        vehicle VARCHAR(255) NOT NULL,
        image VARCHAR(500) NOT NULL,
        front_wheel JSONB NOT NULL,
        rear_wheel JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
  } catch (e) {
    // Table might already exist, that's fine
    console.log("Table check:", e);
  }
}

export async function GET(request: NextRequest) {
  await ensureTable();
  try {
    const slug = request.nextUrl.searchParams.get("slug");

    if (slug) {
      // Get single config
      const config = await visualizerDb
        .select()
        .from(schema.visualizerConfigs)
        .where(eq(schema.visualizerConfigs.slug, slug))
        .limit(1);

      if (config.length === 0) {
        return NextResponse.json({ error: "Config not found" }, { status: 404 });
      }

      return NextResponse.json(config[0]);
    }

    // List all configs
    const configs = await visualizerDb
      .select()
      .from(schema.visualizerConfigs)
      .orderBy(schema.visualizerConfigs.vehicle);

    return NextResponse.json(configs);
  } catch (error) {
    console.error("Visualizer GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch configs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  await ensureTable();
  try {
    const body = await request.json();
    const { slug, vehicle, image, frontWheel, rearWheel } = body;

    if (!slug || !vehicle || !image || !frontWheel || !rearWheel) {
      return NextResponse.json(
        { error: "Missing required fields: slug, vehicle, image, frontWheel, rearWheel" },
        { status: 400 }
      );
    }

    // Upsert: try to update, insert if not exists
    const existing = await visualizerDb
      .select()
      .from(schema.visualizerConfigs)
      .where(eq(schema.visualizerConfigs.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      // Update
      const updated = await visualizerDb
        .update(schema.visualizerConfigs)
        .set({
          vehicle,
          image,
          frontWheel,
          rearWheel,
          updatedAt: new Date(),
        })
        .where(eq(schema.visualizerConfigs.slug, slug))
        .returning();

      return NextResponse.json({ saved: true, config: updated[0] });
    } else {
      // Insert
      const inserted = await visualizerDb
        .insert(schema.visualizerConfigs)
        .values({
          slug,
          vehicle,
          image,
          frontWheel,
          rearWheel,
        })
        .returning();

      return NextResponse.json({ saved: true, config: inserted[0] });
    }
  } catch (error) {
    console.error("Visualizer POST error:", error);
    return NextResponse.json(
      { error: "Failed to save config" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get("slug");

    if (!slug) {
      return NextResponse.json(
        { error: "Missing slug parameter" },
        { status: 400 }
      );
    }

    const deleted = await visualizerDb
      .delete(schema.visualizerConfigs)
      .where(eq(schema.visualizerConfigs.slug, slug))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, slug });
  } catch (error) {
    console.error("Visualizer DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete config" },
      { status: 500 }
    );
  }
}
