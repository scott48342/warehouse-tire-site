#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Inline the fixed function
function getModelVariants(model) {
  const MODEL_ALIASES = {
    "silverado-2500": ["silverado-2500hd", "silverado-2500-hd"],
    "silverado-2500hd": ["silverado-2500", "silverado-2500-hd"],
    "silverado-2500-hd": ["silverado-2500hd", "silverado-2500"],
    "ram-3500": ["3500"],
  };
  
  const HD_RICH_PRIORITY = {
    "silverado-2500-hd": "silverado-2500hd",
  };
  
  const lowercased = model.toLowerCase().trim();
  const slugified = model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const aliases = MODEL_ALIASES[slugified] || [];
  const richVariant = HD_RICH_PRIORITY[slugified];
  
  if (richVariant) {
    const others = aliases.filter(a => a !== richVariant);
    return [...new Set([richVariant, lowercased, slugified, ...others])];
  }
  
  return [...new Set([lowercased, slugified, ...aliases])];
}

const testVehicles = [
  { year: 2022, make: 'Ford', model: 'F-150 Lightning' },
  { year: 2024, make: 'Toyota', model: 'Tacoma' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 2500 HD' },
  { year: 2025, make: 'Ford', model: 'Bronco' },
];

async function main() {
  console.log('Testing DB queries with fixed getModelVariants:\n');
  
  for (const v of testVehicles) {
    const modelVariants = getModelVariants(v.model);
    console.log(`${v.year} ${v.make} ${v.model}:`);
    console.log(`  Variants to try: [${modelVariants.join(', ')}]`);
    
    for (const modelName of modelVariants) {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM vehicle_fitments 
        WHERE year = $1 
          AND make ILIKE $2 
          AND model ILIKE $3 
          AND certification_status = 'certified'
      `, [v.year, v.make.toLowerCase(), modelName]);
      
      const count = parseInt(result.rows[0].count);
      if (count > 0) {
        console.log(`  ✅ FOUND ${count} rows with model ILIKE '${modelName}'`);
        break;
      } else {
        console.log(`  ❌ No match with model ILIKE '${modelName}'`);
      }
    }
    console.log('');
  }
  
  await pool.end();
}

main();
