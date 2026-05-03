import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/tires/sizes
 * 
 * Returns valid tire size options, filtered by selected values.
 * 
 * Query params:
 *   - width: filter aspects/rims valid for this width
 *   - aspect: filter rims valid for this width/aspect combo
 * 
 * Returns: { widths, aspects, rims }
 */

// Common real-world tire size combinations
// Format: "width/aspectRrim" -> true
const VALID_SIZES: Record<string, boolean> = {};

// Build the valid sizes map from common tire sizes
const TIRE_SIZES = [
  // Passenger car sizes
  "175/65R14", "175/70R13", "175/70R14",
  "185/60R15", "185/65R14", "185/65R15", "185/70R14",
  "195/55R16", "195/60R15", "195/65R15", "195/70R14",
  "205/50R17", "205/55R16", "205/60R16", "205/65R15", "205/70R15",
  "215/45R17", "215/50R17", "215/55R16", "215/55R17", "215/60R16", "215/65R16", "215/70R15", "215/70R16",
  "225/40R18", "225/45R17", "225/45R18", "225/50R17", "225/50R18", "225/55R17", "225/55R18", "225/60R16", "225/60R17", "225/60R18", "225/65R17", "225/70R16",
  "235/40R18", "235/40R19", "235/45R17", "235/45R18", "235/45R19", "235/50R18", "235/50R19", "235/55R17", "235/55R18", "235/55R19", "235/55R20", "235/60R17", "235/60R18", "235/65R16", "235/65R17", "235/65R18", "235/70R16", "235/75R15", "235/80R17",
  "245/35R19", "245/35R20", "245/40R17", "245/40R18", "245/40R19", "245/40R20", "245/45R17", "245/45R18", "245/45R19", "245/45R20", "245/50R18", "245/50R20", "245/55R19", "245/60R18", "245/65R17", "245/70R16", "245/70R17", "245/75R16", "245/75R17",
  "255/30R19", "255/30R20", "255/35R18", "255/35R19", "255/35R20", "255/40R17", "255/40R18", "255/40R19", "255/40R20", "255/45R18", "255/45R19", "255/45R20", "255/50R19", "255/50R20", "255/55R18", "255/55R19", "255/55R20", "255/60R17", "255/60R18", "255/60R19", "255/65R16", "255/65R17", "255/70R16", "255/70R17", "255/70R18", "255/75R17", "255/80R17",
  "265/30R19", "265/30R20", "265/35R18", "265/35R19", "265/35R20", "265/35R22", "265/40R20", "265/40R21", "265/40R22", "265/45R20", "265/45R21", "265/50R19", "265/50R20", "265/60R18", "265/60R20", "265/65R17", "265/65R18", "265/70R16", "265/70R17", "265/70R18", "265/75R16",
  "275/30R19", "275/30R20", "275/35R18", "275/35R19", "275/35R20", "275/35R21", "275/40R18", "275/40R19", "275/40R20", "275/45R19", "275/45R20", "275/45R21", "275/50R20", "275/50R21", "275/50R22", "275/55R19", "275/55R20", "275/60R18", "275/60R20", "275/65R17", "275/65R18", "275/65R20", "275/70R16", "275/70R17", "275/70R18",
  "285/30R19", "285/30R20", "285/30R21", "285/35R19", "285/35R20", "285/35R21", "285/35R22", "285/40R19", "285/40R20", "285/40R21", "285/40R22", "285/45R19", "285/45R20", "285/45R21", "285/45R22", "285/50R20", "285/55R18", "285/55R20", "285/60R18", "285/60R20", "285/65R17", "285/65R18", "285/65R20", "285/70R17", "285/75R16", "285/75R17", "285/75R18",
  "295/25R20", "295/25R21", "295/30R19", "295/30R20", "295/35R20", "295/35R21", "295/40R20", "295/40R21", "295/45R20", "295/50R20", "295/55R20", "295/60R20", "295/65R20", "295/70R17", "295/70R18",
  "305/25R20", "305/25R21", "305/30R19", "305/30R20", "305/35R20", "305/35R24", "305/40R20", "305/40R22", "305/45R22", "305/50R20", "305/55R20", "305/60R18", "305/65R17", "305/70R16", "305/70R17", "305/70R18",
  "315/30R21", "315/30R22", "315/35R20", "315/35R21", "315/40R21", "315/70R17",
  "325/30R19", "325/30R21", "325/35R22", "325/50R22", "325/60R18", "325/65R18",
  "335/25R20", "335/25R22", "335/30R20", "335/35R17",
  "345/25R20", "345/25R21", "345/30R19", "345/30R20",
  "355/25R21", "355/30R19",
  // Truck/SUV/Off-road sizes
  "31X10.50R15", "32X11.50R15", "33X10.50R15", "33X12.50R15", "33X12.50R17", "33X12.50R18", "33X12.50R20",
  "35X11.50R17", "35X12.50R15", "35X12.50R17", "35X12.50R18", "35X12.50R20", "35X12.50R22", "35X13.50R20",
  "37X12.50R17", "37X12.50R18", "37X12.50R20", "37X12.50R22", "37X13.50R17", "37X13.50R20", "37X13.50R22",
  "38X13.50R20", "38X15.50R20",
  "40X13.50R17", "40X15.50R22",
  "LT245/75R16", "LT245/75R17", "LT265/70R17", "LT275/65R18", "LT275/70R18", "LT285/70R17", "LT285/75R16", "LT295/70R17", "LT315/70R17",
];

// Parse and populate the valid sizes map
for (const size of TIRE_SIZES) {
  // Handle standard sizes like "225/65R17"
  const match = size.match(/^(\d+)\/(\d+)R(\d+)$/);
  if (match) {
    VALID_SIZES[size] = true;
  }
}

// Extract unique widths, aspects, and rims
function getWidths(): string[] {
  const widths = new Set<string>();
  for (const size of TIRE_SIZES) {
    const match = size.match(/^(\d+)\/(\d+)R(\d+)$/);
    if (match) widths.add(match[1]);
  }
  return Array.from(widths).sort((a, b) => parseInt(a) - parseInt(b));
}

function getAspects(width?: string): string[] {
  const aspects = new Set<string>();
  for (const size of TIRE_SIZES) {
    const match = size.match(/^(\d+)\/(\d+)R(\d+)$/);
    if (match) {
      if (!width || match[1] === width) {
        aspects.add(match[2]);
      }
    }
  }
  return Array.from(aspects).sort((a, b) => parseInt(a) - parseInt(b));
}

function getRims(width?: string, aspect?: string): string[] {
  const rims = new Set<string>();
  for (const size of TIRE_SIZES) {
    const match = size.match(/^(\d+)\/(\d+)R(\d+)$/);
    if (match) {
      const matchesWidth = !width || match[1] === width;
      const matchesAspect = !aspect || match[2] === aspect;
      if (matchesWidth && matchesAspect) {
        rims.add(match[3]);
      }
    }
  }
  return Array.from(rims).sort((a, b) => parseInt(a) - parseInt(b));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const width = searchParams.get("width") || undefined;
  const aspect = searchParams.get("aspect") || undefined;

  return NextResponse.json({
    widths: getWidths(),
    aspects: getAspects(width),
    rims: getRims(width, aspect),
  });
}
