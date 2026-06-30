import pg from 'pg';
import { readFileSync } from 'fs';

const envContent = readFileSync('C:\\Users\\Scott-Pc\\backup clawd\\warehouse-tire-site\\.env.local', 'utf8');
const match = envContent.match(/POSTGRES_URL="([^"]+)"/);
const pool = new pg.Pool({ connectionString: match[1], ssl: { rejectUnauthorized: false } });

// Check remaining nulls for the makes we should have covered
const remaining = await pool.query(`
  SELECT make, model, COUNT(*) cnt 
  FROM vehicle_fitments 
  WHERE (offset_min_mm IS NULL OR offset_max_mm IS NULL)
    AND LOWER(make) IN ('alfa romeo','aston martin','daewoo','ferrari','fiat','isuzu','karma','lotus',
                        'lucid','mclaren','mitsubishi','rolls-royce','saab','smart','suzuki','volvo',
                        'chevrolet','gmc','buick','cadillac','pontiac','oldsmobile','amc','saturn','international')
  GROUP BY make, model ORDER BY make, model
`);

console.log('=== STILL NULL (need to fix) ===');
console.log(JSON.stringify(remaining.rows, null, 2));

// Overall stats for our makes
const stats = await pool.query(`
  SELECT 
    make,
    COUNT(*) total,
    COUNT(offset_min_mm) has_offset,
    COUNT(*) - COUNT(offset_min_mm) still_null
  FROM vehicle_fitments
  WHERE LOWER(make) IN ('chevrolet','gmc','buick','cadillac','pontiac','oldsmobile','amc','saturn','international',
                        'alfa romeo','aston martin','daewoo','ferrari','fiat','isuzu','karma','lotus',
                        'lucid','mclaren','mitsubishi','rolls-royce','saab','smart','suzuki','volvo',
                        'cadillac','chevrolet','gmc')
  GROUP BY make ORDER BY make
`);
console.log('\n=== COVERAGE BY MAKE ===');
for (const r of stats.rows) {
  const pct = ((r.has_offset / r.total) * 100).toFixed(1);
  console.log(`${r.make}: ${r.has_offset}/${r.total} (${pct}%) - still null: ${r.still_null}`);
}

await pool.end();
