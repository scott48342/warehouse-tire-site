/**
 * Audit tire/wheel diameter mismatches, Land Rover Discovery gaps, and Acura duplicates
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

function extractDiameter(tireSize: string | null): number | null {
  if (!tireSize) return null;
  const match = String(tireSize).match(/R(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

function parseWheelDiameters(oemWheelSizes: any): { front: number[], rear: number[] } {
  const front: number[] = [];
  const rear: number[] = [];
  
  if (!oemWheelSizes) return { front, rear };
  
  // Handle different formats
  const data = typeof oemWheelSizes === 'string' ? JSON.parse(oemWheelSizes) : oemWheelSizes;
  
  if (Array.isArray(data)) {
    // Array of wheel specs like [{diameter: 17, width: 7}, ...]
    for (const w of data) {
      if (w.diameter) front.push(w.diameter);
      if (w.rearDiameter) rear.push(w.rearDiameter);
    }
  } else if (typeof data === 'object') {
    // Object format
    if (data.diameter) front.push(data.diameter);
    if (data.rearDiameter) rear.push(data.rearDiameter);
    if (data.front?.diameter) front.push(data.front.diameter);
    if (data.rear?.diameter) rear.push(data.rear.diameter);
  }
  
  return { front: [...new Set(front)], rear: [...new Set(rear)] };
}

function parseTireDiameters(oemTireSizes: any): number[] {
  const diameters: number[] = [];
  
  if (!oemTireSizes) return diameters;
  
  const data = typeof oemTireSizes === 'string' ? JSON.parse(oemTireSizes) : oemTireSizes;
  
  if (Array.isArray(data)) {
    for (const t of data) {
      const size = typeof t === 'string' ? t : t?.size || t?.front || t;
      const dia = extractDiameter(String(size));
      if (dia) diameters.push(dia);
      
      // Check rear too
      if (t?.rear) {
        const rearDia = extractDiameter(String(t.rear));
        if (rearDia) diameters.push(rearDia);
      }
    }
  } else if (typeof data === 'string') {
    const dia = extractDiameter(data);
    if (dia) diameters.push(dia);
  }
  
  return [...new Set(diameters)];
}

async function main() {
  console.log('=== AUDIT: Tire/Wheel Diameter Mismatches ===\n');

  // Get records with both wheel and tire data
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments
    WHERE oem_wheel_sizes IS NOT NULL 
      AND oem_tire_sizes IS NOT NULL
  `);

  interface Mismatch {
    id: string;
    vehicle: string;
    wheelDiameters: number[];
    tireDiameters: number[];
    oemWheelSizes: any;
    oemTireSizes: any;
  }

  const mismatches: Mismatch[] = [];

  for (const row of records.rows) {
    const wheels = parseWheelDiameters(row.oem_wheel_sizes);
    const allWheelDiameters = [...wheels.front, ...wheels.rear];
    const tireDiameters = parseTireDiameters(row.oem_tire_sizes);
    
    if (allWheelDiameters.length === 0 || tireDiameters.length === 0) continue;
    
    // Check if ANY tire diameter matches ANY wheel diameter
    const hasMatch = tireDiameters.some(td => allWheelDiameters.includes(td));
    
    if (!hasMatch) {
      mismatches.push({
        id: row.id,
        vehicle: `${row.year} ${row.make} ${row.model} [${row.display_trim || 'Base'}]`,
        wheelDiameters: allWheelDiameters,
        tireDiameters,
        oemWheelSizes: row.oem_wheel_sizes,
        oemTireSizes: row.oem_tire_sizes
      });
    }
  }

  console.log('Records checked:', records.rowCount);
  console.log('Complete mismatches (no tire matches any wheel):', mismatches.length);
  console.log('\nSample mismatches (first 20):');
  mismatches.slice(0, 20).forEach((s, i) => {
    console.log(`\n${i+1}. ${s.vehicle}`);
    console.log(`   Wheel diameters: ${s.wheelDiameters.join(', ')}" `);
    console.log(`   Tire diameters: R${s.tireDiameters.join(', R')}`);
    console.log(`   Raw wheels: ${JSON.stringify(s.oemWheelSizes)}`);
    console.log(`   Raw tires: ${JSON.stringify(s.oemTireSizes)}`);
  });

  // Also check for partial mismatches - some tires don't match
  console.log('\n\n=== Partial Mismatches (extra tire sizes that don\'t match wheels) ===\n');
  
  let partialMismatches = 0;
  const partialSamples: any[] = [];
  
  for (const row of records.rows) {
    const wheels = parseWheelDiameters(row.oem_wheel_sizes);
    const allWheelDiameters = [...new Set([...wheels.front, ...wheels.rear])];
    const tireDiameters = parseTireDiameters(row.oem_tire_sizes);
    
    if (allWheelDiameters.length === 0 || tireDiameters.length === 0) continue;
    
    // Find tires that don't match any wheel
    const unmatchedTires = tireDiameters.filter(td => !allWheelDiameters.includes(td));
    
    if (unmatchedTires.length > 0 && partialSamples.length < 10) {
      partialMismatches++;
      partialSamples.push({
        vehicle: `${row.year} ${row.make} ${row.model} [${row.display_trim || 'Base'}]`,
        wheelDiameters: allWheelDiameters,
        tireDiameters,
        unmatchedTires
      });
    } else if (unmatchedTires.length > 0) {
      partialMismatches++;
    }
  }
  
  console.log('Records with extra unmatched tire sizes:', partialMismatches);
  partialSamples.forEach((s, i) => {
    console.log(`\n${i+1}. ${s.vehicle}`);
    console.log(`   Wheels: ${s.wheelDiameters.join(', ')}" → Tires: R${s.tireDiameters.join(', R')}`);
    console.log(`   ❌ Unmatched: R${s.unmatchedTires.join(', R')}`);
  });

  // Check Land Rover Discovery
  console.log('\n\n=== AUDIT: Land Rover Discovery Missing Wheels ===\n');
  const lrRes = await pool.query(`
    SELECT id, year, model, display_trim, oem_wheel_sizes, oem_tire_sizes, bolt_pattern
    FROM vehicle_fitments
    WHERE make = 'Land Rover' AND model ILIKE '%Discovery%'
    ORDER BY year DESC, display_trim
  `);
  console.log('Land Rover Discovery records:', lrRes.rowCount);
  
  const missingWheels = lrRes.rows.filter(r => {
    const wheels = parseWheelDiameters(r.oem_wheel_sizes);
    return wheels.front.length === 0;
  });
  console.log('Missing wheel diameter:', missingWheels.length);
  
  if (lrRes.rows.length > 0) {
    console.log('\nAll Discovery records:');
    lrRes.rows.forEach(r => {
      const wheels = parseWheelDiameters(r.oem_wheel_sizes);
      const tires = parseTireDiameters(r.oem_tire_sizes);
      console.log(`  ${r.year} ${r.model} [${r.display_trim}] - wheels: ${wheels.front.join('/')||'MISSING'}" bolt: ${r.bolt_pattern}, tires: R${tires.join('/R')||'?'}`);
    });
  }

  // Check Acura duplicates
  console.log('\n\n=== AUDIT: Acura TL/TLX/TSX Duplicates ===\n');
  const acuraRes = await pool.query(`
    SELECT year, make, model, display_trim, bolt_pattern, COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE make = 'Acura' AND model IN ('TL', 'TLX', 'TSX')
    GROUP BY year, make, model, display_trim, bolt_pattern
    HAVING COUNT(*) > 1
    ORDER BY year DESC, model, display_trim
  `);
  console.log('Duplicate groups:', acuraRes.rowCount);
  if (acuraRes.rows.length > 0) {
    console.log('\nDuplicate records:');
    for (const r of acuraRes.rows) {
      console.log(`  ${r.year} ${r.make} ${r.model} [${r.display_trim}] - ${r.cnt} copies`);
    }
    
    // Get actual duplicate records to see differences
    console.log('\nDetailed duplicate comparison:');
    for (const dup of acuraRes.rows.slice(0, 5)) {
      const details = await pool.query(`
        SELECT id, year, make, model, display_trim, oem_wheel_sizes, oem_tire_sizes, bolt_pattern, center_bore_mm, source
        FROM vehicle_fitments
        WHERE year = $1 AND make = $2 AND model = $3 AND display_trim = $4
        ORDER BY id
      `, [dup.year, dup.make, dup.model, dup.display_trim]);
      
      console.log(`\n  ${dup.year} ${dup.make} ${dup.model} [${dup.display_trim}]:`);
      details.rows.forEach((d, i) => {
        const wheels = parseWheelDiameters(d.oem_wheel_sizes);
        const tires = parseTireDiameters(d.oem_tire_sizes);
        console.log(`    ${i+1}. id=${d.id.slice(0,8)} wheels=${wheels.front.join('/')}" tires=R${tires.join('/R')} bolt=${d.bolt_pattern} cb=${d.center_bore_mm} src=${d.source}`);
      });
    }
  }

  // Total Acura records for context
  const acuraTotalRes = await pool.query(`
    SELECT model, COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE make = 'Acura' AND model IN ('TL', 'TLX', 'TSX')
    GROUP BY model
    ORDER BY model
  `);
  console.log('\nTotal Acura records by model:');
  acuraTotalRes.rows.forEach(r => console.log(`  ${r.model}: ${r.cnt}`));

  await pool.end();
}

main().catch(console.error);
