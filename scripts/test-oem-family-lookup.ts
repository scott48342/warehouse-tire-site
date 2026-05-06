import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

interface TestCase {
  year: number;
  make: string;
  model: string;
  wheelDiameter: number;
  description: string;
}

// Test 10 diverse vehicles with 18" and 20" aftermarket wheel sizes
const testCases: TestCase[] = [
  // Trucks with 20"
  { year: 2008, make: "Chevrolet", model: "Silverado 1500", wheelDiameter: 20, description: "Old truck → 20\" upgrade" },
  { year: 2010, make: "Ford", model: "F-150", wheelDiameter: 20, description: "F-150 → 20\" upgrade" },
  { year: 2012, make: "RAM", model: "1500", wheelDiameter: 20, description: "Ram → 20\" upgrade" },
  
  // SUVs with 20"
  { year: 2012, make: "Chevrolet", model: "Tahoe", wheelDiameter: 20, description: "Tahoe → 20\" upgrade" },
  { year: 2015, make: "Jeep", model: "Wrangler", wheelDiameter: 20, description: "Wrangler → 20\" upgrade" },
  
  // Cars/Crossovers with 18"
  { year: 2015, make: "Honda", model: "Accord", wheelDiameter: 18, description: "Accord → 18\" sport" },
  { year: 2016, make: "Toyota", model: "Camry", wheelDiameter: 18, description: "Camry → 18\" upgrade" },
  { year: 2014, make: "Ford", model: "Mustang", wheelDiameter: 20, description: "Mustang → 20\" upgrade" },
  
  // Luxury with 20"
  { year: 2016, make: "BMW", model: "3 Series", wheelDiameter: 20, description: "BMW 3 → 20\" sport" },
  { year: 2017, make: "Audi", model: "A4", wheelDiameter: 20, description: "Audi A4 → 20\" sport" },
];

async function getOemFamilySizes(make: string, model: string, wheelDiameter: number): Promise<string[]> {
  const result = await pool.query(`
    WITH tire_sizes AS (
      SELECT 
        jsonb_array_elements_text(oem_tire_sizes) as tire_size
      FROM vehicle_fitments
      WHERE make = $1
        AND model ILIKE $2
        AND jsonb_typeof(oem_wheel_sizes) = 'array'
        AND EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(oem_wheel_sizes) as wheel
          WHERE (wheel->>'diameter')::numeric = $3
        )
    )
    SELECT DISTINCT tire_size
    FROM tire_sizes
    WHERE tire_size LIKE $4
    ORDER BY tire_size
  `, [make, `%${model}%`, wheelDiameter, `%R${wheelDiameter}`]);
  
  return result.rows.map(r => r.tire_size);
}

async function main() {
  console.log('=== OEM Family Tire Size Lookup Test (18" and 20") ===\n');
  console.log('Testing: When customer puts aftermarket wheels on older vehicle,');
  console.log('what tire sizes do we suggest from newer models of same vehicle?\n');
  console.log('─'.repeat(80) + '\n');

  for (const test of testCases) {
    const sizes = await getOemFamilySizes(test.make, test.model, test.wheelDiameter);
    
    console.log(`🚗 ${test.year} ${test.make} ${test.model} with ${test.wheelDiameter}" wheels`);
    console.log(`   ${test.description}`);
    
    if (sizes.length > 0) {
      console.log(`   ✅ OEM Family Sizes: ${sizes.join(', ')}`);
    } else {
      console.log(`   ⚠️  No OEM data found - will fall back to calculated sizes`);
    }
    console.log('');
  }

  await pool.end();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
