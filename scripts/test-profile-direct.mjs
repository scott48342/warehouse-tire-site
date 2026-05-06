import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';

// Simplified parseWheelSizes
function parseWheelSizeEntry(input) {
  if (!input || typeof input !== 'object') return null;
  const obj = input;
  const diameter = Number(obj.diameter || obj.rimDiameter || 0);
  const width = Number(obj.width || obj.rimWidth || 0);
  if (diameter >= 13 && diameter <= 30 && width >= 4 && width <= 14) {
    return {
      diameter, width,
      offset: obj.offset != null ? Number(obj.offset) : null,
      tireSize: typeof obj.tireSize === 'string' ? obj.tireSize : null,
      axle: (obj.axle === 'front' || obj.axle === 'rear') ? obj.axle 
          : (obj.position === 'front' || obj.position === 'rear') ? obj.position
          : 'both',
      isStock: obj.isStock !== false,
    };
  }
  return null;
}

function parseWheelSizes(input) {
  if (!Array.isArray(input)) return [];
  return input.map(parseWheelSizeEntry).filter(Boolean);
}

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Test the exact same query the profileService uses
const result = await pool.query(`
  SELECT *
  FROM vehicle_fitments
  WHERE year = 2023
    AND LOWER(make) = 'dodge'
    AND LOWER(model) = 'challenger'
    AND modification_id = 'srt-hellcat-widebody'
    AND certification_status = 'certified'
  LIMIT 1
`);

console.log('Query returned:', result.rows.length, 'rows');

if (result.rows.length > 0) {
  const row = result.rows[0];
  console.log('\n=== RAW DB ROW ===');
  console.log('modification_id:', row.modification_id);
  console.log('display_trim:', row.display_trim);
  console.log('oem_wheel_sizes type:', typeof row.oem_wheel_sizes);
  console.log('oem_wheel_sizes isArray:', Array.isArray(row.oem_wheel_sizes));
  console.log('oem_wheel_sizes length:', row.oem_wheel_sizes?.length);
  console.log('oem_wheel_sizes raw:', JSON.stringify(row.oem_wheel_sizes, null, 2));
  
  console.log('\n=== PARSED ===');
  const parsed = parseWheelSizes(row.oem_wheel_sizes);
  console.log('parsed length:', parsed.length);
  console.log('parsed:', JSON.stringify(parsed, null, 2));
  
  // Check for front/rear
  const front = parsed.find(w => w.axle === 'front');
  const rear = parsed.find(w => w.axle === 'rear');
  console.log('\n=== STAGGERED CHECK ===');
  console.log('Has front:', !!front, front?.width);
  console.log('Has rear:', !!rear, rear?.width);
  console.log('Is staggered:', front && rear && front.width !== rear.width);
}

await pool.end();
