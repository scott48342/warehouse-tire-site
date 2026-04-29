import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([^#][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const { Client } = pg;
const dbUrl = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').replace(/^["']|["']$/g, '');
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

await client.connect();

console.log('=== CHECKING NAME MISMATCHES ===\n');

// Check specific examples that showed as "missing"
const testCases = [
  { make: 'GMC', catalogModel: 'Sierra 2500HD' },
  { make: 'GMC', catalogModel: 'Sierra 1500' },
  { make: 'Ford', catalogModel: 'Edge' },
  { make: 'Chevrolet', catalogModel: 'Silverado 1500' },
  { make: 'Nissan', catalogModel: 'Frontier' },
  { make: 'Tesla', catalogModel: 'Model S' },
  { make: 'Tesla', catalogModel: 'Model 3' },
];

for (const tc of testCases) {
  console.log(`\n--- ${tc.make} ${tc.catalogModel} ---`);
  
  // Check what's in catalog_models
  const catalogRes = await client.query(`
    SELECT cm.name, cm.years FROM catalog_models cm
    JOIN catalog_makes m ON cm.make_slug = m.slug
    WHERE m.name = $1 AND cm.name ILIKE $2
  `, [tc.make, `%${tc.catalogModel}%`]);
  console.log('In catalog_models:', catalogRes.rows.map(r => `"${r.name}" (${r.years})`).join(', ') || 'NOT FOUND');
  
  // Check what's in vehicle_fitments
  const fitmentRes = await client.query(`
    SELECT DISTINCT model, year FROM vehicle_fitments
    WHERE make ILIKE $1 AND model ILIKE $2
    ORDER BY year
  `, [tc.make, `%${tc.catalogModel.replace(/\s+/g, '%')}%`]);
  
  if (fitmentRes.rows.length > 0) {
    const years = fitmentRes.rows.map(r => r.year);
    const modelNames = [...new Set(fitmentRes.rows.map(r => r.model))];
    console.log('In vehicle_fitments:', modelNames.map(m => `"${m}"`).join(', '));
    console.log('Years covered:', years.join(', '));
  } else {
    console.log('In vehicle_fitments: NOT FOUND');
    
    // Try to find similar names
    const similarRes = await client.query(`
      SELECT DISTINCT model FROM vehicle_fitments
      WHERE make ILIKE $1 AND model ILIKE $2
      LIMIT 5
    `, [tc.make, `%${tc.catalogModel.split(' ')[0]}%`]);
    if (similarRes.rows.length > 0) {
      console.log('Similar models found:', similarRes.rows.map(r => `"${r.model}"`).join(', '));
    }
  }
}

// Overall stats
console.log('\n\n=== OVERALL STATS ===');
const catalogCount = await client.query(`SELECT COUNT(DISTINCT make_slug || '|' || name) as cnt FROM catalog_models`);
const fitmentCount = await client.query(`SELECT COUNT(DISTINCT make || '|' || model) as cnt FROM vehicle_fitments WHERE certification_status = 'certified'`);
console.log('Unique make/model in catalog_models:', catalogCount.rows[0].cnt);
console.log('Unique make/model in vehicle_fitments:', fitmentCount.rows[0].cnt);

await client.end();
