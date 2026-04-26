/**
 * Phase 1: Quarantine contaminated fitment records
 * 
 * - Add certification columns if not exist
 * - Mark mismatch records as needs_review
 * - Preserve original data in audit fields
 * - Categorize by issue type
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const DRY_RUN = process.argv.includes('--dry-run');

function extractDiameter(tireSize: string | null): number | null {
  if (!tireSize) return null;
  const match = String(tireSize).match(/R(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  return Math.floor(parseFloat(match[1]));
}

function parseWheelDiameters(oemWheelSizes: any): number[] {
  const diameters: number[] = [];
  if (!oemWheelSizes) return diameters;
  
  const data = typeof oemWheelSizes === 'string' ? JSON.parse(oemWheelSizes) : oemWheelSizes;
  
  if (Array.isArray(data)) {
    for (const w of data) {
      if (typeof w === 'string') {
        const match = w.match(/x(\d+)/i);
        if (match) diameters.push(parseInt(match[1]));
      } else if (w?.diameter) {
        diameters.push(Math.floor(w.diameter));
      }
      if (w?.rearDiameter) diameters.push(Math.floor(w.rearDiameter));
    }
  } else if (typeof data === 'object') {
    if (data.diameter) diameters.push(Math.floor(data.diameter));
    if (data.rearDiameter) diameters.push(Math.floor(data.rearDiameter));
  }
  
  return [...new Set(diameters)];
}

function parseTireDiameters(oemTireSizes: any): number[] {
  const diameters: number[] = [];
  if (!oemTireSizes) return diameters;
  
  const data = typeof oemTireSizes === 'string' ? JSON.parse(oemTireSizes) : oemTireSizes;
  
  if (Array.isArray(data)) {
    for (const t of data) {
      const size = typeof t === 'string' ? t : t?.size || t?.front;
      if (size) {
        const dia = extractDiameter(String(size));
        if (dia) diameters.push(dia);
      }
      if (t?.rear) {
        const dia = extractDiameter(String(t.rear));
        if (dia) diameters.push(dia);
      }
    }
  } else if (typeof data === 'string') {
    const dia = extractDiameter(data);
    if (dia) diameters.push(dia);
  }
  
  return [...new Set(diameters)];
}

function determineIssueType(wheelDiameters: number[], tireDiameters: number[], yearMin: number, yearMax: number): string {
  const avgWheel = wheelDiameters.reduce((s, d) => s + d, 0) / wheelDiameters.length;
  const avgTire = tireDiameters.reduce((s, d) => s + d, 0) / tireDiameters.length;
  
  if (avgTire > avgWheel + 2) {
    return 'AFTERMARKET_TIRES';
  } else if (avgWheel > avgTire + 2) {
    return 'AFTERMARKET_WHEELS';
  } else if (yearMax - yearMin > 10) {
    return 'GENERATION_CONTAMINATION';
  } else {
    return 'DATA_MISMATCH';
  }
}

async function main() {
  console.log(`\n🔒 Phase 1: Quarantine Contaminated Fitment Records${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  // Step 1: Add certification columns if they don't exist
  console.log('Step 1: Ensuring certification columns exist...');
  
  if (!DRY_RUN) {
    await pool.query(`
      ALTER TABLE vehicle_fitments 
      ADD COLUMN IF NOT EXISTS certification_status VARCHAR(50) DEFAULT 'certified',
      ADD COLUMN IF NOT EXISTS certification_errors JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS audit_original_data JSONB DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMP DEFAULT NULL
    `);
    console.log('  ✓ Certification columns ready\n');
  } else {
    console.log('  (would add certification_status, certification_errors, audit_original_data, quarantined_at columns)\n');
  }

  // Step 2: Find all mismatched records
  console.log('Step 2: Identifying contaminated records...');
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim, source, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments
    WHERE oem_wheel_sizes IS NOT NULL 
      AND oem_tire_sizes IS NOT NULL
  `);

  interface MismatchRecord {
    id: string;
    year: number;
    make: string;
    model: string;
    trim: string;
    source: string;
    wheelDiameters: number[];
    tireDiameters: number[];
    issueType: string;
    rawWheels: any;
    rawTires: any;
  }

  const mismatches: MismatchRecord[] = [];

  for (const row of records.rows) {
    const wheelDiameters = parseWheelDiameters(row.oem_wheel_sizes);
    const tireDiameters = parseTireDiameters(row.oem_tire_sizes);
    
    if (wheelDiameters.length === 0 || tireDiameters.length === 0) continue;
    
    const hasMatch = tireDiameters.some(td => wheelDiameters.includes(td));
    
    if (!hasMatch) {
      mismatches.push({
        id: row.id,
        year: row.year,
        make: row.make,
        model: row.model,
        trim: row.display_trim || 'Base',
        source: row.source || 'unknown',
        wheelDiameters,
        tireDiameters,
        issueType: determineIssueType(wheelDiameters, tireDiameters, row.year, row.year),
        rawWheels: row.oem_wheel_sizes,
        rawTires: row.oem_tire_sizes
      });
    }
  }

  console.log(`  Found ${mismatches.length} contaminated records\n`);

  // Step 3: Quarantine records
  console.log('Step 3: Quarantining records...');
  
  let quarantined = 0;
  const byIssueType: Record<string, number> = {};
  const byMakeModel: Record<string, number> = {};

  for (const m of mismatches) {
    byIssueType[m.issueType] = (byIssueType[m.issueType] || 0) + 1;
    const key = `${m.make} ${m.model}`;
    byMakeModel[key] = (byMakeModel[key] || 0) + 1;

    if (!DRY_RUN) {
      const certificationErrors = [{
        type: m.issueType,
        detected_at: new Date().toISOString(),
        wheel_diameters: m.wheelDiameters,
        tire_diameters: m.tireDiameters,
        source: m.source
      }];

      const auditData = {
        oem_wheel_sizes: m.rawWheels,
        oem_tire_sizes: m.rawTires,
        quarantine_reason: m.issueType,
        quarantine_date: new Date().toISOString()
      };

      await pool.query(`
        UPDATE vehicle_fitments
        SET 
          certification_status = 'needs_review',
          certification_errors = $1,
          audit_original_data = $2,
          quarantined_at = NOW(),
          updated_at = NOW()
        WHERE id = $3
      `, [JSON.stringify(certificationErrors), JSON.stringify(auditData), m.id]);
    }

    quarantined++;
    
    if (quarantined % 200 === 0) {
      console.log(`  Progress: ${quarantined} / ${mismatches.length} quarantined...`);
    }
  }

  console.log(`  ✓ Quarantined ${quarantined} records\n`);

  // Step 4: Count certified vs quarantined
  console.log('Step 4: Calculating certification status...');
  
  let certifiedCount = 0;
  let needsReviewCount = 0;
  
  if (!DRY_RUN) {
    const statusCounts = await pool.query(`
      SELECT certification_status, COUNT(*) as cnt
      FROM vehicle_fitments
      GROUP BY certification_status
    `);
    
    for (const row of statusCounts.rows) {
      if (row.certification_status === 'certified' || row.certification_status === null) {
        certifiedCount += parseInt(row.cnt);
      } else if (row.certification_status === 'needs_review') {
        needsReviewCount += parseInt(row.cnt);
      }
    }
  } else {
    const totalRes = await pool.query('SELECT COUNT(*) as cnt FROM vehicle_fitments');
    certifiedCount = parseInt(totalRes.rows[0].cnt) - mismatches.length;
    needsReviewCount = mismatches.length;
  }

  // Output summary
  console.log('\n' + '='.repeat(60));
  console.log('QUARANTINE SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`\n📊 Certification Status:`);
  console.log(`  ✅ Certified: ${certifiedCount.toLocaleString()}`);
  console.log(`  ⚠️ Needs Review: ${needsReviewCount.toLocaleString()}`);
  console.log(`  📈 Certification Rate: ${(certifiedCount / (certifiedCount + needsReviewCount) * 100).toFixed(1)}%`);

  console.log(`\n📋 Quarantined by Issue Type:`);
  for (const [type, count] of Object.entries(byIssueType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  console.log(`\n📋 Top 15 Quarantined Make/Models:`);
  const sortedMakeModels = Object.entries(byMakeModel).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [key, count] of sortedMakeModels) {
    console.log(`  ${key}: ${count}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('LIVE FLOW PROTECTION');
  console.log('='.repeat(60));
  
  console.log(`
🛡️ Protected Flows (only use certification_status = 'certified'):
  
  1. PACKAGE BUILDER
     → /api/packages/* must filter: certification_status = 'certified'
     → Prevents contaminated wheel/tire combos from being sold
  
  2. TIRE SEARCH
     → /api/tires/search must filter: certification_status = 'certified'
     → Falls back to wheel-diameter-only search for uncertified
  
  3. STAGGER LOGIC
     → /api/wheels/fitment-search stagger detection
     → Only trust isStaggered from certified records
  
  4. GUARANTEED FIT BADGE
     → Frontend badge display
     → Only show for certification_status = 'certified'
  
  5. WHEEL SEARCH (partial protection)
     → /api/wheels/fitment-search
     → Allow if bolt_pattern + center_bore are valid (wheel-safe)
     → But do NOT derive tire sizes from uncertified records
`);

  console.log('='.repeat(60));
  console.log('NEXT STEPS');
  console.log('='.repeat(60));
  
  console.log(`
📝 Phase 2 Correction Batches (by priority):

  Batch 1: RAM 1500 (107 records)
           → Modern trucks, high traffic, clear OEM specs available
  
  Batch 2: Silverado/Sierra 1500 (120 records combined)
           → GM twins, same platform specs
  
  Batch 3: Ford Mustang (123 records)
           → Classic cars, need generation-specific research
  
  Batch 4: BMW 3/5/M Series (168 records combined)
           → European luxury, well-documented OEM specs
  
  Batch 5: Mercedes E/S Class (98 records combined)
           → European luxury, well-documented OEM specs
  
  Batch 6: Lexus LX (40 records)
           → Single model, clear data mismatch
  
  Batch 7: Classic Muscle (Firebird, Camaro, Charger, Challenger)
           → Historic vehicles, need classic car databases
`);

  await pool.end();
}

main().catch(console.error);
