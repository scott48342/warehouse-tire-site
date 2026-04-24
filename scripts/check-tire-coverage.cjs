const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

// Read .env.local manually
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
envLines.forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
});

const client = postgres(process.env.POSTGRES_URL);

async function check() {
  // Count total records
  const [{ total }] = await client`SELECT COUNT(*)::int as total FROM vehicle_fitments`;
  
  // oem_tire_sizes is JSONB array - check if it's non-empty
  const [{ with_tires }] = await client`
    SELECT COUNT(*)::int as with_tires 
    FROM vehicle_fitments 
    WHERE oem_tire_sizes IS NOT NULL 
      AND oem_tire_sizes::text != '[]'
      AND oem_tire_sizes::text != 'null'
      AND LENGTH(oem_tire_sizes::text) > 2
  `;
  
  // By source
  const bySrc = await client`
    SELECT source, COUNT(*)::int as cnt, 
           SUM(CASE WHEN oem_tire_sizes IS NOT NULL AND oem_tire_sizes::text != '[]' AND oem_tire_sizes::text != 'null' AND LENGTH(oem_tire_sizes::text) > 2 THEN 1 ELSE 0 END)::int as with_tires
    FROM vehicle_fitments 
    GROUP BY source 
    ORDER BY cnt DESC
  `;
  
  // Sample without tire sizes - popular makes
  const noTiresMakes = await client`
    SELECT make, COUNT(*)::int as cnt
    FROM vehicle_fitments 
    WHERE oem_tire_sizes IS NULL 
       OR oem_tire_sizes::text = '[]'
       OR oem_tire_sizes::text = 'null'
       OR LENGTH(oem_tire_sizes::text) <= 2
    GROUP BY make
    ORDER BY cnt DESC
    LIMIT 15
  `;
  
  // Sample records with tire sizes
  const sampleWithTires = await client`
    SELECT year, make, model, display_trim, oem_tire_sizes
    FROM vehicle_fitments
    WHERE oem_tire_sizes IS NOT NULL 
      AND oem_tire_sizes::text != '[]'
      AND LENGTH(oem_tire_sizes::text) > 2
    ORDER BY year DESC
    LIMIT 5
  `;
  
  console.log('=== TIRE SIZE COVERAGE ===');
  console.log('Total records:', total);
  console.log('With oem_tire_sizes:', with_tires, `(${Math.round(with_tires/total*100)}%)`);
  console.log('Without tire sizes:', total - with_tires);
  console.log('\n=== BY SOURCE ===');
  bySrc.forEach(r => console.log(`  ${(r.source || 'null').padEnd(30)} ${String(r.cnt).padStart(6)} records, ${String(r.with_tires).padStart(6)} with tires (${Math.round(r.with_tires/r.cnt*100)}%)`));
  console.log('\n=== MAKES WITHOUT TIRE SIZES ===');
  noTiresMakes.forEach(r => console.log(`  ${r.make}: ${r.cnt} records`));
  console.log('\n=== SAMPLE RECORDS WITH TIRE SIZES ===');
  sampleWithTires.forEach(r => console.log(`  ${r.year} ${r.make} ${r.model} ${r.display_trim}: ${JSON.stringify(r.oem_tire_sizes)}`));
  
  await client.end();
}

check().catch(e => { console.error(e); process.exit(1); });
