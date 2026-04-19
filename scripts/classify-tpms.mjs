/**
 * Classify TPMS products into subcategories:
 * - tpms_sensor: Sensors and valves
 * - tpms_kit: Service kits, bundles, assortments
 * - tpms_tool: Tools, scanners, programmers
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

function classifyTpms(title) {
  const t = title.toUpperCase();
  
  // Tools first (most specific)
  if (t.includes('TOOL') || t.includes('SCAN') || t.includes('PROGRAMMER') || 
      t.includes('TORQUE') || t.includes('PRINTER') || t.includes('GAUGE') ||
      t.includes('DISPLAY')) {
    return 'tpms_tool';
  }
  
  // Kits (bundles, service packs, assortments)
  if (t.includes(' KIT') || t.includes('SERVICE') || t.includes('SRV PK') || 
      t.includes('PACK') || t.includes('ASSORTMENT') || t.includes('BUNDLE') ||
      t.includes('RETROFIT')) {
    return 'tpms_kit';
  }
  
  // Sensors/Valves (default for most TPMS products)
  if (t.includes('VALVE') || t.includes('SENSOR') || t.includes('SNAP-IN') || 
      t.includes('CLAMP-IN') || t.includes('CORE') || t.includes('STEM') ||
      t.includes('CRADLE') || t.includes('BAND') || t.includes('MOUNTING')) {
    return 'tpms_sensor';
  }
  
  // Default to sensor (most TPMS products are sensor-related)
  return 'tpms_sensor';
}

async function run() {
  console.log('=== Classifying TPMS products ===\n');
  
  const result = await pool.query(`
    SELECT sku, title FROM accessories WHERE category = 'tpms'
  `);
  
  const counts = { tpms_sensor: 0, tpms_kit: 0, tpms_tool: 0 };
  
  for (const row of result.rows) {
    const newSubType = classifyTpms(row.title);
    counts[newSubType]++;
    
    await pool.query(
      'UPDATE accessories SET sub_type = $1, updated_at = NOW() WHERE sku = $2',
      [newSubType, row.sku]
    );
  }
  
  console.log('Classification complete:');
  console.log(`  Sensors/Valves: ${counts.tpms_sensor}`);
  console.log(`  Kits: ${counts.tpms_kit}`);
  console.log(`  Tools: ${counts.tpms_tool}`);
  
  // Verify
  const verify = await pool.query(`
    SELECT sub_type, COUNT(*) as count 
    FROM accessories 
    WHERE category = 'tpms'
    GROUP BY sub_type
    ORDER BY count DESC
  `);
  console.log('\nVerification:');
  console.table(verify.rows);
  
  await pool.end();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
