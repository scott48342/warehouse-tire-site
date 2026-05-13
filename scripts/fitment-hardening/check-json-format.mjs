/**
 * Check the actual format of JSON columns
 */

import postgres from "postgres";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env.local") });

const connectionString = process.env.POSTGRES_URL;
const client = postgres(connectionString, { max: 1 });

async function main() {
  // Check JSON column types
  const sample = await client`
    SELECT 
      id,
      oem_wheel_sizes,
      oem_tire_sizes,
      pg_typeof(oem_wheel_sizes::jsonb) as wheel_type,
      pg_typeof(oem_tire_sizes::jsonb) as tire_type
    FROM vehicle_fitments
    WHERE oem_wheel_sizes IS NOT NULL
    LIMIT 5
  `;
  
  console.log("Sample JSON data:\n");
  for (const row of sample) {
    console.log(`ID: ${row.id}`);
    console.log(`  Wheels: ${JSON.stringify(row.oem_wheel_sizes)}`);
    console.log(`  Tires: ${JSON.stringify(row.oem_tire_sizes)}`);
    console.log(`  Wheel Type: ${row.wheel_type}`);
    console.log(`  Tire Type: ${row.tire_type}\n`);
  }
  
  // Check for non-array values
  const nonArrays = await client`
    SELECT COUNT(*) as count
    FROM vehicle_fitments
    WHERE oem_wheel_sizes IS NOT NULL 
      AND jsonb_typeof(oem_wheel_sizes::jsonb) != 'array'
  `;
  console.log(`Non-array wheel sizes: ${nonArrays[0].count}`);
  
  const nullTires = await client`
    SELECT COUNT(*) as count
    FROM vehicle_fitments
    WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = 'null'
  `;
  console.log(`Null/empty tire sizes: ${nullTires[0].count}`);
  
  await client.end();
}

main().catch(console.error);
