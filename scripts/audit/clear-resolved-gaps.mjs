/**
 * Clear unresolved gaps for vehicles that now have fitment data
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function clearResolved() {
  const client = await pool.connect();
  
  console.log('='.repeat(80));
  console.log('CLEARING RESOLVED FITMENT GAPS');
  console.log('='.repeat(80));
  
  try {
    // Find all unresolved searches where we now have fitment data
    const result = await client.query(`
      DELETE FROM unresolved_fitment_searches u
      WHERE EXISTS (
        SELECT 1 FROM vehicle_fitments v
        WHERE v.year = u.year
          AND LOWER(v.make) = u.make
          AND LOWER(v.model) LIKE '%' || u.model || '%'
          AND v.oem_tire_sizes IS NOT NULL
          AND jsonb_array_length(v.oem_tire_sizes) > 0
      )
      RETURNING u.year, u.make, u.model, u.search_type, u.occurrence_count
    `);
    
    console.log(`\nDeleted ${result.rowCount} resolved gap entries:\n`);
    
    // Group by vehicle for cleaner output
    const byVehicle = {};
    for (const row of result.rows) {
      const key = `${row.year} ${row.make} ${row.model}`;
      if (!byVehicle[key]) byVehicle[key] = { searches: 0, types: [] };
      byVehicle[key].searches += row.occurrence_count;
      byVehicle[key].types.push(row.search_type);
    }
    
    const sortedVehicles = Object.entries(byVehicle).sort((a, b) => b[1].searches - a[1].searches);
    for (const [vehicle, data] of sortedVehicles.slice(0, 30)) {
      console.log(`  ${vehicle}: ${data.searches} searches (${data.types.join(', ')})`);
    }
    
    if (sortedVehicles.length > 30) {
      console.log(`  ... and ${sortedVehicles.length - 30} more`);
    }
    
    // Show remaining gaps
    const remaining = await client.query(`
      SELECT COUNT(*) as count, SUM(occurrence_count) as searches
      FROM unresolved_fitment_searches
    `);
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Remaining unresolved: ${remaining.rows[0].count} vehicles, ${remaining.rows[0].searches} total searches`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

clearResolved().catch(console.error);
