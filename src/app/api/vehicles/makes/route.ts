import { NextResponse } from "next/server";

export const runtime = "edge";

// All makes with potential fitment data
// Includes both current manufacturers and defunct brands with classic vehicles
// NOTE: Keep alphabetically sorted for consistent UI display
const MAKES = [
  // Current manufacturers
  "Acura", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "Buick",
  "Cadillac", "Chevrolet", "Chrysler", "Dodge", "Ferrari", "Fiat", "Ford",
  "Genesis", "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar", "Jeep", "Kia",
  "Lamborghini", "Land Rover", "Lexus", "Lincoln", "Lotus", "Maserati",
  "Mazda", "McLaren", "Mercedes-Benz", "Mini", "Mitsubishi", "Nissan",
  "Polestar", "Porsche", "Ram", "Rivian", "Rolls-Royce", "Subaru", "Tesla",
  "Toyota", "Volkswagen", "Volvo",
  // Defunct/classic brands with fitment data
  "AMC",           // American Motors (1954-1988)
  "Daewoo",        // Daewoo Motors (1982-2001)
  "Datsun",        // Datsun (pre-Nissan rebrand)
  "DeLorean",      // DeLorean (1981-1983)
  "Eagle",         // Eagle (Chrysler brand, 1988-1998)
  "Geo",           // Geo (GM brand, 1989-1997)
  "Hummer",        // Hummer (1992-2010, revived 2022 as GMC)
  "Isuzu",         // Isuzu (limited US market)
  "Mercury",       // Mercury (Ford brand, 1938-2011)
  "Oldsmobile",    // Oldsmobile (GM brand, 1897-2004)
  "Plymouth",      // Plymouth (Chrysler brand, 1928-2001)
  "Pontiac",       // Pontiac (GM brand, 1926-2010)
  "Saab",          // Saab (1945-2012)
  "Saturn",        // Saturn (GM brand, 1985-2010)
  "Scion",         // Scion (Toyota brand, 2003-2016)
  "Suzuki",        // Suzuki (US market 1985-2012)
].sort();

/**
 * GET /api/vehicles/makes?year=2005
 * 
 * Returns available makes for vehicle selector.
 * 
 * This list includes both current and defunct brands that have
 * fitment data available. Future improvement: dynamically populate
 * from catalog_makes table to auto-include newly imported makes.
 */
export async function GET() {
  return NextResponse.json(
    { results: MAKES },
    {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    }
  );
}
