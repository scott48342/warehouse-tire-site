/**
 * Fitment Geometry Audit
 *
 * Reports vehicles where wheel recommendations may have geometry issues:
 * - Missing OEM offset data (offset_min_mm / offset_max_mm are null)
 * - Vehicles where OEM offset midpoint looks suspicious (range too wide)
 * - Summary counts by make
 *
 * GET /api/admin/fitment-geometry-audit
 * GET /api/admin/fitment-geometry-audit?action=missing   (only missing offset)
 * GET /api/admin/fitment-geometry-audit?action=summary   (count only)
 * GET /api/admin/fitment-geometry-audit?action=wide      (implausibly wide ranges)
 */

import { NextResponse } from "next/server";
import { getPool } from "@/lib/vehicleFitment";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url  = new URL(req.url);
  const action = url.searchParams.get("action") ?? "all";

  try {
    const pool = getPool();

    // ── Missing offset records ──────────────────────────────────────────────
    const { rows: missing } = await pool.query<{
      make: string; model: string; year_from: number; year_to: number; cnt: string;
      bolt_pattern: string | null;
    }>(`
      SELECT make, model,
             MIN(year) AS year_from, MAX(year) AS year_to,
             COUNT(*)  AS cnt,
             bolt_pattern
      FROM vehicle_fitments
      WHERE offset_min_mm IS NULL OR offset_max_mm IS NULL
      GROUP BY make, model, bolt_pattern
      ORDER BY make, model
    `);

    // ── Implausibly wide ranges (> 80mm) ───────────────────────────────────
    const { rows: wide } = await pool.query<{
      make: string; model: string; year_from: number; year_to: number; cnt: string;
      midpoint: string; range_mm: string; bolt_pattern: string | null;
    }>(`
      SELECT make, model,
             MIN(year)  AS year_from, MAX(year) AS year_to,
             COUNT(*)   AS cnt,
             ROUND(AVG((offset_max_mm + offset_min_mm) / 2))  AS midpoint,
             ROUND(AVG(offset_max_mm - offset_min_mm))         AS range_mm,
             bolt_pattern
      FROM vehicle_fitments
      WHERE offset_min_mm IS NOT NULL AND offset_max_mm IS NOT NULL
        AND (offset_max_mm - offset_min_mm) > 80
      GROUP BY make, model, bolt_pattern
      ORDER BY range_mm DESC
      LIMIT 100
    `);

    // ── Summary ────────────────────────────────────────────────────────────
    const { rows: summary } = await pool.query<{
      total: string; has_offset: string; missing_offset: string;
      pct_complete: string; wide_range_cnt: string;
    }>(`
      SELECT
        COUNT(*)                                                              AS total,
        COUNT(*) FILTER (WHERE offset_min_mm IS NOT NULL
                           AND offset_max_mm IS NOT NULL)                    AS has_offset,
        COUNT(*) FILTER (WHERE offset_min_mm IS NULL
                            OR offset_max_mm IS NULL)                        AS missing_offset,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE offset_min_mm IS NOT NULL
                                    AND offset_max_mm IS NOT NULL)
          / NULLIF(COUNT(*), 0)
        )                                                                     AS pct_complete,
        COUNT(*) FILTER (WHERE offset_max_mm IS NOT NULL
                           AND offset_min_mm IS NOT NULL
                           AND (offset_max_mm - offset_min_mm) > 80)         AS wide_range_cnt
      FROM vehicle_fitments
    `);

    const s = summary[0];

    const responseBody: Record<string, unknown> = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalRecords:        Number(s.total),
        withOffset:          Number(s.has_offset),
        missingOffset:       Number(s.missing_offset),
        coveragePct:         Number(s.pct_complete),
        wideRangeCount:      Number(s.wide_range_cnt),
      },
    };

    if (action === "summary") {
      return NextResponse.json(responseBody);
    }

    if (action === "missing" || action === "all") {
      responseBody.missingOffsetGroups = missing.map(r => ({
        make: r.make,
        model: r.model,
        years: `${r.year_from}–${r.year_to}`,
        records: Number(r.cnt),
        boltPattern: r.bolt_pattern,
      }));
    }

    if (action === "wide" || action === "all") {
      responseBody.wideRangeGroups = wide.map(r => ({
        make: r.make,
        model: r.model,
        years: `${r.year_from}–${r.year_to}`,
        records: Number(r.cnt),
        midpointMm: Number(r.midpoint),
        rangeMm: Number(r.range_mm),
        boltPattern: r.bolt_pattern,
        note: Number(r.range_mm) > 100
          ? "⚠️ Range exceeds 100mm — verify OEM data"
          : "Range > 80mm — review recommended",
      }));
    }

    return NextResponse.json(responseBody);

  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
