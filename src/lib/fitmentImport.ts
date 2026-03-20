/**
 * Fitment Import - Fetch from Wheel-Size API and store in database
 */
import pg from "pg";
import * as wheelSizeApi from "./wheelSizeApi";
import {
  getPool,
  ensureFitmentTables,
  upsertVehicle,
  upsertVehicleFitment,
  clearVehicleWheelSpecs,
  insertVehicleWheelSpec,
  type Vehicle,
} from "./vehicleFitment";

export type ImportResult = {
  success: boolean;
  vehicle?: Vehicle;
  fitmentImported: boolean;
  wheelSpecsCount: number;
  error?: string;
  rawData?: any; // Debug: raw Wheel-Size response
};

/**
 * Import fitment data for a specific vehicle from Wheel-Size API
 */
export async function importVehicleFitment(
  year: number,
  make: string,
  model: string,
  trim?: string,
  options: { debug?: boolean } = {}
): Promise<ImportResult> {
  const db = getPool();

  try {
    // Ensure tables exist
    await ensureFitmentTables(db);

    // If no trim/modification provided, get the first available one
    let modificationSlug = trim;
    if (!modificationSlug) {
      const mods = await wheelSizeApi.getModifications(make, model, year);
      if (mods.length > 0) {
        // Prefer USDM market mods, or just use the first one
        const usdmMod = mods.find(m => m.regions?.includes("usdm"));
        modificationSlug = (usdmMod || mods[0]).slug;
        if (options.debug) {
          console.log(`[fitmentImport] Auto-selected modification: ${modificationSlug}`);
        }
      }
    }

    // Fetch from Wheel-Size API
    const wsData = await wheelSizeApi.getVehicleData(make, model, year, modificationSlug);

    if (!wsData) {
      return {
        success: false,
        fitmentImported: false,
        wheelSpecsCount: 0,
        error: `No data found for ${year} ${make} ${model}${trim ? ` ${trim}` : ""} from Wheel-Size API`,
      };
    }

    if (options.debug) {
      console.log("[fitmentImport] Raw Wheel-Size data:", JSON.stringify(wsData, null, 2));
    }

    // Step 1: Upsert vehicle
    const vehicle = await upsertVehicle(db, {
      year,
      make,
      model,
      trim: wsData.trim || trim,
      slug: wsData.slug,
    });

    // Step 2: Store technical fitment data
    let fitmentImported = false;
    if (wsData.technical) {
      const tech = wsData.technical;
      await upsertVehicleFitment(db, vehicle.id, {
        boltPattern: tech.bolt_pattern,
        centerBore: tech.centre_bore,
        studHoles: tech.stud_holes,
        pcd: tech.pcd,
        threadSize: tech.thread_size,
        fastenerType: tech.fastener_type,
        torqueNm: tech.wheel_tightening_torque,
      });
      fitmentImported = true;
    }

    // Step 3: Store wheel specs (clear existing and insert fresh)
    let wheelSpecsCount = 0;
    if (wsData.wheels && wsData.wheels.length > 0) {
      await clearVehicleWheelSpecs(db, vehicle.id);

      for (const setup of wsData.wheels) {
        // Front wheel/tire
        if (setup.front) {
          await insertVehicleWheelSpec(db, vehicle.id, {
            rimDiameter: setup.front.rim_diameter,
            rimWidth: setup.front.rim_width,
            offset: setup.front.rim_offset,
            tireSize: setup.front.tire,
            isStock: setup.is_stock,
          });
          wheelSpecsCount++;
        }

        // Rear wheel/tire (if different - staggered setup)
        if (setup.rear && !setup.showing_fp_only) {
          // Only add rear if it's actually different
          const isDifferent =
            setup.rear.rim_diameter !== setup.front.rim_diameter ||
            setup.rear.rim_width !== setup.front.rim_width ||
            setup.rear.rim_offset !== setup.front.rim_offset;

          if (isDifferent) {
            await insertVehicleWheelSpec(db, vehicle.id, {
              rimDiameter: setup.rear.rim_diameter,
              rimWidth: setup.rear.rim_width,
              offset: setup.rear.rim_offset,
              tireSize: setup.rear.tire,
              isStock: setup.is_stock,
            });
            wheelSpecsCount++;
          }
        }
      }
    }

    return {
      success: true,
      vehicle,
      fitmentImported,
      wheelSpecsCount,
      rawData: options.debug ? wsData : undefined,
    };
  } catch (err: any) {
    console.error("[fitmentImport] Error:", err);
    return {
      success: false,
      fitmentImported: false,
      wheelSpecsCount: 0,
      error: err?.message || String(err),
    };
  }
}

/**
 * Import fitment for all trims of a year/make/model
 */
export async function importAllTrims(
  year: number,
  make: string,
  model: string,
  options: { debug?: boolean } = {}
): Promise<{ results: ImportResult[]; totalWheelSpecs: number }> {
  const results: ImportResult[] = [];
  let totalWheelSpecs = 0;

  try {
    // Get all modifications (trims)
    const mods = await wheelSizeApi.getModifications(make, model, year);

    if (mods.length === 0) {
      // No specific trims, try generic import
      const result = await importVehicleFitment(year, make, model, undefined, options);
      results.push(result);
      totalWheelSpecs += result.wheelSpecsCount;
    } else {
      // Import each trim
      for (const mod of mods) {
        const result = await importVehicleFitment(year, make, model, mod.slug, options);
        results.push(result);
        totalWheelSpecs += result.wheelSpecsCount;
      }
    }
  } catch (err: any) {
    results.push({
      success: false,
      fitmentImported: false,
      wheelSpecsCount: 0,
      error: err?.message || String(err),
    });
  }

  return { results, totalWheelSpecs };
}
