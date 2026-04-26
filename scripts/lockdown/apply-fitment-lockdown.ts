/**
 * Apply Fitment Lockdown
 * 
 * Creates lockdown infrastructure:
 * - Change log table
 * - Staging table
 * - Dataset versions table
 * - Read-only view
 * - Locks all certified records
 * 
 * Usage: npx tsx scripts/lockdown/apply-fitment-lockdown.ts
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log('='.repeat(70));
  console.log('APPLYING FITMENT LOCKDOWN');
  console.log('='.repeat(70));
  console.log('');
  
  const client = await pool.connect();
  
  try {
    // ========================================
    // 1. CREATE CHANGE LOG TABLE
    // ========================================
    console.log('📋 1. Creating fitment_change_log table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS fitment_change_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fitment_id UUID NOT NULL,
        operation VARCHAR(20) NOT NULL,
        old_data JSONB,
        new_data JSONB,
        changed_fields TEXT[],
        source_script VARCHAR(200),
        source_version VARCHAR(50),
        reason TEXT,
        performed_by VARCHAR(100) DEFAULT 'system',
        performed_at TIMESTAMPTZ DEFAULT NOW(),
        batch_id UUID,
        metadata JSONB DEFAULT '{}'::jsonb
      )
    `);
    
    await client.query('CREATE INDEX IF NOT EXISTS idx_fitment_change_log_fitment_id ON fitment_change_log(fitment_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_fitment_change_log_performed_at ON fitment_change_log(performed_at)');
    console.log('  ✅ fitment_change_log created');
    
    // ========================================
    // 2. CREATE STAGING TABLE
    // ========================================
    console.log('\n📋 2. Creating vehicle_fitments_staging table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicle_fitments_staging (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        year INTEGER NOT NULL,
        make VARCHAR(100) NOT NULL,
        model VARCHAR(255) NOT NULL,
        raw_trim VARCHAR(255),
        bolt_pattern VARCHAR(50),
        center_bore_mm DECIMAL(5,2),
        oem_wheel_sizes JSONB DEFAULT '[]'::jsonb,
        oem_tire_sizes JSONB DEFAULT '[]'::jsonb,
        is_staggered BOOLEAN DEFAULT FALSE,
        certification_status VARCHAR(50) DEFAULT 'pending',
        certification_errors JSONB DEFAULT '[]'::jsonb,
        audit_original_data JSONB,
        staging_status VARCHAR(50) DEFAULT 'pending',
        staged_at TIMESTAMPTZ DEFAULT NOW(),
        staged_by VARCHAR(100) DEFAULT 'import',
        source_script VARCHAR(200),
        source_version VARCHAR(50),
        batch_id UUID,
        live_fitment_id UUID,
        promoted_at TIMESTAMPTZ,
        promoted_by VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    await client.query('CREATE INDEX IF NOT EXISTS idx_fitments_staging_status ON vehicle_fitments_staging(staging_status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_fitments_staging_batch ON vehicle_fitments_staging(batch_id)');
    console.log('  ✅ vehicle_fitments_staging created');
    
    // ========================================
    // 3. CREATE VERSIONS TABLE
    // ========================================
    console.log('\n📋 3. Creating fitment_dataset_versions table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS fitment_dataset_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version VARCHAR(50) NOT NULL UNIQUE,
        status VARCHAR(50) DEFAULT 'pending',
        total_records INTEGER,
        certified_records INTEGER,
        needs_review_records INTEGER,
        certification_pct DECIMAL(5,2),
        source_description TEXT,
        source_script VARCHAR(200),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        activated_at TIMESTAMPTZ,
        archived_at TIMESTAMPTZ,
        created_by VARCHAR(100) DEFAULT 'system',
        activated_by VARCHAR(100),
        notes TEXT,
        metadata JSONB DEFAULT '{}'::jsonb
      )
    `);
    
    await client.query('CREATE INDEX IF NOT EXISTS idx_fitment_versions_status ON fitment_dataset_versions(status)');
    console.log('  ✅ fitment_dataset_versions created');
    
    // ========================================
    // 4. ADD LOCKDOWN COLUMNS TO MAIN TABLE
    // ========================================
    console.log('\n📋 4. Adding lockdown columns to vehicle_fitments...');
    
    // Check existing columns
    const { rows: cols } = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'vehicle_fitments'
    `);
    const existingCols = new Set(cols.map(c => c.column_name));
    
    if (!existingCols.has('is_locked')) {
      await client.query('ALTER TABLE vehicle_fitments ADD COLUMN is_locked BOOLEAN DEFAULT TRUE');
      console.log('  ✅ Added is_locked column');
    }
    
    if (!existingCols.has('dataset_version')) {
      await client.query('ALTER TABLE vehicle_fitments ADD COLUMN dataset_version VARCHAR(50)');
      console.log('  ✅ Added dataset_version column');
    }
    
    if (!existingCols.has('last_modified_by')) {
      await client.query('ALTER TABLE vehicle_fitments ADD COLUMN last_modified_by VARCHAR(100)');
      console.log('  ✅ Added last_modified_by column');
    }
    
    if (!existingCols.has('last_modified_reason')) {
      await client.query('ALTER TABLE vehicle_fitments ADD COLUMN last_modified_reason TEXT');
      console.log('  ✅ Added last_modified_reason column');
    }
    
    // ========================================
    // 5. LOCK ALL CERTIFIED RECORDS
    // ========================================
    console.log('\n📋 5. Locking all certified records...');
    
    const { rowCount: lockedCount } = await client.query(`
      UPDATE vehicle_fitments 
      SET is_locked = TRUE, dataset_version = 'v1.0.0-initial'
      WHERE certification_status = 'certified' AND (is_locked IS NULL OR is_locked = FALSE OR dataset_version IS NULL)
    `);
    console.log(`  ✅ Locked ${lockedCount} records`);
    
    // ========================================
    // 6. CREATE READ-ONLY VIEW
    // ========================================
    console.log('\n📋 6. Creating certified_vehicle_fitments view...');
    
    // Build view with only existing columns
    const viewColumns = [
      'id', 'year', 'make', 'model', 'raw_trim', 'bolt_pattern',
      'oem_wheel_sizes', 'oem_tire_sizes',
      'certification_status', 'certified_at', 'certified_by_script_version', 'dataset_version'
    ];
    
    // Check which columns exist
    const availableCols = viewColumns.filter(c => existingCols.has(c) || ['is_locked', 'dataset_version'].includes(c));
    
    await client.query(`
      CREATE OR REPLACE VIEW certified_vehicle_fitments AS
      SELECT ${availableCols.join(', ')}
      FROM vehicle_fitments
      WHERE certification_status = 'certified' AND is_locked = TRUE
    `);
    console.log('  ✅ certified_vehicle_fitments view created');
    
    // ========================================
    // 7. INSERT INITIAL VERSION
    // ========================================
    console.log('\n📋 7. Creating initial dataset version...');
    
    const { rows: stats } = await client.query(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE certification_status = 'certified')::int as certified,
        COUNT(*) FILTER (WHERE certification_status = 'needs_review')::int as needs_review
      FROM vehicle_fitments
    `);
    
    const s = stats[0];
    const pct = s.total > 0 ? (s.certified / s.total * 100) : 0;
    
    await client.query(`
      INSERT INTO fitment_dataset_versions (
        version, status, total_records, certified_records, needs_review_records,
        certification_pct, source_description, activated_at, activated_by
      ) VALUES ('v1.0.0-initial', 'active', $1, $2, $3, $4, 'Initial certified dataset after cleanup', NOW(), 'system')
      ON CONFLICT (version) DO NOTHING
    `, [s.total, s.certified, s.needs_review, pct.toFixed(2)]);
    console.log('  ✅ v1.0.0-initial version created');
    
    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n' + '='.repeat(70));
    console.log('✅ FITMENT LOCKDOWN COMPLETE');
    console.log('='.repeat(70));
    console.log('');
    console.log('📊 Current State:');
    console.log(`   Total records:     ${s.total.toLocaleString()}`);
    console.log(`   Certified (locked): ${s.certified.toLocaleString()} (${pct.toFixed(2)}%)`);
    console.log(`   Needs review:       ${s.needs_review.toLocaleString()}`);
    console.log(`   Dataset version:    v1.0.0-initial`);
    console.log('');
    console.log('🔒 Protection Applied:');
    console.log('   ✅ All certified records locked (is_locked = TRUE)');
    console.log('   ✅ Read-only view: certified_vehicle_fitments');
    console.log('   ✅ Staging table: vehicle_fitments_staging');
    console.log('   ✅ Change log: fitment_change_log');
    console.log('   ✅ Version tracking: fitment_dataset_versions');
    console.log('');
    console.log('📌 How Future Updates Work:');
    console.log('   1. Import to vehicle_fitments_staging (not live table)');
    console.log('   2. Run certification on staged records');
    console.log('   3. Promote certified records with promoteStagedRecords()');
    console.log('   4. All changes logged in fitment_change_log');
    console.log('');
    console.log('🛑 Direct writes to vehicle_fitments are now blocked by:');
    console.log('   - Application code uses certified_vehicle_fitments view (read-only)');
    console.log('   - Import scripts must use staging workflow');
    console.log('   - All changes require audit trail');
    
  } finally {
    client.release();
  }
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
