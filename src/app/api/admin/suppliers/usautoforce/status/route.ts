/**
 * US AutoForce Direct Integration - Status Check
 * 
 * GET /api/admin/suppliers/usautoforce/status
 * 
 * Returns current configuration status for the US AutoForce direct integration.
 * LOCAL DEV ONLY - Test credentials.
 */

import { NextResponse } from "next/server";
import { getStatus, testConnection, serviceCheck } from "@/lib/usautoforce";
import { USAUTOFORCE_WAREHOUSES } from "@/lib/usautoforce/warehouses";

export async function GET() {
  try {
    const status = getStatus();
    const connectionTest = await testConnection();
    
    return NextResponse.json({
      integration: "usautoforce-direct",
      description: "US AutoForce Direct API (bypasses TireWeb)",
      note: "LOCAL DEV ONLY - Using test credentials",
      
      status,
      connectionTest,
      
      warehouses: {
        total: USAUTOFORCE_WAREHOUSES.length,
        byRegion: {
          northeast: USAUTOFORCE_WAREHOUSES.filter(w => 
            ["MA", "NY", "NJ", "CT", "PA", "MD", "VA", "ME", "VT"].includes(w.state)
          ).length,
          southeast: USAUTOFORCE_WAREHOUSES.filter(w => 
            ["FL", "GA", "NC", "SC", "AL", "TN"].includes(w.state)
          ).length,
          midwest: USAUTOFORCE_WAREHOUSES.filter(w => 
            ["IL", "WI", "MI", "IN", "OH", "MN", "MO", "IA", "NE", "SD"].includes(w.state)
          ).length,
          southwest: USAUTOFORCE_WAREHOUSES.filter(w => 
            ["TX", "AZ", "NV", "CO"].includes(w.state)
          ).length,
          west: USAUTOFORCE_WAREHOUSES.filter(w => 
            ["CA", "WA", "OR", "UT", "ID"].includes(w.state)
          ).length,
        },
      },
      
      missingConfig: [
        ...(!status.hasCredentials ? ["USAUTOFORCE_USERNAME, USAUTOFORCE_PASSWORD"] : []),
        ...(!status.hasApiUrl ? ["USAUTOFORCE_API_URL (need from Jennifer)"] : []),
        ...(!status.hasFtp ? ["USAUTOFORCE_FTP_HOST (need from Jennifer)"] : []),
      ],
      
      nextSteps: !status.hasApiUrl ? [
        "1. Get API endpoint URL from Jennifer Fletcher",
        "2. Get FTP hostname from Jennifer",
        "3. Get API password (sent separately)",
        "4. Test stock check by tire size",
        "5. Compare results with TireWeb/USAutoForce data",
      ] : [
        "Ready to test - run stock checks",
      ],
    });
  } catch (error) {
    console.error("[usautoforce-status] Error:", error);
    return NextResponse.json(
      { error: "Failed to get status", details: String(error) },
      { status: 500 }
    );
  }
}
