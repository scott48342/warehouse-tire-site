/**
 * Fill HD Truck Records from Templates
 * 
 * Uses platform-based templates to fill missing wheel specs for HD trucks.
 * Bypasses inheritance - directly applies verified OEM data.
 * 
 * NON-NEGOTIABLE: NO REGRESSION.
 * - Only fills records with missing/incomplete wheel specs
 * - Does NOT overwrite existing valid data
 * - Validates platform match before applying
 * 
 * Usage: npx tsx scripts/fitment-audit/fill-hd-from-templates.ts [--dry-run]
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
import * as fs from "fs/promises";
import {
  getHdPlatform,
  applyHdTemplate,
  validatePlatformMatch,
  isDRW,
  HD_TEMPLATES,
  PlatformMatch,
  AppliedFitment,
} from "../../src/lib/fitment/hd-templates";

const { Pool } = pg;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface FillResult {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  status: 'filled' | 'skipped' | 'blocked' | 'error';
  reason?: string;
  templateId?: string;
  wheelType?: 'srw' | 'drw';
  confidence?: string;
  before: {
    boltPattern?: string;
    oemWheelSizes?: any;
  };
  after?: {
    boltPattern?: string;
    oemWheelSizes?: any;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function hasValidWheelSpecs(oemWheelSizes: any): boolean {
  if (!oemWheelSizes || !Array.isArray(oemWheelSizes)) return false;
  if (oemWheelSizes.length === 0) return false;
  return oemWheelSizes.some((ws: any) => 
    ws && typeof ws === 'object' && 
    (ws.diameter > 0 || ws.rim_diameter > 0)
  );
}

function isHdModel(model: string): boolean {
  return /2500|3500|f-?250|f-?350|titan.?xd/i.test(model);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║    FILL HD TRUCKS FROM TEMPLATES                               ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "🔴 LIVE"}`);
  console.log(`Templates loaded: ${HD_TEMPLATES.length}\n`);
  
  const results: FillResult[] = [];
  let filledCount = 0;
  let skippedHasData = 0;
  let skippedNoTemplate = 0;
  let blockedValidation = 0;
  let errorCount = 0;
  
  const client = await pool.connect();
  
  try {
    // Get all HD truck records
    const { rows: hdRecords } = await client.query(`
      SELECT id, year, make, model, display_trim, bolt_pattern, oem_wheel_sizes, 
             center_bore_mm, thread_size, source
      FROM vehicle_fitments
      WHERE (
        model ILIKE '%2500%' OR model ILIKE '%3500%' OR
        model ILIKE '%f-250%' OR model ILIKE '%f-350%' OR
        model ILIKE 'titan-xd%' OR model ILIKE 'titan xd%'
      )
      ORDER BY make, model, year
    `);
    
    console.log(`Found ${hdRecords.length} HD truck records\n`);
    
    let processed = 0;
    for (const rec of hdRecords) {
      processed++;
      if (processed % 100 === 0) {
        console.log(`Processing ${processed}/${hdRecords.length}...`);
      }
      
      const { id, year, make, model, display_trim: trim } = rec;
      
      // Check if already has valid wheel specs
      if (hasValidWheelSpecs(rec.oem_wheel_sizes)) {
        results.push({
          id,
          year,
          make,
          model,
          trim,
          status: 'skipped',
          reason: 'Already has valid wheel specs',
          before: { boltPattern: rec.bolt_pattern, oemWheelSizes: rec.oem_wheel_sizes },
        });
        skippedHasData++;
        continue;
      }
      
      // Get platform match
      const match = getHdPlatform(year, make, model, trim);
      
      if (!match) {
        results.push({
          id,
          year,
          make,
          model,
          trim,
          status: 'skipped',
          reason: 'No matching template',
          before: { boltPattern: rec.bolt_pattern, oemWheelSizes: rec.oem_wheel_sizes },
        });
        skippedNoTemplate++;
        continue;
      }
      
      // Validate match
      const validation = validatePlatformMatch(year, make, model, trim, match);
      
      if (!validation.valid) {
        results.push({
          id,
          year,
          make,
          model,
          trim,
          status: 'blocked',
          reason: validation.errors.join('; '),
          templateId: match.platformId,
          before: { boltPattern: rec.bolt_pattern, oemWheelSizes: rec.oem_wheel_sizes },
        });
        blockedValidation++;
        continue;
      }
      
      // Apply template
      const fitment = applyHdTemplate(match);
      
      // Build update data
      const oemWheelSizes = fitment.oemWheelSizes.map(ws => ({
        diameter: ws.diameter,
        width: ws.width,
        offset: ws.offset,
      }));
      
      // Keep source short to avoid varchar(50) overflow
      const templateShort = match.platformId.replace(/_gen\d+_\d+.*$/, '');
      const sourceNote = ` [tpl:${templateShort}]`;
      
      if (!dryRun) {
        try {
          await client.query(`
            UPDATE vehicle_fitments
            SET 
              bolt_pattern = $1,
              center_bore_mm = $2,
              thread_size = $3,
              seat_type = $4,
              oem_wheel_sizes = $5,
              offset_min_mm = $6,
              offset_max_mm = $7,
              source = COALESCE(source, '') || $8::text
            WHERE id = $9
          `, [
            fitment.boltPattern,
            fitment.centerBoreMm,
            fitment.threadSize,
            fitment.seatType,
            JSON.stringify(oemWheelSizes),
            fitment.offsetMinMm,
            fitment.offsetMaxMm,
            sourceNote,
            id,
          ]);
          
          filledCount++;
        } catch (err: any) {
          results.push({
            id,
            year,
            make,
            model,
            trim,
            status: 'error',
            reason: err.message,
            templateId: match.platformId,
            before: { boltPattern: rec.bolt_pattern, oemWheelSizes: rec.oem_wheel_sizes },
          });
          errorCount++;
          continue;
        }
      } else {
        filledCount++;
      }
      
      results.push({
        id,
        year,
        make,
        model,
        trim,
        status: 'filled',
        templateId: match.platformId,
        wheelType: match.wheelType,
        confidence: match.confidence,
        before: { boltPattern: rec.bolt_pattern, oemWheelSizes: rec.oem_wheel_sizes },
        after: { boltPattern: fitment.boltPattern, oemWheelSizes: oemWheelSizes },
      });
    }
    
  } finally {
    client.release();
    await pool.end();
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║                        FILL SUMMARY                            ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");
  
  console.log(`✅ Filled from templates: ${filledCount}`);
  console.log(`⏭️  Skipped (already has data): ${skippedHasData}`);
  console.log(`⏭️  Skipped (no template): ${skippedNoTemplate}`);
  console.log(`🚫 Blocked (validation): ${blockedValidation}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`\nTotal processed: ${results.length}`);
  
  // By template
  const byTemplate: Record<string, number> = {};
  results.filter(r => r.status === 'filled').forEach(r => {
    byTemplate[r.templateId || 'unknown'] = (byTemplate[r.templateId || 'unknown'] || 0) + 1;
  });
  console.log("\n═══ BY TEMPLATE ═══");
  Object.entries(byTemplate).sort((a, b) => b[1] - a[1])
    .forEach(([t, c]) => console.log(`  ${t}: ${c}`));
  
  // By model
  const byModel: Record<string, number> = {};
  results.filter(r => r.status === 'filled').forEach(r => {
    const key = `${r.make}/${r.model}`;
    byModel[key] = (byModel[key] || 0) + 1;
  });
  console.log("\n═══ BY MODEL (FILLED) ═══");
  Object.entries(byModel).sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([m, c]) => console.log(`  ${m}: ${c}`));
  
  // SRW vs DRW
  const srwCount = results.filter(r => r.status === 'filled' && r.wheelType === 'srw').length;
  const drwCount = results.filter(r => r.status === 'filled' && r.wheelType === 'drw').length;
  console.log(`\n═══ WHEEL TYPE ═══`);
  console.log(`  SRW: ${srwCount}`);
  console.log(`  DRW: ${drwCount}`);
  
  // Skipped no template breakdown
  const noTemplateByModel: Record<string, number> = {};
  results.filter(r => r.status === 'skipped' && r.reason === 'No matching template').forEach(r => {
    const key = `${r.make}/${r.model}`;
    noTemplateByModel[key] = (noTemplateByModel[key] || 0) + 1;
  });
  if (Object.keys(noTemplateByModel).length > 0) {
    console.log("\n═══ NO TEMPLATE (need to add) ═══");
    Object.entries(noTemplateByModel).sort((a, b) => b[1] - a[1])
      .forEach(([m, c]) => console.log(`  ${m}: ${c}`));
  }
  
  // Sample outputs
  console.log("\n═══ SAMPLE OUTPUTS ═══");
  const samples = results.filter(r => r.status === 'filled').slice(0, 3);
  samples.forEach(s => {
    console.log(`\n${s.year} ${s.make} ${s.model} "${s.trim || 'Base'}":`);
    console.log(`  Template: ${s.templateId}`);
    console.log(`  Type: ${s.wheelType?.toUpperCase()}`);
    console.log(`  Bolt: ${s.after?.boltPattern}`);
    console.log(`  OEM sizes: ${JSON.stringify(s.after?.oemWheelSizes)}`);
  });
  
  // Save log
  const logPath = path.resolve(__dirname, "fill-hd-templates-log.json");
  await fs.writeFile(logPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    mode: dryRun ? "dry-run" : "live",
    summary: {
      filled: filledCount,
      skippedHasData,
      skippedNoTemplate,
      blockedValidation,
      errors: errorCount,
      total: results.length,
    },
    byTemplate,
    byModel,
    results: results.slice(0, 500),
  }, null, 2));
  console.log(`\n📄 Log saved to: ${logPath}`);
  
  if (dryRun) {
    console.log("\n⚠️  DRY RUN - No changes made. Run without --dry-run to apply.");
  } else {
    console.log("\n✅ FILL COMPLETE. Run wheel audit to verify.");
  }
}

main().catch(console.error);
