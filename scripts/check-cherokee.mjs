import { config } from 'dotenv';
config({ path: '.env.local' });

const { sql } = await import('@vercel/postgres');

const result = await sql`
  SELECT modification_id, display_trim, thread_size, oem_tire_sizes, oem_wheel_sizes
  FROM vehicle_fitments 
  WHERE year = 2023 AND LOWER(make) = 'jeep' AND LOWER(model) = 'cherokee'
  ORDER BY modification_id
`;

console.log(JSON.stringify(result.rows, null, 2));
