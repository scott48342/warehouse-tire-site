import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

const client = await pool.connect();

console.log('='.repeat(80));
console.log('CLEANUP SPAM + ADD MISSING VEHICLES');
console.log('='.repeat(80));

// 1. Delete spam/garbage entries
console.log('\n1. Deleting spam entries...');

const spamDeleted = await client.query(`
  DELETE FROM unresolved_fitment_searches
  WHERE 
    -- Repeated words in make/model
    make LIKE '%benz benz%'
    OR make LIKE '%rover rover%'
    OR make LIKE '%romeo romeo%'
    OR model LIKE '%benz benz%'
    OR model LIKE '%rover rover%'
    OR model LIKE '%romeo romeo%'
    -- Invalid years
    OR year > 2027
    OR year < 1990
    -- Garbage characters
    OR make ~ '[0-9]{3,}'
    OR model ~ '[0-9]{5,}'
  RETURNING id
`);
console.log(`   Deleted ${spamDeleted.rowCount} spam entries`);

// 2. Add missing real vehicles
console.log('\n2. Adding missing vehicles...');

const MISSING_VEHICLES = [
  // Acura Integra (2023, 2024, 2026)
  { year: 2023, make: 'acura', model: 'integra', tires: ['215/55R17', '235/40R18', '245/35R19'], wheels: [{d:17,w:7,o:55},{d:18,w:8,o:50},{d:19,w:8.5,o:45}], bolt: '5x114.3', hub: 64.1 },
  { year: 2024, make: 'acura', model: 'integra', tires: ['215/55R17', '235/40R18', '245/35R19'], wheels: [{d:17,w:7,o:55},{d:18,w:8,o:50},{d:19,w:8.5,o:45}], bolt: '5x114.3', hub: 64.1 },
  { year: 2026, make: 'acura', model: 'integra', tires: ['215/55R17', '235/40R18', '245/35R19'], wheels: [{d:17,w:7,o:55},{d:18,w:8,o:50},{d:19,w:8.5,o:45}], bolt: '5x114.3', hub: 64.1 },
  
  // Kia K5 (2021-2025)
  { year: 2021, make: 'kia', model: 'k5', tires: ['215/55R17', '235/45R18', '245/40R19'], wheels: [{d:17,w:7,o:45},{d:18,w:7.5,o:45},{d:19,w:8,o:42}], bolt: '5x114.3', hub: 67.1 },
  { year: 2022, make: 'kia', model: 'k5', tires: ['215/55R17', '235/45R18', '245/40R19'], wheels: [{d:17,w:7,o:45},{d:18,w:7.5,o:45},{d:19,w:8,o:42}], bolt: '5x114.3', hub: 67.1 },
  { year: 2023, make: 'kia', model: 'k5', tires: ['215/55R17', '235/45R18', '245/40R19'], wheels: [{d:17,w:7,o:45},{d:18,w:7.5,o:45},{d:19,w:8,o:42}], bolt: '5x114.3', hub: 67.1 },
  { year: 2024, make: 'kia', model: 'k5', tires: ['215/55R17', '235/45R18', '245/40R19'], wheels: [{d:17,w:7,o:45},{d:18,w:7.5,o:45},{d:19,w:8,o:42}], bolt: '5x114.3', hub: 67.1 },
  { year: 2025, make: 'kia', model: 'k5', tires: ['215/55R17', '235/45R18', '245/40R19'], wheels: [{d:17,w:7,o:45},{d:18,w:7.5,o:45},{d:19,w:8,o:42}], bolt: '5x114.3', hub: 67.1 },
  
  // Nissan Frontier (2020-2023, we have 2024)
  { year: 2020, make: 'nissan', model: 'frontier', tires: ['255/70R16', '265/70R17', '265/65R18'], wheels: [{d:16,w:7,o:30},{d:17,w:7.5,o:30},{d:18,w:7.5,o:30}], bolt: '6x114.3', hub: 66.1 },
  { year: 2021, make: 'nissan', model: 'frontier', tires: ['255/70R16', '265/70R17', '265/65R18'], wheels: [{d:16,w:7,o:30},{d:17,w:7.5,o:30},{d:18,w:7.5,o:30}], bolt: '6x114.3', hub: 66.1 },
  { year: 2022, make: 'nissan', model: 'frontier', tires: ['265/70R17', '265/65R18', '275/55R20'], wheels: [{d:17,w:7.5,o:30},{d:18,w:7.5,o:30},{d:20,w:8.5,o:35}], bolt: '6x114.3', hub: 66.1 },
  { year: 2023, make: 'nissan', model: 'frontier', tires: ['265/70R17', '265/65R18', '275/55R20'], wheels: [{d:17,w:7.5,o:30},{d:18,w:7.5,o:30},{d:20,w:8.5,o:35}], bolt: '6x114.3', hub: 66.1 },
  
  // GMC Yukon XL (separate model)
  { year: 2021, make: 'gmc', model: 'yukon-xl', tires: ['275/65R18', '275/60R20', '285/45R22'], wheels: [{d:18,w:8.5,o:24},{d:20,w:9,o:24},{d:22,w:9,o:28}], bolt: '6x139.7', hub: 78.1 },
  { year: 2022, make: 'gmc', model: 'yukon-xl', tires: ['275/65R18', '275/60R20', '285/45R22'], wheels: [{d:18,w:8.5,o:24},{d:20,w:9,o:24},{d:22,w:9,o:28}], bolt: '6x139.7', hub: 78.1 },
  { year: 2023, make: 'gmc', model: 'yukon-xl', tires: ['275/65R18', '275/60R20', '285/45R22'], wheels: [{d:18,w:8.5,o:24},{d:20,w:9,o:24},{d:22,w:9,o:28}], bolt: '6x139.7', hub: 78.1 },
  { year: 2024, make: 'gmc', model: 'yukon-xl', tires: ['275/65R18', '275/60R20', '285/45R22'], wheels: [{d:18,w:8.5,o:24},{d:20,w:9,o:24},{d:22,w:9,o:28}], bolt: '6x139.7', hub: 78.1 },
];

