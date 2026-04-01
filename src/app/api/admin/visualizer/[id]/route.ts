/**
 * Single Visualizer Config API
 * 
 * GET - Get config by ID
 * PATCH - Update config (positions, notes, etc.)
 * DELETE - Delete config
 */

import { NextRequest, NextResponse } from "next/server";
import { visualizerDb, schema } from "@/lib/visualizer/db";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const config = await visualizerDb
      .select()
      .from(schema.visualizerConfigs)
      .where(eq(schema.visualizerConfigs.id, id))
      .limit(1);

    if (config.length === 0) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    return NextResponse.json(config[0]);
  } catch (error) {
    console.error("GET config error:", error);
    return NextResponse.json(
      { error: "Failed to fetch config" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const {
      frontWheel,
      rearWheel,
      reviewNotes,
      vehicle,
      image,
    } = body;

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (frontWheel) updateData.frontWheel = frontWheel;
    if (rearWheel) updateData.rearWheel = rearWheel;
    if (reviewNotes !== undefined) updateData.reviewNotes = reviewNotes;
    if (vehicle) updateData.vehicle = vehicle;
    if (image) updateData.image = image;

    const updated = await visualizerDb
      .update(schema.visualizerConfigs)
      .set(updateData)
      .where(eq(schema.visualizerConfigs.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    return NextResponse.json({ updated: true, config: updated[0] });
  } catch (error) {
    console.error("PATCH config error:", error);
    return NextResponse.json(
      { error: "Failed to update config" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const deleted = await visualizerDb
      .delete(schema.visualizerConfigs)
      .where(eq(schema.visualizerConfigs.id, id))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error("DELETE config error:", error);
    return NextResponse.json(
      { error: "Failed to delete config" },
      { status: 500 }
    );
  }
}
