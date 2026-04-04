import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function check() {
  const { rows: cols } = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'wp_tires' 
    ORDER BY ordinal_position
  `);
  console.log('=== WP_TIRES COLUMNS ===');
  cols.forEach(c => console.log('  ' + c.column_name + ': ' + c.data_type));
  
  const { rows: terrains } = await pool.query(`
    SELECT DISTINCT terrain, COUNT(*) as cnt 
    FROM wp_tires 
    WHERE terrain IS NOT NULL AND terrain != '' 
    GROUP BY terrain 
    ORDER BY cnt DESC 
    LIMIT 20
  `);
  console.log('\n=== TERRAIN VALUES ===');
  terrains.forEach(t => console.log('  ' + t.terrain + ': ' + t.cnt));
  
  const { rows: mileage } = await pool.query(`
    SELECT DISTINCT mileage_warranty, COUNT(*) as cnt 
    FROM wp_tires 
    WHERE mileage_warranty IS NOT NULL 
    GROUP BY mileage_warranty 
    ORDER BY cnt DESC 
    LIMIT 15
  `);
  console.log('\n=== MILEAGE WARRANTY VALUES ===');
  mileage.forEach(m => console.log('  ' + m.mileage_warranty + ': ' + m.cnt));
  
  const { rows: constructions } = await pool.query(`
    SELECT DISTINCT construction_type, COUNT(*) as cnt 
    FROM wp_tires 
    WHERE construction_type IS NOT NULL AND construction_type != '' 
    GROUP BY construction_type 
    ORDER BY cnt DESC 
    LIMIT 15
  `);
  console.log('\n=== CONSTRUCTION TYPE VALUES ===');
  constructions.forEach(c => console.log('  ' + c.construction_type + ': ' + c.cnt));
  
  // Load range might be embedded in tire_description or separate field
  const { rows: loadRangeSample } = await pool.query(`
    SELECT tire_description FROM wp_tires 
    WHERE tire_description LIKE '%/E %' OR tire_description LIKE '%/D %' OR tire_description LIKE '%/C %'
    LIMIT 10
  `);
  console.log('\n=== LOAD RANGE IN DESCRIPTION ===');
  loadRangeSample.forEach(l => console.log('  ' + l.tire_description));
  
  const { rows: speedRatings } = await pool.query(`
    SELECT DISTINCT speed_rating, COUNT(*) as cnt 
    FROM wp_tires 
    WHERE speed_rating IS NOT NULL AND speed_rating != '' 
    GROUP BY speed_rating 
    ORDER BY cnt DESC 
    LIMIT 20
  `);
  console.log('\n=== SPEED RATING VALUES ===');
  speedRatings.forEach(s => console.log('  ' + s.speed_rating + ': ' + s.cnt));
  
  const { rows: loadIndexes } = await pool.query(`
    SELECT DISTINCT load_index, COUNT(*) as cnt 
    FROM wp_tires 
    WHERE load_index IS NOT NULL AND load_index != '' 
    GROUP BY load_index 
    ORDER BY cnt DESC 
    LIMIT 20
  `);
  console.log('\n=== LOAD INDEX VALUES ===');
  loadIndexes.forEach(l => console.log('  ' + l.load_index + ': ' + l.cnt));
  
  // Check sample tires with terrain
  const { rows: sample } = await pool.query(`
    SELECT sku, brand_desc, tire_description, terrain, mileage_warranty, 
           construction_type, speed_rating, load_index
    FROM wp_tires 
    WHERE terrain IS NOT NULL AND terrain != ''
    LIMIT 5
  `);
  console.log('\n=== SAMPLE TIRES WITH TERRAIN ===');
  sample.forEach(s => console.log(JSON.stringify(s, null, 2)));
  
  const { rows: total } = await pool.query('SELECT COUNT(*) as total FROM wp_tires');
  const { rows: withTerrain } = await pool.query("SELECT COUNT(*) as cnt FROM wp_tires WHERE terrain IS NOT NULL AND terrain != ''");
  const { rows: withMileage } = await pool.query("SELECT COUNT(*) as cnt FROM wp_tires WHERE mileage_warranty IS NOT NULL AND mileage_warranty != '' AND mileage_warranty::integer > 0");
  const { rows: withLoadIndex } = await pool.query("SELECT COUNT(*) as cnt FROM wp_tires WHERE load_index IS NOT NULL AND load_index != ''");
  
  console.log('\n=== COVERAGE ===');
  console.log('Total tires: ' + total[0].total);
  console.log('With terrain: ' + withTerrain[0].cnt + ' (' + Math.round(withTerrain[0].cnt / total[0].total * 100) + '%)');
  console.log('With mileage: ' + withMileage[0].cnt + ' (' + Math.round(withMileage[0].cnt / total[0].total * 100) + '%)');
  console.log('With loadIndex: ' + withLoadIndex[0].cnt + ' (' + Math.round(withLoadIndex[0].cnt / total[0].total * 100) + '%)');
  
  await pool.end();
}

check().catch(console.error);
