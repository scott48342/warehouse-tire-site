/**
 * Visualizer Config API
 * 
 * GET - List all configs (optionally filter by status)
 * POST - Create/update config (upsert by slug)
 * DELETE - Delete config by slug
 */

import { NextRequest, NextResponse } from "next/server";
import { visualizerDb, schema } from "@/lib/visualizer/db";
import { eq, sql, and } from "drizzle-orm";

// Ensure table exists with all columns (auto-migrate)
async function ensureTable() {
  try {
    await visualizerDb.execute(sql`
      CREATE TABLE IF NOT EXISTS visualizer_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(255) NOT NULL UNIQUE,
        year INTEGER,
        make VARCHAR(100),
        model VARCHAR(100),
        category VARCHAR(50),
        vehicle VARCHAR(255) NOT NULL,
        image VARCHAR(500) NOT NULL,
        front_wheel JSONB NOT NULL,
        rear_wheel JSONB NOT NULL,
        source VARCHAR(50) DEFAULT 'manual',
        generation_prompt TEXT,
        version INTEGER DEFAULT 1,
        status VARCHAR(20) DEFAULT 'draft',
        is_active BOOLEAN DEFAULT false,
        review_notes TEXT,
        reviewed_by VARCHAR(100),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        approved_at TIMESTAMP
      )
    `);
    
    // Add new columns if they don't exist (for existing tables)
    const alterStatements = [
      `ALTER TABLE visualizer_configs ADD COLUMN IF NOT EXISTS year INTEGER`,
      `ALTER TABLE visualizer_configs ADD COLUMN IF NOT EXISTS make VARCHAR(100)`,
      `ALTER TABLE visualizer_configs ADD COLUMN IF NOT EXISTS model VARCHAR(100)`,
      `ALTER TABLE visualizer_configs ADD COLUMN IF NOT EXISTS category VARCHAR(50)`,
      `ALTER TABLE visualizer_configs ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual'`,
      `ALTER TABLE visualizer_configs ADD COLUMN IF NOT EXISTS generation_prompt TEXT`,
      `ALTER TABLE visualizer_configs ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1`,
      `ALTER TABLE visualizer_configs ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft'`,
      `ALTER TABLE visualizer_configs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false`,
      `ALTER TABLE visualizer_configs ADD COLUMN IF NOT EXISTS review_notes TEXT`,
      `ALTER TABLE visualizer_configs ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(100)`,
      `ALTER TABLE visualizer_configs ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`,
    ];
    
    for (const stmt of alterStatements) {
      try {
        await visualizerDb.execute(sql.raw(stmt));
      } catch (e) {
        // Column might already exist
      }
    }
  } catch (e) {
    console.log("Table check:", e);
  }
}

export async function GET(request: NextRequest) {
  await ensureTable();
  
  try {
    const status = request.nextUrl.searchParams.get("status");
    const slug = request.nextUrl.searchParams.get("slug");
    const activeOnly = request.nextUrl.searchParams.get("active") === "true";

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

    // Build query conditions
    let query = visualizerDb.select().from(schema.visualizerConfigs);
    
    if (status) {
      query = query.where(eq(schema.visualizerConfigs.status, status)) as typeof query;
    }
    
    if (activeOnly) {
      query = query.where(eq(schema.visualizerConfigs.isActive, true)) as typeof query;
    }

    const configs = await query.orderBy(schema.visualizerConfigs.createdAt);

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
    const { 
      slug, 
      vehicle, 
      image, 
      frontWheel, 
      rearWheel,
      year,
      make,
      model,
      category,
      source,
      generationPrompt,
      status,
      reviewNotes,
    } = body;

    if (!slug || !vehicle || !image || !frontWheel || !rearWheel) {
      return NextResponse.json(
        { error: "Missing required fields: slug, vehicle, image, frontWheel, rearWheel" },
        { status: 400 }
      );
    }

    // Check if exists
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
          year: year ?? existing[0].year,
          make: make ?? existing[0].make,
          model: model ?? existing[0].model,
          category: category ?? existing[0].category,
          reviewNotes: reviewNotes ?? existing[0].reviewNotes,
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
          year,
          make,
          model,
          category,
          source: source || "manual",
          generationPrompt,
          status: status || "draft",
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
  await ensureTable();
  
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
