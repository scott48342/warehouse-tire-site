import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Replicate key normalization from keys.ts
function normalizeMake(make) {
  return make.toLowerCase().trim();
}

function normalizeModel(model) {
  return model.toLowerCase().replace(/[\s_-]+/g, '-').trim();
}

// Replicate model aliases logic
function getModelVariants(model) {
  const normalized = normalizeModel(model);
  // Simple version - just return normalized
  return [normalized];
}

async function trace() {
  const year = 2024;
  const make = 'Dodge';
  const model = 'Challenger';
  const trim = 'R/T';
  
  console.log('=== Input ===');
  console.log({ year, make, model, trim });
  
  const normalizedMake = normalizeMake(make);
  const modelVariants = getModelVariants(model);
  const normalizedModel = normalizeModel(model);
  
  console.log('\n=== Normalized ===');
  console.log('normalizedMake:', normalizedMake);
  console.log('modelVariants:', modelVariants);
  console.log('normalizedModel:', normalizedModel);
  
  console.log('\n=== DB Query (Step 2 exact displayTrim) ===');
  for (const modelName of modelVariants) {
    console.log(`Trying model: "${modelName}"`);
    
    const r = await pool.query(`
      SELECT id, modification_id, display_trim, make, model
      FROM vehicle_fitments 
      WHERE year = $1
        AND make ILIKE $2
        AND model ILIKE $3
        AND display_trim = $4
        AND certification_status = 'certified'
      LIMIT 5
    `, [year, normalizedMake, modelName, trim]);
    
    console.log(`  Results: ${r.rows.length}`);
    if (r.rows.length > 0) {
      console.log('  FOUND:', r.rows[0]);
    }
  }
  
  console.log('\n=== Check what model names exist in DB for Challenger ===');
  const r3 = await pool.query(`
    SELECT DISTINCT model FROM vehicle_fitments 
    WHERE make ILIKE 'dodge' AND model ILIKE '%challenger%'
  `);
  console.log('Distinct models:', r3.rows.map(r => r.model));
  
  await pool.end();
}

trace().catch(e => { console.error(e); process.exit(1); });
