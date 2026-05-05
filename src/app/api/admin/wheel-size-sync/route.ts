/**
 * Admin API: Wheel-Size Sync Governor
 * 
 * Monitor and control Wheel-Size API access.
 * Admin-only endpoint - no customer traffic should ever reach this.
 * 
 * GET - Get current governor state and audit log
 * POST - Actions: process-vehicles, reset-counters, toggle-kill-switch, dry-run-test
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getGovernorState,
  getAuditLog,
  activateKillSwitch,
  deactivateKillSwitch,
  resetDailyCounters,
  processVehicleAllowlist,
  getConfig,
  governedCall,
  type VehicleTarget,
  type GovernorState,
  type AuditLogEntry,
} from "@/lib/wheel-size/safetyGovernor";

// =============================================================================
// Types
// =============================================================================

interface StatusResponse {
  governor: GovernorState;
  config: {
    dailyCap: number;
    hourlyCap: number;
    minDelayMs: number;
    enabled: boolean;
    dryRun: boolean;
    apiKeyConfigured: boolean;
  };
  recentAuditLog: AuditLogEntry[];
}

interface ProcessVehiclesRequest {
  action: "process-vehicles";
  vehicles: VehicleTarget[];
  dryRun?: boolean;
}

interface ToggleKillSwitchRequest {
  action: "toggle-kill-switch";
  activate: boolean;
  reason?: string;
}

interface ResetCountersRequest {
  action: "reset-counters";
}

interface DryRunTestRequest {
  action: "dry-run-test";
  vehicle: VehicleTarget;
}

type PostRequest = 
  | ProcessVehiclesRequest 
  | ToggleKillSwitchRequest 
  | ResetCountersRequest
  | DryRunTestRequest;

// =============================================================================
// GET - Status
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const auditLimit = Math.min(parseInt(searchParams.get("auditLimit") || "50"), 200);
    
    const [state, auditLog] = await Promise.all([
      getGovernorState(),
      getAuditLog(auditLimit),
    ]);
    
    const config = getConfig();
    
    const response: StatusResponse = {
      governor: state,
      config: {
        ...config,
        apiKeyConfigured: !!process.env.WHEEL_SIZE_API_KEY,
      },
      recentAuditLog: auditLog,
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error("[admin/wheel-size-sync] GET error:", error);
    return NextResponse.json(
      { error: "Failed to get governor status" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Actions
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as PostRequest;
    
    switch (body.action) {
      // -----------------------------------------------------------------------
      // Process specific vehicles (allowlist only)
      // -----------------------------------------------------------------------
      case "process-vehicles": {
        const { vehicles, dryRun } = body;
        
        if (!vehicles || !Array.isArray(vehicles) || vehicles.length === 0) {
          return NextResponse.json(
            { error: "No vehicles provided. Must specify exact vehicles to process." },
            { status: 400 }
          );
        }
        
        // Validate vehicle list (prevent sneaky full-crawl attempts)
        if (vehicles.length > 50) {
          return NextResponse.json(
            { error: "Maximum 50 vehicles per batch. Process in smaller chunks." },
            { status: 400 }
          );
        }
        
        for (const v of vehicles) {
          if (!v.year || !v.make || !v.model) {
            return NextResponse.json(
              { error: "Each vehicle must have year, make, and model" },
              { status: 400 }
            );
          }
        }
        
        // Check if sync is enabled
        const config = getConfig();
        if (!config.enabled) {
          return NextResponse.json(
            { error: "Wheel-Size sync is disabled (WHEEL_SIZE_SYNC_ENABLED=false)" },
            { status: 403 }
          );
        }
        
        // Process vehicles
        const result = await processVehicleAllowlist(
          { vehicles, dryRun },
          async (vehicle) => {
            // Build the actual Wheel-Size API call
            const baseUrl = "https://api.wheel-size.com/v2";
            const apiKey = process.env.WHEEL_SIZE_API_KEY;
            
            const params = new URLSearchParams({
              user_key: apiKey!,
              year: String(vehicle.year),
              make: vehicle.make,
              model: vehicle.model,
            });
            
            if (vehicle.trim) {
              params.set("trim", vehicle.trim);
            }
            
            return fetch(`${baseUrl}/modifications/?${params}`);
          }
        );
        
        return NextResponse.json({
          success: true,
          result,
        });
      }
      
      // -----------------------------------------------------------------------
      // Toggle kill switch
      // -----------------------------------------------------------------------
      case "toggle-kill-switch": {
        const { activate, reason } = body;
        
        if (activate) {
          if (!reason) {
            return NextResponse.json(
              { error: "Reason required when activating kill switch" },
              { status: 400 }
            );
          }
          await activateKillSwitch(reason);
          return NextResponse.json({
            success: true,
            message: "Kill switch activated",
            reason,
          });
        } else {
          await deactivateKillSwitch();
          return NextResponse.json({
            success: true,
            message: "Kill switch deactivated",
          });
        }
      }
      
      // -----------------------------------------------------------------------
      // Reset daily counters
      // -----------------------------------------------------------------------
      case "reset-counters": {
        await resetDailyCounters();
        return NextResponse.json({
          success: true,
          message: "Daily counters reset",
        });
      }
      
      // -----------------------------------------------------------------------
      // Dry-run test (single vehicle, no actual API call)
      // -----------------------------------------------------------------------
      case "dry-run-test": {
        const { vehicle } = body;
        
        if (!vehicle || !vehicle.year || !vehicle.make || !vehicle.model) {
          return NextResponse.json(
            { error: "Vehicle with year, make, model required" },
            { status: 400 }
          );
        }
        
        const vehicleStr = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`;
        
        // Force dry-run
        const originalDryRun = process.env.WHEEL_SIZE_DRY_RUN;
        process.env.WHEEL_SIZE_DRY_RUN = "true";
        
        try {
          const result = await governedCall({
            endpoint: "/modifications",
            params: {
              year: String(vehicle.year),
              make: vehicle.make,
              model: vehicle.model,
              ...(vehicle.trim ? { trim: vehicle.trim } : {}),
            },
            vehicle: vehicleStr,
            fetcher: async () => {
              // This should never be called in dry-run mode
              throw new Error("Dry-run fetcher was called - this is a bug!");
            },
          });
          
          return NextResponse.json({
            success: true,
            dryRunResult: result,
            message: "Dry-run completed - no actual API call was made",
          });
        } finally {
          // Restore
          if (originalDryRun !== undefined) {
            process.env.WHEEL_SIZE_DRY_RUN = originalDryRun;
          } else {
            delete process.env.WHEEL_SIZE_DRY_RUN;
          }
        }
      }
      
      default:
        return NextResponse.json(
          { error: `Unknown action: ${(body as { action: string }).action}` },
          { status: 400 }
        );
    }
    
  } catch (error) {
    console.error("[admin/wheel-size-sync] POST error:", error);
    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 }
    );
  }
}
