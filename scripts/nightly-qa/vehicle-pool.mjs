/**
 * Vehicle Pool - Selects vehicles for QA testing
 * 
 * Selection strategy:
 * 1. Always include canary vehicles (high-traffic, known edge cases)
 * 2. Include recent failures from previous runs
 * 3. Fill remaining slots with random selection by category
 */

import pg from 'pg';
import { config } from './config.mjs';

const { Pool } = pg;

// Fallback vehicle pools when DB isn't available
const FALLBACK_VEHICLES = {
  'half-ton': [
    { year: 2024, make: 'Ford', model: 'F-150', trim: 'XLT', expectedBolt: '6x135' },
    { year: 2024, make: 'Ford', model: 'F-150', trim: 'Lariat', expectedBolt: '6x135' },
    { year: 2023, make: 'Ford', model: 'F-150', trim: 'Raptor', expectedBolt: '6x135', isPerformance: true },
    { year: 2024, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LT', expectedBolt: '6x139.7' },
    { year: 2024, make: 'Chevrolet', model: 'Silverado 1500', trim: 'High Country', expectedBolt: '6x139.7' },
    { year: 2023, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LT Trail Boss', expectedBolt: '6x139.7' },
    { year: 2024, make: 'GMC', model: 'Sierra 1500', trim: 'SLT', expectedBolt: '6x139.7' },
    { year: 2024, make: 'GMC', model: 'Sierra 1500', trim: 'AT4', expectedBolt: '6x139.7' },
    { year: 2024, make: 'Ram', model: '1500', trim: 'Big Horn', expectedBolt: '6x139.7' },
    { year: 2024, make: 'Ram', model: '1500', trim: 'Laramie', expectedBolt: '6x139.7' },
    { year: 2023, make: 'Ram', model: '1500', trim: 'Rebel', expectedBolt: '6x139.7' },
    { year: 2024, make: 'Toyota', model: 'Tundra', trim: 'SR5', expectedBolt: '6x139.7' },
    { year: 2023, make: 'Toyota', model: 'Tundra', trim: 'TRD Pro', expectedBolt: '6x139.7', isPerformance: true },
    { year: 2022, make: 'Nissan', model: 'Titan', trim: 'Pro-4X', expectedBolt: '6x139.7' },
    { year: 2020, make: 'Ford', model: 'F-150', trim: 'XL', expectedBolt: '6x135' },
    { year: 2019, make: 'Chevrolet', model: 'Silverado 1500', trim: 'WT', expectedBolt: '6x139.7' },
    { year: 2018, make: 'Ram', model: '1500', trim: 'Express', expectedBolt: '6x139.7' },
  ],
  'hd': [
    { year: 2024, make: 'Ford', model: 'F-250', trim: 'XLT', expectedBolt: '8x170' },
    { year: 2024, make: 'Ford', model: 'F-250', trim: 'Lariat', expectedBolt: '8x170' },
    { year: 2023, make: 'Ford', model: 'F-350', trim: 'King Ranch', expectedBolt: '8x170' },
    { year: 2024, make: 'Chevrolet', model: 'Silverado 2500 HD', trim: 'LT', expectedBolt: '8x180' },
    { year: 2024, make: 'Chevrolet', model: 'Silverado 2500 HD', trim: 'High Country', expectedBolt: '8x180' },
    { year: 2023, make: 'Chevrolet', model: 'Silverado 3500 HD', trim: 'LTZ', expectedBolt: '8x180' },
    { year: 2024, make: 'GMC', model: 'Sierra 2500 HD', trim: 'SLT', expectedBolt: '8x180' },
    { year: 2023, make: 'GMC', model: 'Sierra 3500 HD', trim: 'Denali', expectedBolt: '8x180' },
    { year: 2024, make: 'Ram', model: '2500', trim: 'Big Horn', expectedBolt: '8x165.1' },
    { year: 2023, make: 'Ram', model: '2500', trim: 'Laramie', expectedBolt: '8x165.1' },
    { year: 2022, make: 'Ram', model: '3500', trim: 'Limited', expectedBolt: '8x165.1' },
    { year: 2015, make: 'Ford', model: 'F-250', trim: 'XLT', expectedBolt: '8x170' },
    { year: 2012, make: 'Chevrolet', model: 'Silverado 2500 HD', trim: 'LT', expectedBolt: '8x180' },
  ],
  'midsize': [
    { year: 2024, make: 'Toyota', model: 'Tacoma', trim: 'TRD Sport', expectedBolt: '6x139.7' },
    { year: 2024, make: 'Toyota', model: 'Tacoma', trim: 'TRD Off-Road', expectedBolt: '6x139.7' },
    { year: 2023, make: 'Toyota', model: 'Tacoma', trim: 'TRD Pro', expectedBolt: '6x139.7', isPerformance: true },
    { year: 2024, make: 'Chevrolet', model: 'Colorado', trim: 'LT', expectedBolt: '6x120' },
    { year: 2023, make: 'Chevrolet', model: 'Colorado', trim: 'ZR2', expectedBolt: '6x120', isPerformance: true },
    { year: 2024, make: 'GMC', model: 'Canyon', trim: 'AT4', expectedBolt: '6x120' },
    { year: 2024, make: 'Ford', model: 'Ranger', trim: 'XLT', expectedBolt: '6x139.7' },
    { year: 2024, make: 'Nissan', model: 'Frontier', trim: 'SV', expectedBolt: '6x114.3' },
    { year: 2024, make: 'Jeep', model: 'Gladiator', trim: 'Sport', expectedBolt: '5x127' },
    { year: 2023, make: 'Jeep', model: 'Gladiator', trim: 'Rubicon', expectedBolt: '5x127', isPerformance: true },
    { year: 2024, make: 'Toyota', model: '4Runner', trim: 'SR5', expectedBolt: '6x139.7' },
    { year: 2023, make: 'Toyota', model: '4Runner', trim: 'TRD Pro', expectedBolt: '6x139.7', isPerformance: true },
  ],
  'jeep': [
    { year: 2024, make: 'Jeep', model: 'Wrangler', trim: 'Sport', expectedBolt: '5x127' },
    { year: 2024, make: 'Jeep', model: 'Wrangler', trim: 'Sahara', expectedBolt: '5x127' },
    { year: 2024, make: 'Jeep', model: 'Wrangler', trim: 'Rubicon', expectedBolt: '5x127', isPerformance: true },
    { year: 2023, make: 'Jeep', model: 'Wrangler', trim: 'Willys', expectedBolt: '5x127' },
    { year: 2024, make: 'Jeep', model: 'Wrangler', trim: 'Rubicon 392', expectedBolt: '5x127', isPerformance: true },
    { year: 2022, make: 'Jeep', model: 'Wrangler', trim: 'Sport S', expectedBolt: '5x127' },
    { year: 2020, make: 'Jeep', model: 'Wrangler', trim: 'Unlimited', expectedBolt: '5x127' },
    { year: 2018, make: 'Jeep', model: 'Wrangler JK', trim: 'Unlimited', expectedBolt: '5x127' },
    // Broncos - NOT Jeeps, different bolt pattern
    { year: 2024, make: 'Ford', model: 'Bronco', trim: 'Big Bend', expectedBolt: '6x139.7', notJeep: true },
    { year: 2024, make: 'Ford', model: 'Bronco', trim: 'Wildtrak', expectedBolt: '6x139.7', notJeep: true },
    { year: 2023, make: 'Ford', model: 'Bronco', trim: 'Badlands', expectedBolt: '6x139.7', notJeep: true },
    { year: 2022, make: 'Ford', model: 'Bronco', trim: 'Raptor', expectedBolt: '6x139.7', isPerformance: true, notJeep: true },
  ],
  'staggered': [
    // CRITICAL - These MUST detect as staggered (only verified staggered vehicles)
    // Mustang GT base is NOT staggered - only GT PP, Dark Horse, Shelby are
    { year: 2024, make: 'Ford', model: 'Mustang', trim: 'GT', expectedBolt: '5x114.3', isStaggered: false },
    { year: 2024, make: 'Ford', model: 'Mustang', trim: 'EcoBoost', expectedBolt: '5x114.3', isStaggered: false },
    { year: 2023, make: 'Ford', model: 'Mustang', trim: 'GT Performance Pack', expectedBolt: '5x114.3', isStaggered: true, criticalStaggered: true },
    { year: 2024, make: 'Ford', model: 'Mustang', trim: 'Dark Horse', expectedBolt: '5x114.3', isStaggered: true, criticalStaggered: true },
    // Camaro - only SS/ZL1/1LE are staggered
    { year: 2024, make: 'Chevrolet', model: 'Camaro', trim: 'LT', expectedBolt: '5x120', isStaggered: false },
    { year: 2024, make: 'Chevrolet', model: 'Camaro', trim: 'SS', expectedBolt: '5x120', isStaggered: true, criticalStaggered: true },
    { year: 2023, make: 'Chevrolet', model: 'Camaro', trim: 'ZL1', expectedBolt: '5x120', isStaggered: true, criticalStaggered: true },
    // Challenger - only Widebody variants are staggered (base Hellcat is NOT)
    { year: 2024, make: 'Dodge', model: 'Challenger', trim: 'SXT', expectedBolt: '5x115', isStaggered: false },
    { year: 2024, make: 'Dodge', model: 'Challenger', trim: 'R/T', expectedBolt: '5x115', isStaggered: false },
    { year: 2023, make: 'Dodge', model: 'Challenger', trim: 'SRT Hellcat', expectedBolt: '5x115', isStaggered: false },
    { year: 2023, make: 'Dodge', model: 'Challenger', trim: 'SRT Hellcat Widebody', expectedBolt: '5x115', isStaggered: true, criticalStaggered: true },
    // Corvette - always staggered
    { year: 2023, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray', expectedBolt: '5x120', isStaggered: true, criticalStaggered: true },
    // European performance (these may or may not have data)
    { year: 2024, make: 'BMW', model: 'M3', trim: 'Competition', expectedBolt: '5x112', isStaggered: true },
    { year: 2024, make: 'BMW', model: 'M4', trim: 'Competition', expectedBolt: '5x112', isStaggered: true },
    { year: 2024, make: 'Audi', model: 'RS5', trim: 'Sportback', expectedBolt: '5x112', isStaggered: true },
  ],
  'car': [
    { year: 2024, make: 'Toyota', model: 'Camry', trim: 'SE', expectedBolt: '5x114.3' },
    { year: 2024, make: 'Toyota', model: 'Camry', trim: 'XLE', expectedBolt: '5x114.3' },
    { year: 2024, make: 'Honda', model: 'Accord', trim: 'Sport', expectedBolt: '5x114.3' },
    { year: 2024, make: 'Honda', model: 'Civic', trim: 'Touring', expectedBolt: '5x114.3' },
    { year: 2024, make: 'Nissan', model: 'Altima', trim: 'SV', expectedBolt: '5x114.3' },
    { year: 2024, make: 'Hyundai', model: 'Sonata', trim: 'SEL', expectedBolt: '5x114.3' },
    { year: 2024, make: 'Kia', model: 'K5', trim: 'GT-Line', expectedBolt: '5x114.3' },
    { year: 2024, make: 'Mazda', model: 'Mazda3', trim: 'Premium', expectedBolt: '5x114.3' },
    { year: 2024, make: 'Subaru', model: 'Outback', trim: 'Premium', expectedBolt: '5x114.3' },
    { year: 2024, make: 'Volkswagen', model: 'Jetta', trim: 'SE', expectedBolt: '5x112' },
    { year: 2024, make: 'Chevrolet', model: 'Malibu', trim: 'LT', expectedBolt: '5x115' },
    { year: 2024, make: 'Toyota', model: 'Corolla', trim: 'LE', expectedBolt: '5x114.3' },
    { year: 2024, make: 'Honda', model: 'CR-V', trim: 'EX', expectedBolt: '5x114.3' },
    { year: 2024, make: 'Toyota', model: 'RAV4', trim: 'XLE', expectedBolt: '5x114.3' },
  ],
  'suv': [
    { year: 2024, make: 'Chevrolet', model: 'Tahoe', trim: 'LT', expectedBolt: '6x139.7' },
    { year: 2024, make: 'Chevrolet', model: 'Suburban', trim: 'Premier', expectedBolt: '6x139.7' },
    { year: 2024, make: 'GMC', model: 'Yukon', trim: 'SLT', expectedBolt: '6x139.7' },
    { year: 2024, make: 'Ford', model: 'Expedition', trim: 'XLT', expectedBolt: '6x135' },
    { year: 2024, make: 'Ford', model: 'Expedition', trim: 'Limited', expectedBolt: '6x135' },
    { year: 2024, make: 'Toyota', model: 'Sequoia', trim: 'SR5', expectedBolt: '6x139.7' },
    { year: 2024, make: 'Cadillac', model: 'Escalade', trim: 'Premium Luxury', expectedBolt: '6x139.7' },
    { year: 2024, make: 'Lincoln', model: 'Navigator', trim: 'Reserve', expectedBolt: '6x135' },
    { year: 2024, make: 'Lexus', model: 'LX', trim: '600', expectedBolt: '5x150' },
    { year: 2024, make: 'Infiniti', model: 'QX80', trim: 'Luxe', expectedBolt: '6x139.7' },
  ],
  'ev': [
    { year: 2024, make: 'Ford', model: 'F-150 Lightning', trim: 'Lariat', expectedBolt: '6x135' },
    { year: 2024, make: 'Ford', model: 'F-150 Lightning', trim: 'XLT', expectedBolt: '6x135' },
    { year: 2024, make: 'Tesla', model: 'Model 3', trim: 'Long Range', expectedBolt: '5x114.3' },
    { year: 2024, make: 'Tesla', model: 'Model Y', trim: 'Long Range', expectedBolt: '5x114.3' },
    { year: 2024, make: 'Tesla', model: 'Model S', trim: 'Plaid', expectedBolt: '5x120', isStaggered: true },
    { year: 2024, make: 'Ford', model: 'Mustang Mach-E', trim: 'Premium', expectedBolt: '5x114.3' },
    { year: 2024, make: 'Chevrolet', model: 'Bolt EUV', trim: 'Premier', expectedBolt: '5x105' },
    { year: 2024, make: 'Hyundai', model: 'Ioniq 5', trim: 'Limited', expectedBolt: '5x114.3' },
    { year: 2024, make: 'Kia', model: 'EV6', trim: 'GT-Line', expectedBolt: '5x114.3' },
    { year: 2024, make: 'Rivian', model: 'R1T', trim: 'Adventure', expectedBolt: '6x135' },
    { year: 2024, make: 'BMW', model: 'iX', trim: 'xDrive50', expectedBolt: '5x112' },
    { year: 2024, make: 'Mercedes-Benz', model: 'EQS', trim: '450+', expectedBolt: '5x112' },
  ],
};

/**
 * Get canary vehicles from database
 */
async function getCanaryVehicles(pool) {
  try {
    const result = await pool.query(`
      SELECT 
        year, make, model, trim, category,
        expected_bolt_pattern as "expectedBolt",
        expected_staggered as "isStaggered",
        is_performance as "isPerformance",
        test_lifted as "testLifted",
        lift_heights as "liftHeights",
        priority
      FROM qa_canary_vehicles
      WHERE enabled = TRUE
      ORDER BY priority DESC
    `);
    return result.rows.map(r => ({
      ...r,
      isCanary: true,
      criticalStaggered: r.isStaggered === true,
    }));
  } catch (err) {
    console.warn('[vehicle-pool] Could not fetch canary vehicles:', err.message);
    return [];
  }
}

/**
 * Get recent failures from previous runs
 */
async function getRecentFailures(pool, limit = 20) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (year, make, model, trim)
        year, make, model, trim, category,
        bolt_pattern_expected as "expectedBolt",
        staggered_expected as "isStaggered"
      FROM qa_results
      WHERE status = 'fail'
        AND severity IN ('critical', 'high')
        AND created_at > NOW() - INTERVAL '7 days'
      ORDER BY year, make, model, trim, created_at DESC
      LIMIT $1
    `, [limit]);
    return result.rows.map(r => ({
      ...r,
      isRecentFailure: true,
    }));
  } catch (err) {
    console.warn('[vehicle-pool] Could not fetch recent failures:', err.message);
    return [];
  }
}

/**
 * Shuffle array in place
 */
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Select random vehicles from fallback pool
 */
function selectFromFallback(category, count) {
  const pool = FALLBACK_VEHICLES[category] || [];
  if (pool.length === 0) return [];
  
  const shuffled = shuffle([...pool]);
  return shuffled.slice(0, count).map(v => ({
    ...v,
    category,
  }));
}

/**
 * Build the vehicle test pool
 */
export async function buildVehiclePool(targetCount = config.targetVehicleCount) {
  const vehicles = [];
  const seen = new Set();
  
  const vehicleKey = (v) => `${v.year}|${v.make}|${v.model}|${v.trim || ''}`;
  
  const addVehicle = (v) => {
    const key = vehicleKey(v);
    if (!seen.has(key)) {
      seen.add(key);
      vehicles.push(v);
      return true;
    }
    return false;
  };
  
  let pool = null;
  
  if (config.databaseUrl) {
    try {
      pool = new Pool({
        connectionString: config.databaseUrl,
        max: 3,
        idleTimeoutMillis: 10000,
        ssl: { rejectUnauthorized: false },
      });
      
      // Add canary vehicles first (always tested)
      const canaries = await getCanaryVehicles(pool);
      for (const v of canaries) {
        addVehicle(v);
      }
      console.log(`[vehicle-pool] Added ${canaries.length} canary vehicles`);
      
      // Add recent failures
      const failures = await getRecentFailures(pool, 20);
      for (const v of failures) {
        addVehicle(v);
      }
      console.log(`[vehicle-pool] Added ${failures.length} recent failure vehicles`);
      
    } catch (err) {
      console.warn('[vehicle-pool] Database error, using fallback pool:', err.message);
    }
  }
  
  // Fill remaining with fallback pools
  const categories = Object.keys(config.categoryDistribution);
  const remaining = targetCount - vehicles.length;
  
  for (const category of categories) {
    const targetForCategory = Math.max(
      config.minPerCategory[category] || 5,
      Math.floor(remaining * (config.categoryDistribution[category] || 0.1))
    );
    
    const currentInCategory = vehicles.filter(v => v.category === category).length;
    const needed = Math.max(0, targetForCategory - currentInCategory);
    
    if (needed > 0) {
      const selected = selectFromFallback(category, needed);
      for (const v of selected) {
        addVehicle(v);
      }
    }
  }
  
  if (pool) {
    await pool.end();
  }
  
  // Shuffle the final pool (but keep canaries at the front)
  const canaryVehicles = vehicles.filter(v => v.isCanary);
  const otherVehicles = vehicles.filter(v => !v.isCanary);
  
  return [...canaryVehicles, ...shuffle(otherVehicles)].slice(0, targetCount);
}

export default { buildVehiclePool };
