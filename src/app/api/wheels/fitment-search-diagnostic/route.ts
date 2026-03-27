import { NextResponse } from "next/server";
import {
  getTechfeedCandidatesByBoltPattern,
  getTechfeedIndexBuiltAt,
} from "@/lib/techfeed/wheels";
import {
  getFitmentProfile,
  type FitmentProfile as DBFitmentProfile,
} from "@/lib/fitment-db/profileService";
import {
  buildFitmentEnvelope,
  validateWheel,
  autoDetectFitmentMode,
  type FitmentMode,
  type WheelSpec,
  type OEMSpecs,
  EXPANSION_PRESETS,
} from "@/lib/aftermarketFitment";
import { getSupplierCredentials } from "@/lib/supplierCredentialsSecure";
import {
  fetchAvailability,
  getCachedBulk,
} from "@/lib/availabilityCache";

export const runtime = "nodejs";
export const maxDuration = 120; // Allow longer for full diagnostic

/**
 * Diagnostic endpoint for wheel search pipeline analysis.
 * 
 * Shows exact counts at every stage:
 * 1. Raw DB candidates (by bolt pattern)
 * 2. After basic filters (price, discontinued)
 * 3. After fitment validation
 * 4. After availability validation
 * 5. Final page slice
 * 
 * Plus unique brand counts at each stage.
 * 
 * Query params:
 * - year, make, model (required)
 * - variant: "baseline" | "no_early_stop" | "skip_availability" | "relaxed_fitment"
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  const variant = url.searchParams.get("variant") || "baseline";
  const pageSize = Number(url.searchParams.get("pageSize") || "24") || 24;

  if (!year || !make || !model) {
    return NextResponse.json(
      { error: "Missing required params: year, make, model" },
      { status: 400 }
    );
  }

  const t0 = Date.now();
  const stages: Record<string, any> = {};

  try {
    // =========================================================================
    // STEP 1: Get fitment profile from DB
    // =========================================================================
    const modificationId = url.searchParams.get("modification") || url.searchParams.get("trim") || "";
    const profileResult = await getFitmentProfile(Number(year), make, model, modificationId);
    const dbProfile = profileResult?.profile;

    if (!dbProfile || !dbProfile.boltPattern) {
      return NextResponse.json({
        error: "Could not resolve fitment profile",
        vehicle: { year, make, model },
      });
    }

    stages.profile = {
      boltPattern: dbProfile.boltPattern,
      centerBoreMm: dbProfile.centerBoreMm,
      oemWheelSizes: dbProfile.oemWheelSizes?.length || 0,
      displayTrim: dbProfile.displayTrim,
    };

    // =========================================================================
    // STEP 2: Build fitment envelope
    // =========================================================================
    const wheelSpecs = (dbProfile.oemWheelSizes || []).map((ws: any) => ({
      rimDiameter: Number(ws.diameter),
      rimWidth: Number(ws.width),
      offset: ws.offset != null ? Number(ws.offset) : null,
    }));

    const oem: OEMSpecs = {
      boltPattern: dbProfile.boltPattern,
      centerBore: Number(dbProfile.centerBoreMm || 0) || 0,
      wheelSpecs,
    };

    // Detect mode
    const oemDiameters = wheelSpecs.map((s) => s.rimDiameter).filter((d) => d > 0);
    const oemWidths = wheelSpecs.map((s) => s.rimWidth).filter((w) => w > 0);
    const oemMinDiameter = oemDiameters.length ? Math.min(...oemDiameters) : 15;
    const oemMaxWidth = oemWidths.length ? Math.max(...oemWidths) : 10;

    const autoResult = autoDetectFitmentMode(model, {
      boltPattern: dbProfile.boltPattern || undefined,
      minDiameter: oemMinDiameter,
      maxWidth: oemMaxWidth,
    });

    let mode: FitmentMode = autoResult.recommendedMode;

    // For relaxed_fitment variant, use truck mode (most permissive)
    if (variant === "relaxed_fitment") {
      mode = "truck";
    }

    const envelope = buildFitmentEnvelope(oem, mode);

    stages.envelope = {
      mode,
      vehicleType: autoResult.vehicleType,
      boltPattern: envelope.boltPattern,
      centerBore: envelope.centerBore,
      oem: {
        diameter: [envelope.oemMinDiameter, envelope.oemMaxDiameter],
        width: [envelope.oemMinWidth, envelope.oemMaxWidth],
        offset: [envelope.oemMinOffset, envelope.oemMaxOffset],
      },
      allowed: {
        diameter: [envelope.allowedMinDiameter, envelope.allowedMaxDiameter],
        width: [envelope.allowedMinWidth, envelope.allowedMaxWidth],
        offset: [envelope.allowedMinOffset, envelope.allowedMaxOffset],
      },
    };

    // =========================================================================
    // STAGE 1: Raw DB candidates by bolt pattern
    // =========================================================================
    const tCandidates0 = Date.now();
    const rawCandidates = await getTechfeedCandidatesByBoltPattern(dbProfile.boltPattern);
    const candidatesMs = Date.now() - tCandidates0;

    const rawBrands = new Set(rawCandidates.map((c) => c.brand_cd).filter(Boolean));

    stages.stage1_raw_candidates = {
      count: rawCandidates.length,
      uniqueBrands: rawBrands.size,
      brands: Array.from(rawBrands).sort(),
      ms: candidatesMs,
    };

    // =========================================================================
    // STAGE 2: After basic DB-level filters (price, discontinued)
    // =========================================================================
    const afterBasicFilter = rawCandidates.filter((c) => {
      // valid pricing fields (required)
      const p = Number(c.map_price || c.msrp || 0) || 0;
      if (p <= 0) return false;

      // best-effort: skip obviously discontinued items
      const desc = (c.product_desc || "").toLowerCase();
      if (desc.includes("discontinued")) return false;

      return true;
    });

    const basicFilterBrands = new Set(afterBasicFilter.map((c) => c.brand_cd).filter(Boolean));

    stages.stage2_after_basic_filter = {
      count: afterBasicFilter.length,
      uniqueBrands: basicFilterBrands.size,
      brands: Array.from(basicFilterBrands).sort(),
      droppedCount: rawCandidates.length - afterBasicFilter.length,
      droppedReasons: {
        noPrice: rawCandidates.filter((c) => (Number(c.map_price || c.msrp || 0) || 0) <= 0).length,
        discontinued: rawCandidates.filter((c) => (c.product_desc || "").toLowerCase().includes("discontinued")).length,
      },
    };

    // =========================================================================
    // STAGE 3: After fitment validation
    // =========================================================================
    type FitmentResult = {
      candidate: typeof afterBasicFilter[0];
      fitmentClass: string;
      excluded: boolean;
      exclusionReasons: string[];
    };

    const fitmentResults: FitmentResult[] = [];
    const fitmentExclusionStats: Record<string, number> = {};

    for (const c of afterBasicFilter) {
      const wheelSpec: WheelSpec = {
        sku: c.sku,
        boltPattern: c.bolt_pattern_metric || c.bolt_pattern_standard || envelope.boltPattern,
        centerBore: c.centerbore != null ? Number(c.centerbore) : undefined,
        diameter: c.diameter != null ? Number(c.diameter) : undefined,
        width: c.width != null ? Number(c.width) : undefined,
        offset: c.offset != null ? Number(c.offset) : undefined,
      };

      const v = validateWheel(wheelSpec, envelope);

      // Check if excluded by fitmentClass
      let excluded = v.fitmentClass === "excluded";
      let reasons = [...v.exclusionReasons];

      // Additional diameter exclusion (hard filter in production code)
      if (!excluded && wheelSpec.diameter !== undefined) {
        const wheelDia = Number(wheelSpec.diameter);
        if (wheelDia < envelope.allowedMinDiameter || wheelDia > envelope.allowedMaxDiameter) {
          excluded = true;
          reasons.push(`diameter ${wheelDia} outside allowed range [${envelope.allowedMinDiameter}, ${envelope.allowedMaxDiameter}]`);
        }
      }

      fitmentResults.push({
        candidate: c,
        fitmentClass: v.fitmentClass,
        excluded,
        exclusionReasons: reasons,
      });

      if (excluded) {
        for (const r of reasons) {
          const key = r.split(":")[0] || r.split(" ")[0] || "unknown";
          fitmentExclusionStats[key] = (fitmentExclusionStats[key] || 0) + 1;
        }
      }
    }

    const fitmentValid = fitmentResults.filter((r) => !r.excluded);
    const fitmentValidBrands = new Set(fitmentValid.map((r) => r.candidate.brand_cd).filter(Boolean));

    // Classification breakdown
    const fitmentClassCounts: Record<string, number> = {};
    for (const r of fitmentValid) {
      fitmentClassCounts[r.fitmentClass] = (fitmentClassCounts[r.fitmentClass] || 0) + 1;
    }

    stages.stage3_after_fitment = {
      count: fitmentValid.length,
      uniqueBrands: fitmentValidBrands.size,
      brands: Array.from(fitmentValidBrands).sort(),
      droppedCount: afterBasicFilter.length - fitmentValid.length,
      fitmentClassBreakdown: fitmentClassCounts,
      exclusionReasonBreakdown: fitmentExclusionStats,
    };

    // =========================================================================
    // STAGE 4: After availability validation
    // =========================================================================
    const wheelProsBase = process.env.WHEELPROS_WRAPPER_URL || process.env.NEXT_PUBLIC_WHEELPROS_API_BASE_URL;
    const wpCreds = await getSupplierCredentials("wheelpros");
    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.WHEELPROS_WRAPPER_API_KEY) {
      headers["x-api-key"] = process.env.WHEELPROS_WRAPPER_API_KEY;
    }

    const minQty = 4;

    // For skip_availability variant, skip this step entirely
    let eligibleItems: typeof fitmentValid = [];
    let availabilityStats = {
      checked: 0,
      cacheHits: 0,
      liveChecks: 0,
      available: 0,
      unavailable: 0,
      timedOut: 0,
      errors: 0,
    };

    if (variant === "skip_availability") {
      // Treat all fitment-valid as eligible
      eligibleItems = fitmentValid;
      availabilityStats.checked = fitmentValid.length;
      availabilityStats.available = fitmentValid.length;
    } else {
      // Normal or no_early_stop variant
      const CONCURRENCY = 16;
      const timeBudgetMs = variant === "no_early_stop" ? 120000 : 8000; // 2 min for full scan
      const scanCap = variant === "no_early_stop" ? 999999 : 6000;

      // Bulk cache check
      const allSkus = fitmentValid.map((r) => r.candidate.sku);
      const cachedAvailability = await getCachedBulk(allSkus, minQty);

      const needsLiveCheck: typeof fitmentValid = [];

      for (const item of fitmentValid) {
        const cached = cachedAvailability.get(item.candidate.sku);
        if (cached) {
          availabilityStats.checked++;
          availabilityStats.cacheHits++;
          if (cached.ok) {
            eligibleItems.push(item);
            availabilityStats.available++;
          } else {
            availabilityStats.unavailable++;
          }
        } else {
          needsLiveCheck.push(item);
        }
      }

      // Live checks with concurrency
      const tAvail0 = Date.now();
      const inFlight = new Set<Promise<void>>();
      let stopped = false;

      const checkOne = async (item: typeof fitmentValid[0]) => {
        try {
          const avail = await fetchAvailability({
            sku: item.candidate.sku,
            minQty,
            wheelProsBase: wheelProsBase!,
            headers,
            customerNumber: wpCreds.customerNumber || undefined,
            companyCode: wpCreds.companyCode || undefined,
          });
          availabilityStats.checked++;
          availabilityStats.liveChecks++;

          if ((avail as any).timedOut) {
            availabilityStats.timedOut++;
          } else if (avail.ok) {
            eligibleItems.push(item);
            availabilityStats.available++;
          } else {
            availabilityStats.unavailable++;
          }
        } catch (e) {
          availabilityStats.errors++;
        }
      };

      let scanned = 0;
      for (const item of needsLiveCheck) {
        if (stopped) break;
        scanned++;

        if (scanned > scanCap) {
          stopped = true;
          break;
        }

        if (Date.now() - tAvail0 > timeBudgetMs) {
          stopped = true;
          break;
        }

        while (inFlight.size >= CONCURRENCY) {
          await Promise.race(inFlight);
        }

        const p = checkOne(item).finally(() => inFlight.delete(p));
        inFlight.add(p);
      }

      // Wait for remaining
      if (inFlight.size > 0) {
        const deadline = Date.now() + 5000;
        while (inFlight.size > 0 && Date.now() < deadline) {
          await Promise.race([...inFlight, new Promise((r) => setTimeout(r, 100))]);
        }
      }

      availabilityStats = {
        ...availabilityStats,
        checked: availabilityStats.checked,
      };
    }

    const eligibleBrands = new Set(eligibleItems.map((r) => r.candidate.brand_cd).filter(Boolean));

    stages.stage4_after_availability = {
      count: eligibleItems.length,
      uniqueBrands: eligibleBrands.size,
      brands: Array.from(eligibleBrands).sort(),
      droppedCount: fitmentValid.length - eligibleItems.length,
      stats: availabilityStats,
    };

    // =========================================================================
    // STAGE 5: Final page slice
    // =========================================================================
    const pageItems = eligibleItems.slice(0, pageSize);
    const pageBrands = new Set(pageItems.map((r) => r.candidate.brand_cd).filter(Boolean));

    stages.stage5_page_slice = {
      count: pageItems.length,
      uniqueBrands: pageBrands.size,
      brands: Array.from(pageBrands).sort(),
      pageSize,
      totalEligible: eligibleItems.length,
    };

    // =========================================================================
    // SUMMARY
    // =========================================================================
    const totalMs = Date.now() - t0;

    return NextResponse.json({
      vehicle: { year, make, model },
      variant,
      stages,
      summary: {
        stage1_raw: stages.stage1_raw_candidates.count,
        stage2_basicFilter: stages.stage2_after_basic_filter.count,
        stage3_fitment: stages.stage3_after_fitment.count,
        stage4_availability: stages.stage4_after_availability.count,
        stage5_page: stages.stage5_page_slice.count,
        biggestDropStage: findBiggestDrop(stages),
        dropPercentages: {
          basicFilter: pct(stages.stage1_raw_candidates.count, stages.stage2_after_basic_filter.count),
          fitment: pct(stages.stage2_after_basic_filter.count, stages.stage3_after_fitment.count),
          availability: pct(stages.stage3_after_fitment.count, stages.stage4_after_availability.count),
        },
      },
      totalMs,
      indexBuiltAt: await getTechfeedIndexBuiltAt(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

function pct(before: number, after: number): string {
  if (before === 0) return "N/A";
  const dropped = before - after;
  return `-${((dropped / before) * 100).toFixed(1)}%`;
}

function findBiggestDrop(stages: Record<string, any>): string {
  const drops = [
    { stage: "basicFilter", drop: stages.stage1_raw_candidates.count - stages.stage2_after_basic_filter.count },
    { stage: "fitment", drop: stages.stage2_after_basic_filter.count - stages.stage3_after_fitment.count },
    { stage: "availability", drop: stages.stage3_after_fitment.count - stages.stage4_after_availability.count },
  ];
  drops.sort((a, b) => b.drop - a.drop);
  return drops[0]?.stage || "none";
}
