import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Resume from this row (1-indexed, after header)
const START_ROW = parseInt(process.argv[2]) || 8600;

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

// Generate WheelPros image URL from SKU
function generateImageUrl(sku, brandCode) {
  if (!sku) return null;
  // WheelPros CDN pattern: https://wpassets.wheelpros.com/accessories/{SKU}.png
  return `https://wpassets.wheelpros.com/accessories/${sku}.png`;
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
  
  console.log('CSV headers:', header.join(', '));
  console.log('Total rows in CSV:', lines.length - 1);
  console.log('Starting from row:', START_ROW);
  
  let inserted = 0;
  let updated = 0;
  let errors = 0;
  
  // Start from specified row
  const startIdx = START_ROW;
  
  for (let batch = Math.floor((startIdx - 1) / BATCH_SIZE); batch * BATCH_SIZE < lines.length - 1; batch++) {
    const start = Math.max(batch * BATCH_SIZE + 1, startIdx);
    const end = Math.min((batch + 1) * BATCH_SIZE + 1, lines.length);
    
    if (start >= lines.length) break;
    
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
        
        // Use existing image_url or generate one
        const imageUrl = row.image_url || generateImageUrl(sku, row.brand_code_3);
        
        try {
          const result = await client.query(`
            INSERT INTO accessories (sku, title, brand, brand_code, category, sub_type, msrp, map_price, sell_price, cost, image_url, image_url_2, image_url_3, upc)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (sku) DO UPDATE SET 
              title = EXCLUDED.title,
              brand = EXCLUDED.brand,
              category = EXCLUDED.category,
              msrp = EXCLUDED.msrp,
              map_price = EXCLUDED.map_price,
              sell_price = EXCLUDED.sell_price,
              image_url = COALESCE(NULLIF(EXCLUDED.image_url, ''), accessories.image_url),
              image_url_2 = COALESCE(NULLIF(EXCLUDED.image_url_2, ''), accessories.image_url_2),
              image_url_3 = COALESCE(NULLIF(EXCLUDED.image_url_3, ''), accessories.image_url_3),
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
            imageUrl,
            row.image_url2 || row.image_url1 || null,
            row.image_url3 || null,
            row.upc
          ]);
          
          if (result.rows[0]?.is_insert) inserted++;
          else updated++;
        } catch (e) {
          errors++;
          if (errors < 10) console.error('Row error:', sku, e.message);
        }
      }
      
      await client.query('COMMIT');
      
      const pct = Math.round((end / (lines.length - 1)) * 100);
      console.log(`Row ${start}-${end - 1} (${pct}%) | +${inserted} inserted, ~${updated} updated, !${errors} errors`);
      
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Batch error:', e.message);
    } finally {
      client.release();
    }
  }
  
  console.log('\n=== ACCESSORY IMPORT COMPLETE ===');
  console.log('Inserted:', inserted);
  console.log('Updated:', updated);
  console.log('Errors:', errors);
  
  // Verify
  const check = await pool.query('SELECT COUNT(*) as total, COUNT(image_url) as with_images FROM accessories');
  console.log('\nTotal in DB:', check.rows[0].total);
  console.log('With images:', check.rows[0].with_images);
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
