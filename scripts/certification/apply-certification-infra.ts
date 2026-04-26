/**
 * Apply Certification Infrastructure
 * 
 * Runs:
 * 1. Schema migration (add columns)
 * 2. Backfill certified_at for existing certified records
 * 3. Verify setup
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const CERTIFICATION_VERSION = 'v1.0.0-initial';

async function main() {
  console.log('='.repeat(70));
  console.log('APPLYING CERTIFICATION INFRASTRUCTURE');
  console.log('='.repeat(70));
  console.log('');
  
  const client = await pool.connect();
  
  try {
    // PHASE 1: Add metadata columns
    console.log('📋 PHASE 1: Adding metadata columns...');
    
    // Check existing columns
    const { rows: cols } = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'vehicle_fitments'
    `);
    const existingCols = new Set(cols.map(c => c.column_name));
    
    // Add certified_at
    if (!existingCols.has('certified_at')) {
      await client.query('ALTER TABLE vehicle_fitments ADD COLUMN certified_at TIMESTAMPTZ');
      console.log('  ✅ Added certified_at column');
    } else {
      console.log('  ⏭️  certified_at already exists');
    }
    
    // Add certified_by_script_version
    if (!existingCols.has('certified_by_script_version')) {
      await client.query('ALTER TABLE vehicle_fitments ADD COLUMN certified_by_script_version VARCHAR(50)');
      console.log('  ✅ Added certified_by_script_version column');
    } else {
      console.log('  ⏭️  certified_by_script_version already exists');
    }
    
    // Add quarantined_at
    if (!existingCols.has('quarantined_at')) {
      await client.query('ALTER TABLE vehicle_fitments ADD COLUMN quarantined_at TIMESTAMPTZ');
      console.log('  ✅ Added quarantined_at column');
    } else {
      console.log('  ⏭️  quarantined_at already exists');
    }
    
    // Ensure certification_errors exists
    if (!existingCols.has('certification_errors')) {
      await client.query("ALTER TABLE vehicle_fitments ADD COLUMN certification_errors JSONB DEFAULT '[]'::jsonb");
      console.log('  ✅ Added certification_errors column');
    } else {
      console.log('  ⏭️  certification_errors already exists');
    }
    
    // Ensure audit_original_data exists
    if (!existingCols.has('audit_original_data')) {
      await client.query('ALTER TABLE vehicle_fitments ADD COLUMN audit_original_data JSONB');
      console.log('  ✅ Added audit_original_data column');
    } else {
      console.log('  ⏭️  audit_original_data already exists');
    }
    
    // Create indexes
    console.log('\n📋 Creating indexes...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_vehicle_fitments_certification_status 
      ON vehicle_fitments(certification_status)
    `);
    console.log('  ✅ Index on certification_status');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_vehicle_fitments_certified_at 
      ON vehicle_fitments(certified_at)
    `);
    console.log('  ✅ Index on certified_at');
    
    // PHASE 2: Backfill certified_at for existing certified records
    console.log('\n📋 PHASE 2: Backfilling certified_at...');
    
    const { rowCount: backfilled } = await client.query(`
      UPDATE vehicle_fitments 
      SET 
        certified_at = COALESCE(updated_at, created_at, NOW()),
        certified_by_script_version = $1
      WHERE certification_status = 'certified' 
        AND certified_at IS NULL
    `, [CERTIFICATION_VERSION]);
    
    console.log(`  ✅ Backfilled ${backfilled} records`);
    
    // PHASE 3: Verify
    console.log('\n📋 PHASE 3: Verifying setup...');
    
    const { rows: verify } = await client.query(`
      SELECT 
        certification_status,
        COUNT(*)::int as count,
        COUNT(certified_at)::int as has_certified_at,
        COUNT(certified_by_script_version)::int as has_version
      FROM vehicle_fitments
      GROUP BY certification_status
      ORDER BY count DESC
    `);
    
    console.log('\n  Status breakdown:');
    for (const r of verify) {
      console.log(`    ${r.certification_status || 'NULL'}: ${r.count} (${r.has_certified_at} with timestamp, ${r.has_version} with version)`);
    }
    
    // Final counts
    const { rows: final } = await client.query(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE certification_status = 'certified')::int as certified,
        COUNT(*) FILTER (WHERE certification_status = 'needs_review')::int as needs_review,
        COUNT(*) FILTER (WHERE certification_status = 'quarantined')::int as quarantined
      FROM vehicle_fitments
    `);
    
    const f = final[0];
    const pct = f.total > 0 ? ((f.certified / f.total) * 100).toFixed(2) : '0';
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ CERTIFICATION INFRASTRUCTURE APPLIED');
    console.log('='.repeat(70));
    console.log(`Total:            ${f.total}`);
    console.log(`✅ Certified:     ${f.certified} (${pct}%)`);
    console.log(`⚠️  Needs Review: ${f.needs_review}`);
    console.log(`🚫 Quarantined:   ${f.quarantined}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Import scripts must use: import { certifyOnUpdate } from "@/lib/certification"');
    console.log('  2. Run certification: npx tsx scripts/run-fitment-certification.ts --report');
    console.log('  3. Admin API: GET /api/admin/certification/status');
    
  } finally {
    client.release();
  }
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
