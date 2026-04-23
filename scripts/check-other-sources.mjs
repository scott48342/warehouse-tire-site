import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

// Get breakdown of "other" sources
const sources = await client.query(`
  SELECT source, COUNT(*) as count
  FROM vehicle_fitments 
  WHERE source NOT LIKE '%web_research%' 
    AND source NOT LIKE '%gap-fill%'
    AND source NOT LIKE '%generation%'
    AND source NOT LIKE '%manual%'
    AND source NOT LIKE '%dealer%'
    AND source NOT LIKE '%classics%'
    AND source NOT LIKE '%muscle%'
    AND source NOT LIKE '%80s%'
    AND source NOT LIKE '%90s%'
  GROUP BY source
  ORDER BY count DESC
`);

console.log("=== 'OTHER' SOURCE BREAKDOWN ===\n");
console.log("Total 'other' sources:", sources.rows.reduce((a, r) => a + parseInt(r.count), 0));
console.log("\nBy source:");
sources.rows.forEach(r => {
  console.log("  " + r.source + ": " + r.count);
});

// Sample some of each major source
console.log("\n=== SAMPLES ===");
for (const row of sources.rows.slice(0, 5)) {
  const samples = await client.query(`
    SELECT year, make, model, bolt_pattern, oem_tire_sizes
    FROM vehicle_fitments 
    WHERE source = $1
    LIMIT 5
  `, [row.source]);
  
  console.log("\n" + row.source + " (" + row.count + " records):");
  samples.rows.forEach(r => {
    console.log("  " + r.year + " " + r.make + " " + r.model + " - " + r.bolt_pattern + " - " + r.oem_tire_sizes);
  });
}

await client.end();
