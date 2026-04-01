/**
 * Generate Vehicle Asset API
 * 
 * POST - Generate a new vehicle image and create draft config
 */

import { NextRequest, NextResponse } from "next/server";
import { visualizerDb, schema } from "@/lib/visualizer/db";
import { generateVehicleAsset } from "@/lib/visualizer/generate";
import { buildSlug } from "@/lib/visualizer/prompts";
import type { VehicleCategory } from "@/lib/visualizer/prompts";
import { eq, sql } from "drizzle-orm";

// Ensure table exists with all columns
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
    console.error("Table setup error:", e);
  }
}

export async function POST(request: NextRequest) {
  await ensureTable();
  
  try {
    const body = await request.json();
    const { year, make, model, category } = body;

    // Validate input
    if (!year || !make || !model || !category) {
      return NextResponse.json(
        { error: "Missing required fields: year, make, model, category" },
        { status: 400 }
      );
    }

    const validCategories: VehicleCategory[] = [
      "muscle", "truck", "suv", "sedan", "sports", "classic", "compact"
    ];
    
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const slug = buildSlug(year, make, model);
    const existing = await visualizerDb
      .select()
      .from(schema.visualizerConfigs)
      .where(eq(schema.visualizerConfigs.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { 
          error: `Vehicle "${slug}" already exists. Use regenerate endpoint to create new version.`,
          existingId: existing[0].id,
        },
        { status: 409 }
      );
    }

    console.log(`[API] Generating vehicle asset for ${year} ${make} ${model}`);

    // Generate image and analyze
    const result = await generateVehicleAsset({
      year: Number(year),
      make,
      model,
      category,
    });

    // Save to database as draft
    const inserted = await visualizerDb
      .insert(schema.visualizerConfigs)
      .values({
        slug: result.slug,
        vehicle: result.vehicle,
        year: Number(year),
        make,
        model,
        category,
        image: result.imagePath,
        frontWheel: result.frontWheel,
        rearWheel: result.rearWheel,
        source: "ai_generated",
        generationPrompt: result.prompt,
        status: "draft",
        isActive: false,
        reviewNotes: result.analysisNotes || null,
      })
      .returning();

    console.log(`[API] Draft created: ${inserted[0].id}`);

    return NextResponse.json({
      success: true,
      draft: inserted[0],
      analysisNotes: result.analysisNotes,
    });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { 
        error: "Failed to generate vehicle asset",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
