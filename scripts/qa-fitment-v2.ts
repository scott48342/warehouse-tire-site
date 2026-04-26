/**
 * Randomized Behavioral QA v2 - Fixed tire/wheel matching
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const ECONOMY_MODELS = ['civic', 'corolla', 'camry', 'accord', 'altima', 'sentra', 'elantra', 'sonata', 'forte', 'optima', 'mazda3', 'mazda6', 'cruze', 'malibu', 'focus', 'fusion', 'jetta', 'passat', 'impreza', 'legacy', 'prius', 'fit', 'yaris', 'versa'];
const TRUCK_MODELS = ['f-150', 'f-250', 'f-350', 'silverado', 'sierra', '1500', '2500', '3500', 'tundra', 'tacoma', 'titan', 'frontier', 'colorado', 'canyon', 'ranger', 'wrangler', 'gladiator', 'bronco', '4runner', 'land cruiser'];

interface Issue {
  id: string;
  vehicle: string;
  submodel: string;
  issue: string;
  data: string;
}

function parseTireDiameter(size: string): number | null {
  const match = size.match(/R(\d{2})/i);
  return match ? parseInt(match[1]) : null;
}

function parseTireWidth(size: string): number | null {
  const match = size.match(/(\d{3})\/\d/);
  return match ? parseInt(match[1]) : null;
}

async function main() {
  console.log('\n🔍 BEHAVIORAL QA v2 - 100 Random Vehicles\n');
  console.log('='.repeat(60));
  
  // Get 100 random records
  const samples = await pool.query(`
    SELECT id, year, make, model, submodel, bolt_pattern,
           oem_wheel_sizes::jsonb as wheels,
           oem_tire_sizes::jsonb as tires
    FROM vehicle_fitments
    WHERE year >= 2000
    ORDER BY RANDOM()
    LIMIT 100
  `);
  
  const issues: Issue[] = [];
  let passed = 0;
  
  for (const row of samples.rows) {
    const vehicleIssues: string[] = [];
    const vehicle = `${row.year} ${row.make} ${row.model}`;
    const normModel = row.model.toLowerCase();
    const isEconomy = ECONOMY_MODELS.some(m => normModel.includes(m));
    const isTruck = TRUCK_MODELS.some(m => normModel.includes(m));
    
    // Parse wheels
    const wheels: { diameter: number; width: number }[] = [];
    if (Array.isArray(row.wheels)) {
      for (const w of row.wheels) {
        if (w.diameter) wheels.push({ diameter: w.diameter, width: w.width || 0 });
      }
    }
    
    // Parse tires
    const tires: { size: string; diameter: number | null; width: number | null }[] = [];
    if (Array.isArray(row.tires)) {
      for (const t of row.tires) {
        if (typeof t === 'string') {
          tires.push({ size: t, diameter: parseTireDiameter(t), width: parseTireWidth(t) });
        }
      }
    }
    
    // Get wheel diameters
    const wheelDiameters = wheels.map(w => w.diameter);
    const tireDiameters = tires.map(t => t.diameter).filter(d => d !== null) as number[];
    
    // === CHECKS ===
    
    // 1. Wheel sanity
    if (wheels.length === 0) {
      vehicleIssues.push('Missing wheel data');
    } else {
      for (const w of wheels) {
        if (w.diameter < 14 || w.diameter > 24) {
          vehicleIssues.push(`Unrealistic wheel ${w.diameter}"`);
        }
        if (isEconomy && w.diameter > 20) {
          vehicleIssues.push(`Economy car with ${w.diameter}" wheels`);
        }
      }
    }
    
    // 2. Tire sanity
    if (tires.length === 0) {
      vehicleIssues.push('Missing tire data');
    } else {
      for (const t of tires) {
        if (t.width && (t.width < 155 || t.width > 355)) {
          vehicleIssues.push(`Unrealistic tire width ${t.width}mm`);
        }
        if (isEconomy && t.width && t.width > 275) {
          vehicleIssues.push(`Economy car with ${t.width}mm tires`);
        }
        // Off-road contamination
        if (isEconomy && /LT\d|\/75R|\/80R|35x|33x|37x/i.test(t.size)) {
          vehicleIssues.push(`Off-road tire "${t.size}" on economy car`);
        }
      }
    }
    
    // 3. Tire/wheel diameter compatibility
    // At least ONE tire should match at least ONE wheel diameter
    if (tireDiameters.length > 0 && wheelDiameters.length > 0) {
      const hasMatch = tireDiameters.some(td => wheelDiameters.includes(td));
      if (!hasMatch) {
        vehicleIssues.push(`No tire matches wheel: tires R${tireDiameters.join('/')} vs wheels ${wheelDiameters.join('/')}`);
      }
    }
    
    // 4. Bolt pattern
    if (!row.bolt_pattern) {
      vehicleIssues.push('Missing bolt pattern');
    } else {
      const match = row.bolt_pattern.match(/(\d)x([\d.]+)/);
      if (match) {
        const lugs = parseInt(match[1]);
        const pcd = parseFloat(match[2]);
        if (lugs < 4 || lugs > 8) vehicleIssues.push(`Invalid lug count ${lugs}`);
        if (pcd < 98 || pcd > 220) vehicleIssues.push(`Invalid PCD ${pcd}`);
      }
    }
    
    // 5. Trim name
    if (!row.submodel || row.submodel.length === 0) {
      vehicleIssues.push('Empty trim name');
    }
    
    if (vehicleIssues.length === 0) {
      passed++;
    } else {
      for (const issue of vehicleIssues) {
        issues.push({
          id: row.id,
          vehicle,
          submodel: row.submodel,
          issue,
          data: `Wheels: ${wheelDiameters.join('/')}  Tires: ${tireDiameters.join('/')}`
        });
      }
    }
  }
  
  // === RESULTS ===
  
  console.log(`\n📊 RESULTS\n`);
  console.log(`  ✅ PASSED: ${passed}/100`);
  console.log(`  ❌ FAILED: ${100 - passed}/100`);
  console.log(`  Pass Rate: ${passed}%`);
  
  if (issues.length > 0) {
    // Group by issue type
    const byType: Record<string, Issue[]> = {};
    for (const i of issues) {
      const type = i.issue.split(':')[0].split(' ')[0];
      if (!byType[type]) byType[type] = [];
      byType[type].push(i);
    }
    
    console.log(`\n📈 Issues by Type:\n`);
    for (const [type, list] of Object.entries(byType).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${type}: ${list.length}`);
    }
    
    console.log(`\n❌ ISSUE DETAILS (first 15):\n`);
    for (const i of issues.slice(0, 15)) {
      console.log(`  ${i.vehicle} [${i.submodel}]`);
      console.log(`    ⚠️ ${i.issue}`);
      console.log(`    ${i.data}`);
      console.log('');
    }
  }
  
  // Same-size check
  console.log(`\n🔍 Same-size across trims check...\n`);
  const sameSize = await pool.query(`
    SELECT make, model, year, COUNT(*) as trims,
           COUNT(DISTINCT oem_wheel_sizes::text) as unique_wheels
    FROM vehicle_fitments
    WHERE year >= 2000
    GROUP BY make, model, year
    HAVING COUNT(*) >= 4 AND COUNT(DISTINCT oem_wheel_sizes::text) = 1
    LIMIT 10
  `);
  
  if (sameSize.rowCount === 0) {
    console.log(`✅ No same-size-across-all-trims issues`);
  } else {
    console.log(`⚠️ ${sameSize.rowCount} vehicles with 4+ trims but identical specs`);
    for (const r of sameSize.rows) {
      console.log(`  ${r.year} ${r.make} ${r.model}: ${r.trims} trims`);
    }
  }
  
  // Final status
  console.log(`\n${'='.repeat(60)}`);
  if (passed >= 95) {
    console.log(`\n🎉 QA PASSED - ${passed}% pass rate\n`);
  } else if (passed >= 85) {
    console.log(`\n✅ QA MOSTLY PASSED - ${passed}% pass rate, minor fixes needed\n`);
  } else {
    console.log(`\n⚠️ QA NEEDS ATTENTION - ${passed}% pass rate\n`);
  }
  
  await pool.end();
}

main().catch(console.error);
