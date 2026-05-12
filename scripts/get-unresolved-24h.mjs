import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Get unresolved wheel searches in last 24 hours
const r = await pool.query(`
  SELECT year, make, model, trim, occurrence_count, last_seen, search_type, source
  FROM unresolved_fitment_searches
  WHERE last_seen >= NOW() - INTERVAL '24 hours'
  AND search_type = 'wheel'
  ORDER BY occurrence_count DESC
`);

console.log('Unresolved WHEEL searches in last 24 hours:');
console.log('='.repeat(70));
r.rows.forEach(row => {
  const lastSeen = new Date(row.last_seen).toLocaleString('en-US', { timeZone: 'America/New_York' });
  console.log(`${row.year} ${row.make} ${row.model}${row.trim ? ' ' + row.trim : ''}`);
  console.log(`   Searches: ${row.occurrence_count} | Last: ${lastSeen} | Source: ${row.source}`);
});

console.log('\n' + '='.repeat(70));
console.log(`Total: ${r.rows.length} YMM combos, ${r.rows.reduce((sum, r) => sum + r.occurrence_count, 0)} total searches`);

await pool.end();
