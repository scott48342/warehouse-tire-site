import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });
const { Pool } = pg;

const DRY_RUN = process.argv.includes('--dry-run');
const EXECUTE = process.argv.includes('--execute');

if (!DRY_RUN && !EXECUTE) {
  console.log('Usage: node fitment-cleanup-v2.mjs --dry-run | --execute');
  process.exit(1);
}

console.log(`\n=== FITMENT CLEANUP v2 (${DRY_RUN ? 'DRY RUN' : '🚨 EXECUTING'}) ===\n`);

const url = process.env.POSTGRES_URL;
const pool = new Pool({
  connectionString: url,
  ssl: url?.includes('neon') || url?.includes('prisma') ? { rejectUnauthorized: false } : undefined
});

const stats = {
  phase1_removed: 0,
  phase1_filled: 0,
  phase2_fixed: 0,
  phase3_flagged: 0,
  phase4_normalized: 0,
  total_before: 0,
  total_after: 0
};

async function main() {
  const before = await pool.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments`);
  stats.total_before = parseInt(before.rows[0].cnt);
  console.log(`Starting records: ${stats.total_before}`);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1A: Try to fill missing tire/wheel sizes from similar vehicles
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n--- PHASE 1A: Fill missing sizes from similar vehicles ---');
  
  // Find records missing sizes but have good fitment data
  const needsSizes = await pool.query(`
    SELECT id, year, make, model, raw_trim, bolt_pattern, center_bore_mm
    FROM vehicle_fitments 
    WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes = 'null'::jsonb)
      AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes = 'null'::jsonb)
      AND bolt_pattern IS NOT NULL AND bolt_pattern != ''
  `);
  
  console.log(`Records needing sizes but have bolt pattern: ${needsSizes.rows.length}`);
  
  let filled = 0;
  let filledRecords = [];
  
  for (const rec of needsSizes.rows) {
    // Look for same make/model within ±2 years that HAS sizes
    const donor = await pool.query(`
      SELECT oem_tire_sizes, oem_wheel_sizes
      FROM vehicle_fitments 
      WHERE make = $1 
        AND model = $2 
        AND bolt_pattern = $3
        AND ABS(year - $4) <= 2
        AND oem_tire_sizes IS NOT NULL 
        AND oem_tire_sizes != '[]'::jsonb 
        AND oem_tire_sizes != 'null'::jsonb
        AND oem_wheel_sizes IS NOT NULL 
        AND oem_wheel_sizes != '[]'::jsonb 
        AND oem_wheel_sizes != 'null'::jsonb
      ORDER BY ABS(year - $4) ASC
      LIMIT 1
    `, [rec.make, rec.model, rec.bolt_pattern, rec.year]);
    
    if (donor.rows.length > 0) {
      filled++;
      filledRecords.push({
        id: rec.id,
        vehicle: `${rec.year} ${rec.make} ${rec.model}`,
        tires: donor.rows[0].oem_tire_sizes,
        wheels: donor.rows[0].oem_wheel_sizes
      });
    }
  }
  
  console.log(`Can fill sizes for: ${filled} records`);
  
  if (filled > 0) {
    console.log('Sample fills:');
    for (const f of filledRecords.slice(0, 5)) {
      console.log(`  ${f.vehicle} <- tires: ${JSON.stringify(f.tires).slice(0,50)}...`);
    }
  }
  
  if (EXECUTE && filledRecords.length > 0) {
    for (const f of filledRecords) {
      await pool.query(`
        UPDATE vehicle_fitments 
        SET oem_tire_sizes = $1::jsonb,
            oem_wheel_sizes = $2::jsonb,
            source = source || ' [sizes-inherited]',
            updated_at = NOW()
        WHERE id = $3
      `, [JSON.stringify(f.tires), JSON.stringify(f.wheels), f.id]);
    }
    console.log(`✅ Filled ${filledRecords.length} records with inherited sizes`);
    stats.phase1_filled = filledRecords.length;
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1B: Remove TRULY invalid records (no bolt pattern AND no sizes)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n--- PHASE 1B: Remove truly invalid records ---');
  
  const trulyInvalid = await pool.query(`
    SELECT id, year, make, model, raw_trim, source
    FROM vehicle_fitments 
    WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes = 'null'::jsonb)
      AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes = 'null'::jsonb)
      AND (bolt_pattern IS NULL OR bolt_pattern = '')
      AND (center_bore_mm IS NULL)
  `);
  
  stats.phase1_removed = trulyInvalid.rows.length;
  console.log(`Truly invalid records (no sizes, no bolt pattern): ${stats.phase1_removed}`);
  
  if (stats.phase1_removed > 0) {
    console.log('Sample:');
    for (const r of trulyInvalid.rows.slice(0, 5)) {
      console.log(`  ${r.year} ${r.make} ${r.model} ${r.raw_trim || ''}`);
    }
  }
  
  if (EXECUTE && stats.phase1_removed > 0) {
    const delResult = await pool.query(`
      DELETE FROM vehicle_fitments 
      WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes = 'null'::jsonb)
        AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes = 'null'::jsonb)
        AND (bolt_pattern IS NULL OR bolt_pattern = '')
        AND (center_bore_mm IS NULL)
    `);
    console.log(`✅ Deleted ${delResult.rowCount} truly invalid records`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: Fix malformed tire sizes (remove old bias-ply formats)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n--- PHASE 2: Clean malformed tire sizes ---');
  
  const allTires = await pool.query(`
    SELECT id, oem_tire_sizes 
    FROM vehicle_fitments 
    WHERE oem_tire_sizes IS NOT NULL 
      AND oem_tire_sizes != '[]'::jsonb 
      AND oem_tire_sizes != 'null'::jsonb
  `);
  
  let fixable = [];
  
  for (const r of allTires.rows) {
    const sizes = r.oem_tire_sizes;
    if (!Array.isArray(sizes)) continue;
    
    let cleaned = [];
    let hasOldFormat = false;
    
    for (const size of sizes) {
      const sizeStr = typeof size === 'string' ? size : (size?.size || '');
      
      // Skip old bias-ply formats (GR70-15, E78-14, etc)
      if (sizeStr.match(/^[A-Z]R?\d{2}-\d{2}$/i) || 
          sizeStr.match(/^[A-Z]\d{2,3}[-x]\d{2}$/i)) {
        hasOldFormat = true;
        continue;
      }
      
      // Keep valid radial formats
      if (sizeStr.match(/\d{2,3}\/\d{2,3}[RZ]\d{2}/i) ||
          sizeStr.match(/^\d{2,3}x[\d.]+R\d{2}/i) ||
          sizeStr.match(/^[PLT]?\d{2,3}\/\d{2,3}R\d{2}/i)) {
        cleaned.push(size);
      }
    }
    
    if (hasOldFormat && cleaned.length > 0 && cleaned.length !== sizes.length) {
      fixable.push({ id: r.id, original: sizes, fixed: cleaned });
    }
  }
  
  stats.phase2_fixed = fixable.length;
  console.log(`Records with old bias-ply formats to clean: ${stats.phase2_fixed}`);
  
  if (fixable.length > 0) {
    console.log('Sample:');
    for (const f of fixable.slice(0, 3)) {
      console.log(`  ${JSON.stringify(f.original)} -> ${JSON.stringify(f.fixed)}`);
    }
  }
  
  if (EXECUTE && fixable.length > 0) {
    for (const f of fixable) {
      await pool.query(`
        UPDATE vehicle_fitments 
        SET oem_tire_sizes = $1::jsonb,
            updated_at = NOW()
        WHERE id = $2
      `, [JSON.stringify(f.fixed), f.id]);
    }
    console.log(`✅ Cleaned ${fixable.length} tire size arrays`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: Mark records with missing sizes as 'partial'
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n--- PHASE 3: Flag partial records ---');
  
  const stillMissing = await pool.query(`
    SELECT COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE ((oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes = 'null'::jsonb)
        OR (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes = 'null'::jsonb))
      AND quality_tier != 'partial'
      AND bolt_pattern IS NOT NULL
  `);
  
  stats.phase3_flagged = parseInt(stillMissing.rows[0].cnt);
  console.log(`Records to flag as partial: ${stats.phase3_flagged}`);
  
  if (EXECUTE && stats.phase3_flagged > 0) {
    const updateResult = await pool.query(`
      UPDATE vehicle_fitments 
      SET quality_tier = 'partial',
          updated_at = NOW()
      WHERE ((oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes = 'null'::jsonb)
          OR (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes = 'null'::jsonb))
        AND quality_tier != 'partial'
        AND bolt_pattern IS NOT NULL
    `);
    console.log(`✅ Flagged ${updateResult.rowCount} records as partial`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 4: Normalize quality_tier
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n--- PHASE 4: Normalize quality tiers ---');
  
  // Promote records with full data to 'complete'
  const canPromote = await pool.query(`
    SELECT COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE oem_tire_sizes IS NOT NULL AND oem_tire_sizes != '[]'::jsonb AND oem_tire_sizes != 'null'::jsonb
      AND oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes != '[]'::jsonb AND oem_wheel_sizes != 'null'::jsonb
      AND bolt_pattern IS NOT NULL AND bolt_pattern != ''
      AND center_bore_mm IS NOT NULL
      AND quality_tier IN ('partial', 'low_confidence', 'medium')
  `);
  
  stats.phase4_normalized = parseInt(canPromote.rows[0].cnt);
  console.log(`Records to promote to 'complete': ${stats.phase4_normalized}`);
  
  if (EXECUTE && stats.phase4_normalized > 0) {
    const promoteResult = await pool.query(`
      UPDATE vehicle_fitments 
      SET quality_tier = 'complete',
          updated_at = NOW()
      WHERE oem_tire_sizes IS NOT NULL AND oem_tire_sizes != '[]'::jsonb AND oem_tire_sizes != 'null'::jsonb
        AND oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes != '[]'::jsonb AND oem_wheel_sizes != 'null'::jsonb
        AND bolt_pattern IS NOT NULL AND bolt_pattern != ''
        AND center_bore_mm IS NOT NULL
        AND quality_tier IN ('partial', 'low_confidence', 'medium')
    `);
    console.log(`✅ Promoted ${promoteResult.rowCount} records to complete`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // FINAL REPORT
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('CLEANUP SUMMARY');
  console.log('='.repeat(60));
  
  const after = await pool.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments`);
  stats.total_after = DRY_RUN ? stats.total_before - stats.phase1_removed : parseInt(after.rows[0].cnt);
  
  // Completeness metrics
  const complete = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments
    WHERE oem_tire_sizes IS NOT NULL AND oem_tire_sizes != '[]'::jsonb
      AND oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes != '[]'::jsonb
  `);
  const withBoltPattern = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments
    WHERE bolt_pattern IS NOT NULL AND bolt_pattern != ''
  `);
  
  const completeCount = parseInt(complete.rows[0].cnt) + (DRY_RUN ? stats.phase1_filled : 0);
  const boltPatternCount = parseInt(withBoltPattern.rows[0].cnt);
  const totalForCalc = DRY_RUN ? stats.total_before : stats.total_after;
  
  console.log(`\nRecords before: ${stats.total_before}`);
  console.log(`Records after:  ${stats.total_after}`);
  console.log(`\nPhase 1A - Sizes filled from similar: ${stats.phase1_filled}`);
  console.log(`Phase 1B - Truly invalid removed: ${stats.phase1_removed}`);
  console.log(`Phase 2 - Tire sizes cleaned: ${stats.phase2_fixed}`);
  console.log(`Phase 3 - Flagged as partial: ${stats.phase3_flagged}`);
  console.log(`Phase 4 - Promoted to complete: ${stats.phase4_normalized}`);
  
  console.log(`\n--- COMPLETENESS ---`);
  console.log(`Full tire+wheel data: ${((completeCount / totalForCalc) * 100).toFixed(1)}% (${completeCount}/${totalForCalc})`);
  console.log(`Has bolt pattern: ${((boltPatternCount / totalForCalc) * 100).toFixed(1)}% (${boltPatternCount}/${totalForCalc})`);
  
  // Quality tier distribution
  const tiers = await pool.query(`
    SELECT quality_tier, COUNT(*) as cnt
    FROM vehicle_fitments
    GROUP BY quality_tier
    ORDER BY cnt DESC
  `);
  console.log(`\n--- QUALITY TIERS ---`);
  for (const t of tiers.rows) {
    console.log(`${t.quality_tier || '(null)'}: ${t.cnt}`);
  }
  
  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN - No changes made. Run with --execute to apply.');
  } else {
    console.log('\n✅ All changes applied successfully.');
  }

  await pool.end();
}

main().catch(console.error);
