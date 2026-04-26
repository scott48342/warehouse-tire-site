/**
 * Investigate why AFTERMARKET_TIRES records aren't being corrected
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

function extractTireDiameter(tireSize: string): number | null {
  if (!tireSize) return null;
  const match = String(tireSize).match(/R(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  return Math.floor(parseFloat(match[1]));
}

function extractWheelDiameters(oemWheelSizes: any): number[] {
  const diameters: number[] = [];
  if (!oemWheelSizes) return diameters;
  
  const wheels = Array.isArray(oemWheelSizes) ? oemWheelSizes : [oemWheelSizes];
  
  for (const wheel of wheels) {
    if (typeof wheel === 'object' && wheel.diameter) {
      const d = Number(wheel.diameter);
      if (d > 0 && !diameters.includes(d)) diameters.push(d);
    } else if (typeof wheel === 'string') {
      const match = wheel.match(/(\d+)x/);
      if (match) {
        const d = parseInt(match[1]);
        if (d > 0 && !diameters.includes(d)) diameters.push(d);
      }
    }
  }
  
  return diameters.sort((a, b) => a - b);
}

async function investigate() {
  // Get sample problematic records
  const result = await pool.query(`
    SELECT id, year, make, model, raw_trim,
           oem_wheel_sizes, oem_tire_sizes, certification_errors
    FROM vehicle_fitments
    WHERE certification_status = 'needs_review'
      AND certification_errors::text LIKE '%AFTERMARKET_TIRES%'
    ORDER BY make, model
    LIMIT 50
  `);
  
  console.log('=== INVESTIGATING AFTERMARKET_TIRES RECORDS ===\n');
  
  const issues: Record<string, number> = {
    'no_wheels': 0,
    'no_tires': 0,
    'no_stock_wheels': 0,
    'diameter_mismatch': 0,
    'era_filter': 0,
    'looks_fine': 0
  };
  
  for (const r of result.rows) {
    const wheels = r.oem_wheel_sizes;
    const tires = r.oem_tire_sizes;
    
    // Check what's wrong
    const wheelDiams = extractWheelDiameters(wheels);
    const tireArray = Array.isArray(tires) ? tires : (tires ? [tires] : []);
    const tireDiams = tireArray.map(t => extractTireDiameter(t)).filter(d => d !== null) as number[];
    
    // Check diameter match
    const tiresMatchWheels = tireDiams.every(td => wheelDiams.includes(td));
    const hasAftermarketDiams = tireDiams.some(td => !wheelDiams.includes(td));
    
    if (wheelDiams.length === 0) {
      issues['no_wheels']++;
    } else if (tireDiams.length === 0) {
      issues['no_tires']++;
    } else if (hasAftermarketDiams) {
      issues['diameter_mismatch']++;
      console.log(`${r.year} ${r.make} ${r.model}:`);
      console.log(`  Wheel diams: ${wheelDiams.join(', ')}`);
      console.log(`  Tire diams: ${tireDiams.join(', ')}`);
      console.log(`  Tires: ${tireArray.slice(0, 5).join(', ')}`);
      console.log('');
    } else {
      issues['looks_fine']++;
    }
  }
  
  console.log('\n=== ISSUE BREAKDOWN ===');
  for (const [issue, count] of Object.entries(issues)) {
    console.log(`  ${issue}: ${count}`);
  }
  
  // Get specific examples of problematic families
  console.log('\n=== TOP PROBLEMATIC FAMILIES ===');
  
  const families = await pool.query(`
    SELECT make, model, COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE certification_status = 'needs_review'
      AND certification_errors::text LIKE '%AFTERMARKET_TIRES%'
    GROUP BY make, model
    ORDER BY cnt DESC
    LIMIT 10
  `);
  
  for (const f of families.rows) {
    const sample = await pool.query(`
      SELECT year, raw_trim, oem_wheel_sizes, oem_tire_sizes
      FROM vehicle_fitments
      WHERE make = $1 AND model = $2
        AND certification_status = 'needs_review'
        AND certification_errors::text LIKE '%AFTERMARKET_TIRES%'
      ORDER BY year
      LIMIT 3
    `, [f.make, f.model]);
    
    console.log(`\n${f.make} ${f.model} (${f.cnt}):`);
    for (const s of sample.rows) {
      const wheelDiams = extractWheelDiameters(s.oem_wheel_sizes);
      const tires = Array.isArray(s.oem_tire_sizes) ? s.oem_tire_sizes : [s.oem_tire_sizes];
      const tireDiams = tires.map(t => extractTireDiameter(t)).filter(d => d !== null);
      
      console.log(`  ${s.year} "${s.raw_trim}":`);
      console.log(`    Wheels: ${wheelDiams.join(', ')} | Tires: ${tireDiams.join(', ')}`);
      console.log(`    Tire sizes: ${tires.slice(0, 4).join(', ')}${tires.length > 4 ? '...' : ''}`);
    }
  }
  
  await pool.end();
}

investigate().catch(console.error);
