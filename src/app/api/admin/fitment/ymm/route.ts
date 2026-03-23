import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Common makes - covers ~95% of US market
 * Same list as storefront /api/vehicles/makes
 */
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
 * GET /api/admin/fitment/ymm
 * 
 * Full-coverage Y/M/M/T picker for admin fitment overrides.
 * Uses same sources as storefront (static years/makes, Wheel-Size API for models/trims).
 * 
 * Query params:
 *   type=years                        → returns { years: string[] }
 *   type=makes                        → returns { makes: string[] }
 *   type=models&year=X&make=Y         → returns { models: string[] }
 *   type=trims&year=X&make=Y&model=Z  → returns { trims: TrimOption[] }
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");

  try {
    // -------------------------------------------------------------------------
    // Years: Static list (2000 → current year + 1)
    // -------------------------------------------------------------------------
    if (type === "years") {
      const currentYear = new Date().getFullYear();
      const startYear = 2000;
      const years: string[] = [];
      for (let y = currentYear + 1; y >= startYear; y--) {
        years.push(String(y));
      }
      return NextResponse.json({ years });
    }

    // -------------------------------------------------------------------------
    // Makes: Static list (~45 makes, covers 95% US market)
    // -------------------------------------------------------------------------
    if (type === "makes") {
      return NextResponse.json({ makes: MAKES });
    }

    // -------------------------------------------------------------------------
    // Models: Proxy to storefront /api/vehicles/models
    // -------------------------------------------------------------------------
    if (type === "models") {
      if (!year || !make) {
        return NextResponse.json({ error: "Missing year or make" }, { status: 400 });
      }

      // Build internal URL to storefront models API
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : "http://localhost:3000";
      
      const modelsUrl = new URL("/api/vehicles/models", baseUrl);
      modelsUrl.searchParams.set("year", year);
      modelsUrl.searchParams.set("make", make);

      const res = await fetch(modelsUrl.toString(), { cache: "no-store" });
      
      if (!res.ok) {
        console.error(`[admin/ymm] Models API error: ${res.status}`);
        return NextResponse.json({ models: [] });
      }

      const data = await res.json();
      return NextResponse.json({ models: data.results || [] });
    }

    // -------------------------------------------------------------------------
    // Trims: Proxy to storefront /api/vehicles/trims
    // -------------------------------------------------------------------------
    if (type === "trims") {
      if (!year || !make || !model) {
        return NextResponse.json({ error: "Missing year, make, or model" }, { status: 400 });
      }

      // Build internal URL to storefront trims API
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : "http://localhost:3000";
      
      const trimsUrl = new URL("/api/vehicles/trims", baseUrl);
      trimsUrl.searchParams.set("year", year);
      trimsUrl.searchParams.set("make", make);
      trimsUrl.searchParams.set("model", model);

      const res = await fetch(trimsUrl.toString(), { cache: "no-store" });
      
      if (!res.ok) {
        console.error(`[admin/ymm] Trims API error: ${res.status}`);
        return NextResponse.json({ trims: [] });
      }

      const data = await res.json();
      // Transform to admin-friendly format
      const trims = (data.results || []).map((t: any) => ({
        value: t.modificationId || t.value,
        label: t.label,
        modificationId: t.modificationId || t.value,
      }));
      
      return NextResponse.json({ 
        trims,
        source: data.source || "unknown",
      });
    }

    return NextResponse.json({ error: "Invalid type. Use: years, makes, models, trims" }, { status: 400 });
    
  } catch (err: any) {
    console.error("[admin/fitment/ymm] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
