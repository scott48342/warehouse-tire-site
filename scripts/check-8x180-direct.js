const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  // Check 8x180 wheels and their offsets
  const result = await client.query(`
    SELECT 
      CAST(offset AS int) as offset,
      width,
      CAST(COUNT(*) AS int) as count
    FROM techfeed_wheels
    WHERE bolt_pattern_metric = '8x180'
      AND offset IS NOT NULL
    GROUP BY offset, width
    ORDER BY CAST(offset AS int)
  `);
  
  console.log('8x180 (Chevy/GMC HD) wheel offset distribution:');
  let drwCount = 0;
  let srwCount = 0;
  
  for (const row of result.rows) {
    const isDrw = row.offset >= 65 || row.offset <= -65;
    const marker = isDrw ? ' [DRW]' : ' [SRW]';
    console.log(`  offset ${row.offset}mm, width ${row.width}" (${row.count} wheels)${marker}`);
    
    if (isDrw) drwCount += row.count;
    else srwCount += row.count;
  }
  
  console.log(`\nTotal 8x180 wheels: DRW-compatible=${drwCount}, SRW-only=${srwCount}`);
  
  // Also check if there are ANY 8x180 wheels with high positive or negative offsets
  const drwResult = await client.query(`
    SELECT sku, brand_cd, product_desc, diameter, width, offset
    FROM techfeed_wheels
    WHERE bolt_pattern_metric = '8x180'
      AND offset IS NOT NULL
      AND (CAST(offset AS int) >= 65 OR CAST(offset AS int) <= -65)
    LIMIT 20
  `);
  
  console.log('\nSample 8x180 DRW-compatible wheels:');
  for (const row of drwResult.rows) {
    console.log(`  ${row.brand_cd} ${row.product_desc} - ${row.diameter}x${row.width} ET${row.offset}`);
  }
  
  await client.end();
}

check().catch(console.error);
