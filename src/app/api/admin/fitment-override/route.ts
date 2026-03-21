import { NextRequest, NextResponse } from "next/server";
import { createOverride, listOverrides, deactivateOverride } from "@/lib/fitment-db/applyOverrides";

/**
 * Admin API for managing fitment overrides
 * 
 * GET - List all active overrides
 * POST - Create a new override
 * DELETE - Deactivate an override
 */

export async function GET() {
  try {
    const overrides = await listOverrides();
    return NextResponse.json({ overrides, count: overrides.length });
  } catch (err: any) {
    console.error("[admin/fitment-override] GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate required fields
    if (!body.scope) {
      return NextResponse.json({ error: "scope is required" }, { status: 400 });
    }
    if (!body.reason) {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }
    
    // Validate scope-specific requirements
    if (body.scope === "modification" && (!body.year || !body.make || !body.model || !body.modificationId)) {
      return NextResponse.json({ error: "modification scope requires year, make, model, modificationId" }, { status: 400 });
    }
    if (body.scope === "model" && (!body.make || !body.model)) {
      return NextResponse.json({ error: "model scope requires make and model" }, { status: 400 });
    }
    if (body.scope === "make" && !body.make) {
      return NextResponse.json({ error: "make scope requires make" }, { status: 400 });
    }
    
    const id = await createOverride({
      scope: body.scope,
      year: body.year ? Number(body.year) : undefined,
      make: body.make,
      model: body.model,
      modificationId: body.modificationId,
      displayTrim: body.displayTrim,
      boltPattern: body.boltPattern,
      centerBoreMm: body.centerBoreMm ? Number(body.centerBoreMm) : undefined,
      threadSize: body.threadSize,
      seatType: body.seatType,
      offsetMinMm: body.offsetMinMm ? Number(body.offsetMinMm) : undefined,
      offsetMaxMm: body.offsetMaxMm ? Number(body.offsetMaxMm) : undefined,
      reason: body.reason,
      createdBy: body.createdBy || "admin-api",
    });
    
    console.log("[admin/fitment-override] Created override:", { id, scope: body.scope, make: body.make, model: body.model });
    
    return NextResponse.json({ id, success: true });
  } catch (err: any) {
    console.error("[admin/fitment-override] POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "id query param is required" }, { status: 400 });
    }
    
    await deactivateOverride(id);
    
    console.log("[admin/fitment-override] Deactivated override:", id);
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[admin/fitment-override] DELETE error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
