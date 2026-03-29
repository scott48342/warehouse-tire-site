import { NextResponse } from "next/server";
import * as catalogStore from "@/lib/catalog-store";

export const runtime = "nodejs";

// Static fallback list - used when no year specified or no catalog data
// Includes both current and defunct brands
const STATIC_MAKES = [
  // Current manufacturers
  "Acura", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "Buick",
  "Cadillac", "Chevrolet", "Chrysler", "Dodge", "Ferrari", "Fiat", "Ford",
  "Genesis", "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar", "Jeep", "Kia",
  "Lamborghini", "Land Rover", "Lexus", "Lincoln", "Lotus", "Maserati",
  "Mazda", "McLaren", "Mercedes-Benz", "Mini", "Mitsubishi", "Nissan",
  "Polestar", "Porsche", "Ram", "Rivian", "Rolls-Royce", "Subaru", "Tesla",
  "Toyota", "Volkswagen", "Volvo",
  // Defunct/classic brands
  "AMC", "Daewoo", "Datsun", "DeLorean", "Eagle", "Geo", "Hummer", "Isuzu",
  "Mercury", "Oldsmobile", "Plymouth", "Pontiac", "Saab", "Saturn", "Scion", "Suzuki",
].sort();

// Year ranges for makes (used for filtering when no catalog data)
// Format: [startYear, endYear] - null means no limit
const MAKE_YEAR_RANGES: Record<string, [number | null, number | null]> = {
  // Defunct brands with known end dates
  "AMC": [1954, 1988],
  "Daewoo": [1982, 2001],
  "DeLorean": [1981, 1983],
  "Eagle": [1988, 1998],
  "Geo": [1989, 1997],
  "Hummer": [1992, 2010],
  "Mercury": [1938, 2011],
  "Oldsmobile": [1897, 2004],
  "Plymouth": [1928, 2001],
  "Pontiac": [1926, 2010],
  "Saab": [1945, 2012],
  "Saturn": [1990, 2010],
  "Scion": [2003, 2016],
  "Suzuki": [1985, 2012],
  // Newer brands with known start dates
  "Genesis": [2017, null],
  "Polestar": [2017, null],
  "Rivian": [2021, null],
  "Tesla": [2008, null],
};

/**
 * Filter static makes by year using known production ranges
 */
function filterStaticMakesByYear(year: number): string[] {
  return STATIC_MAKES.filter(make => {
    const range = MAKE_YEAR_RANGES[make];
    if (!range) return true; // No range = always show
    
    const [start, end] = range;
    if (start && year < start) return false;
    if (end && year > end) return false;
    return true;
  });
}

/**
 * Normalize make slug to display name
 */
function slugToDisplayName(slug: string): string {
  // Special cases
  const specialCases: Record<string, string> = {
    "mercedes": "Mercedes-Benz",
    "mercedes-benz": "Mercedes-Benz",
    "land-rover": "Land Rover",
    "alfa-romeo": "Alfa Romeo",
    "aston-martin": "Aston Martin",
    "rolls-royce": "Rolls-Royce",
  };
  
  if (specialCases[slug.toLowerCase()]) {
    return specialCases[slug.toLowerCase()];
  }
  
  // Default: capitalize each word
  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * GET /api/vehicles/makes?year=2005
 * 
 * Returns available makes for vehicle selector.
 * When year is provided, only returns makes that have data for that year.
 * 
 * Data sources (merged in priority order):
 * 1. catalog_models table (makes with models for this year)
 * 2. vehicle_fitments table (locally imported fitment data)
 * 3. Static fallback (filtered by year ranges)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const yearStr = url.searchParams.get("year");
  const year = yearStr ? parseInt(yearStr, 10) : null;

  // If no year, return filtered static list
  if (!year || isNaN(year)) {
    return NextResponse.json(
      { results: STATIC_MAKES, source: "static" },
      { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } }
    );
  }

  try {
    // Collect makes from all sources
    const makeSet = new Set<string>();
    const makeNames = new Map<string, string>(); // slug -> display name

    // Source 1: Catalog (catalog_models where year in years[])
    const catalogMakes = await catalogStore.getMakesByYear(year);
    for (const make of catalogMakes) {
      const slug = make.slug.toLowerCase();
      makeSet.add(slug);
      makeNames.set(slug, make.name);
    }

    // Source 2: Vehicle fitments (locally imported data)
    const fitmentMakes = await catalogStore.getFitmentMakesByYear(year);
    for (const slug of fitmentMakes) {
      makeSet.add(slug.toLowerCase());
      if (!makeNames.has(slug.toLowerCase())) {
        makeNames.set(slug.toLowerCase(), slugToDisplayName(slug));
      }
    }

    // If we have catalog/fitment data, use it
    if (makeSet.size > 0) {
      const makes = Array.from(makeSet)
        .map(slug => makeNames.get(slug) || slugToDisplayName(slug))
        .sort();
      
      console.log(`[makes] Year ${year}: ${makes.length} makes from catalog/fitment`);
      
      return NextResponse.json(
        { results: makes, source: "catalog", count: makes.length },
        { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } }
      );
    }

    // Fallback: Static list filtered by year ranges
    const filteredStatic = filterStaticMakesByYear(year);
    console.log(`[makes] Year ${year}: ${filteredStatic.length} makes from static (filtered)`);
    
    return NextResponse.json(
      { results: filteredStatic, source: "static-filtered", count: filteredStatic.length },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } }
    );

  } catch (err: any) {
    console.error(`[makes] Error for year ${year}:`, err?.message);
    
    // On error, return year-filtered static list
    const filteredStatic = filterStaticMakesByYear(year);
    return NextResponse.json(
      { results: filteredStatic, source: "static-fallback", error: err?.message },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  }
}
