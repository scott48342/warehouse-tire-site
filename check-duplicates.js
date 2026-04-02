/**
 * Check for potential false-positive additions due to format differences
 * e.g., "9Jx20" vs "9x20" or "8.5Jx18" vs "8.5x18"
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const prisma = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

  console.log('Checking for wheel size format variations...\n');

  // Get sample records with string-format wheel sizes
  const res = await prisma.query(`
    SELECT year, make, model, display_trim, oem_wheel_sizes
    FROM vehicle_fitments
    WHERE oem_wheel_sizes::text LIKE '%Jx%'
    LIMIT 10
  `);

  console.log('Records with "Jx" format wheel sizes:\n');
  for (const r of res.rows) {
    console.log(`${r.year} ${r.make} ${r.model} - ${r.display_trim}`);
    console.log(`  Wheels: ${JSON.stringify(r.oem_wheel_sizes)}\n`);
  }

  // Check the Tahoe example
  console.log('\n--- 2022 Chevrolet Tahoe Example ---');
  const tahoe = await prisma.query(`
    SELECT oem_wheel_sizes FROM vehicle_fitments
    WHERE year = 2022 AND make = 'chevrolet' AND model = 'tahoe'
    LIMIT 1
  `);
  if (tahoe.rows.length > 0) {
    console.log('Current wheel sizes:', JSON.stringify(tahoe.rows[0].oem_wheel_sizes, null, 2));
    
    // Parse each size
    console.log('\nParsed:');
    for (const ws of tahoe.rows[0].oem_wheel_sizes) {
      if (typeof ws === 'string') {
        const match = ws.match(/(\d+(?:\.\d+)?)[Jj]?[xX](\d+(?:\.\d+)?)/);
        if (match) {
          console.log(`  "${ws}" → width: ${match[1]}, diameter: ${match[2]}`);
        }
      } else {
        console.log(`  object: width=${ws.width}, diameter=${ws.diameter}`);
      }
    }
  }

  // Count how many records have string vs object format
  console.log('\n--- Format Distribution ---');
  const formatRes = await prisma.query(`
    SELECT 
      COUNT(*) FILTER (WHERE oem_wheel_sizes::text LIKE '%Jx%') as jx_format,
      COUNT(*) FILTER (WHERE oem_wheel_sizes::text LIKE '%"diameter"%') as object_format,
      COUNT(*) as total
    FROM vehicle_fitments
    WHERE jsonb_array_length(oem_wheel_sizes) > 0
  `);
  console.log(`String format (Jx): ${formatRes.rows[0].jx_format}`);
  console.log(`Object format: ${formatRes.rows[0].object_format}`);
  console.log(`Total with wheels: ${formatRes.rows[0].total}`);

  await prisma.end();
}

main().catch(console.error);
