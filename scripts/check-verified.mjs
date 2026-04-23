import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

const verified = await client.query("SELECT COUNT(*) as total FROM vehicle_fitments WHERE source = 'verified-research'");
console.log('Verified-research records:', verified.rows[0].total);

const sources = await client.query(`
  SELECT 
    CASE 
      WHEN source LIKE '%verified%' THEN 'verified-research'
      WHEN source LIKE '%web_research%' OR source LIKE '%gap-fill%' THEN 'web_research (unverified)'
      WHEN source LIKE '%classics%' THEN 'classics-research'
      WHEN source LIKE '%muscle%' THEN 'muscle-research'
      WHEN source LIKE '%80s%' THEN '80s-research'
      WHEN source LIKE '%90s%' THEN '90s-research'
      WHEN source LIKE '%generation%' THEN 'generation_import'
      ELSE 'other'
    END as source_type,
    COUNT(*) as count
  FROM vehicle_fitments
  GROUP BY source_type
  ORDER BY count DESC
`);

console.log('\nSource breakdown:');
sources.rows.forEach(r => console.log('  ' + r.source_type + ': ' + r.count));

const total = await client.query("SELECT COUNT(*) as c FROM vehicle_fitments");
console.log('\nTotal records:', total.rows[0].c);

await client.end();
