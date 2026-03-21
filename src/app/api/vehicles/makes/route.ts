import { NextResponse } from "next/server";

export const runtime = "edge";

// Common makes - covers ~95% of US market
const MAKES = [
  "Acura", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "Buick",
  "Cadillac", "Chevrolet", "Chrysler", "Dodge", "Ferrari", "Fiat", "Ford",
  "Genesis", "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar", "Jeep", "Kia",
  "Lamborghini", "Land Rover", "Lexus", "Lincoln", "Lotus", "Maserati",
  "Mazda", "McLaren", "Mercedes-Benz", "Mini", "Mitsubishi", "Nissan",
  "Polestar", "Porsche", "Ram", "Rivian", "Rolls-Royce", "Subaru", "Tesla",
  "Toyota", "Volkswagen", "Volvo"
].sort();

/**
 * GET /api/vehicles/makes?year=2005
 * 
 * Returns available makes (static list - API-independent).
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
