import pg from 'pg';
import { readFileSync, writeFileSync } from 'fs';

const envContent = readFileSync('C:\\Users\\Scott-Pc\\backup clawd\\warehouse-tire-site\\.env.local', 'utf8');
const match = envContent.match(/POSTGRES_URL="([^"]+)"/);
const pool = new pg.Pool({ connectionString: match[1], ssl: { rejectUnauthorized: false } });

// Final coverage stats
const stats = await pool.query(`
  SELECT 
    make,
    COUNT(*) total,
    COUNT(offset_min_mm) has_offset,
    COUNT(*) - COUNT(offset_min_mm) still_null
  FROM vehicle_fitments
  WHERE LOWER(make) IN ('chevrolet','gmc','buick','cadillac','pontiac','oldsmobile','amc','saturn','international',
                        'alfa romeo','aston martin','daewoo','ferrari','fiat','isuzu','karma','lotus',
                        'lucid','mclaren','mitsubishi','rolls-royce','saab','smart','suzuki','volvo')
  GROUP BY make ORDER BY make
`);

const summary = {
  completedAt: new Date().toISOString(),
  agent: 'GM + Remaining Makes Offset Agent',
  rowsUpdatedThisRun: 1531,
  groupsUpdatedThisRun: 137,
  finalCoverage: stats.rows.map(r => ({
    make: r.make,
    total: Number(r.total),
    hasOffset: Number(r.has_offset),
    stillNull: Number(r.still_null),
    coveragePct: ((Number(r.has_offset) / Number(r.total)) * 100).toFixed(1)
  }))
};

writeFileSync('scripts/offset-research-gm.json', JSON.stringify(summary, null, 2));
console.log('Summary saved.');
console.log(`Total makes covered: ${summary.finalCoverage.length}`);
console.log(`All at 100%: ${summary.finalCoverage.every(r => r.stillNull === 0)}`);

await pool.end();
