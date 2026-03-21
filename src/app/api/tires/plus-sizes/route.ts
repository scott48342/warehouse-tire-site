import { NextResponse } from "next/server";
import {
  generatePlusSizeCandidates,
  generatePlusSizeCandidatesMulti,
  getTireDatabaseStats,
  type PlusSizeCandidate,
} from "@/lib/tirePlusSizing";

export const runtime = "nodejs";

/**
 * GET /api/tires/plus-sizes
 * 
 * Generate plus-size tire candidates based on OEM size and target wheel diameter.
 * 
 * Query params:
 *   oemSize - OEM tire size (e.g., "225/65R17") - required
 *   oemSizes - Multiple OEM sizes (comma-separated, for staggered) - alternative to oemSize
 *   wheelDiameter - Target wheel rim diameter (e.g., "20") - required
 *   wheelWidth - Wheel width in inches (optional, for width filtering)
 *   maxOdDiff - Max OD difference % (default: 3)
 *   primaryOdDiff - Primary OD difference % (default: 2)
 *   debug - Include debug info (optional)
 * 
 * Response:
 *   {
 *     oemSize: string,
 *     oemOverallDiameter: number,
 *     targetRimDiameter: number,
 *     candidates: PlusSizeCandidate[],  // All within tolerance
 *     primarySizes: string[],           // ±2% OD (recommended)
 *     acceptableSizes: string[],        // ±3% OD (acceptable)
 *     debug?: { ... }
 *   }
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  
  // Parse params
  const oemSizeParam = url.searchParams.get("oemSize");
  const oemSizesParam = url.searchParams.get("oemSizes");
  const wheelDiameterParam = url.searchParams.get("wheelDiameter");
  const wheelWidthParam = url.searchParams.get("wheelWidth");
  const maxOdDiffParam = url.searchParams.get("maxOdDiff");
  const primaryOdDiffParam = url.searchParams.get("primaryOdDiff");
  const debugParam = url.searchParams.get("debug");

  // Validate required params
  if (!wheelDiameterParam) {
    return NextResponse.json(
      { error: "Missing required param: wheelDiameter" },
      { status: 400 }
    );
  }

  const wheelDiameter = parseInt(wheelDiameterParam, 10);
  if (!Number.isFinite(wheelDiameter) || wheelDiameter <= 0) {
    return NextResponse.json(
      { error: "Invalid wheelDiameter - must be a positive integer" },
      { status: 400 }
    );
  }

  // Handle multiple OEM sizes (staggered) or single
  const oemSizes: string[] = oemSizesParam
    ? oemSizesParam.split(",").map((s) => s.trim()).filter(Boolean)
    : oemSizeParam
      ? [oemSizeParam.trim()]
      : [];

  if (oemSizes.length === 0) {
    return NextResponse.json(
      { error: "Missing required param: oemSize or oemSizes" },
      { status: 400 }
    );
  }

  // Parse optional params
  const wheelWidth = wheelWidthParam ? parseFloat(wheelWidthParam) : undefined;
  const maxOdDiffPercent = maxOdDiffParam ? parseFloat(maxOdDiffParam) : 3;
  const primaryOdDiffPercent = primaryOdDiffParam ? parseFloat(primaryOdDiffParam) : 2;
  const includeDebug = debugParam === "1" || debugParam === "true";

  // Options
  const options = {
    wheelWidth: wheelWidth && Number.isFinite(wheelWidth) ? wheelWidth : undefined,
    maxOdDiffPercent,
    primaryOdDiffPercent,
  };

  // Generate candidates
  if (oemSizes.length === 1) {
    // Single OEM size
    const result = generatePlusSizeCandidates(oemSizes[0], wheelDiameter, options);

    return NextResponse.json({
      oemSize: result.oemSize,
      oemOverallDiameter: result.oemOverallDiameter,
      targetRimDiameter: result.targetRimDiameter,
      candidates: result.acceptableCandidates,
      primarySizes: result.primaryCandidates.map((c) => c.size),
      acceptableSizes: result.acceptableCandidates.map((c) => c.size),
      ...(includeDebug && {
        debug: {
          ...result.debug,
          oemParsed: result.oemParsed,
          dbStats: getTireDatabaseStats(),
        },
      }),
    });
  } else {
    // Multiple OEM sizes (staggered) - find intersection
    const candidates = generatePlusSizeCandidatesMulti(oemSizes, wheelDiameter, options);

    // Also get individual results for debug
    const individualResults = oemSizes.map((size) =>
      generatePlusSizeCandidates(size, wheelDiameter, options)
    );

    // Calculate representative OEM OD (average)
    const oemOds = individualResults
      .map((r) => r.oemOverallDiameter)
      .filter((od): od is number => od !== null);
    const avgOemOd = oemOds.length > 0
      ? Math.round((oemOds.reduce((a, b) => a + b, 0) / oemOds.length) * 100) / 100
      : null;

    const primarySizes = candidates.filter((c) => c.isPrimary).map((c) => c.size);
    const acceptableSizes = candidates.map((c) => c.size);

    return NextResponse.json({
      oemSizes,
      oemOverallDiameter: avgOemOd,
      targetRimDiameter: wheelDiameter,
      candidates,
      primarySizes,
      acceptableSizes,
      ...(includeDebug && {
        debug: {
          individualResults: individualResults.map((r) => ({
            oemSize: r.oemSize,
            oemOd: r.oemOverallDiameter,
            sizesMatchingRim: r.debug?.sizesMatchingRim,
            sizesWithin3Percent: r.debug?.sizesWithin3Percent,
          })),
          dbStats: getTireDatabaseStats(),
        },
      }),
    });
  }
}
