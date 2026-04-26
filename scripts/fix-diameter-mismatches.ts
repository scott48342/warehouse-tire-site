/**
 * Fix tire/wheel diameter mismatches
 * 
 * Rules:
 * 1. Filter oem_tire_sizes to only include tires matching oem_wheel_sizes diameters
 * 2. If NO tires match ANY wheel, keep existing data but log for manual review
 * 3. Preserve legitimate multiple OEM options when they actually match
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
  // Handle "37x12.50R16.5" -> 16 (common rounding)
  const match = String(tireSize).match(/R(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  return Math.floor(parseFloat(match[1])); // 16.5 -> 16
}

function parseWheelDiameters(oemWheelSizes: any): number[] {
  const diameters: number[] = [];
  
  if (!oemWheelSizes) return diameters;
  
  const data = typeof oemWheelSizes === 'string' ? JSON.parse(oemWheelSizes) : oemWheelSizes;
  
  if (Array.isArray(data)) {
    for (const w of data) {
      if (typeof w === 'string') {
        // Handle "9Jx22" format
        const match = w.match(/x(\d+)/i);
        if (match) diameters.push(parseInt(match[1]));
      } else if (w?.diameter) {
        diameters.push(Math.floor(w.diameter));
      }
      if (w?.rearDiameter) {
        diameters.push(Math.floor(w.rearDiameter));
      }
    }
  } else if (typeof data === 'object') {
    if (data.diameter) diameters.push(Math.floor(data.diameter));
    if (data.rearDiameter) diameters.push(Math.floor(data.rearDiameter));
    if (data.front?.diameter) diameters.push(Math.floor(data.front.diameter));
    if (data.rear?.diameter) diameters.push(Math.floor(data.rear.diameter));
  }
  
  return [...new Set(diameters)];
}

function parseTires(oemTireSizes: any): { size: string, diameter: number }[] {
  const tires: { size: string, diameter: number }[] = [];
  
  if (!oemTireSizes) return tires;
  
  const data = typeof oemTireSizes === 'string' ? JSON.parse(oemTireSizes) : oemTireSizes;
  
  if (Array.isArray(data)) {
    for (const t of data) {
      const size = typeof t === 'string' ? t : t?.size || t?.front;
      if (size) {
        const diameter = extractDiameter(String(size));
        if (diameter) tires.push({ size: String(size), diameter });
      }
      // Also check rear
      if (t?.rear) {
        const diameter = extractDiameter(String(t.rear));
        if (diameter) tires.push({ size: String(t.rear), diameter });
      }
    }
  } else if (typeof data === 'string') {
    const diameter = extractDiameter(data);
    if (diameter) tires.push({ size: data, diameter });
  }
  
  return tires;
}

async function main() {
  console.log(`\n🔧 Fixing tire/wheel diameter mismatches${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  // Get all records with both wheel and tire data
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments
    WHERE oem_wheel_sizes IS NOT NULL 
      AND oem_tire_sizes IS NOT NULL
  `);

  let fixed = 0;
  let skipped = 0;
  let noChange = 0;
  const samples: { before: any, after: any, vehicle: string }[] = [];
  const needsManualReview: string[] = [];

  for (const row of records.rows) {
    const wheelDiameters = parseWheelDiameters(row.oem_wheel_sizes);
    const tires = parseTires(row.oem_tire_sizes);
    
    if (wheelDiameters.length === 0 || tires.length === 0) {
      noChange++;
      continue;
    }
    
    // Filter to only tires that match a wheel diameter
    const matchingTires = tires.filter(t => wheelDiameters.includes(t.diameter));
    
    if (matchingTires.length === tires.length) {
      // All tires already match - no change needed
      noChange++;
      continue;
    }
    
    if (matchingTires.length === 0) {
      // No tires match any wheel - needs manual review
      needsManualReview.push(`${row.year} ${row.make} ${row.model} [${row.display_trim}] - wheels: ${wheelDiameters.join('/')}" tires: ${tires.map(t => t.size).join(', ')}`);
      skipped++;
      continue;
    }
    
    // Some tires match - update to only include matching ones
    const newTireSizes = [...new Set(matchingTires.map(t => t.size))];
    
    const vehicle = `${row.year} ${row.make} ${row.model} [${row.display_trim}]`;
    
    if (samples.length < 20) {
      samples.push({
        vehicle,
        before: tires.map(t => t.size),
        after: newTireSizes
      });
    }
    
    if (!DRY_RUN) {
      await pool.query(`
        UPDATE vehicle_fitments
        SET oem_tire_sizes = $1, updated_at = NOW()
        WHERE id = $2
      `, [JSON.stringify(newTireSizes), row.id]);
    }
    
    fixed++;
    
    if (fixed % 500 === 0) {
      console.log(`  Progress: ${fixed} fixed...`);
    }
  }

  console.log(`\n✅ Results:`);
  console.log(`  Records checked: ${records.rowCount}`);
  console.log(`  Fixed (filtered tires): ${fixed}`);
  console.log(`  No change needed: ${noChange}`);
  console.log(`  Skipped (needs manual review): ${skipped}`);
  
  console.log(`\n📋 Sample fixes:`);
  samples.forEach((s, i) => {
    console.log(`\n  ${i+1}. ${s.vehicle}`);
    console.log(`     Before: ${JSON.stringify(s.before)}`);
    console.log(`     After:  ${JSON.stringify(s.after)}`);
  });
  
  if (needsManualReview.length > 0) {
    console.log(`\n⚠️ Needs manual review (first 20):`);
    needsManualReview.slice(0, 20).forEach(v => console.log(`  - ${v}`));
    if (needsManualReview.length > 20) {
      console.log(`  ... and ${needsManualReview.length - 20} more`);
    }
  }

  await pool.end();
}

main().catch(console.error);
