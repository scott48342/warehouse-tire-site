/**
 * Fix Land Rover Discovery incomplete wheel data
 * 
 * For 2005-2011 Discovery trims (S, SE, HSE, etc.) that have incomplete wheel data
 * (missing diameter), populate from known OEM specs.
 * 
 * Land Rover Discovery (LR3/LR4) wheel specs:
 * - 2005-2009 (LR3): 18" standard, 19" optional
 * - 2010-2016 (LR4): 19" standard, 20" optional
 * - All use 5x120 bolt pattern
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const DRY_RUN = process.argv.includes('--dry-run');

// Known Discovery wheel specs by year range
const DISCOVERY_SPECS: Record<string, { wheels: any[], tires: string[] }> = {
  // LR3 (2005-2009)
  '2005-2009': {
    wheels: [
      { diameter: 18, width: 8, offset: 53, position: 'both', isStock: true },
      { diameter: 19, width: 8, offset: 53, position: 'both', isStock: false }
    ],
    tires: ['255/60R18', '255/55R19']
  },
  // LR4 (2010-2016)
  '2010-2016': {
    wheels: [
      { diameter: 19, width: 8, offset: 53, position: 'both', isStock: true },
      { diameter: 20, width: 8.5, offset: 53, position: 'both', isStock: false }
    ],
    tires: ['255/55R19', '275/45R20']
  }
};

function getSpecsForYear(year: number): { wheels: any[], tires: string[] } | null {
  if (year >= 2005 && year <= 2009) return DISCOVERY_SPECS['2005-2009'];
  if (year >= 2010 && year <= 2016) return DISCOVERY_SPECS['2010-2016'];
  return null;
}

function hasValidWheelDiameter(oemWheelSizes: any): boolean {
  if (!oemWheelSizes) return false;
  
  const data = typeof oemWheelSizes === 'string' ? JSON.parse(oemWheelSizes) : oemWheelSizes;
  
  if (!Array.isArray(data) || data.length === 0) return false;
  
  // Check if any wheel entry has a diameter
  return data.some((w: any) => w?.diameter && typeof w.diameter === 'number');
}

async function main() {
  console.log(`\n🔧 Fixing Land Rover Discovery incomplete wheel data${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  // Get Discovery records - check for missing or incomplete wheel data
  const records = await pool.query(`
    SELECT id, year, model, display_trim, oem_wheel_sizes, oem_tire_sizes, bolt_pattern
    FROM vehicle_fitments
    WHERE make = 'Land Rover' 
      AND model ILIKE '%discovery%'
      AND year BETWEEN 2005 AND 2016
    ORDER BY year DESC
  `);

  console.log(`Found ${records.rowCount} Discovery records (2005-2016)\n`);

  let fixed = 0;
  let skipped = 0;
  let alreadyGood = 0;
  const samples: any[] = [];

  for (const row of records.rows) {
    // Check if wheel data is missing or incomplete
    if (hasValidWheelDiameter(row.oem_wheel_sizes)) {
      alreadyGood++;
      continue;
    }
    
    const specs = getSpecsForYear(row.year);
    
    if (!specs) {
      console.log(`  ⚠️ No specs for ${row.year} ${row.model} [${row.display_trim}]`);
      skipped++;
      continue;
    }

    const vehicle = `${row.year} ${row.model} [${row.display_trim}]`;
    
    if (samples.length < 10) {
      samples.push({
        vehicle,
        before: { wheels: row.oem_wheel_sizes, tires: row.oem_tire_sizes },
        after: { wheels: specs.wheels, tires: specs.tires }
      });
    }

    if (!DRY_RUN) {
      await pool.query(`
        UPDATE vehicle_fitments
        SET 
          oem_wheel_sizes = $1,
          oem_tire_sizes = $2,
          updated_at = NOW()
        WHERE id = $3
      `, [JSON.stringify(specs.wheels), JSON.stringify(specs.tires), row.id]);
    }

    fixed++;
  }

  console.log(`\n✅ Results:`);
  console.log(`  Records with valid wheel data: ${alreadyGood}`);
  console.log(`  Fixed (added missing diameter): ${fixed}`);
  console.log(`  Skipped: ${skipped}`);

  console.log(`\n📋 Sample fixes:`);
  samples.forEach((s, i) => {
    console.log(`\n  ${i+1}. ${s.vehicle}`);
    console.log(`     Before: wheels=${JSON.stringify(s.before.wheels)?.substring(0,80)}...`);
    console.log(`     After:  wheels=${JSON.stringify(s.after.wheels)}`);
    console.log(`             tires=${JSON.stringify(s.after.tires)}`);
  });

  await pool.end();
}

main().catch(console.error);
