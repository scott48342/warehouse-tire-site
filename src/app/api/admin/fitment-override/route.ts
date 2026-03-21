import { NextRequest, NextResponse } from "next/server";
import {
  createOverride,
  listOverrides,
  deactivateOverride,
  updateOverride,
  getOverride,
  findOverrideByVehicle,
  type CreateOverrideInput,
  type OEMWheelSizeOverride,
} from "@/lib/fitment-db/applyOverrides";

/**
 * Admin API for managing fitment overrides
 * 
 * GET - List all active overrides, or fetch specific override by id/vehicle
 * POST - Create a new override
 * PATCH - Update an existing override
 * DELETE - Deactivate an override
 * 
 * Override Schema:
 * {
 *   scope: "global" | "year" | "make" | "model" | "modification"
 *   year?: number           // Required for modification scope
 *   make?: string           // Required for make/model/modification scopes
 *   model?: string          // Required for model/modification scopes
 *   modificationId?: string // Required for modification scope
 *   
 *   // Override values (any of these):
 *   displayTrim?: string
 *   boltPattern?: string       // e.g. "6x139.7"
 *   centerBoreMm?: number      // e.g. 78.1
 *   threadSize?: string        // e.g. "M14x1.5"
 *   seatType?: string          // e.g. "conical"
 *   offsetMinMm?: number       // e.g. 15
 *   offsetMaxMm?: number       // e.g. 45
 *   oemWheelSizes?: [{diameter, width, offset, axle, isStock, tireSize?}]
 *   oemTireSizes?: string[]    // e.g. ["265/70R17", "275/60R20"]
 *   forceQuality?: "valid" | "partial" // Force profile quality assessment
 *   
 *   // Metadata:
 *   reason: string          // Required: why this override exists
 *   notes?: string          // Additional context
 *   createdBy?: string      // Who created it (defaults to "admin-api")
 * }
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const year = searchParams.get("year");
    const make = searchParams.get("make");
    const model = searchParams.get("model");
    const modification = searchParams.get("modification");
    
    // If ID provided, fetch specific override
    if (id) {
      const override = await getOverride(id);
      if (!override) {
        return NextResponse.json({ error: "Override not found" }, { status: 404 });
      }
      return NextResponse.json({ override });
    }
    
    // If vehicle params provided, find matching override
    if (year && make && model) {
      const override = await findOverrideByVehicle(
        Number(year),
        make,
        model,
        modification || undefined
      );
      return NextResponse.json({
        override: override || null,
        found: !!override,
        vehicle: { year: Number(year), make, model, modification },
      });
    }
    
    // Otherwise, list all overrides
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
    
    // Validate forceQuality if provided
    if (body.forceQuality && !["valid", "partial"].includes(body.forceQuality)) {
      return NextResponse.json({ error: "forceQuality must be 'valid' or 'partial'" }, { status: 400 });
    }
    
    // Validate oemWheelSizes structure if provided
    if (body.oemWheelSizes) {
      if (!Array.isArray(body.oemWheelSizes)) {
        return NextResponse.json({ error: "oemWheelSizes must be an array" }, { status: 400 });
      }
      for (const ws of body.oemWheelSizes) {
        if (typeof ws.diameter !== "number" || typeof ws.width !== "number") {
          return NextResponse.json({ error: "oemWheelSizes items must have numeric diameter and width" }, { status: 400 });
        }
        if (!["front", "rear", "both"].includes(ws.axle)) {
          return NextResponse.json({ error: "oemWheelSizes items must have axle: 'front' | 'rear' | 'both'" }, { status: 400 });
        }
      }
    }
    
    // Validate oemTireSizes if provided
    if (body.oemTireSizes) {
      if (!Array.isArray(body.oemTireSizes) || !body.oemTireSizes.every((s: unknown) => typeof s === "string")) {
        return NextResponse.json({ error: "oemTireSizes must be an array of strings" }, { status: 400 });
      }
    }
    
    const input: CreateOverrideInput = {
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
      offsetMinMm: body.offsetMinMm != null ? Number(body.offsetMinMm) : undefined,
      offsetMaxMm: body.offsetMaxMm != null ? Number(body.offsetMaxMm) : undefined,
      oemWheelSizes: body.oemWheelSizes as OEMWheelSizeOverride[] | undefined,
      oemTireSizes: body.oemTireSizes,
      forceQuality: body.forceQuality,
      notes: body.notes,
      reason: body.reason,
      createdBy: body.createdBy || "admin-api",
    };
    
    const id = await createOverride(input);
    
    console.log("[admin/fitment-override] Created override:", {
      id,
      scope: body.scope,
      make: body.make,
      model: body.model,
      modificationId: body.modificationId,
      forceQuality: body.forceQuality,
    });
    
    return NextResponse.json({ id, success: true });
  } catch (err: any) {
    console.error("[admin/fitment-override] POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "id query param is required" }, { status: 400 });
    }
    
    const body = await req.json();
    
    // Validate forceQuality if provided
    if (body.forceQuality !== undefined && body.forceQuality !== null && !["valid", "partial"].includes(body.forceQuality)) {
      return NextResponse.json({ error: "forceQuality must be 'valid', 'partial', or null" }, { status: 400 });
    }
    
    // Validate oemWheelSizes structure if provided
    if (body.oemWheelSizes !== undefined && body.oemWheelSizes !== null) {
      if (!Array.isArray(body.oemWheelSizes)) {
        return NextResponse.json({ error: "oemWheelSizes must be an array" }, { status: 400 });
      }
      for (const ws of body.oemWheelSizes) {
        if (typeof ws.diameter !== "number" || typeof ws.width !== "number") {
          return NextResponse.json({ error: "oemWheelSizes items must have numeric diameter and width" }, { status: 400 });
        }
      }
    }
    
    await updateOverride(id, {
      year: body.year !== undefined ? (body.year ? Number(body.year) : undefined) : undefined,
      make: body.make,
      model: body.model,
      modificationId: body.modificationId,
      displayTrim: body.displayTrim,
      boltPattern: body.boltPattern,
      centerBoreMm: body.centerBoreMm !== undefined ? (body.centerBoreMm ? Number(body.centerBoreMm) : undefined) : undefined,
      threadSize: body.threadSize,
      seatType: body.seatType,
      offsetMinMm: body.offsetMinMm !== undefined ? (body.offsetMinMm != null ? Number(body.offsetMinMm) : null) : undefined,
      offsetMaxMm: body.offsetMaxMm !== undefined ? (body.offsetMaxMm != null ? Number(body.offsetMaxMm) : null) : undefined,
      oemWheelSizes: body.oemWheelSizes,
      oemTireSizes: body.oemTireSizes,
      forceQuality: body.forceQuality,
      notes: body.notes,
      reason: body.reason,
    });
    
    console.log("[admin/fitment-override] Updated override:", id);
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[admin/fitment-override] PATCH error:", err);
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
