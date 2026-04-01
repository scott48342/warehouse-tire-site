/**
 * Regenerate Vehicle Image API
 * 
 * POST - Generate a new image for an existing config
 */

import { NextRequest, NextResponse } from "next/server";
import { visualizerDb, schema } from "@/lib/visualizer/db";
import { regenerateVehicleImage } from "@/lib/visualizer/generate";
import type { VehicleCategory } from "@/lib/visualizer/prompts";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get current config
    const current = await visualizerDb
      .select()
      .from(schema.visualizerConfigs)
      .where(eq(schema.visualizerConfigs.id, id))
      .limit(1);

    if (current.length === 0) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    const config = current[0];

    if (!config.year || !config.make || !config.model || !config.category) {
      return NextResponse.json(
        { error: "Config missing required fields for regeneration (year, make, model, category)" },
        { status: 400 }
      );
    }

    console.log(`[API] Regenerating image for ${config.vehicle}`);

    // Generate new image
    const result = await regenerateVehicleImage(
      config.year,
      config.make,
      config.model,
      config.category as VehicleCategory,
      config.slug
    );

    // Update config with new image, increment version, reset to draft
    const updated = await visualizerDb
      .update(schema.visualizerConfigs)
      .set({
        image: result.imagePath,
        generationPrompt: result.prompt,
        version: (config.version || 1) + 1,
        status: "draft",
        isActive: false,
        approvedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.visualizerConfigs.id, id))
      .returning();

    console.log(`[API] Image regenerated, version ${updated[0].version}`);

    return NextResponse.json({
      success: true,
      config: updated[0],
      newImagePath: result.imagePath,
    });
  } catch (error) {
    console.error("Regenerate error:", error);
    return NextResponse.json(
      { 
        error: "Failed to regenerate image",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
