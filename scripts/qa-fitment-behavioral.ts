/**
 * Randomized Behavioral QA for Fitment Data
 * Validates 100 random vehicles for data sanity
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Vehicle categories for sampling
const CATEGORIES: Record<string, { makes: string[], expectedWheelRange: [number, number], expectedTireWidthRange: [number, number] }> = {
  'economy': {
    makes: ['Honda', 'Toyota', 'Nissan', 'Hyundai', 'Kia', 'Mazda', 'Chevrolet', 'Ford'],
    expectedWheelRange: [14, 18],
    expectedTireWidthRange: [175, 235],
  },
  'sedan': {
    makes: ['Honda', 'Toyota', 'Nissan', 'Hyundai', 'Kia', 'Mazda', 'Chevrolet', 'Ford', 'Volkswagen', 'Subaru'],
    expectedWheelRange: [15, 19],
    expectedTireWidthRange: [195, 255],
  },
  'suv': {
    makes: ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'GMC', 'Jeep', 'Nissan', 'Hyundai', 'Kia', 'Subaru', 'Mazda'],
    expectedWheelRange: [16, 22],
    expectedTireWidthRange: [215, 295],
  },
  'truck': {
    makes: ['Ford', 'Chevrolet', 'GMC', 'RAM', 'Toyota', 'Nissan'],
    expectedWheelRange: [17, 24],
    expectedTireWidthRange: [245, 325],
  },
  'van': {
    makes: ['Honda', 'Toyota', 'Chrysler', 'Dodge', 'Kia', 'Ford', 'Chevrolet', 'Mercedes-Benz', 'RAM'],
    expectedWheelRange: [16, 20],
    expectedTireWidthRange: [215, 275],
  },
  'luxury': {
    makes: ['BMW', 'Mercedes-Benz', 'Audi', 'Lexus', 'Infiniti', 'Acura', 'Cadillac', 'Lincoln', 'Genesis', 'Volvo'],
    expectedWheelRange: [17, 22],
    expectedTireWidthRange: [225, 295],
  },
  'performance': {
    makes: ['BMW', 'Porsche', 'Chevrolet', 'Ford', 'Dodge', 'Audi', 'Mercedes-Benz', 'Alfa Romeo', 'Jaguar'],
    expectedWheelRange: [18, 22],
    expectedTireWidthRange: [235, 335],
  },
};

// Models that should NOT have truck/off-road specs
const ECONOMY_SEDAN_MODELS = [
  'civic', 'corolla', 'camry', 'accord', 'altima', 'sentra', 'elantra', 'sonata',
  'forte', 'optima', 'mazda3', 'mazda6', 'cruze', 'malibu', 'focus', 'fusion',
  'jetta', 'passat', 'impreza', 'legacy', 'prius', 'fit', 'yaris', 'versa'
];

// Models that SHOULD have larger specs
const TRUCK_OFF_ROAD_MODELS = [
  'f-150', 'f-250', 'f-350', 'silverado', 'sierra', '1500', '2500', '3500',
  'tundra', 'tacoma', 'titan', 'frontier', 'colorado', 'canyon', 'ranger',
  'wrangler', 'gladiator', 'bronco', '4runner', 'land cruiser', 'sequoia'
];

interface QAResult {
  id: string;
  year: number;
  make: string;
  model: string;
  submodel: string;
  wheelDiameter: number | null;
  wheelWidth: number | null;
  tireSize: string | null;
  boltPattern: string;
  issues: string[];
  category: string;
}

function parseTireSize(size: string): { width: number; aspect: number; diameter: number } | null {
  // Match patterns like "225/45R17", "P225/45R17", "LT265/70R17", "35x12.50R17"
  const standard = size.match(/(\d{3})\/(\d{2,3})R(\d{2})/i);
  if (standard) {
    return { width: parseInt(standard[1]), aspect: parseInt(standard[2]), diameter: parseInt(standard[3]) };
  }
  
  const flotation = size.match(/(\d{2,3})x([\d.]+)R(\d{2})/i);
  if (flotation) {
    // Flotation tires - convert to approximate width
    const heightInches = parseFloat(flotation[1]);
    const widthInches = parseFloat(flotation[2]);
    return { width: Math.round(widthInches * 25.4), aspect: 0, diameter: parseInt(flotation[3]) };
  }
  
  return null;
}

async function main() {
  console.log('\n🔍 RANDOMIZED BEHAVIORAL QA - Fitment Data\n');
  console.log('=' .repeat(60));
  
  const results: QAResult[] = [];
  const issuesByCategory: Record<string, number> = {};
  const suspiciousClusters: { key: string; count: number; issues: string[] }[] = [];
  
  // Sample vehicles from each category
  for (const [category, config] of Object.entries(CATEGORIES)) {
    const makesIn = config.makes.map(m => `'${m}'`).join(',');
    
    // Get random samples
    const samples = await pool.query(`
      SELECT id, year, make, model, submodel, bolt_pattern,
             oem_wheel_sizes::text as wheels, oem_tire_sizes::text as tires
      FROM vehicle_fitments
      WHERE year >= 2000 AND make IN (${makesIn})
      ORDER BY RANDOM()
      LIMIT ${Math.ceil(100 / Object.keys(CATEGORIES).length)}
    `);
    
    for (const row of samples.rows) {
      const issues: string[] = [];
      
      // Parse wheel data
      let wheelDiameter: number | null = null;
      let wheelWidth: number | null = null;
      try {
        const wheels = JSON.parse(row.wheels || '[]');
        if (wheels.length > 0) {
          wheelDiameter = wheels[0].diameter;
          wheelWidth = wheels[0].width;
        }
      } catch (e) {}
      
      // Parse tire data
      let tireSize: string | null = null;
      let tireWidth: number | null = null;
      let tireDiameter: number | null = null;
      try {
        const tires = JSON.parse(row.tires || '[]');
        if (tires.length > 0) {
          tireSize = tires[0];
          const parsed = parseTireSize(tires[0]);
          if (parsed) {
            tireWidth = parsed.width;
            tireDiameter = parsed.diameter;
          }
        }
      } catch (e) {}
      
      const normModel = row.model.toLowerCase();
      const isEconomySedan = ECONOMY_SEDAN_MODELS.some(m => normModel.includes(m));
      const isTruckOffRoad = TRUCK_OFF_ROAD_MODELS.some(m => normModel.includes(m));
      
      // ===== VALIDATION CHECKS =====
      
      // 1. Trim name sanity
      if (!row.submodel || row.submodel.length < 2) {
        issues.push('TRIM: Empty or too short');
      }
      if (/^[0-9]+$/.test(row.submodel)) {
        issues.push('TRIM: Numeric only');
      }
      if (row.submodel && row.submodel.length > 50) {
        issues.push('TRIM: Suspiciously long name');
      }
      
      // 2. Wheel diameter sanity
      if (wheelDiameter) {
        if (wheelDiameter < 14 || wheelDiameter > 24) {
          issues.push(`WHEEL: Unrealistic diameter ${wheelDiameter}"`);
        }
        if (isEconomySedan && wheelDiameter > 19) {
          issues.push(`WHEEL: Economy car with ${wheelDiameter}" wheels`);
        }
        if (isTruckOffRoad && wheelDiameter < 16) {
          issues.push(`WHEEL: Truck with tiny ${wheelDiameter}" wheels`);
        }
      } else {
        issues.push('WHEEL: Missing diameter');
      }
      
      // 3. Wheel width sanity
      if (wheelWidth) {
        if (wheelWidth < 5 || wheelWidth > 14) {
          issues.push(`WHEEL: Unrealistic width ${wheelWidth}"`);
        }
        if (isEconomySedan && wheelWidth > 9) {
          issues.push(`WHEEL: Economy car with ${wheelWidth}" wide wheels`);
        }
      }
      
      // 4. Tire size sanity
      if (tireSize) {
        if (tireWidth) {
          if (tireWidth < 155 || tireWidth > 355) {
            issues.push(`TIRE: Unrealistic width ${tireWidth}mm`);
          }
          if (isEconomySedan && tireWidth > 245) {
            issues.push(`TIRE: Economy car with ${tireWidth}mm tires`);
          }
        }
        
        // Check tire diameter matches wheel
        if (tireDiameter && wheelDiameter && tireDiameter !== wheelDiameter) {
          issues.push(`MISMATCH: Tire R${tireDiameter} on ${wheelDiameter}" wheel`);
        }
      } else {
        issues.push('TIRE: Missing size');
      }
      
      // 5. Bolt pattern sanity
      if (!row.bolt_pattern) {
        issues.push('BOLT: Missing pattern');
      } else {
        const boltMatch = row.bolt_pattern.match(/(\d)x([\d.]+)/);
        if (boltMatch) {
          const lugs = parseInt(boltMatch[1]);
          const pcd = parseFloat(boltMatch[2]);
          if (lugs < 4 || lugs > 8) {
            issues.push(`BOLT: Invalid lug count ${lugs}`);
          }
          if (pcd < 98 || pcd > 220) {
            issues.push(`BOLT: Invalid PCD ${pcd}`);
          }
        }
      }
      
      // 6. Off-road contamination check
      if (isEconomySedan && tireSize) {
        if (/LT\d|\/70R|\/75R|\/80R|35x|33x|37x/i.test(tireSize)) {
          issues.push(`CONTAMINATION: Off-road tire ${tireSize} on economy car`);
        }
      }
      
      results.push({
        id: row.id,
        year: row.year,
        make: row.make,
        model: row.model,
        submodel: row.submodel,
        wheelDiameter,
        wheelWidth,
        tireSize,
        boltPattern: row.bolt_pattern,
        issues,
        category,
      });
      
      if (issues.length > 0) {
        issuesByCategory[category] = (issuesByCategory[category] || 0) + 1;
      }
    }
  }
  
  // ===== ANALYSIS =====
  
  const passed = results.filter(r => r.issues.length === 0);
  const failed = results.filter(r => r.issues.length > 0);
  
  console.log(`\n📊 SUMMARY (${results.length} vehicles sampled)\n`);
  console.log(`  ✅ PASS: ${passed.length}`);
  console.log(`  ❌ FAIL: ${failed.length}`);
  console.log(`  Pass Rate: ${((passed.length / results.length) * 100).toFixed(1)}%`);
  
  console.log(`\n📈 Issues by Category:\n`);
  for (const [cat, count] of Object.entries(issuesByCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count} issues`);
  }
  
  // Find suspicious clusters
  const clusterMap: Record<string, QAResult[]> = {};
  for (const r of failed) {
    const key = `${r.make} ${r.model}`;
    if (!clusterMap[key]) clusterMap[key] = [];
    clusterMap[key].push(r);
  }
  
  const clusters = Object.entries(clusterMap)
    .filter(([k, v]) => v.length >= 2)
    .map(([key, records]) => ({
      key,
      count: records.length,
      issues: [...new Set(records.flatMap(r => r.issues))],
    }))
    .sort((a, b) => b.count - a.count);
  
  if (clusters.length > 0) {
    console.log(`\n⚠️ SUSPICIOUS CLUSTERS:\n`);
    for (const c of clusters.slice(0, 10)) {
      console.log(`  ${c.key} (${c.count} records):`);
      c.issues.forEach(i => console.log(`    - ${i}`));
    }
  }
  
  // Show failed examples
  if (failed.length > 0) {
    console.log(`\n❌ FAILED EXAMPLES (first 20):\n`);
    for (const f of failed.slice(0, 20)) {
      console.log(`  ${f.year} ${f.make} ${f.model} [${f.submodel}]`);
      console.log(`    Wheel: ${f.wheelDiameter || 'N/A'}" x ${f.wheelWidth || 'N/A'}"`);
      console.log(`    Tire: ${f.tireSize || 'N/A'}`);
      console.log(`    Bolt: ${f.boltPattern}`);
      f.issues.forEach(i => console.log(`    ⚠️ ${i}`));
      console.log('');
    }
  }
  
  // Check for same-size nonsense (all trims have identical specs)
  console.log(`\n🔍 Checking for copied same-size nonsense...\n`);
  const sameSpecsQuery = await pool.query(`
    SELECT make, model, year, 
           COUNT(DISTINCT oem_wheel_sizes::text) as unique_wheels,
           COUNT(*) as trim_count
    FROM vehicle_fitments
    WHERE year >= 2000
    GROUP BY make, model, year
    HAVING COUNT(*) >= 4 AND COUNT(DISTINCT oem_wheel_sizes::text) = 1
    ORDER BY trim_count DESC
    LIMIT 15
  `);
  
  if (sameSpecsQuery.rows.length > 0) {
    console.log(`⚠️ Vehicles with 4+ trims but identical wheel specs:`);
    for (const r of sameSpecsQuery.rows) {
      console.log(`  ${r.year} ${r.make} ${r.model}: ${r.trim_count} trims, all same wheels`);
    }
  } else {
    console.log(`✅ No obvious same-size-across-all-trims issues found`);
  }
  
  // Final recommendation
  console.log(`\n${'='.repeat(60)}`);
  if (failed.length === 0) {
    console.log(`\n🎉 ALL ${results.length} SAMPLED RECORDS PASSED QA\n`);
  } else if (failed.length <= 5) {
    console.log(`\n✅ QA MOSTLY PASSED - ${failed.length} minor issues found\n`);
  } else {
    console.log(`\n⚠️ QA FOUND ${failed.length} ISSUES - Review needed\n`);
  }
  
  await pool.end();
}

main().catch(console.error);