let added = 0;
for (const v of MISSING_VEHICLES) {
  const existing = await client.query(
    `SELECT id FROM vehicle_fitments WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3`,
    [v.year, v.make, v.model]
  );
  
  if (existing.rows.length === 0) {
    await client.query(`
      INSERT INTO vehicle_fitments (
        year, make, model, modification_id, display_trim,
        bolt_pattern, center_bore_mm, offset_min_mm, offset_max_mm,
        oem_tire_sizes, oem_wheel_sizes, source, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'gap-fix', NOW(), NOW())
    `, [
      v.year, v.make, v.model, `${v.model}-${v.year}-base`, 'Base',
      v.bolt, v.hub, 20, 55,
      JSON.stringify(v.tires), JSON.stringify(v.wheels)
    ]);
    console.log(`   ✅ Added ${v.year} ${v.make} ${v.model}`);
    added++;
  }
}
console.log(`   Total added: ${added}`);

// 3. Clear resolved gaps again
console.log('\n3. Clearing newly resolved gaps...');

const resolved = await client.query(`
  DELETE FROM unresolved_fitment_searches u
  WHERE EXISTS (
    SELECT 1 FROM vehicle_fitments v
    WHERE v.year = u.year
      AND LOWER(v.make) = u.make
      AND (LOWER(v.model) = u.model OR LOWER(v.model) LIKE '%' || u.model || '%' OR u.model LIKE '%' || LOWER(v.model) || '%')
      AND v.oem_tire_sizes IS NOT NULL
      AND jsonb_array_length(v.oem_tire_sizes) > 0
  )
  RETURNING id
`);
console.log(`   Cleared ${resolved.rowCount} resolved entries`);

// Final stats
const remaining = await client.query(`
  SELECT COUNT(*) as count, SUM(occurrence_count) as searches
  FROM unresolved_fitment_searches
`);

console.log('\n' + '='.repeat(80));
console.log(`FINAL: ${remaining.rows[0].count} unresolved vehicles, ${remaining.rows[0].searches} searches`);

await client.release();
await pool.end();
