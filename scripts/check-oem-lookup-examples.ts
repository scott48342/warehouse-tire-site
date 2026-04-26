/**
 * Check OEM lookup examples
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Same lookup table from v2
const OEM_TIRE_LOOKUP: Record<number, Record<string, string[]>> = {
  14: {
    'pre-1980': ['195/75R14', '205/75R14', '215/75R14'],
    '1980-1990': ['185/75R14', '195/75R14', '205/70R14', '195/70R14'],
    '1990+': ['185/65R14', '195/65R14', '185/70R14', '195/70R14', '205/70R14']
  },
  15: {
    'pre-1980': ['215/75R15', '225/75R15'],
    '1980-1990': ['195/75R15', '205/75R15', '215/75R15', '205/70R15', '215/70R15', '225/70R15'],
    '1990-2000': ['195/65R15', '205/65R15', '205/70R15', '215/65R15', '225/60R15'],
    '2000+': ['195/65R15', '205/65R15', '215/60R15', '225/60R15']
  },
  16: {
    'pre-1990': ['205/70R16', '215/70R16', '225/70R16', '245/75R16'],
    '1990-2000': ['205/60R16', '205/65R16', '215/55R16', '225/55R16', '225/60R16'],
    '2000+': ['205/55R16', '215/55R16', '215/60R16', '225/60R16', '235/60R16']
  }
};

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

function extractTireDiameter(tireSize: string): number | null {
  if (!tireSize) return null;
  const match = String(tireSize).match(/R(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  return Math.floor(parseFloat(match[1]));
}

async function check() {
  // Get sample records that will use OEM lookup
  const result = await pool.query(`
    SELECT year, make, model, raw_trim, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments
    WHERE certification_status = 'needs_review'
      AND certification_errors::text LIKE '%AFTERMARKET_TIRES%'
    ORDER BY make, model
    LIMIT 100
  `);
  
  console.log('=== OEM LOOKUP EXAMPLES ===\n');
  
  let lookupCount = 0;
  
  for (const r of result.rows) {
    const wheelDiams = extractWheelDiameters(r.oem_wheel_sizes);
    const tires = Array.isArray(r.oem_tire_sizes) ? r.oem_tire_sizes : [r.oem_tire_sizes];
    const tireDiams = tires.map(t => extractTireDiameter(t)).filter(d => d !== null) as number[];
    
    // Check if any tires match wheels
    const hasMatch = tireDiams.some(td => wheelDiams.includes(td));
    
    if (!hasMatch && lookupCount < 15) {
      lookupCount++;
      console.log(`${r.year} ${r.make} ${r.model} "${r.raw_trim}":`);
      console.log(`  OEM Wheels: ${wheelDiams.join('", ')}" | Tires had: ${tireDiams.join('", ')}"`);
      
      // Show what we would apply
      const diam = wheelDiams[0];
      let eraKey: string;
      if (diam <= 15) {
        if (r.year < 1980) eraKey = 'pre-1980';
        else if (r.year < 1990) eraKey = '1980-1990';
        else if (r.year < 2000) eraKey = '1990-2000';
        else eraKey = '2000+';
      } else {
        if (r.year < 1990) eraKey = 'pre-1990';
        else if (r.year < 2000) eraKey = '1990-2000';
        else eraKey = '2000+';
      }
      
      const lookup = OEM_TIRE_LOOKUP[diam];
      const oemTires = lookup?.[eraKey] || lookup?.[Object.keys(lookup || {})[0]] || [];
      
      console.log(`  Would apply (${diam}" / ${eraKey}): ${oemTires.slice(0, 2).join(', ')}`);
      console.log('');
    }
  }
  
  await pool.end();
}

check().catch(console.error);
