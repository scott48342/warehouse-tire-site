import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { vehicleFitments } from "@/lib/fitment-db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import {
  checkBatchJobAllowed,
  startBatchJob,
  endBatchJob,
  getUsageStats,
} from "@/lib/wheelSizeGuard";
import { isWheelSizeEnabled } from "@/lib/wheelSizeApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/admin/fitment/refresh-trims
 * 
 * ⚠️ PROTECTED by Wheel-Size API guardrails
 * Requires: { confirm: true, allowBatch: true }
 * 
 * Safely refresh displayTrim for vehicles that show "Base" by fetching
 * fresh trim_levels from Wheel-Size API.
 * 
 * SAFE: Only updates displayTrim and rawTrim fields - does NOT touch:
 * - boltPattern
 * - centerBoreMm
 * - threadSize
 * - seatType
 * - oemWheelSizes
 * - oemTireSizes
 * - offset ranges
 * 
 * Body params:
 * - dryRun: boolean (default: true) - simulate without saving
 * - limit: number (default: 20) - max vehicles to process
 * - skipIfHasData: boolean (default: true) - skip if displayTrim isn't "Base"
 * - confirm: boolean (REQUIRED) - acknowledge ToS warning
 * - allowBatch: boolean (REQUIRED) - enable batch mode
 */
