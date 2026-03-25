/**
 * Test endpoint for TireWire Wheels API
 * 
 * GET /api/tirewire/wheels/test
 * - Tests wheel search with sample params
 * - Returns sample results for verification
 * 
 * This is a DEBUG endpoint - should be removed or protected in production.
 */

import { NextResponse } from "next/server";
import { 
  searchWheelsTirewire, 
  tirewireWheelToUnified,
  testWheelConnection 
} from "@/lib/tirewire/wheel-client";
import { getEnabledConnections } from "@/lib/tirewire/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "search";
  
  try {
    // Test connection to each enabled provider
    if (action === "connections") {
      const connections = await getEnabledConnections();
      const results = await Promise.all(
        connections.map(async (conn) => {
          const test = await testWheelConnection(conn.connectionId);
          return {
            provider: conn.provider,
            connectionId: conn.connectionId,
            ...test,
          };
        })
      );
      
      return NextResponse.json({
        ok: true,
        connections: results,
      });
    }
    
    // Search test
    const diameter = Number(url.searchParams.get("diameter")) || 20;
    const boltPattern = url.searchParams.get("boltPattern") || undefined;
    const brand = url.searchParams.get("brand") || undefined;
    
    console.log(`[tirewire-wheels-test] Testing search: diameter=${diameter}, boltPattern=${boltPattern}, brand=${brand}`);
    
    const startMs = Date.now();
    const results = await searchWheelsTirewire({
      rimDiameter: diameter,
      boltPattern,
      brand,
      excludeZeroStock: true,
    });
    const elapsed = Date.now() - startMs;
    
    // Flatten and convert to unified format
    const allWheels = results.flatMap(r => 
      r.wheels.map(w => tirewireWheelToUnified(w, r.provider))
    );
    
    // Get unique brands
    const brands = [...new Set(allWheels.map(w => w.brand).filter(Boolean))].sort();
    
    // Sample of wheels (first 10)
    const sample = allWheels.slice(0, 10).map(w => ({
      sku: w.sku,
      brand: w.brand,
      model: w.model,
      finish: w.finish,
      size: w.size,
      boltPattern: w.boltPattern,
      offset: w.offset,
      cost: w.cost,
      price: w.price,
      imageUrl: w.imageUrl,
      qty: w.quantity,
      source: w.source,
    }));
    
    return NextResponse.json({
      ok: true,
      search: { diameter, boltPattern, brand },
      timing: { ms: elapsed },
      summary: {
        totalWheels: allWheels.length,
        byProvider: results.map(r => ({
          provider: r.provider,
          count: r.wheels.length,
        })),
        uniqueBrands: brands.length,
        brands: brands.slice(0, 20),
      },
      sample,
    });
    
  } catch (err: any) {
    console.error("[tirewire-wheels-test] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
