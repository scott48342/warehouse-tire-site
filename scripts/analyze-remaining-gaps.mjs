import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// Find ACTUAL missing US vehicles (not future, not regional variants)
const result = await pool.query(`
  SELECT year, make, model, COUNT(*) as trims
  FROM vehicle_fitments
  WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
    AND year BETWEEN 2000 AND 2025
    AND model NOT LIKE '%l'
    AND model NOT LIKE '%-l'
    AND model NOT LIKE '%-pro'
    AND model NOT LIKE '%-plus'
    AND model NOT LIKE '%-xl'
    AND model NOT LIKE '%-x'
    AND model NOT LIKE '%sportback%'
  GROUP BY year, make, model
  ORDER BY year DESC, trims DESC
  LIMIT 40
`);

console.log('US vehicles (2000-2025) missing tire sizes (filtered):');
result.rows.forEach(r => console.log(`  ${r.year} ${r.make} ${r.model} (${r.trims} trims)`));

// Count by year range
const byYear = await pool.query(`
  SELECT 
    CASE 
      WHEN year >= 2020 THEN '2020-2025'
      WHEN year >= 2015 THEN '2015-2019'
      WHEN year >= 2010 THEN '2010-2014'
      ELSE '2000-2009'
    END as year_range,
    COUNT(*) as count
  FROM vehicle_fitments
  WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
    AND year BETWEEN 2000 AND 2025
  GROUP BY 1
  ORDER BY 1 DESC
`);
console.log('\nMissing by year range:');
byYear.rows.forEach(r => console.log(`  ${r.year_range}: ${r.count}`));

// Total missing
const total = await pool.query(`
  SELECT COUNT(*) as total,
    SUM(CASE WHEN oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]' THEN 1 ELSE 0 END) as missing_tires,
    SUM(CASE WHEN oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]' THEN 1 ELSE 0 END) as missing_wheels
  FROM vehicle_fitments
`);
const t = total.rows[0];
console.log(`\nOverall: ${t.missing_tires}/${t.total} missing tires (${(t.missing_tires/t.total*100).toFixed(1)}%)`);
console.log(`         ${t.missing_wheels}/${t.total} missing wheels (${(t.missing_wheels/t.total*100).toFixed(1)}%)`);

pool.end();
