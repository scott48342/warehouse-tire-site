/**
 * USAF Vehicle Lookup API (Admin)
 * 
 * GET /api/admin/usaf-vehicle?action=years
 * GET /api/admin/usaf-vehicle?action=makes&year=2024
 * GET /api/admin/usaf-vehicle?action=models&year=2024&make=Ford
 * GET /api/admin/usaf-vehicle?action=options&year=2024&make=Ford&model=F-150
 * GET /api/admin/usaf-vehicle?action=compare&year=2024&make=Ford&model=F-150
 */

import { NextResponse } from "next/server";
import {
  getVehicleYears,
  getVehicleMakes,
  getVehicleModels,
  getVehicleOptions,
  getStatus,
} from "@/lib/usautoforce/client";
import { db } from "@/lib/fitment-db/db";
import { vehicleFitments } from "@/lib/fitment-db/schema";
import { eq, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Normalize tire size for comparison
function normalizeTireSize(size: string | null): string | null {
  if (!size) return null;
  let s = size.toUpperCase().trim();
  
  // Standard: "P?LT?(\d{3})/(\d{2,3})R?(\d{2})"
  const stdMatch = s.match(/^P?(LT)?(\d{3})\/(\d{2,3})R?(\d{2})/i);
  if (stdMatch) {
    const [, lt, width, aspect, rim] = stdMatch;
    return `${lt || ""}${width}/${aspect}R${rim}`.toUpperCase();
  }
  
  // Flotation: "(\d{2,3})x(\d{1,2}\.?\d*)R?(\d{2})"
  const flotMatch = s.match(/^(\d{2,3})x(\d{1,2}\.?\d*)R?(\d{2})/i);
  if (flotMatch) {
    const [, diameter, width, rim] = flotMatch;
    return `${diameter}x${width}R${rim}`.toUpperCase();
  }
  
  return s;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "status";
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  
  try {
    switch (action) {
      case "status": {
        const status = getStatus();
        return NextResponse.json({
          configured: status.configured,
          apiUrl: status.apiUrl,
          isTestMode: status.isTestMode,
        });
      }
      
      case "years": {
        const result = await getVehicleYears();
        return NextResponse.json(result);
      }
      
      case "makes": {
        if (!year) {
          return NextResponse.json({ error: "year required" }, { status: 400 });
        }
        const result = await getVehicleMakes(parseInt(year));
        return NextResponse.json(result);
      }
      
      case "models": {
        if (!year || !make) {
          return NextResponse.json({ error: "year and make required" }, { status: 400 });
        }
        const result = await getVehicleModels(parseInt(year), make);
        return NextResponse.json(result);
      }
      
      case "options": {
        if (!year || !make || !model) {
          return NextResponse.json({ error: "year, make, and model required" }, { status: 400 });
        }
        const result = await getVehicleOptions(parseInt(year), make, model);
        return NextResponse.json(result);
      }
      
      case "compare": {
        if (!year || !make || !model) {
          return NextResponse.json({ error: "year, make, and model required" }, { status: 400 });
        }
        
        // Get USAF data
        const usafResult = await getVehicleOptions(parseInt(year), make, model);
        const usafSizes = usafResult.options.map(o => normalizeTireSize(o.tireSize)).filter(Boolean) as string[];
        
        // Get WTD data - uses oemTireSizes (JSONB array) not individual columns
        const wtdFitments = await db
          .select({
            displayTrim: vehicleFitments.displayTrim,
            oemTireSizes: vehicleFitments.oemTireSizes,
          })
          .from(vehicleFitments)
          .where(
            and(
              eq(vehicleFitments.year, parseInt(year)),
              sql`LOWER(${vehicleFitments.make}) = LOWER(${make})`,
              sql`LOWER(${vehicleFitments.model}) = LOWER(${model})`
            )
          );
        
        const wtdSizes = new Set<string>();
        const trims: string[] = [];
        for (const f of wtdFitments) {
          if (f.displayTrim) trims.push(f.displayTrim);
          // oemTireSizes is a JSONB array of tire size strings: ["245/70R17", "265/70R17"]
          const tireSizes = (f.oemTireSizes as string[]) || [];
          for (const ts of tireSizes) {
            if (ts && typeof ts === "string") {
              const normalized = normalizeTireSize(ts);
              if (normalized) wtdSizes.add(normalized);
            }
          }
        }
        
        const usafSet = new Set(usafSizes);
        const common = [...wtdSizes].filter(s => usafSet.has(s));
        const wtdOnly = [...wtdSizes].filter(s => !usafSet.has(s));
        const usafOnly = [...usafSet].filter(s => !wtdSizes.has(s));
        
        return NextResponse.json({
          vehicle: { year: parseInt(year), make, model },
          wtd: {
            sizes: [...wtdSizes],
            trims: [...new Set(trims)],
            recordCount: wtdFitments.length,
          },
          usaf: {
            sizes: usafSizes,
            success: usafResult.success,
          },
          comparison: {
            match: wtdOnly.length === 0 && usafOnly.length === 0 && common.length > 0,
            common,
            wtdOnly,
            usafOnly,
          },
        });
      }
      
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("[usaf-vehicle] Error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
