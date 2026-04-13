/**
 * Vehicle Configurations API
 * 
 * Returns OEM wheel+tire configurations from the fitment_configurations table.
 * Used by the tire page to determine:
 * 1. Whether to show blocking gate vs inline switcher
 * 2. Which diameter to auto-select (is_default)
 * 3. What options to show in the switcher
 * 
 * Falls back gracefully when no configuration data exists.
 */

import { NextRequest, NextResponse } from "next/server";
import { getFitmentConfigurations } from "@/lib/fitment-db/getFitmentConfigurations";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const year = sp.get("year");
  const make = sp.get("make");
  const model = sp.get("model");
  const modification = sp.get("modification");
  const trim = sp.get("trim");

  // Validate required params
  if (!year || !make || !model) {
    return NextResponse.json(
      { error: "Missing required parameters: year, make, model" },
      { status: 400 }
    );
  }

  const yearNum = parseInt(year, 10);
  if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
    return NextResponse.json(
      { error: "Invalid year parameter" },
      { status: 400 }
    );
  }

  try {
    // Pass both modification (for DB lookup) and trim (to prioritize matching)
    const result = await getFitmentConfigurations(
      yearNum,
      make,
      model,
      modification || trim || undefined,
      trim || undefined // requestedTrim helps prioritize comma-separated trim lists
    );

    // Extract unique diameters with their default status
    const diameterOptions = result.uniqueDiameters.map(dia => {
      const config = result.configurations.find(c => c.wheelDiameter === dia);
      return {
        diameter: dia,
        isDefault: config?.isDefault ?? false,
        label: config?.configurationLabel || `${dia}" wheels`,
        tireSize: config?.tireSize || null,
      };
    });

    // Find the default diameter
    const defaultConfig = result.configurations.find(c => c.isDefault);
    const defaultDiameter = defaultConfig?.wheelDiameter ?? result.uniqueDiameters[0] ?? null;

    return NextResponse.json({
      success: true,
      source: result.source,
      confidence: result.confidence,
      usedConfigTable: result.usedConfigTable,
      hasMultipleDiameters: result.hasMultipleDiameters,
      defaultDiameter,
      diameterOptions,
      // Include full configurations for advanced use cases
      configurations: result.configurations.map(c => ({
        wheelDiameter: c.wheelDiameter,
        wheelWidth: c.wheelWidth,
        tireSize: c.tireSize,
        axlePosition: c.axlePosition,
        isDefault: c.isDefault,
        isOptional: c.isOptional,
        configurationKey: c.configurationKey,
        configurationLabel: c.configurationLabel,
      })),
    });
  } catch (err) {
    console.error("[/api/vehicles/configurations] Error:", err);
    return NextResponse.json(
      { 
        error: "Failed to fetch configurations",
        source: "none",
        confidence: "low",
        usedConfigTable: false,
        hasMultipleDiameters: false,
        defaultDiameter: null,
        diameterOptions: [],
        configurations: [],
      },
      { status: 500 }
    );
  }
}
