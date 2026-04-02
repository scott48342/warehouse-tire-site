/**
 * Test the getTrimsWithCoverage function directly
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Simulate the normalization functions
function normalizeMake(make) {
  return make.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeModel(model) {
  return model.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Simulate model variants (aliases)
function getModelVariants(model) {
  const normalized = normalizeModel(model);
  // Common aliases
  const aliases = {
    'f-150': ['f-150', 'f150'],
    'f-250': ['f-250', 'f250', 'f-250-super-duty'],
    'f-350': ['f-350', 'f350', 'f-350-super-duty'],
    'mustang': ['mustang'],
    'camaro': ['camaro'],
    'challenger': ['challenger'],
    'charger': ['charger'],
  };
  return aliases[normalized] || [normalized];
}

async function testTrimsAPI(pool, year, make, model) {
  const normalizedMake = normalizeMake(make);
  const modelVariants = getModelVariants(model);
  
  console.log(`\nTesting: ${year} ${make} ${model}`);
  console.log(`   Normalized make: "${normalizedMake}"`);
  console.log(`   Model variants: ${JSON.stringify(modelVariants)}`);
  
  // Build the query similar to how Drizzle would
  const placeholders = modelVariants.map((_, i) => `$${i + 3}`).join(', ');
  const query = `
    SELECT DISTINCT modification_id, display_trim
    FROM vehicle_fitments
    WHERE year = $1 AND make = $2 AND model IN (${placeholders})
    ORDER BY display_trim
  `;
  
  const result = await pool.query(query, [year, normalizedMake, ...modelVariants]);
  
  console.log(`   Query returned ${result.rows.length} trims:`);
  for (const r of result.rows) {
    console.log(`   • "${r.display_trim}" (mod: ${r.modification_id?.substring(0, 30)}...)`);
  }
  
  // Simulate the API response transformation
  const apiResponse = {
    results: result.rows.map(t => ({
      value: t.modification_id,
      label: t.display_trim || "Base",
      modificationId: t.modification_id,
    })),
    source: "fitment_db",
    count: result.rows.length,
    hasCoverage: result.rows.length > 0,
  };
  
  console.log(`\n   API Response would be:`);
  console.log(`   {`);
  console.log(`     source: "${apiResponse.source}",`);
  console.log(`     count: ${apiResponse.count},`);
  console.log(`     hasCoverage: ${apiResponse.hasCoverage},`);
  console.log(`     results: [`);
  for (const r of apiResponse.results.slice(0, 5)) {
    console.log(`       { value: "${r.value?.substring(0,25)}...", label: "${r.label}" },`);
  }
  if (apiResponse.results.length > 5) {
    console.log(`       ... and ${apiResponse.results.length - 5} more`);
  }
  console.log(`     ]`);
  console.log(`   }`);
  
  return apiResponse;
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('='.repeat(80));
  console.log('SIMULATING TRIMS API RESPONSES');
  console.log('='.repeat(80));

  await testTrimsAPI(pool, 2020, 'Ford', 'Mustang');
  await testTrimsAPI(pool, 2020, 'Chevrolet', 'Camaro');
  await testTrimsAPI(pool, 2020, 'Dodge', 'Challenger');
  await testTrimsAPI(pool, 2020, 'Dodge', 'Charger');

  await pool.end();
  
  console.log('\n' + '='.repeat(80));
  console.log('CONCLUSION: If this shows multiple trims, the issue is in the frontend/UI');
  console.log('='.repeat(80));
}

main().catch(console.error);
