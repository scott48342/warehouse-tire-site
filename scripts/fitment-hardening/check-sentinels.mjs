import postgres from "postgres";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env.local") });

const client = postgres(process.env.POSTGRES_URL, { max: 1 });

// Check what Ram vehicles exist
console.log("All Ram 2024 vehicles:");
const rams = await client`
  SELECT DISTINCT make, model, bolt_pattern 
  FROM vehicle_fitments 
  WHERE make ILIKE '%ram%' AND year = 2024
  LIMIT 10
`;
rams.forEach(row => console.log(`  ${row.make} ${row.model} -> ${row.bolt_pattern}`));
if (rams.length === 0) console.log("  (no 2024 Ram vehicles)");

// Check other years
console.log("\nRam vehicles any year:");
const ramsAll = await client`
  SELECT DISTINCT year, make, model, bolt_pattern 
  FROM vehicle_fitments 
  WHERE make ILIKE '%ram%'
  ORDER BY year DESC
  LIMIT 10
`;
ramsAll.forEach(row => console.log(`  ${row.year} ${row.make} ${row.model} -> ${row.bolt_pattern}`));

await client.end();
