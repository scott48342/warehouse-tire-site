import { NextRequest, NextResponse } from "next/server";
import tireSizesData from "@/data/tire-sizes.json";

/**
 * GET /api/tires/sizes
 * 
 * Returns valid tire size options, filtered by selected values.
 * Supports both metric (225/65R17) and flotation (35x12.50R17) sizes.
 * 
 * Query params:
 *   - width: filter aspects/rims valid for this width
 *   - aspect: filter rims valid for this width/aspect combo
 *   - type: "metric" (default) or "flotation"
 *   - dia: (flotation) filter widths/rims valid for this diameter
 *   - floatWidth: (flotation) filter rims valid for this dia/width combo
 * 
 * Returns: 
 *   Metric: { widths, aspects, rims }
 *   Flotation: { diameters, widths, rims }
 */

// Parse metric sizes from JSON
const metricSizes = Array.isArray(tireSizesData.metric) ? tireSizesData.metric : [];
const parsedMetric = metricSizes
  .map((s: string) => {
    const m = String(s).match(/^(\d{2,3})\/(\d{2})R(\d{2})$/);
    if (!m) return null;
    return { width: m[1], aspect: m[2], rim: m[3] };
  })
  .filter(Boolean) as Array<{ width: string; aspect: string; rim: string }>;

// Parse flotation sizes from JSON
const flotationSizes = Array.isArray(tireSizesData.flotation) ? tireSizesData.flotation : [];
const parsedFlotation = flotationSizes
  .map((x: any) => ({
    dia: String(x?.dia),
    width: String(x?.width),
    rim: String(x?.rim),
  }))
  .filter((x) => x.dia && x.width && x.rim && x.dia !== "undefined");

// ═══════════════════════════════════════════════════════════════════════════════
// METRIC SIZE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getMetricWidths(): string[] {
  const widths = new Set<string>();
  for (const size of parsedMetric) {
    widths.add(size.width);
  }
  return Array.from(widths).sort((a, b) => parseInt(a) - parseInt(b));
}

function getMetricAspects(width?: string): string[] {
  const aspects = new Set<string>();
  for (const size of parsedMetric) {
    if (!width || size.width === width) {
      aspects.add(size.aspect);
    }
  }
  return Array.from(aspects).sort((a, b) => parseInt(a) - parseInt(b));
}

function getMetricRims(width?: string, aspect?: string): string[] {
  const rims = new Set<string>();
  for (const size of parsedMetric) {
    const matchesWidth = !width || size.width === width;
    const matchesAspect = !aspect || size.aspect === aspect;
    if (matchesWidth && matchesAspect) {
      rims.add(size.rim);
    }
  }
  return Array.from(rims).sort((a, b) => parseInt(a) - parseInt(b));
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOTATION SIZE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getFlotationDiameters(): string[] {
  const dias = new Set<string>();
  for (const size of parsedFlotation) {
    dias.add(size.dia);
  }
  return Array.from(dias).sort((a, b) => parseFloat(a) - parseFloat(b));
}

function getFlotationWidths(dia?: string): string[] {
  const widths = new Set<string>();
  for (const size of parsedFlotation) {
    if (!dia || size.dia === dia) {
      widths.add(size.width);
    }
  }
  return Array.from(widths).sort((a, b) => parseFloat(a) - parseFloat(b));
}

function getFlotationRims(dia?: string, width?: string): string[] {
  const rims = new Set<string>();
  for (const size of parsedFlotation) {
    const matchesDia = !dia || size.dia === dia;
    const matchesWidth = !width || size.width === width;
    if (matchesDia && matchesWidth) {
      rims.add(size.rim);
    }
  }
  return Array.from(rims).sort((a, b) => parseInt(a) - parseInt(b));
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "metric";
  
  if (type === "flotation") {
    const dia = searchParams.get("dia") || undefined;
    const floatWidth = searchParams.get("width") || searchParams.get("floatWidth") || undefined;
    
    return NextResponse.json({
      type: "flotation",
      diameters: getFlotationDiameters(),
      widths: getFlotationWidths(dia),
      rims: getFlotationRims(dia, floatWidth),
    });
  }
  
  // Default: metric
  const width = searchParams.get("width") || undefined;
  const aspect = searchParams.get("aspect") || undefined;

  return NextResponse.json({
    type: "metric",
    widths: getMetricWidths(),
    aspects: getMetricAspects(width),
    rims: getMetricRims(width, aspect),
  });
}
