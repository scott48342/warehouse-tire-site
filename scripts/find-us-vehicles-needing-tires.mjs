import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// Common US vehicle models that tiresize.com will have
const usModels = [
  'f-150', 'f-250', 'f-350', 'mustang', 'explorer', 'escape', 'bronco', 'ranger', 'edge', 'expedition',
  'silverado', 'colorado', 'tahoe', 'suburban', 'camaro', 'corvette', 'equinox', 'traverse', 'malibu',
  'ram-1500', 'ram-2500', 'ram-3500', 'challenger', 'charger', 'durango', 'grand-cherokee', 'wrangler',
  'camry', 'corolla', 'rav4', 'highlander', 'tacoma', 'tundra', '4runner', 'prius',
  'accord', 'civic', 'cr-v', 'pilot', 'odyssey', 'ridgeline', 'hr-v',
  'altima', 'maxima', 'sentra', 'rogue', 'pathfinder', 'murano', 'frontier', 'titan',
  'outback', 'forester', 'crosstrek', 'impreza', 'wrx', 'legacy',
  'cx-5', 'cx-9', 'mazda3', 'mazda6', 'mx-5-miata',
  'elantra', 'sonata', 'tucson', 'santa-fe', 'palisade',
  'optima', 'sorento', 'sportage', 'telluride', 'forte'
];

const modelPattern = usModels.join('|');

const result = await pool.query(`
  SELECT DISTINCT year, make, model,
    (SELECT COUNT(*) FROM vehicle_fitments vf2 
     WHERE vf2.year = vf.year AND vf2.make = vf.make AND vf2.model = vf.model) as trim_count
  FROM vehicle_fitments vf
  WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
    AND year BETWEEN 2010 AND 2024
    AND (
      LOWER(model) ~ '(${modelPattern})'
      OR LOWER(model) IN (${usModels.map(m => `'${m}'`).join(',')})
    )
  ORDER BY trim_count DESC, year DESC
  LIMIT 30
`);

console.log('US vehicles needing tire sizes (priority order):');
result.rows.forEach((r, i) => {
  console.log(`${String(i+1).padStart(2)}. ${r.year} ${r.make} ${r.model} (${r.trim_count} trims)`);
});

// Also check what percent of catalog is missing
const stats = await pool.query(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]' THEN 1 ELSE 0 END) as missing_tires,
    SUM(CASE WHEN oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]' THEN 1 ELSE 0 END) as missing_wheels
  FROM vehicle_fitments
  WHERE year >= 2010
`);
const s = stats.rows[0];
console.log(`\nOverall (2010+): ${s.missing_tires}/${s.total} missing tires (${(s.missing_tires/s.total*100).toFixed(1)}%)`);
console.log(`                ${s.missing_wheels}/${s.total} missing wheels (${(s.missing_wheels/s.total*100).toFixed(1)}%)`);

pool.end();
