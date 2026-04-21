/**
 * PHASE 1: Add quality_tier column to vehicle_fitments
 * 
 * Tiers:
 * - "complete": has wheel specs (diameter + width) AND tire sizes
 * - "partial": has tire sizes but no/incomplete wheel specs  
 * - "low_confidence": missing both OR from unreliable sources
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("PHASE 1: Adding quality_tier column");
console.log("═══════════════════════════════════════════════════════════════════════════\n");

// Step 1: Add column if not exists
console.log("Step 1: Adding quality_tier column...");
await pool.query(`
  ALTER TABLE vehicle_fitments 
  ADD COLUMN IF NOT EXISTS quality_tier VARCHAR(20) DEFAULT 'unknown'
`);
console.log("  ✓ Column added\n");

// Step 2: Add index for fast filtering
console.log("Step 2: Adding index on quality_tier...");
await pool.query(`
  CREATE INDEX IF NOT EXISTS idx_vehicle_fitments_quality_tier 
  ON vehicle_fitments(quality_tier)
`);
console.log("  ✓ Index created\n");

// Step 3: Populate quality_tier based on data completeness
console.log("Step 3: Populating quality_tier values...\n");

// Define low-confidence sources (gap-fill, batch imports without verification)
const lowConfidenceSources = [
  'catalog-gap-fill',
  'luxury-gap-fill', 
  'batch1-fill',
  'batch2v2-trim-groups',
  'batch3-sports-cars',
  'batch4-suvs-sedans',
  'batch5-sports-more',
  'batch6-minivans-evs',
  'batch7-subcompacts-final',
  'final-gap-fill',
  'gap-fix',
  'priority-gap-fill',
];

// Mark "complete" records first (has valid wheel specs + tire sizes)
const completeResult = await pool.query(`
  UPDATE vehicle_fitments
  SET quality_tier = 'complete'
  WHERE 
    -- Has wheel specs with diameter AND width
    oem_wheel_sizes IS NOT NULL 
    AND oem_wheel_sizes != '[]'::jsonb
    AND jsonb_array_length(oem_wheel_sizes) > 0
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(oem_wheel_sizes) AS ws
      WHERE (ws->>'diameter')::numeric >= 13 
        AND (ws->>'diameter')::numeric <= 30
        AND (ws->>'width')::numeric >= 4
        AND (ws->>'width')::numeric <= 14
    )
    -- AND has tire sizes
    AND oem_tire_sizes IS NOT NULL
    AND oem_tire_sizes != '[]'::jsonb
    AND jsonb_array_length(oem_tire_sizes) > 0
    -- AND has bolt pattern
    AND bolt_pattern IS NOT NULL
    AND bolt_pattern != ''
`);
console.log(`  ✓ Marked ${completeResult.rowCount} records as "complete"`);

// Mark "partial" records (has tire sizes but no/invalid wheel specs)
const partialResult = await pool.query(`
  UPDATE vehicle_fitments
  SET quality_tier = 'partial'
  WHERE quality_tier != 'complete'
    AND oem_tire_sizes IS NOT NULL
    AND oem_tire_sizes != '[]'::jsonb
    AND jsonb_array_length(oem_tire_sizes) > 0
    AND bolt_pattern IS NOT NULL
    AND bolt_pattern != ''
`);
console.log(`  ✓ Marked ${partialResult.rowCount} records as "partial"`);

// Mark remaining as "low_confidence"
const lowResult = await pool.query(`
  UPDATE vehicle_fitments
  SET quality_tier = 'low_confidence'
  WHERE quality_tier NOT IN ('complete', 'partial')
`);
console.log(`  ✓ Marked ${lowResult.rowCount} records as "low_confidence"`);

// Downgrade records from low-confidence sources that don't have excellent data
const downgradeResult = await pool.query(`
  UPDATE vehicle_fitments
  SET quality_tier = 'low_confidence'
  WHERE quality_tier = 'partial'
    AND source = ANY($1::text[])
`, [lowConfidenceSources]);
console.log(`  ✓ Downgraded ${downgradeResult.rowCount} gap-fill records to "low_confidence"\n`);

// Step 4: Print summary
console.log("Step 4: Summary\n");
const { rows: summary } = await pool.query(`
  SELECT 
    quality_tier,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as pct
  FROM vehicle_fitments
  WHERE year >= 2000
  GROUP BY quality_tier
  ORDER BY 
    CASE quality_tier 
      WHEN 'complete' THEN 1 
      WHEN 'partial' THEN 2 
      ELSE 3 
    END
`);

console.log("Quality Tier Distribution:");
console.log("─".repeat(40));
for (const row of summary) {
  console.log(`  ${row.quality_tier.padEnd(15)} ${row.count.toString().padStart(7)} (${row.pct}%)`);
}

// Verify no records are "unknown"
const { rows: [unknownCheck] } = await pool.query(`
  SELECT COUNT(*) as count FROM vehicle_fitments WHERE quality_tier = 'unknown'
`);
if (unknownCheck.count > 0) {
  console.log(`\n⚠️ WARNING: ${unknownCheck.count} records still have "unknown" tier`);
}

console.log("\n✅ Phase 1 complete!");
await pool.end();
