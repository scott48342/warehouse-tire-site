import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();
console.log('Connected\n');

// Fix Astro (6x139.7 → 5x127)
const astro = await client.query(`
  UPDATE vehicle_fitments 
  SET bolt_pattern = '5x127', center_bore_mm = 78.1
  WHERE model = 'Astro' AND bolt_pattern = '6x139.7'
`);
console.log(`✓ Astro: ${astro.rowCount} rows fixed`);

// Fix S10 (6x139.7 → 5x120.65)
const s10 = await client.query(`
  UPDATE vehicle_fitments 
  SET bolt_pattern = '5x120.65', center_bore_mm = 70.3
  WHERE model = 'S10' AND bolt_pattern = '6x139.7'
`);
console.log(`✓ S10: ${s10.rowCount} rows fixed`);

// Fix S10 Blazer
const s10b = await client.query(`
  UPDATE vehicle_fitments 
  SET bolt_pattern = '5x120.65', center_bore_mm = 70.3
  WHERE model LIKE '%S10%Blazer%' AND bolt_pattern = '6x139.7'
`);
console.log(`✓ S10 Blazer: ${s10b.rowCount} rows fixed`);

// Fix Blazer (1995-2005 are S10-based)
const blazer = await client.query(`
  UPDATE vehicle_fitments 
  SET bolt_pattern = '5x120.65', center_bore_mm = 70.3
  WHERE model = 'Blazer' AND year >= 1995 AND bolt_pattern = '6x139.7'
`);
console.log(`✓ Blazer (S10-based): ${blazer.rowCount} rows fixed`);

// Fix Safari
const safari = await client.query(`
  UPDATE vehicle_fitments 
  SET bolt_pattern = '5x127', center_bore_mm = 78.1
  WHERE model = 'Safari' AND bolt_pattern = '6x139.7'
`);
console.log(`✓ Safari: ${safari.rowCount} rows fixed`);

// Fix Sonoma
const sonoma = await client.query(`
  UPDATE vehicle_fitments 
  SET bolt_pattern = '5x120.65', center_bore_mm = 70.3
  WHERE model = 'Sonoma' AND bolt_pattern = '6x139.7'
`);
console.log(`✓ Sonoma: ${sonoma.rowCount} rows fixed`);

// Fix Jimmy (1995+ are S10-based)
const jimmy = await client.query(`
  UPDATE vehicle_fitments 
  SET bolt_pattern = '5x120.65', center_bore_mm = 70.3
  WHERE model = 'Jimmy' AND year >= 1995 AND bolt_pattern = '6x139.7'
`);
console.log(`✓ Jimmy: ${jimmy.rowCount} rows fixed`);

// Fix S15
const s15 = await client.query(`
  UPDATE vehicle_fitments 
  SET bolt_pattern = '5x120.65', center_bore_mm = 70.3
  WHERE model = 'S15' AND bolt_pattern = '6x139.7'
`);
console.log(`✓ S15: ${s15.rowCount} rows fixed`);

const total = astro.rowCount + s10.rowCount + s10b.rowCount + blazer.rowCount + 
              safari.rowCount + sonoma.rowCount + jimmy.rowCount + s15.rowCount;

console.log(`\n========================================`);
console.log(`TOTAL: ${total} rows fixed`);
console.log(`========================================`);

await client.end();
