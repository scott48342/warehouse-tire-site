/**
 * Admin: Catalog Management
 * 
 * GET /api/admin/catalog - Get catalog stats
 * POST /api/admin/catalog - Populate catalog from Wheel-Size API
 * 
 * ⚠️ PROTECTED by Wheel-Size API guardrails
 * Batch operations require: { confirm: true, allowBatch: true }
 */

import { NextResponse } from "next/server";
import * as catalogStore from "@/lib/catalog-store";
import {
  checkBatchJobAllowed,
  startBatchJob,
  endBatchJob,
  getUsageStats,
} from "@/lib/wheelSizeGuard";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for full population

export async function GET() {
  try {
    const stats = await catalogStore.getStats();
    return NextResponse.json(stats);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to get stats" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch (e: any) {
    return NextResponse.json({ 
      error: "Failed to parse JSON body",
      message: e?.message,
    }, { status: 400 });
  }
  
  const action = body.action;

  // Actions that don't need batch protection
  const safeModeActions = ["stats", "clear"];
  
  // Actions that trigger batch Wheel-Size API calls
  const batchActions = ["populate-makes", "populate-models", "populate-common"];

  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // GUARDRAIL CHECK for batch operations
    // ═══════════════════════════════════════════════════════════════════════════
    if (batchActions.includes(action)) {
      const batchCheck = checkBatchJobAllowed({
        action,
        confirm: body.confirm,
        allowBatch: body.allowBatch,
        adminId: body.adminId || "anonymous",
      });
      
      if (!batchCheck.allowed) {
        return NextResponse.json({
          error: batchCheck.error,
          warning: batchCheck.warning,
          requiresConfirmation: batchCheck.requiresConfirmation,
          usage: getUsageStats(),
          hint: batchCheck.requiresConfirmation 
            ? 'Add { "confirm": true, "allowBatch": true } to your request body'
            : undefined,
        }, { status: batchCheck.requiresConfirmation ? 400 : 429 });
      }
      
      // Start batch job tracking
      startBatchJob(body.adminId || "anonymous");
    }
    // ═══════════════════════════════════════════════════════════════════════════

    let result: any;
    
    switch (action) {
      case "populate-makes": {
        const count = await catalogStore.populateMakes();
        result = { success: true, makes: count };
        break;
      }
      
      case "populate-models": {
        const makeSlug = body.make;
        if (!makeSlug) {
          endBatchJob(false);
          return NextResponse.json({ error: "Missing 'make' parameter" }, { status: 400 });
        }
        const count = await catalogStore.populateModels(makeSlug);
        result = { success: true, make: makeSlug, models: count };
        break;
      }
      
      case "populate-common": {
        const populateResult = await catalogStore.populateCommonMakes();
        result = { success: true, ...populateResult };
        break;
      }
      
      case "clear": {
        await catalogStore.clearCatalog();
        result = { success: true, message: "Catalog cleared" };
        break;
      }
      
      case "stats": {
        const stats = await catalogStore.getStats();
        result = stats;
        break;
      }
      
      default:
        return NextResponse.json({ 
          error: "Unknown action",
          receivedAction: action,
          validActions: ["populate-makes", "populate-models", "populate-common", "clear", "stats"],
          protectedActions: batchActions,
          note: "Batch actions require { confirm: true, allowBatch: true }",
        }, { status: 400 });
    }
    
    // End batch job tracking (success)
    if (batchActions.includes(action)) {
      endBatchJob(true);
    }
    
    return NextResponse.json(result);
    
  } catch (err: any) {
    // End batch job tracking (failure)
    if (batchActions.includes(action)) {
      endBatchJob(false);
    }
    
    console.error(`[admin/catalog] Error:`, err);
    return NextResponse.json({ 
      error: err?.message || "Operation failed",
      action,
    }, { status: 500 });
  }
}
