/**
 * Fitment Import - Fetch from Wheel-Size API and store in database
 * 
 * USAGE:
 *   await importVehicleFitment(2024, "Ford", "F-150");  // Import first US-market engine variant
 *   await importAllVehicleVariants(2024, "Ford", "F-150");  // Import all engine variants
 * 
 * NOTES:
 * - Wheel-Size API organizes by ENGINE TYPE, not trim level (XLT/Lariat/etc)
 * - Each "modification" is an engine variant (2.7 EcoBoost, 5.0 V8, etc)
 * - All engines of the same type share the same bolt pattern/center bore
 * - Wheel specs (diameters/widths/offsets) may vary by engine
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
  modificationSlug?: string;
  modificationName?: string;
  error?: string;
  rawData?: any;
};

export type BulkImportResult = {
  success: boolean;
  totalVehicles: number;
  totalWheelSpecs: number;
  results: ImportResult[];
  error?: string;
};

/**
 * Import fitment data for a specific vehicle/modification from Wheel-Size API
 * 
 * @param year - Vehicle year
 * @param make - Make name (e.g., "Ford") - will be resolved to slug
 * @param model - Model name (e.g., "F-150") - will be resolved to slug
 * @param options - Import options
 */
export async function importVehicleFitment(
  year: number,
  make: string,
  model: string,
  options: { 
    modificationSlug?: string;  // Specific modification slug to import
    usMarketOnly?: boolean;     // Only import USDM modifications (default: true)
    debug?: boolean;
  } = {}
): Promise<ImportResult> {
  const { modificationSlug, usMarketOnly = true, debug = false } = options;
  const db = getPool();

  try {
    await ensureFitmentTables(db);

    // Step 1: Resolve make slug
    console.log(`[fitmentImport] Resolving make: "${make}"`);
    const foundMake = await wheelSizeApi.findMake(make);
    if (!foundMake) {
      return {
        success: false,
        fitmentImported: false,
        wheelSpecsCount: 0,
        error: `Make "${make}" not found in Wheel-Size API`,
      };
    }
    const makeSlug = foundMake.slug;
    console.log(`[fitmentImport] Make resolved: ${make} -> ${makeSlug}`);

    // Step 2: Resolve model slug
    console.log(`[fitmentImport] Resolving model: "${model}"`);
    const foundModel = await wheelSizeApi.findModel(makeSlug, model);
    if (!foundModel) {
      return {
        success: false,
        fitmentImported: false,
        wheelSpecsCount: 0,
        error: `Model "${model}" not found for make "${make}"`,
      };
    }
    const modelSlug = foundModel.slug;
    console.log(`[fitmentImport] Model resolved: ${model} -> ${modelSlug}`);

    // Step 3: Get modification slug if not provided
    let selectedModSlug = modificationSlug;
    let selectedModName: string | undefined;

    if (!selectedModSlug) {
      console.log(`[fitmentImport] Fetching modifications for ${year} ${makeSlug} ${modelSlug}`);
      let mods = await wheelSizeApi.getModifications(makeSlug, modelSlug, year);
      
      if (mods.length === 0) {
        return {
          success: false,
          fitmentImported: false,
          wheelSpecsCount: 0,
          error: `No modifications found for ${year} ${make} ${model}`,
        };
      }

      // Filter to US market if requested
      if (usMarketOnly) {
        const usdmMods = mods.filter(m => m.regions?.includes("usdm"));
        if (usdmMods.length > 0) {
          mods = usdmMods;
          console.log(`[fitmentImport] Filtered to ${mods.length} USDM modifications`);
        } else {
          console.log(`[fitmentImport] No USDM mods found, using all ${mods.length} modifications`);
        }
      }

      // Select first modification
      selectedModSlug = mods[0].slug;
      selectedModName = mods[0].name;
      console.log(`[fitmentImport] Selected modification: ${selectedModSlug} (${selectedModName})`);
    }

    // Step 4: Fetch vehicle data with modification
    console.log(`[fitmentImport] Fetching vehicle data for modification: ${selectedModSlug}`);
    const wsData = await wheelSizeApi.getVehicleData(makeSlug, modelSlug, year, selectedModSlug);

    if (!wsData) {
      return {
        success: false,
        fitmentImported: false,
        wheelSpecsCount: 0,
        modificationSlug: selectedModSlug,
        error: `No vehicle data returned for modification ${selectedModSlug}`,
      };
    }

    if (debug) {
      console.log("[fitmentImport] Raw Wheel-Size data:", JSON.stringify(wsData, null, 2));
    }

    // Step 5: Upsert vehicle record
    const vehicle = await upsertVehicle(db, {
      year,
      make: foundMake.name,  // Use canonical name from API
      model: foundModel.name,  // Use canonical name from API
      trim: wsData.trim || wsData.name,
      slug: wsData.slug,
    });
    console.log(`[fitmentImport] Vehicle upserted: id=${vehicle.id}`);

    // Step 6: Store technical fitment data
    let fitmentImported = false;
    if (wsData.technical) {
      const tech = wsData.technical;

      // Parse centre_bore (can be string or number)
      const centerBore = typeof tech.centre_bore === "string" 
        ? parseFloat(tech.centre_bore) 
        : tech.centre_bore;

      // Parse torque value (can be "204 Nm" string)
      let torqueNm: number | undefined;
      if (tech.wheel_tightening_torque) {
        const torqueMatch = String(tech.wheel_tightening_torque).match(/^(\d+)/);
        torqueNm = torqueMatch ? parseInt(torqueMatch[1], 10) : undefined;
      }

      // Thread size is nested in wheel_fasteners
      const threadSize = tech.wheel_fasteners?.thread_size;
      const fastenerType = tech.wheel_fasteners?.type;

      await upsertVehicleFitment(db, vehicle.id, {
        boltPattern: tech.bolt_pattern,
        centerBore,
        studHoles: tech.stud_holes,
        pcd: tech.pcd,
        threadSize,
        fastenerType,
        torqueNm,
      });
      fitmentImported = true;
      console.log(`[fitmentImport] Fitment stored: ${tech.bolt_pattern}, CB ${centerBore}mm`);
    }

    // Step 7: Store wheel specs
    let wheelSpecsCount = 0;
    if (wsData.wheels && wsData.wheels.length > 0) {
      await clearVehicleWheelSpecs(db, vehicle.id);

      for (const setup of wsData.wheels) {
        // Front wheel/tire
        if (setup.front && setup.front.rim_diameter) {
          await insertVehicleWheelSpec(db, vehicle.id, {
            rimDiameter: setup.front.rim_diameter,
            rimWidth: setup.front.rim_width,
            offset: setup.front.rim_offset,
            tireSize: setup.front.tire,
            isStock: setup.is_stock,
          });
          wheelSpecsCount++;
        }

        // Rear wheel/tire (only if staggered - different from front)
        if (setup.rear && !setup.showing_fp_only && 
            setup.rear.rim_diameter && setup.rear.rim_width) {
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
      console.log(`[fitmentImport] Stored ${wheelSpecsCount} wheel specs`);
    }

    return {
      success: true,
      vehicle,
      fitmentImported,
      wheelSpecsCount,
      modificationSlug: selectedModSlug,
      modificationName: selectedModName || wsData.name,
      rawData: debug ? wsData : undefined,
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
 * Import ALL engine variants for a year/make/model
 * Creates separate vehicle records for each engine variant
 */
export async function importAllVehicleVariants(
  year: number,
  make: string,
  model: string,
  options: { 
    usMarketOnly?: boolean;
    debug?: boolean;
  } = {}
): Promise<BulkImportResult> {
  const { usMarketOnly = true, debug = false } = options;
  const results: ImportResult[] = [];

  try {
    // Resolve slugs
    const foundMake = await wheelSizeApi.findMake(make);
    if (!foundMake) {
      return {
        success: false,
        totalVehicles: 0,
        totalWheelSpecs: 0,
        results: [],
        error: `Make "${make}" not found`,
      };
    }

    const foundModel = await wheelSizeApi.findModel(foundMake.slug, model);
    if (!foundModel) {
      return {
        success: false,
        totalVehicles: 0,
        totalWheelSpecs: 0,
        results: [],
        error: `Model "${model}" not found for make "${make}"`,
      };
    }

    // Get all modifications
    let mods = await wheelSizeApi.getModifications(foundMake.slug, foundModel.slug, year);
    
    if (usMarketOnly) {
      const usdmMods = mods.filter(m => m.regions?.includes("usdm"));
      if (usdmMods.length > 0) {
        mods = usdmMods;
      }
    }

    if (mods.length === 0) {
      return {
        success: false,
        totalVehicles: 0,
        totalWheelSpecs: 0,
        results: [],
        error: `No modifications found for ${year} ${make} ${model}`,
      };
    }

    console.log(`[fitmentImport] Importing ${mods.length} variants for ${year} ${make} ${model}`);

    // Import each modification
    for (const mod of mods) {
      console.log(`[fitmentImport] Importing variant: ${mod.name} (${mod.slug})`);
      const result = await importVehicleFitment(year, make, model, {
        modificationSlug: mod.slug,
        usMarketOnly: false,  // Already filtered
        debug,
      });
      results.push(result);
    }

    const totalVehicles = results.filter(r => r.success).length;
    const totalWheelSpecs = results.reduce((sum, r) => sum + r.wheelSpecsCount, 0);

    return {
      success: totalVehicles > 0,
      totalVehicles,
      totalWheelSpecs,
      results,
    };
  } catch (err: any) {
    console.error("[fitmentImport] Bulk import error:", err);
    return {
      success: false,
      totalVehicles: 0,
      totalWheelSpecs: 0,
      results,
      error: err?.message || String(err),
    };
  }
}

/**
 * List available modifications for a vehicle (for UI selection)
 */
export async function listAvailableModifications(
  year: number,
  make: string,
  model: string,
  options: { usMarketOnly?: boolean } = {}
): Promise<{
  success: boolean;
  makeSlug?: string;
  modelSlug?: string;
  modifications: Array<{
    slug: string;
    name: string;
    engine?: string;
    regions: string[];
  }>;
  error?: string;
}> {
  try {
    const foundMake = await wheelSizeApi.findMake(make);
    if (!foundMake) {
      return { success: false, modifications: [], error: `Make "${make}" not found` };
    }

    const foundModel = await wheelSizeApi.findModel(foundMake.slug, model);
    if (!foundModel) {
      return { success: false, modifications: [], error: `Model "${model}" not found` };
    }

    let mods = await wheelSizeApi.getModifications(foundMake.slug, foundModel.slug, year);
    
    if (options.usMarketOnly) {
      mods = mods.filter(m => m.regions?.includes("usdm"));
    }

    return {
      success: true,
      makeSlug: foundMake.slug,
      modelSlug: foundModel.slug,
      modifications: mods.map(m => ({
        slug: m.slug,
        name: m.name,
        engine: m.engine ? `${m.engine.capacity}L ${m.engine.type} ${m.engine.fuel}` : undefined,
        regions: m.regions || [],
      })),
    };
  } catch (err: any) {
    return {
      success: false,
      modifications: [],
      error: err?.message || String(err),
    };
  }
}
