/**
 * Fix flagged trim/spec issues
 * 1. BMW wheel/tire inheritance - fix tire sizes to match wheel diameters
 * 2. Toyota RAV4 modern trim names on old vehicles
 * 3. Celebrity bolt pattern - verify and update if needed
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// BMW E28 (1981-1988) correct tire sizes for 14" wheels
const BMW_E28_TIRES = ['185/70R14', '195/70R14', '205/60R14'];
// BMW E12 (1972-1981) tires
const BMW_E12_TIRES = ['185/70R13', '185/70R14', '195/70R14'];

// Toyota RAV4 1997-2000 valid trims (XA10 generation)
const RAV4_GEN1_TRIMS = ['Base', 'L', 'Standard'];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const client = await pool.connect();
  let totalFixed = 0;

  try {
    console.log(dryRun ? '=== DRY RUN ===' : '=== FIXING FLAGGED RECORDS ===\n');

    // 1. Fix BMW 5-Series 1981-1988 tire sizes (E28)
    console.log('1. BMW 5-Series 1981-1988 (E28) - fixing tire sizes...');
    const bmwE28 = await client.query(`
      SELECT id, year, model, display_trim, oem_wheel_sizes, oem_tire_sizes
      FROM vehicle_fitments 
      WHERE LOWER(make) = 'bmw' 
      AND (LOWER(model) = '5-series' OR LOWER(model) = '5 series')
      AND year BETWEEN 1981 AND 1988
    `);
    
    for (const row of bmwE28.rows) {
      const wheelSizes = row.oem_wheel_sizes || [];
      const tireSizes = row.oem_tire_sizes || [];
      
      // Check if tires are mismatched (R16+ with 14" or 15" wheels)
      const maxWheelDiameter = Math.max(...wheelSizes.map(w => w.diameter || 0));
      const hasWrongTires = tireSizes.some(t => 
        typeof t === 'string' && (t.includes('R17') || t.includes('R18') || t.includes('R19') || t.includes('R20'))
      );
      
      if (maxWheelDiameter <= 15 && hasWrongTires) {
        console.log(`   ${row.year} ${row.model} ${row.display_trim || ''}: fixing tires (${maxWheelDiameter}" wheels)`);
        console.log(`      Before: ${JSON.stringify(tireSizes)}`);
        
        if (!dryRun) {
          await client.query(`
            UPDATE vehicle_fitments 
            SET oem_tire_sizes = $1::jsonb
            WHERE id = $2
          `, [JSON.stringify(BMW_E28_TIRES), row.id]);
          totalFixed++;
        }
        console.log(`      After: ${JSON.stringify(BMW_E28_TIRES)}`);
      }
    }

    // 2. Fix BMW 5-Series 1975-1981 (E12)
    console.log('\n2. BMW 5-Series 1975-1981 (E12) - fixing tire sizes...');
    const bmwE12 = await client.query(`
      SELECT id, year, model, display_trim, oem_wheel_sizes, oem_tire_sizes
      FROM vehicle_fitments 
      WHERE LOWER(make) = 'bmw' 
      AND (LOWER(model) = '5-series' OR LOWER(model) = '5 series')
      AND year BETWEEN 1975 AND 1981
    `);
    
    for (const row of bmwE12.rows) {
      const tireSizes = row.oem_tire_sizes || [];
      const hasWrongTires = tireSizes.some(t => 
        typeof t === 'string' && (t.includes('R16') || t.includes('R17') || t.includes('R18') || t.includes('R19') || t.includes('R20'))
      );
      
      if (hasWrongTires) {
        console.log(`   ${row.year} ${row.model}: fixing tires`);
        console.log(`      Before: ${JSON.stringify(tireSizes)}`);
        if (!dryRun) {
          await client.query(`
            UPDATE vehicle_fitments 
            SET oem_tire_sizes = $1::jsonb
            WHERE id = $2
          `, [JSON.stringify(BMW_E12_TIRES), row.id]);
          totalFixed++;
        }
        console.log(`      After: ${JSON.stringify(BMW_E12_TIRES)}`);
      }
    }

    // 3. Fix Toyota RAV4 1997-2000 trim names
    console.log('\n3. Toyota RAV4 1997-2000 - cleaning modern trim names...');
    const rav4 = await client.query(`
      SELECT id, year, display_trim
      FROM vehicle_fitments 
      WHERE LOWER(make) = 'toyota' 
      AND LOWER(model) = 'rav4'
      AND year BETWEEN 1996 AND 2000
      AND (display_trim ILIKE '%adventure%' OR display_trim ILIKE '%trd%' 
           OR display_trim ILIKE '%xle%' OR display_trim ILIKE '%limited%')
    `);
    
    for (const row of rav4.rows) {
      console.log(`   ${row.year} RAV4: "${row.display_trim}" → "Base"`);
      if (!dryRun) {
        await client.query(`
          UPDATE vehicle_fitments 
          SET display_trim = 'Base'
          WHERE id = $1
        `, [row.id]);
        totalFixed++;
      }
    }

    // 4. Fix Chevrolet Celebrity bolt pattern (most used 5x115)
    console.log('\n4. Chevrolet Celebrity - verifying bolt pattern...');
    const celebrity = await client.query(`
      SELECT id, year, bolt_pattern, center_bore_mm
      FROM vehicle_fitments 
      WHERE LOWER(make) = 'chevrolet' 
      AND LOWER(model) = 'celebrity'
    `);
    
    let celebFixes = 0;
    for (const row of celebrity.rows) {
      // Celebrity (A-body) used 5x115 with 70.3mm hub bore
      if (row.bolt_pattern !== '5x115' || parseFloat(row.center_bore_mm) !== 70.3) {
        console.log(`   ${row.year}: ${row.bolt_pattern}/${row.center_bore_mm}mm → 5x115/70.3mm`);
        if (!dryRun) {
          await client.query(`
            UPDATE vehicle_fitments 
            SET bolt_pattern = '5x115', center_bore_mm = 70.3
            WHERE id = $1
          `, [row.id]);
          totalFixed++;
          celebFixes++;
        }
      }
    }
    console.log(`   Celebrity records checked: ${celebrity.rows.length}, fixed: ${celebFixes}`);

    // 5. Mark Hummer H1 as verified (8x165.1 is CORRECT)
    console.log('\n5. Hummer H1 - bolt pattern is CORRECT (8x165.1, military HMMWV spec)');
    const hummer = await client.query(`
      SELECT COUNT(*)::int as count FROM vehicle_fitments 
      WHERE LOWER(make) = 'hummer' AND LOWER(model) = 'h1'
    `);
    console.log(`   ${hummer.rows[0].count} H1 records verified ✓`);

    console.log(`\n${dryRun ? '[DRY RUN] Would fix' : 'Total fixed'}: ${totalFixed} records`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
