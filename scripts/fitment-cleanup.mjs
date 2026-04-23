import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });
const { Pool } = pg;

const DRY_RUN = process.argv.includes('--dry-run');
const EXECUTE = process.argv.includes('--execute');

if (!DRY_RUN && !EXECUTE) {
  console.log('Usage: node fitment-cleanup.mjs --dry-run | --execute');
  process.exit(1);
}

console.log(`\n=== FITMENT CLEANUP (${DRY_RUN ? 'DRY RUN' : '🚨 EXECUTING'}) ===\n`);

const url = process.env.POSTGRES_URL;
const pool = new Pool({
  connectionString: url,
  ssl: url?.includes('neon') || url?.includes('prisma') ? { rejectUnauthorized: false } : undefined
});

const stats = {
  phase1_removed: 0,
  phase2_fixed: 0,
  phase3_flagged: 0,
  phase4_normalized: 0,
  total_before: 0,
  total_after: 0
};

async function main() {
  // Get initial count
  const before = await pool.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments`);
  stats.total_before = parseInt(before.rows[0].cnt);
  console.log(`Starting records: ${stats.total_before}`);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: Remove records with BOTH empty tire_sizes AND wheel_sizes
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n--- PHASE 1: Remove completely empty records ---');
  
  const emptyRecords = await pool.query(`
    SELECT id, year, make, model, raw_trim, source
    FROM vehicle_fitments 
    WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes = 'null'::jsonb)
      AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes = 'null'::jsonb)
  `);
  
  stats.phase1_removed = emptyRecords.rows.length;
  console.log(`Found ${stats.phase1_removed} records with both empty`);
  
  // Show sample of what will be deleted
  console.log('Sample records to remove:');
  for (const r of emptyRecords.rows.slice(0, 10)) {
    console.log(`  ${r.year} ${r.make} ${r.model} ${r.raw_trim || ''} [${r.source || 'no source'}]`);
  }
  
  if (EXECUTE && stats.phase1_removed > 0) {
    const delResult = await pool.query(`
      DELETE FROM vehicle_fitments 
      WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes = 'null'::jsonb)
        AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes = 'null'::jsonb)
    `);
    console.log(`✅ Deleted ${delResult.rowCount} records`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: Validate and fix tire sizes
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n--- PHASE 2: Validate tire sizes ---');
  
  // Find records with potentially bad tire sizes
  const allTireRecords = await pool.query(`
    SELECT id, oem_tire_sizes 
    FROM vehicle_fitments 
    WHERE oem_tire_sizes IS NOT NULL 
      AND oem_tire_sizes != '[]'::jsonb 
      AND oem_tire_sizes != 'null'::jsonb
  `);
  
  let malformedIds = [];
  let fixableSizes = [];
  
  for (const r of allTireRecords.rows) {
    const sizes = r.oem_tire_sizes;
    if (Array.isArray(sizes)) {
      let hasIssue = false;
      let fixedSizes = [];
      
      for (const size of sizes) {
        const sizeStr = typeof size === 'string' ? size : (size?.size || size?.tireSize || '');
        
        // Check for valid tire format: 225/65R17, 33x12.50R20, P245/75R16, etc.
        const standardMatch = sizeStr.match(/^[P]?(\d{2,3})\/(\d{2,3})[RZ](\d{2})(?:[A-Z].*)?$/i);
        const ltMatch = sizeStr.match(/^(?:LT)?(\d{2,3})x?(\d{1,2}(?:\.\d{1,2})?)R(\d{2})(?:LT)?.*$/i);
        
        if (standardMatch) {
          const diameter = parseInt(standardMatch[3]);
          if (diameter < 13 || diameter > 40) {
            hasIssue = true;
          } else {
            fixedSizes.push(sizeStr);
          }
        } else if (ltMatch) {
          const diameter = parseInt(ltMatch[3]);
          if (diameter < 13 || diameter > 40) {
            hasIssue = true;
          } else {
            fixedSizes.push(sizeStr);
          }
        } else if (sizeStr && sizeStr.length > 3) {
          // Non-standard format, check if we can extract diameter
          const diamMatch = sizeStr.match(/R(\d{2})/i);
          if (diamMatch) {
            const diameter = parseInt(diamMatch[1]);
            if (diameter >= 13 && diameter <= 40) {
              fixedSizes.push(sizeStr);
            } else {
              hasIssue = true;
            }
          } else {
            hasIssue = true;
            stats.phase2_fixed++;
          }
        }
      }
      
      if (hasIssue && fixedSizes.length > 0) {
        fixableSizes.push({ id: r.id, original: sizes, fixed: fixedSizes });
      } else if (hasIssue && fixedSizes.length === 0) {
        malformedIds.push(r.id);
      }
    }
  }
  
  console.log(`Records with fixable tire sizes: ${fixableSizes.length}`);
  console.log(`Records with completely malformed tires: ${malformedIds.length}`);
  
  if (fixableSizes.length > 0) {
    console.log('Sample fixable:');
    for (const f of fixableSizes.slice(0, 5)) {
      console.log(`  ${JSON.stringify(f.original)} -> ${JSON.stringify(f.fixed)}`);
    }
  }
  
  // Apply fixes
  if (EXECUTE) {
    for (const fix of fixableSizes) {
      await pool.query(`
        UPDATE vehicle_fitments 
        SET oem_tire_sizes = $1::jsonb,
            updated_at = NOW()
        WHERE id = $2
      `, [JSON.stringify(fix.fixed), fix.id]);
    }
    console.log(`✅ Fixed ${fixableSizes.length} tire size arrays`);
    stats.phase2_fixed = fixableSizes.length;
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: Ensure minimum completeness (at least 1 tire OR 1 wheel)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n--- PHASE 3: Check minimum completeness ---');
  
  // After phase 1, all remaining should have at least one of tire/wheel
  // Let's verify and flag any edge cases
  const partialRecords = await pool.query(`
    SELECT id, year, make, model, raw_trim, 
           oem_tire_sizes IS NOT NULL AND oem_tire_sizes != '[]'::jsonb AND oem_tire_sizes != 'null'::jsonb as has_tires,
           oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes != '[]'::jsonb AND oem_wheel_sizes != 'null'::jsonb as has_wheels,
           quality_tier
    FROM vehicle_fitments
    WHERE NOT (
      (oem_tire_sizes IS NOT NULL AND oem_tire_sizes != '[]'::jsonb AND oem_tire_sizes != 'null'::jsonb)
      AND 
      (oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes != '[]'::jsonb AND oem_wheel_sizes != 'null'::jsonb)
    )
  `);
  
  const tiresOnly = partialRecords.rows.filter(r => r.has_tires && !r.has_wheels);
  const wheelsOnly = partialRecords.rows.filter(r => !r.has_tires && r.has_wheels);
  
  console.log(`Records with tires only (no wheels): ${tiresOnly.length}`);
  console.log(`Records with wheels only (no tires): ${wheelsOnly.length}`);
  
  // Flag these as partial
  if (EXECUTE && (tiresOnly.length > 0 || wheelsOnly.length > 0)) {
    const partialIds = partialRecords.rows.map(r => r.id);
    await pool.query(`
      UPDATE vehicle_fitments 
      SET quality_tier = 'partial',
          updated_at = NOW()
      WHERE id = ANY($1) AND quality_tier != 'partial'
    `, [partialIds]);
    console.log(`✅ Flagged ${partialIds.length} records as 'partial'`);
    stats.phase3_flagged = partialIds.length;
  } else {
    stats.phase3_flagged = partialRecords.rows.length;
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 4: Normalize sources
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n--- PHASE 4: Normalize source tags ---');
  
  // Map sources to tiers
  const sourceMapping = {
    'verified': [
      'verified-research', 'manufacturer_spec', 'manual_research', 'manual-fix', 
      'manual-fix [dealer-verified]', 'drivetrain-split-cleanup'
    ],
    'validated': [
      'generation_inherit', 'generation-baseline', 'generation_template', 'generation_import',
      'cache-import', 'tier-a-import', 'api_import', 'railway_import', 'platform_inheritance_ld',
      'platform_inheritance_lx', 'merge_consolidation'
    ],
    'fallback': [
      'batch1-fill', 'batch2v2-trim-groups', 'batch3-sports-cars', 'batch4-suvs-sedans',
      'batch5-sports-more', 'batch6-minivans-evs', 'batch7-subcompacts-final', 
      'final-gap-fill', 'catalog-gap-fill', 'luxury-gap-fill', 'gap-fix', 'priority-fix'
    ]
  };
  
  // Count current source diversity
  const sourceGroups = await pool.query(`
    SELECT 
      CASE 
        WHEN source ILIKE '%verified%' OR source ILIKE '%manufacturer%' OR source ILIKE '%manual%dealer%' THEN 'verified'
        WHEN source ILIKE '%generation%' OR source ILIKE '%cache-import%' OR source ILIKE '%api_import%' OR source ILIKE '%tier-a%' THEN 'validated'
        WHEN source ILIKE '%batch%' OR source ILIKE '%gap%fill%' OR source ILIKE '%fallback%' THEN 'fallback'
        ELSE 'other'
      END as source_group,
      COUNT(*) as cnt
    FROM vehicle_fitments
    GROUP BY 1
    ORDER BY cnt DESC
  `);
  
  console.log('Source distribution by category:');
  for (const r of sourceGroups.rows) {
    console.log(`  ${r.source_group}: ${r.cnt}`);
  }
  
  // Update quality_tier based on source patterns for records that don't have it set correctly
  if (EXECUTE) {
    // Set 'high' tier for verified sources
    const verifiedUpdate = await pool.query(`
      UPDATE vehicle_fitments 
      SET quality_tier = 'high',
          updated_at = NOW()
      WHERE (source ILIKE '%verified%' OR source ILIKE '%manufacturer%' OR source ILIKE '%manual%dealer%')
        AND quality_tier NOT IN ('high', 'complete')
    `);
    
    // Set 'low_confidence' for fallback sources that aren't already marked
    const fallbackUpdate = await pool.query(`
      UPDATE vehicle_fitments 
      SET quality_tier = 'low_confidence',
          updated_at = NOW()
      WHERE (source ILIKE '%batch%' AND source NOT LIKE '%web_research%')
        AND quality_tier NOT IN ('complete', 'high')
        AND quality_tier IS DISTINCT FROM 'low_confidence'
    `);
    
    stats.phase4_normalized = verifiedUpdate.rowCount + fallbackUpdate.rowCount;
    console.log(`✅ Normalized ${stats.phase4_normalized} quality tier tags`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // FINAL REPORT
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('CLEANUP SUMMARY');
  console.log('='.repeat(60));
  
  const after = await pool.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments`);
  stats.total_after = parseInt(after.rows[0].cnt);
  
  // Completeness check
  const complete = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments
    WHERE (oem_tire_sizes IS NOT NULL AND oem_tire_sizes != '[]'::jsonb AND oem_tire_sizes != 'null'::jsonb)
      AND (oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes != '[]'::jsonb AND oem_wheel_sizes != 'null'::jsonb)
  `);
  const completeCount = parseInt(complete.rows[0].cnt);
  const completeness = ((completeCount / stats.total_after) * 100).toFixed(1);
  
  console.log(`\nRecords before: ${stats.total_before}`);
  console.log(`Records after:  ${stats.total_after}`);
  console.log(`Records removed (Phase 1): ${stats.phase1_removed}`);
  console.log(`Tire sizes fixed (Phase 2): ${stats.phase2_fixed}`);
  console.log(`Flagged partial (Phase 3): ${stats.phase3_flagged}`);
  console.log(`Sources normalized (Phase 4): ${stats.phase4_normalized}`);
  console.log(`\nCompleteness: ${completeness}% (${completeCount}/${stats.total_after} have both tires and wheels)`);
  
  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN - No changes made. Run with --execute to apply.');
  } else {
    console.log('\n✅ All changes applied successfully.');
  }

  await pool.end();
}

main().catch(console.error);
