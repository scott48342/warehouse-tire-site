/**
 * TireWeb Protection Layer Status
 * 
 * GET /api/admin/suppliers/tireweb/status
 * Returns circuit breaker state, cache stats, and in-flight requests.
 */

import { NextResponse } from "next/server";
import { getDiagnostics, getCircuitStatus } from "@/lib/tireweb/protection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const diagnostics = await getDiagnostics();
    
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      protection: {
        circuit: {
          status: diagnostics.circuit.status,
          failures: diagnostics.circuit.failures,
          lastFailure: diagnostics.circuit.lastFailure 
            ? new Date(diagnostics.circuit.lastFailure).toISOString() 
            : null,
          openedAt: diagnostics.circuit.openedAt 
            ? new Date(diagnostics.circuit.openedAt).toISOString() 
            : null,
        },
        inFlightRequests: diagnostics.inFlightCount,
        backgroundRevalidations: diagnostics.revalidatingCount,
        redisConnected: diagnostics.redisConnected,
      },
      config: {
        cacheTtlMinutes: 30,
        staleTtlMinutes: 10,
        circuitOpenDurationMinutes: 5,
        failureThreshold: 3,
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message || String(err),
    }, { status: 500 });
  }
}
