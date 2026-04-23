import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();
console.log('Connected\n');

// 1. Check and delete pre-1999 Silverado phantom records
console.log('=== PRE-1999 SILVERADO CLEANUP ===');
const silveradoCheck = await client.query(`
  SELECT year, model, display_trim, COUNT(*) as cnt 
  FROM vehicle_fitments 
  WHERE model ILIKE '%silverado%' AND year < 1999 
  GROUP BY year, model, display_trim 
  ORDER BY year
`);
console.log('Pre-1999 Silverado records found:');
console.table(silveradoCheck.rows);

if (silveradoCheck.rows.length > 0) {
  const del = await client.query(`
    DELETE FROM vehicle_fitments 
    WHERE model ILIKE '%silverado%' AND year < 1999
  `);
  console.log(`✓ Deleted ${del.rowCount} phantom Silverado records\n`);
}

// 2. Fix vintage Camaro tire sizes (if any have modern sizes)
console.log('=== VINTAGE CAMARO TIRE FIX ===');
const camaroFix = await client.query(`
  UPDATE vehicle_fitments 
  SET oem_tire_sizes = '["P205/70R14", "P215/70R14", "P225/70R15"]'::jsonb
  WHERE model ILIKE 'camaro' 
    AND year < 1982 
    AND oem_tire_sizes::text ILIKE '%R20%'
`);
console.log(`✓ Camaro: ${camaroFix.rowCount} rows fixed\n`);

// 3. Fix vintage Corvette tire sizes
console.log('=== VINTAGE CORVETTE TIRE FIX ===');
const corvetteFix = await client.query(`
  UPDATE vehicle_fitments 
  SET oem_tire_sizes = '["P225/70R15", "P235/60R15", "P255/60R15"]'::jsonb
  WHERE model ILIKE 'corvette' 
    AND year < 1984 
    AND oem_tire_sizes::text ILIKE '%R20%'
`);
console.log(`✓ Corvette: ${corvetteFix.rowCount} rows fixed\n`);

// 4. Delete invalid Corvette Z51 trims pre-1984
console.log('=== CORVETTE Z51 CLEANUP ===');
const z51Del = await client.query(`
  DELETE FROM vehicle_fitments 
  WHERE model ILIKE 'corvette' 
    AND display_trim ILIKE '%Z51%' 
    AND year < 1984
`);
console.log(`✓ Deleted ${z51Del.rowCount} invalid Z51 records\n`);

// 5. Fix Jeep Grand Cherokee ZJ tire inheritance
console.log('=== JEEP ZJ TIRE FIX ===');
const jeepFix = await client.query(`
  UPDATE vehicle_fitments 
  SET oem_tire_sizes = '["P215/75R15", "P225/70R15", "P225/75R16", "P235/70R16"]'::jsonb
  WHERE model ILIKE 'grand cherokee' 
    AND year BETWEEN 1993 AND 1998 
    AND (oem_tire_sizes::text ILIKE '%R20%' OR oem_tire_sizes::text ILIKE '%R22%')
`);
console.log(`✓ Jeep ZJ: ${jeepFix.rowCount} rows fixed\n`);

// 6. Summary
console.log('=== FINAL COUNTS ===');
const counts = await client.query(`
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE bolt_pattern IS NOT NULL) as with_bolt_pattern,
    COUNT(*) FILTER (WHERE oem_tire_sizes IS NOT NULL) as with_tires
  FROM vehicle_fitments
`);
console.table(counts.rows);

await client.end();
console.log('\n✅ Cleanup complete');
