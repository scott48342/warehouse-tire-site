const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function addVehicleC() {
  // Get scott's user ID
  const user = await pool.query("SELECT id FROM auth_users WHERE email = 'scott@warehousetire.net'");
  if (user.rows.length === 0) {
    console.log('User not found');
    return;
  }
  const userId = user.rows[0].id;
  console.log('User ID:', userId);
  
  // Check if already exists
  const existing = await pool.query("SELECT id, year, make, model FROM user_garage WHERE user_id = $1", [userId]);
  console.log('Existing vehicles:', existing.rows);
  
  // Add Vehicle C: 2020 Honda Civic (only if not exists)
  if (existing.rows.length === 0) {
    const vehicleCId = 'v_' + Date.now() + '_vehicleC';
    await pool.query(
      "INSERT INTO user_garage (id, user_id, year, make, model, trim, modification, added_at, last_active_at) VALUES ($1, $2, '2020', 'Honda', 'Civic', 'EX', 'honda-civic-2020-ex', NOW(), NOW())",
      [vehicleCId, userId]
    );
    console.log('Added Vehicle C:', vehicleCId);
  } else {
    console.log('User already has vehicles');
  }
  
  // Verify
  const vehicles = await pool.query("SELECT year, make, model FROM user_garage WHERE user_id = $1", [userId]);
  console.log('Final vehicles for user:', vehicles.rows);
  
  pool.end();
}

addVehicleC().catch(console.error);
