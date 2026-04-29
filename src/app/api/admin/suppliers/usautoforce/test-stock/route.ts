/**
 * US AutoForce Direct Integration - Stock Check Test
 * 
 * GET /api/admin/suppliers/usautoforce/test-stock?size=225/60R16
 * GET /api/admin/suppliers/usautoforce/test-stock?size=265/70R17&branch=4862
 * 
 * Test stock check against the US AutoForce direct API (AIS).
 * LOCAL DEV ONLY - Test credentials.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkStockBySize, getStatus, serviceCheck } from "@/lib/usautoforce";

export async function GET(request: NextRequest) {
  try {
    const status = getStatus();
    
    if (!status.configured) {
      return NextResponse.json({
        error: "US AutoForce not configured",
        missingCredentials: true,
        hint: "Set USAUTOFORCE_USERNAME, USAUTOFORCE_PASSWORD, USAUTOFORCE_ACCOUNT in .env.local",
        status,
      }, { status: 400 });
    }
    
    const { searchParams } = new URL(request.url);
    const size = searchParams.get("size");
    const branch = searchParams.get("branch") || undefined;
    const ping = searchParams.get("ping") === "true";
    
    // Service check (ping)
    if (ping) {
      const pingResult = await serviceCheck();
      return NextResponse.json({
        action: "ping",
        result: pingResult,
        isTestMode: status.isTestMode,
        apiUrl: status.apiUrl,
      });
    }
    
    // Stock check requires size
    if (!size) {
      return NextResponse.json({
        error: "Missing size parameter",
        hint: "Provide ?size=225/60R16",
        examples: [
          "/api/admin/suppliers/usautoforce/test-stock?ping=true",
          "/api/admin/suppliers/usautoforce/test-stock?size=225/60R16",
          "/api/admin/suppliers/usautoforce/test-stock?size=265/70R17&branch=4862",
        ],
        status,
      }, { status: 400 });
    }
    
    const startTime = Date.now();
    const result = await checkStockBySize(size, { branch });
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      query: { size, branch: branch || "4101 (default)" },
      duration: `${duration}ms`,
      result,
      isTestMode: status.isTestMode,
      apiUrl: status.apiUrl,
      
      // Once working, compare with TireWeb data:
      comparison: {
        note: "Compare results with TireWeb/USAutoForce connection (488548)",
        tireweb: {
          connectionId: 488548,
          provider: "tireweb_usautoforce",
        },
      },
    });
  } catch (error) {
    console.error("[usautoforce-test-stock] Error:", error);
    return NextResponse.json(
      { error: "Stock check failed", details: String(error) },
      { status: 500 }
    );
  }
}
