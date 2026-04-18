import { config } from 'dotenv';
config({ path: '.env.local' });

const { sql } = await import('@vercel/postgres');

// Check exact make/model values stored
const result = await sql`
  SELECT modification_id, year, make, model, display_trim
  FROM vehicle_fitments 
  WHERE year = 2023 AND model ILIKE '%cherokee%'
`;

console.log('Stored records:');
console.log(JSON.stringify(result.rows, null, 2));

// Check what the trims API query would find
const result2 = await sql`
  SELECT modification_id, display_trim
  FROM vehicle_fitments 
  WHERE year = 2023 
    AND LOWER(make) = 'jeep'
    AND LOWER(model) = 'cherokee'
`;
console.log('\nWith LOWER() query:');
console.log(JSON.stringify(result2.rows, null, 2));
