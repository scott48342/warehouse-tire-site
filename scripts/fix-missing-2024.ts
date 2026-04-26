import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

// 2024 Subaru specs (all 5x114.3, 56.1mm bore)
const subaru2024: Record<string, { wheels: any[], tires: string[] }> = {
  // Forester 2024
  'forester:Base': { wheels: [{ diameter: 17, width: 7, offset: 48, axle: 'square', isStock: true }], tires: ['225/60R17'] },
  'forester:Premium': { wheels: [{ diameter: 17, width: 7, offset: 48, axle: 'square', isStock: true }], tires: ['225/60R17'] },
  'forester:Sport': { wheels: [{ diameter: 18, width: 7, offset: 48, axle: 'square', isStock: true }], tires: ['225/55R18'] },
  'forester:Limited': { wheels: [{ diameter: 18, width: 7, offset: 48, axle: 'square', isStock: true }], tires: ['225/55R18'] },
  'forester:Touring': { wheels: [{ diameter: 18, width: 7, offset: 48, axle: 'square', isStock: true }], tires: ['225/55R18'] },
  'forester:Wilderness': { wheels: [{ diameter: 17, width: 7, offset: 48, axle: 'square', isStock: true }], tires: ['225/60R17'] },
  
  // Ascent 2024
  'ascent:Base': { wheels: [{ diameter: 18, width: 7.5, offset: 55, axle: 'square', isStock: true }], tires: ['245/60R18'] },
  'ascent:Premium': { wheels: [{ diameter: 18, width: 7.5, offset: 55, axle: 'square', isStock: true }], tires: ['245/60R18'] },
  'ascent:Limited': { wheels: [{ diameter: 20, width: 7.5, offset: 55, axle: 'square', isStock: true }], tires: ['245/50R20'] },
  'ascent:Touring': { wheels: [{ diameter: 20, width: 7.5, offset: 55, axle: 'square', isStock: true }], tires: ['245/50R20'] },
  'ascent:Onyx Edition': { wheels: [{ diameter: 18, width: 7.5, offset: 55, axle: 'square', isStock: true }], tires: ['245/60R18'] },
  
  // Crosstrek 2024
  'crosstrek:Base': { wheels: [{ diameter: 17, width: 7, offset: 55, axle: 'square', isStock: true }], tires: ['225/60R17'] },
  'crosstrek:Premium': { wheels: [{ diameter: 17, width: 7, offset: 55, axle: 'square', isStock: true }], tires: ['225/60R17'] },
  'crosstrek:Sport': { wheels: [{ diameter: 18, width: 7, offset: 55, axle: 'square', isStock: true }], tires: ['225/55R18'] },
  'crosstrek:Limited': { wheels: [{ diameter: 18, width: 7, offset: 55, axle: 'square', isStock: true }], tires: ['225/55R18'] },
  'crosstrek:Wilderness': { wheels: [{ diameter: 17, width: 7, offset: 55, axle: 'square', isStock: true }], tires: ['225/60R17'] },
  
  // WRX 2024
  'wrx:Base': { wheels: [{ diameter: 17, width: 8, offset: 55, axle: 'square', isStock: true }], tires: ['245/45R17'] },
  'wrx:Premium': { wheels: [{ diameter: 18, width: 8.5, offset: 55, axle: 'square', isStock: true }], tires: ['245/40R18'] },
  'wrx:Limited': { wheels: [{ diameter: 18, width: 8.5, offset: 55, axle: 'square', isStock: true }], tires: ['245/40R18'] },
  'wrx:GT': { wheels: [{ diameter: 18, width: 8.5, offset: 55, axle: 'square', isStock: true }], tires: ['245/40R18'] },
  'wrx:TR': { wheels: [{ diameter: 18, width: 8.5, offset: 55, axle: 'square', isStock: true }], tires: ['245/40R18'] },
};

// 2024 Nissan Titan specs (6x139.7, 78.1mm bore)
const titan2024: Record<string, { wheels: any[], tires: string[] }> = {
  'S': { wheels: [{ diameter: 18, width: 7.5, offset: 25, axle: 'square', isStock: true }], tires: ['265/70R18'] },
  'SV': { wheels: [{ diameter: 18, width: 7.5, offset: 25, axle: 'square', isStock: true }], tires: ['265/70R18'] },
  'PRO-4X': { wheels: [{ diameter: 18, width: 7.5, offset: 25, axle: 'square', isStock: true }], tires: ['275/65R18'] },
  'Platinum Reserve': { wheels: [{ diameter: 20, width: 7.5, offset: 25, axle: 'square', isStock: true }], tires: ['275/60R20'] },
};

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING'}\n`);

  // Get missing Subaru records
  const subaruMissing = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments 
    WHERE year = 2024 
      AND LOWER(make) = 'subaru'
      AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes::text IN ('[]', 'null'))
  `);

  console.log(`Subaru 2024 missing: ${subaruMissing.rows.length}`);
  let updated = 0;

  for (const r of subaruMissing.rows) {
    const key = `${r.model.toLowerCase()}:${r.display_trim}`;
    const specs = subaru2024[key];
    
    if (specs) {
      if (dryRun) {
        console.log(`  [DRY] ${r.year} ${r.make} ${r.model} ${r.display_trim} → ${specs.wheels[0].diameter}"`);
      } else {
        await pool.query(`
          UPDATE vehicle_fitments 
          SET oem_wheel_sizes = $1::jsonb, oem_tire_sizes = $2::jsonb, 
              bolt_pattern = '5x114.3', center_bore_mm = 56.1,
              quality_tier = 'complete', updated_at = NOW()
          WHERE id = $3
        `, [JSON.stringify(specs.wheels), JSON.stringify(specs.tires), r.id]);
      }
      updated++;
    } else {
      console.log(`  ⚠️ No specs for: ${key}`);
    }
  }

  // Get missing Nissan Titan records
  const titanMissing = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments 
    WHERE year = 2024 
      AND LOWER(make) = 'nissan'
      AND LOWER(model) = 'titan'
      AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes::text IN ('[]', 'null'))
  `);

  console.log(`\nNissan Titan 2024 missing: ${titanMissing.rows.length}`);

  for (const r of titanMissing.rows) {
    const specs = titan2024[r.display_trim];
    
    if (specs) {
      if (dryRun) {
        console.log(`  [DRY] ${r.year} ${r.make} ${r.model} ${r.display_trim} → ${specs.wheels[0].diameter}"`);
      } else {
        await pool.query(`
          UPDATE vehicle_fitments 
          SET oem_wheel_sizes = $1::jsonb, oem_tire_sizes = $2::jsonb, 
              bolt_pattern = '6x139.7', center_bore_mm = 78.1,
              quality_tier = 'complete', updated_at = NOW()
          WHERE id = $3
        `, [JSON.stringify(specs.wheels), JSON.stringify(specs.tires), r.id]);
      }
      updated++;
    } else {
      console.log(`  ⚠️ No specs for Titan: ${r.display_trim}`);
    }
  }

  console.log(`\n✓ ${updated} records ${dryRun ? 'would be' : ''} updated`);
  await pool.end();
}

main();
