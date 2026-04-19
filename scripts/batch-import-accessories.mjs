import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Category detection
function categorize(subType, title) {
  const t = (title || '').toUpperCase();
  const st = (subType || '').toUpperCase();
  
  if (st.includes('CAP') || t.includes('CAP')) return { category: 'center_cap', subType: 'center_cap' };
  if (st.includes('LUG') || t.includes('LUG')) return { category: 'lug_nut', subType: t.includes('LOCK') ? 'wheel_lock' : 'lug_nut' };
  if (st.includes('HUB') || t.includes('HUB RING') || t.includes('HUB CENTRIC')) return { category: 'hub_ring', subType: 'hub_ring' };
  if (t.includes('LED') || t.includes('LIGHT')) return { category: 'lighting', subType: 'lighting' };
  if (t.includes('TPMS')) return { category: 'tpms', subType: 'tpms' };
  if (t.includes('VALVE')) return { category: 'valve_stem', subType: 'valve_stem' };
  if (t.includes('SPACER')) return { category: 'spacer', subType: 'spacer' };
  
  return { category: 'other', subType: null };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else current += char;
  }
  result.push(current.trim());
  return result;
}

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

const BATCH_SIZE = 500;

async function main() {
  const content = fs.readFileSync('data/Accessory_TechGuide.csv', 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  const header = parseCSVLine(lines[0]);
  
  console.log('Total rows:', lines.length - 1);
  
  let inserted = 0;
  let updated = 0;
  let errors = 0;
  
  for (let batch = 0; batch * BATCH_SIZE < lines.length - 1; batch++) {
    const start = batch * BATCH_SIZE + 1;
    const end = Math.min(start + BATCH_SIZE, lines.length);
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (let i = start; i < end; i++) {
        const cols = parseCSVLine(lines[i]);
        const row = {};
        header.forEach((h, j) => row[h.toLowerCase()] = cols[j]);
        
        const sku = row.sku;
        if (!sku) continue;
        
        const title = row.product_desc || '';
        const { category, subType } = categorize(row.product_sub_type, title);
        const msrp = parseFloat(row.msrp) || null;
        const map = parseFloat(row.map_price) || null;
        const cost = msrp ? msrp * 0.75 : null;
        const sellPrice = cost ? Math.min(cost * 1.3, msrp || Infinity) : (map || msrp);
        
        try {
          const result = await client.query(`
            INSERT INTO accessories (sku, title, brand, brand_code, category, sub_type, msrp, map_price, sell_price, cost, image_url, upc)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (sku) DO UPDATE SET 
              title = EXCLUDED.title,
              brand = EXCLUDED.brand,
              category = EXCLUDED.category,
              msrp = EXCLUDED.msrp,
              map_price = EXCLUDED.map_price,
              sell_price = EXCLUDED.sell_price,
              image_url = EXCLUDED.image_url,
              updated_at = NOW()
            RETURNING (xmax = 0) AS is_insert
          `, [
            sku,
            title,
            row.brand_desc,
            row.brand_code_3,
            category,
            subType,
            msrp,
            map,
            sellPrice,
            cost,
            row.image_url,
            row.upc
          ]);
          
          if (result.rows[0]?.is_insert) inserted++;
          else updated++;
        } catch (e) {
          errors++;
          if (errors < 5) console.error('Row error:', sku, e.message);
        }
      }
      
      await client.query('COMMIT');
      
      const pct = Math.round((end / (lines.length - 1)) * 100);
      console.log(`Batch ${batch + 1}: ${start}-${end - 1} (${pct}%) | Inserted: ${inserted}, Updated: ${updated}, Errors: ${errors}`);
      
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Batch error:', e.message);
    } finally {
      client.release();
    }
  }
  
  console.log('\n=== COMPLETE ===');
  console.log('Inserted:', inserted);
  console.log('Updated:', updated);
  console.log('Errors:', errors);
  
  // Verify
  const check = await pool.query('SELECT COUNT(*) as total, COUNT(image_url) as with_images FROM accessories');
  console.log('Total in DB:', check.rows[0].total);
  console.log('With images:', check.rows[0].with_images);
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
