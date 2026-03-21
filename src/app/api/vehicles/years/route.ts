import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/vehicles/years
 * 
 * Returns available years for vehicle selection.
 * Years are generated statically (current year down to 2000).
 */
export async function GET() {
  const currentYear = new Date().getFullYear();
  const startYear = 2000;
  
  // Generate years from current year down to startYear
  const results: string[] = [];
  for (let y = currentYear + 1; y >= startYear; y--) {
    results.push(String(y));
  }

  return NextResponse.json({ results });
}
