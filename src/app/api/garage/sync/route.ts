/**
 * Garage Sync API
 * 
 * Merges local (guest) garage with server garage on login.
 * Server is authoritative - local vehicles are added only if not duplicates.
 * 
 * Called after successful login to sync state.
 * 
 * POST /api/garage/sync
 * Body: { localVehicles: GarageVehicle[], activeId?: string }
 * Returns: { vehicles: GarageVehicle[], activeId: string, merged: number }
 * 
 * @created 2026-08-21
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { userGarage, type UserGarageVehicle, type NewUserGarageVehicle } from "@/lib/auth-schema";
import { eq, desc } from "drizzle-orm";

const MAX_VEHICLES = 10;

/**
 * Check if two vehicles are duplicates
 * Uses modification ID if available, falls back to year/make/model
 */
function isDuplicate(
  a: { year: string; make: string; model: string; modification?: string | null },
  b: { year: string; make: string; model: string; modification?: string | null }
): boolean {
  // Prefer modification ID match
  if (a.modification && b.modification) {
    return a.modification === b.modification;
  }
  
  // Fall back to normalized YMM (case-insensitive)
  const normalize = (s: string) => s.toLowerCase().replace(/[-_\s]+/g, '');
  return (
    a.year === b.year &&
    normalize(a.make) === normalize(b.make) &&
    normalize(a.model) === normalize(b.model)
  );
}

async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

/**
 * POST /api/garage/sync - Merge local garage to server
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
    const localVehicles = body.localVehicles || [];
    const localActiveId = body.activeId;

    // Get server vehicles
    const serverVehicles = await db
      .select()
      .from(userGarage)
      .where(eq(userGarage.userId, session.user.id))
      .orderBy(desc(userGarage.lastActiveAt));

    let merged = 0;
    let newActiveId: string | null = null;

    // Merge local vehicles that don't exist on server
    for (const local of localVehicles) {
      // Skip if already at max
      if (serverVehicles.length + merged >= MAX_VEHICLES) {
        break;
      }

      // Check for duplicates
      const exists = serverVehicles.some(server => isDuplicate(server, {
        year: String(local.year),
        make: String(local.make),
        model: String(local.model),
        modification: local.modification,
      }));

      if (exists) {
        // If this was the local active, find the server equivalent
        if (local.id === localActiveId) {
          const match = serverVehicles.find(server => isDuplicate(server, {
            year: String(local.year),
            make: String(local.make),
            model: String(local.model),
            modification: local.modification,
          }));
          if (match) {
            newActiveId = match.id;
            // Update lastActiveAt on the matched vehicle
            await db
              .update(userGarage)
              .set({ lastActiveAt: new Date() })
              .where(eq(userGarage.id, match.id));
          }
        }
        continue;
      }

      // Add to server
      const vehicleId = local.id || `v_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      
      const newVehicle: NewUserGarageVehicle = {
        id: vehicleId,
        userId: session.user.id,
        year: String(local.year),
        make: String(local.make),
        model: String(local.model),
        trim: local.trim ? String(local.trim) : null,
        modification: local.modification ? String(local.modification) : null,
        wheelDia: local.wheelDia ? String(local.wheelDia) : null,
        nickname: local.nickname ? String(local.nickname) : null,
        addedAt: new Date(local.addedAt || Date.now()),
        lastActiveAt: new Date(),
      };

      await db.insert(userGarage).values(newVehicle);
      merged++;

      // If this was the local active, it becomes the new active
      if (local.id === localActiveId) {
        newActiveId = vehicleId;
      }
    }

    // Fetch final merged list
    const vehicles = await db
      .select()
      .from(userGarage)
      .where(eq(userGarage.userId, session.user.id))
      .orderBy(desc(userGarage.lastActiveAt));

    // Determine final active ID
    // Priority: matched local active > first vehicle
    const activeId = newActiveId || vehicles[0]?.id || null;

    return NextResponse.json({
      vehicles,
      activeId,
      merged,
      count: vehicles.length,
      maxVehicles: MAX_VEHICLES,
    });
  } catch (error) {
    console.error("[garage/sync] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