export async function POST(req: Request) {
  // ═══════════════════════════════════════════════════════════════════════════
  // KILL SWITCH - Block ALL Wheel-Size API calls when disabled
  // ═══════════════════════════════════════════════════════════════════════════
  if (!isWheelSizeEnabled()) {
    console.warn("[refresh-trims] Wheel-Size API DISABLED - blocking request");
    return NextResponse.json({
      error: "Wheel-Size API is temporarily disabled",
      disabled: true,
    }, { status: 503 });
  }

  const t0 = Date.now();
  
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // No body is fine
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // GUARDRAIL CHECK - this endpoint makes batch Wheel-Size API calls
  // ═══════════════════════════════════════════════════════════════════════════
  const batchCheck = checkBatchJobAllowed({
    action: "refresh-trims",
    confirm: body.confirm,
    allowBatch: body.allowBatch,
    adminId: body.adminId || "anonymous",
  });
  
  if (!batchCheck.allowed) {
    return NextResponse.json({
      error: batchCheck.error,
      warning: batchCheck.warning,
      requiresConfirmation: batchCheck.requiresConfirmation,
      usage: getUsageStats(),
      hint: batchCheck.requiresConfirmation 
        ? 'Add { "confirm": true, "allowBatch": true } to your request body'
        : undefined,
    }, { status: batchCheck.requiresConfirmation ? 400 : 429 });
  }
  
  startBatchJob(body.adminId || "anonymous");
  // ═══════════════════════════════════════════════════════════════════════════
  
  const dryRun = body.dryRun !== false; // Default to dry run for safety
  const limit = Math.min(100, Math.max(1, body.limit || 20));
  const skipIfHasData = body.skipIfHasData !== false;
  
  const results: any[] = [];
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  try {
    // Find vehicles with displayTrim = "Base" or empty
    const candidates = await db.query.vehicleFitments.findMany({
      where: or(
        eq(vehicleFitments.displayTrim, "Base"),
        eq(vehicleFitments.displayTrim, ""),
        isNull(vehicleFitments.displayTrim)
      ),
      limit: limit,
      orderBy: (vf, { desc }) => [desc(vf.createdAt)],
    });
    
    console.log(`[refresh-trims] Found ${candidates.length} candidates with displayTrim="Base"`);
    
    const apiKey = process.env.WHEELSIZE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        ok: false,
        error: "Missing WHEELSIZE_API_KEY",
        dryRun,
      }, { status: 500 });
    }
    
    for (const vehicle of candidates) {
      const vehicleKey = `${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.modificationId})`;
      
      try {
        // Fetch fresh data from Wheel-Size
        const modsUrl = new URL("https://api.wheel-size.com/v2/modifications/");
        modsUrl.searchParams.set("user_key", apiKey);
        modsUrl.searchParams.set("make", vehicle.make);
        modsUrl.searchParams.set("model", vehicle.model);
        modsUrl.searchParams.set("year", String(vehicle.year));
        
        const modsRes = await fetch(modsUrl.toString());
        if (!modsRes.ok) {
          results.push({ vehicle: vehicleKey, status: "api_error", error: `HTTP ${modsRes.status}` });
          errors++;
          continue;
        }
        
        const modsData = await modsRes.json();
        const modifications = modsData.data || [];
        
        // Find the matching modification
        const mod = modifications.find((m: any) => 
          m.slug === vehicle.modificationId || 
          m.slug?.toLowerCase() === vehicle.modificationId?.toLowerCase()
        );
        
        if (!mod) {
          results.push({ vehicle: vehicleKey, status: "mod_not_found", modsAvailable: modifications.length });
          skipped++;
          continue;
        }
        
        const trimLevels = (mod.trim_levels || []).filter((t: string) => t && t.trim());
        
        if (trimLevels.length === 0) {
          results.push({ 
            vehicle: vehicleKey, 
            status: "no_trim_levels", 
            modTrim: mod.trim,
            modName: mod.name,
          });
          skipped++;
          continue;
        }
        
        const newDisplayTrim = trimLevels[0];
        const newRawTrim = trimLevels.join("; ");
        
        results.push({
          vehicle: vehicleKey,
          status: dryRun ? "would_update" : "updated",
          oldDisplayTrim: vehicle.displayTrim,
          newDisplayTrim,
          oldRawTrim: vehicle.rawTrim,
          newRawTrim,
          allTrimLevels: trimLevels,
        });
        
        if (!dryRun) {
          // SAFE UPDATE: Only touch displayTrim and rawTrim
          await db.update(vehicleFitments)
            .set({
              displayTrim: newDisplayTrim,
              rawTrim: newRawTrim,
              updatedAt: new Date(),
            })
            .where(eq(vehicleFitments.id, vehicle.id));
        }
        
        updated++;
        
        // Rate limiting
        await new Promise(r => setTimeout(r, 200));
        
      } catch (err: any) {
        results.push({ vehicle: vehicleKey, status: "error", error: err?.message });
        errors++;
      }
    }
    
    endBatchJob(true);
    
    return NextResponse.json({
      ok: true,
      dryRun,
      summary: {
        candidates: candidates.length,
        updated,
        skipped,
        errors,
      },
      results,
      timing: { totalMs: Date.now() - t0 },
    });
    
  } catch (err: any) {
    endBatchJob(false);
    console.error("[refresh-trims] Error:", err);
    return NextResponse.json({
      ok: false,
      error: err?.message || String(err),
      dryRun,
      timing: { totalMs: Date.now() - t0 },
    }, { status: 500 });
  }
}

/**
 * GET - Show current status of "Base" trim vehicles
 */
export async function GET(req: Request) {
  try {
    const baseCount = await db.query.vehicleFitments.findMany({
      where: or(
        eq(vehicleFitments.displayTrim, "Base"),
        eq(vehicleFitments.displayTrim, ""),
        isNull(vehicleFitments.displayTrim)
      ),
      columns: {
        id: true,
        year: true,
        make: true,
        model: true,
        modificationId: true,
        displayTrim: true,
        rawTrim: true,
      },
      limit: 50,
      orderBy: (vf, { desc }) => [desc(vf.createdAt)],
    });
    
    return NextResponse.json({
      ok: true,
      count: baseCount.length,
      note: "Vehicles with displayTrim='Base' (first 50)",
      vehicles: baseCount,
      usage: {
        dryRun: "POST with { dryRun: true } to preview changes",
        apply: "POST with { dryRun: false } to apply changes",
        limit: "POST with { limit: 50 } to process more",
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message || String(err),
    }, { status: 500 });
  }
}
