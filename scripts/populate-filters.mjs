/**
 * Populate Filter Columns from Product Titles
 * 
 * Parses existing accessory titles to extract filter attributes
 * like thread size, material, style, etc.
 */

import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;

// Parsing functions
function parseThreadSize(title) {
  const t = title.toUpperCase();
  // Metric: M12x1.50, M14x1.25, etc.
  const metric = t.match(/M?(\d{2})[X-](\d\.\d+)/);
  if (metric) return `M${metric[1]}x${metric[2]}`;
  // SAE: 1/2-20, 7/16-20, 14-1.5
  const sae = t.match(/(\d+\/\d+)[- ]?(\d+)/);
  if (sae) return `${sae[1]}-${sae[2]}`;
  // Simple: 12-1.25, 14-1.50
  const simple = t.match(/(\d{2})-(\d\.\d+)/);
  if (simple) return `M${simple[1]}x${simple[2]}`;
  return null;
}

function parseMaterial(title) {
  const t = title.toUpperCase();
  if (t.includes('BLACK CHROME') || t.includes('BLK CHR')) return 'Black Chrome';
  if (t.includes('CHROME') || t.includes(' CHR') || t.match(/\bCHR\b/)) return 'Chrome';
  if (t.includes('ZINC')) return 'Zinc';
  if (t.includes('STAINLESS') || t.includes(' SS ')) return 'Stainless Steel';
  if (t.includes('GUNMETAL')) return 'Gunmetal';
  if (t.includes('BLACK') || t.includes(' BLK') || t.match(/\bBLK\b/)) return 'Black';
  if (t.includes(' RED ')) return 'Red';
  if (t.includes(' BLUE ')) return 'Blue';
  return null;
}

function parseClosedEnd(title) {
  const t = title.toUpperCase();
  if (t.includes('CLOSED') || t.includes('CL END')) return true;
  if (t.includes('OPEN END') || t.includes('OPEN-END')) return false;
  return null;
}

function parseIsBolt(title) {
  const t = title.toUpperCase();
  if (t.includes(' BOLT') || t.includes('BOLTS') || t.match(/\bBOLT\b/)) return true;
  if (t.includes(' NUT') || t.includes('NUTS') || t.match(/\bNUT\b/)) return false;
  return null;
}

function parseLugStyle(title) {
  const t = title.toUpperCase();
  if (t.includes('SPLINE') || t.includes('SPL')) return 'Spline';
  if (t.includes('TUNER')) return 'Tuner';
  if (t.includes('BULGE')) return 'Bulge';
  if (t.includes('ACORN')) return 'Acorn';
  if (t.includes(' ET ')) return 'ET';
  if (t.includes('SHANK') || t.includes('MAG')) return 'Mag Shank';
  if (t.includes('6 POINT') || t.includes('6-POINT') || t.includes('6PT')) return '6-Point';
  if (t.includes('HEX')) return 'Hex';
  return null;
}

function parsePackageType(title) {
  const t = title.toUpperCase();
  if (t.includes(' KIT') || t.includes(' SET')) return 'Kit';
  if (t.includes('BULK')) return 'Bulk';
  if (t.includes('CARDED')) return 'Carded';
  if (t.includes('BAG')) return 'Bag';
  if (t.includes(' PKG') || t.includes(' PACK') || t.match(/\d+PK/)) return 'Pack';
  return null;
}

function parsePieceCount(title) {
  const t = title.toUpperCase();
  // Match: 20 PC, 24PC, (4PK), 6PK, 4LUG, 5LUG, 6LUG
  const lugMatch = t.match(/(\d)LUG/);
  if (lugMatch) return parseInt(lugMatch[1]) * 4; // 4 per lug typically
  const pcMatch = t.match(/(\d+)\s*(?:PC|PK|PIECE|PACK|CT)/);
  if (pcMatch) return parseInt(pcMatch[1]);
  const setMatch = t.match(/SET\s*(?:OF\s*)?(\d+)/);
  if (setMatch) return parseInt(setMatch[1]);
  return null;
}

function parseHexSize(title) {
  const t = title.toUpperCase();
  // Metric: 17MM, 19MM, 21MM
  const mm = t.match(/(\d{2})\s*MM/);
  if (mm) return `${mm[1]}mm`;
  // SAE: 3/4", 13/16"
  const sae = t.match(/(\d+\/\d+)["″]/);
  if (sae) return `${sae[1]}"`;
  return null;
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Get all lug nuts to parse
    const result = await pool.query(`
      SELECT sku, title FROM accessories 
      WHERE category = 'lug_nut'
    `);
    
    console.log(`Processing ${result.rows.length} lug nuts...`);
    
    let updated = 0;
    for (const row of result.rows) {
      const threadSize = parseThreadSize(row.title);
      const material = parseMaterial(row.title);
      const closedEnd = parseClosedEnd(row.title);
      const isBolt = parseIsBolt(row.title);
      const style = parseLugStyle(row.title);
      const packageType = parsePackageType(row.title);
      const pieceCount = parsePieceCount(row.title);
      const hexSize = parseHexSize(row.title);
      
      // Only update if we found something
      if (threadSize || material || closedEnd !== null || isBolt !== null || 
          style || packageType || pieceCount || hexSize) {
        await pool.query(`
          UPDATE accessories SET
            thread_size = COALESCE($1, thread_size),
            material = COALESCE($2, material),
            closed_end = COALESCE($3, closed_end),
            is_bolt = COALESCE($4, is_bolt),
            style = COALESCE($5, style),
            package_type = COALESCE($6, package_type),
            piece_count = COALESCE($7, piece_count),
            hex_size = COALESCE($8, hex_size),
            updated_at = NOW()
          WHERE sku = $9
        `, [threadSize, material, closedEnd, isBolt, style, packageType, pieceCount, hexSize, row.sku]);
        updated++;
      }
    }
    
    console.log(`Updated ${updated} lug nuts with filter attributes`);
    
    // Show stats
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE thread_size IS NOT NULL) as has_thread_size,
        COUNT(*) FILTER (WHERE material IS NOT NULL) as has_material,
        COUNT(*) FILTER (WHERE style IS NOT NULL) as has_style,
        COUNT(*) FILTER (WHERE closed_end IS NOT NULL) as has_closed_end,
        COUNT(*) FILTER (WHERE is_bolt IS NOT NULL) as has_is_bolt,
        COUNT(*) FILTER (WHERE hex_size IS NOT NULL) as has_hex_size,
        COUNT(*) FILTER (WHERE package_type IS NOT NULL) as has_package_type
      FROM accessories 
      WHERE category = 'lug_nut'
    `);
    
    console.log('\nLug nut filter coverage:');
    console.table(stats.rows[0]);
    
    // Show distinct values
    const threadSizes = await pool.query(`
      SELECT DISTINCT thread_size, COUNT(*) as cnt 
      FROM accessories WHERE thread_size IS NOT NULL 
      GROUP BY thread_size ORDER BY cnt DESC LIMIT 15
    `);
    console.log('\nTop thread sizes:');
    console.table(threadSizes.rows);
    
    const materials = await pool.query(`
      SELECT DISTINCT material, COUNT(*) as cnt 
      FROM accessories WHERE material IS NOT NULL 
      GROUP BY material ORDER BY cnt DESC
    `);
    console.log('\nMaterials:');
    console.table(materials.rows);
    
    const styles = await pool.query(`
      SELECT DISTINCT style, COUNT(*) as cnt 
      FROM accessories WHERE style IS NOT NULL 
      GROUP BY style ORDER BY cnt DESC
    `);
    console.log('\nStyles:');
    console.table(styles.rows);
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
