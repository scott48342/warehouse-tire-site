/**
 * User Garage API
 * 
 * CRUD operations for authenticated users' saved vehicles.
 * All endpoints require authentication - user ID derived from session.
 * 
 * Endpoints:
 * - GET    /api/garage - List user's vehicles
 * - POST   /api/garage - Add vehicle(s) to garage
 * - DELETE /api/garage - Remove vehicle from garage
 * - PATCH  /api/garage - Update vehicle (nickname, wheelDia)
 * 
 * @created 2026-08-21
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { userGarage, type UserGarageVehicle, type NewUserGarageVehicle } from "@/lib/auth-schema";
import { eq, and, desc } from "drizzle-orm";

// Maximum vehicles per user
const MAX_VEHICLES = 10;

/**
 * Get session from headers (server-side)
 */
async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

/**
 * GET /api/garage - List user's saved vehicles
 */
export async function GET() {
  try {
    const session = await getSession();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", vehicles: [] },
        { status: 401 }
      );
    }

    const vehicles = await db
      .select()
      .from(userGarage)
      .where(eq(userGarage.userId, session.user.id))
      .orderBy(desc(userGarage.lastActiveAt));

    return NextResponse.json({
      vehicles,
      count: vehicles.length,
      maxVehicles: MAX_VEHICLES,
    });
  } catch (error) {
    console.error("[garage] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/garage - Add vehicle(s) to garage
 * 
 * Body: { vehicle: GarageVehicle } or { vehicles: GarageVehicle[] }
 * 
 * Returns: { added: VehicleId[], existing: VehicleId[], vehicles: GarageVehicle[] }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const vehiclesToAdd = body.vehicles || (body.vehicle ? [body.vehicle] : []);
    
    if (!vehiclesToAdd.length) {
      return NextResponse.json(
        { error: "No vehicles provided" },
        { status: 400 }
      );
    }

    // Get current vehicles
    const existing = await db
      .select()
      .from(userGarage)
      .where(eq(userGarage.userId, session.user.id));

    const added: string[] = [];
    const alreadyExists: string[] = [];

    for (const vehicle of vehiclesToAdd) {
      // Check for duplicates by modification or year/make/model
      const isDuplicate = existing.some(v => {
        if (vehicle.modification && v.modification) {
          return v.modification === vehicle.modification;
        }
        return (
          v.year === vehicle.year &&
          v.make === vehicle.make &&
          v.model === vehicle.model
        );
      });

      if (isDuplicate) {
        // Find the existing vehicle and update lastActiveAt
        const existingVehicle = existing.find(v => 
          (vehicle.modification && v.modification === vehicle.modification) ||
          (v.year === vehicle.year && v.make === vehicle.make && v.model === vehicle.model)
        );
        if (existingVehicle) {
          await db
            .update(userGarage)
            .set({ lastActiveAt: new Date() })
            .where(eq(userGarage.id, existingVehicle.id));
          alreadyExists.push(existingVehicle.id);
        }
        continue;
      }

      // Check max limit
      if (existing.length + added.length >= MAX_VEHICLES) {
        break; // Stop adding, don't overflow
      }

      // Generate ID if not provided
      const vehicleId = vehicle.id || `v_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

      // Insert new vehicle
      const newVehicle: NewUserGarageVehicle = {
        id: vehicleId,
        userId: session.user.id,
        year: String(vehicle.year),
        make: String(vehicle.make),
        model: String(vehicle.model),
        trim: vehicle.trim ? String(vehicle.trim) : null,
        modification: vehicle.modification ? String(vehicle.modification) : null,
        wheelDia: vehicle.wheelDia ? String(vehicle.wheelDia) : null,
        nickname: vehicle.nickname ? String(vehicle.nickname) : null,
        addedAt: new Date(vehicle.addedAt || Date.now()),
        lastActiveAt: new Date(),
      };

      await db.insert(userGarage).values(newVehicle);
      added.push(vehicleId);
      existing.push(newVehicle as UserGarageVehicle); // Track for duplicate check
    }

    // Fetch updated list
    const vehicles = await db
      .select()
      .from(userGarage)
      .where(eq(userGarage.userId, session.user.id))
      .orderBy(desc(userGarage.lastActiveAt));

    return NextResponse.json({
      added,
      existing: alreadyExists,
      vehicles,
      count: vehicles.length,
    });
  } catch (error) {
    console.error("[garage] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/garage - Remove vehicle from garage
 * 
 * Body: { vehicleId: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { vehicleId } = body;

    if (!vehicleId) {
      return NextResponse.json(
        { error: "vehicleId required" },
        { status: 400 }
      );
    }

    // Delete only if owned by user
    const result = await db
      .delete(userGarage)
      .where(
        and(
          eq(userGarage.id, vehicleId),
          eq(userGarage.userId, session.user.id)
        )
      );

    return NextResponse.json({ deleted: true, vehicleId });
  } catch (error) {
    console.error("[garage] DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/garage - Update vehicle metadata
 * 
 * Body: { vehicleId: string, nickname?: string, wheelDia?: number }
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { vehicleId, nickname, wheelDia, lastActiveAt } = body;

    if (!vehicleId) {
      return NextResponse.json(
        { error: "vehicleId required" },
        { status: 400 }
      );
    }

    // Build update object
    const updates: Partial<UserGarageVehicle> = {};
    if (nickname !== undefined) updates.nickname = nickname;
    if (wheelDia !== undefined) updates.wheelDia = String(wheelDia);
    if (lastActiveAt) updates.lastActiveAt = new Date(lastActiveAt);
    else updates.lastActiveAt = new Date(); // Always update lastActiveAt on PATCH

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      );
    }

    // Update only if owned by user
    await db
      .update(userGarage)
      .set(updates)
      .where(
        and(
          eq(userGarage.id, vehicleId),
          eq(userGarage.userId, session.user.id)
        )
      );

    // Fetch updated vehicle
    const [vehicle] = await db
      .select()
      .from(userGarage)
      .where(eq(userGarage.id, vehicleId));

    return NextResponse.json({ updated: true, vehicle });
  } catch (error) {
    console.error("[garage] PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
