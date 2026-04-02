require('dotenv').config({ path: '.env.local' });
const pg = require('pg');

const partNumbers = ['LXST2061765020', 'IHR0142', 'GTB538', 'TH0380', 'C167074004'];

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Check if any API part numbers are in our mappings
    const { rows: matches } = await pool.query(
      'SELECT part_number, image_url FROM km_image_mappings WHERE part_number = ANY($1)',
      [partNumbers]
    );
    console.log(`Matches for API part numbers: ${matches.length}`);
    matches.forEach(r => console.log(`  ${r.part_number}: ${r.image_url}`));

    // Show sample of what we have in DB
    const { rows: samples } = await pool.query(
      'SELECT part_number, LEFT(image_url, 80) as url_preview FROM km_image_mappings LIMIT 10'
    );
    console.log('\nSample DB part numbers:');
    samples.forEach(r => console.log(`  ${r.part_number}: ${r.url_preview}...`));

    // Show total count
    const { rows: count } = await pool.query('SELECT COUNT(*) as cnt FROM km_image_mappings');
    console.log(`\nTotal mappings in DB: ${count[0].cnt}`);

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
