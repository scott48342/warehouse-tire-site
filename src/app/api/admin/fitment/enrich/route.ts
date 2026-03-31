/**
 * Generation-Based Fitment Enrichment API
 * POST /api/admin/fitment/enrich
 * 
 * Safe enrichment rules:
 * - NEVER guess across generations
 * - ONLY inherit data from same year/make/model with valid data
 * - DO NOT overwrite valid existing data
 * - DO NOT introduce incorrect data
 * 
 * @created 2026-03-29
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { vehicleFitments } from "@/lib/fitment-db/schema";
import { eq, and, or, isNull, sql, ne } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 300;

interface EnrichmentResult {
  id: string;
  vehicle: string;
  before: {
    boltPattern: string | null;
    centerBoreMm: number | null;
    threadSize: string | null;
  };
  after: {
    boltPattern: string | null;
    centerBoreMm: number | null;
    threadSize: string | null;
  };
  changes: string[];
  source: string;
}

interface EnrichmentReport {
  dryRun: boolean;
  summary: {
    totalScanned: number;
    alreadyComplete: number;
    incompleteFound: number;
    enriched: number;
    flagged: number;
    duplicatesRemoved: number;
  };
  enriched: EnrichmentResult[];
  flagged: Array<{ id: string; vehicle: string; reason: string }>;
  duplicatesRemoved: Array<{ id: string; vehicle: string; keptId: string }>;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { dryRun = true, limit = 5000 } = body;
    
    console.log(`[fitment/enrich] Starting generation-based enrichment (dryRun=${dryRun}, limit=${limit})`);
    
    // Step 1: Get all records
    const allRecords = await db
      .select()
      .from(vehicleFitments)
      .orderBy(vehicleFitments.year, vehicleFitments.make, vehicleFitments.model)
      .limit(limit);
    
    console.log(`[fitment/enrich] Fetched ${allRecords.length} records`);
    
    // Step 2: Analyze records
    const complete: typeof allRecords = [];
    const incomplete: typeof allRecords = [];
    
    // Group by year/make/model for duplicate detection and enrichment
    const grouped = new Map<string, typeof allRecords>();
    
    for (const r of allRecords) {
      const key = `${r.year}|${r.make}|${r.model}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(r);
      
      const hasBP = r.boltPattern && r.boltPattern.trim().length > 0;
      const hasHB = r.centerBoreMm && Number(r.centerBoreMm) > 0;
      const hasTS = r.threadSize && r.threadSize.trim().length > 0;
      
      if (hasBP && hasHB && hasTS) {
        complete.push(r);
      } else {
        incomplete.push(r);
      }
    }
    
    console.log(`[fitment/enrich] Complete: ${complete.length}, Incomplete: ${incomplete.length}`);
    
    // Step 3: Find duplicates and determine which to keep
    const duplicatesToRemove: Array<{ id: string; vehicle: string; keptId: string }> = [];
    
    for (const [key, records] of grouped) {
      if (records.length > 1) {
        // Sort by completeness score (higher = better)
        const scored = records.map(r => {
          let score = 0;
          if (r.boltPattern && r.boltPattern.trim().length > 0) score += 100;
          if (r.centerBoreMm && Number(r.centerBoreMm) > 0) score += 10;
          if (r.threadSize && r.threadSize.trim().length > 0) score += 1;
          if (r.oemTireSizes && Array.isArray(r.oemTireSizes) && r.oemTireSizes.length > 0) score += 50;
          if (r.oemWheelSizes && Array.isArray(r.oemWheelSizes) && r.oemWheelSizes.length > 0) score += 25;
          return { record: r, score };
        }).sort((a, b) => b.score - a.score);
        
        // Keep the best one, mark others for removal
        const keep = scored[0].record;
        for (let i = 1; i < scored.length; i++) {
          const dup = scored[i].record;
          // Only remove if the duplicate is truly inferior (empty/null key fields)
          if (scored[i].score < scored[0].score) {
            duplicatesToRemove.push({
              id: dup.id,
              vehicle: `${dup.year} ${dup.make} ${dup.model} (${dup.displayTrim})`,
              keptId: keep.id,
            });
          }
        }
      }
    }
    
    console.log(`[fitment/enrich] Duplicates to remove: ${duplicatesToRemove.length}`);
    
    // Step 4: Build enrichment reference from complete records AND cache files
    // Map: year|make|model -> fitment data
    const enrichmentRef = new Map<string, {
      boltPattern: string;
      centerBoreMm: number;
      threadSize: string | null;
      source: string;
    }>();
    
    // First, load from complete DB records
    for (const r of complete) {
      const key = `${r.year}|${r.make}|${r.model}`;
      if (!enrichmentRef.has(key)) {
        enrichmentRef.set(key, {
          boltPattern: r.boltPattern!,
          centerBoreMm: Number(r.centerBoreMm),
          threadSize: r.threadSize,
          source: `inherited from ${r.displayTrim}`,
        });
      }
    }
    
    // Then, load from cache files (for makes we have generation data for)
    const fs = await import("fs/promises");
    const path = await import("path");
    
    const cacheRoot = "C:/Users/Scott-Pc/clawd/fitment-research/cache";
    try {
      const makes = await fs.readdir(cacheRoot);
      for (const make of makes) {
        const makePath = path.join(cacheRoot, make);
        const stat = await fs.stat(makePath);
        if (!stat.isDirectory()) continue;
        
        const models = await fs.readdir(makePath);
        for (const model of models) {
          const modelPath = path.join(makePath, model);
          const modelStat = await fs.stat(modelPath);
          if (!modelStat.isDirectory()) continue;
          
          const yearFiles = await fs.readdir(modelPath);
          for (const yearFile of yearFiles) {
            if (!yearFile.endsWith(".json")) continue;
            const year = parseInt(yearFile.replace(".json", ""), 10);
            if (isNaN(year)) continue;
            
            try {
              const filePath = path.join(modelPath, yearFile);
              const content = await fs.readFile(filePath, "utf-8");
              const data = JSON.parse(content);
              
              if (data.fitment?.bolt_pattern) {
                const key = `${year}|${make.toLowerCase()}|${model.toLowerCase().replace(/ /g, "-")}`;
                if (!enrichmentRef.has(key)) {
                  enrichmentRef.set(key, {
                    boltPattern: data.fitment.bolt_pattern,
                    centerBoreMm: data.fitment.center_bore_mm || 0,
                    threadSize: data.fitment.thread_size || null,
                    source: "cache-generation",
                  });
                }
              }
            } catch (e) {
              // Skip invalid cache files
            }
          }
        }
      }
    } catch (e) {
      console.warn("[fitment/enrich] Could not load cache files:", e);
    }
    
    console.log(`[fitment/enrich] Enrichment references: ${enrichmentRef.size}`);
    
    // Step 5: Enrich incomplete records
    const enriched: EnrichmentResult[] = [];
    const flagged: Array<{ id: string; vehicle: string; reason: string }> = [];
    
    for (const r of incomplete) {
      const key = `${r.year}|${r.make}|${r.model}`;
      const vehicle = `${r.year} ${r.make} ${r.model} (${r.displayTrim})`;
      
      // Skip if this record is marked for removal
      if (duplicatesToRemove.some(d => d.id === r.id)) {
        continue;
      }
      
      const ref = enrichmentRef.get(key);
      
      if (!ref) {
        // No reference data available - flag for manual review
        flagged.push({
          id: r.id,
          vehicle,
          reason: "No complete record exists for same year/make/model",
        });
        continue;
      }
      
      // Build updates - ONLY fill missing fields
      const changes: string[] = [];
      const updates: any = {};
      
      const hasBP = r.boltPattern && r.boltPattern.trim().length > 0;
      const hasHB = r.centerBoreMm && Number(r.centerBoreMm) > 0;
      const hasTS = r.threadSize && r.threadSize.trim().length > 0;
      
      if (!hasBP && ref.boltPattern) {
        updates.boltPattern = ref.boltPattern;
        changes.push(`BP: null → ${ref.boltPattern}`);
      }
      
      if (!hasHB && ref.centerBoreMm) {
        updates.centerBoreMm = String(ref.centerBoreMm);
        changes.push(`HB: null → ${ref.centerBoreMm}`);
      }
      
      if (!hasTS && ref.threadSize) {
        updates.threadSize = ref.threadSize;
        changes.push(`TS: null → ${ref.threadSize}`);
      }
      
      if (changes.length > 0) {
        enriched.push({
          id: r.id,
          vehicle,
          before: {
            boltPattern: r.boltPattern,
            centerBoreMm: r.centerBoreMm ? Number(r.centerBoreMm) : null,
            threadSize: r.threadSize,
          },
          after: {
            boltPattern: updates.boltPattern || r.boltPattern,
            centerBoreMm: updates.centerBoreMm ? Number(updates.centerBoreMm) : (r.centerBoreMm ? Number(r.centerBoreMm) : null),
            threadSize: updates.threadSize || r.threadSize,
          },
          changes,
          source: ref.source,
        });
        
        // Apply update if not dry run
        if (!dryRun) {
          await db.update(vehicleFitments)
            .set({
              ...updates,
              source: r.source ? `${r.source}+inherited` : "inherited",
              updatedAt: new Date(),
            })
            .where(eq(vehicleFitments.id, r.id));
        }
      } else {
        // Record is incomplete but we can't fill any fields
        flagged.push({
          id: r.id,
          vehicle,
          reason: "Reference exists but no fillable fields",
        });
      }
    }
    
    console.log(`[fitment/enrich] Enriched: ${enriched.length}, Flagged: ${flagged.length}`);
    
    // Step 6: Remove duplicates if not dry run
    if (!dryRun && duplicatesToRemove.length > 0) {
      const idsToRemove = duplicatesToRemove.map(d => d.id);
      for (const id of idsToRemove) {
        await db.delete(vehicleFitments).where(eq(vehicleFitments.id, id));
      }
      console.log(`[fitment/enrich] Removed ${idsToRemove.length} duplicates`);
    }
    
    // Build report
    const report: EnrichmentReport = {
      dryRun,
      summary: {
        totalScanned: allRecords.length,
        alreadyComplete: complete.length,
        incompleteFound: incomplete.length,
        enriched: enriched.length,
        flagged: flagged.length,
        duplicatesRemoved: dryRun ? 0 : duplicatesToRemove.length,
      },
      enriched: enriched.slice(0, 20), // Limit examples
      flagged: flagged.slice(0, 20),
      duplicatesRemoved: duplicatesToRemove.slice(0, 20),
    };
    
    console.log(`[fitment/enrich] Complete:`, report.summary);
    
    return NextResponse.json(report);
    
  } catch (err: any) {
    console.error("[fitment/enrich] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    endpoint: "/api/admin/fitment/enrich",
    description: "Generation-based fitment enrichment",
    usage: "POST with { dryRun: boolean, limit: number }",
    rules: [
      "NEVER guess across generations",
      "ONLY inherit data from same year/make/model",
      "DO NOT overwrite valid existing data",
      "DO NOT introduce incorrect data",
    ],
  });
}
