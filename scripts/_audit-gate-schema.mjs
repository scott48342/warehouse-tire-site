import pg from "pg";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const c = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await c.connect();

const cols = await c.query(
  `select column_name, data_type from information_schema.columns
   where table_name = 'vehicle_fitments' order by ordinal_position`
);
console.log("vehicle_fitments columns:");
console.log(cols.rows.map((r) => `  ${r.column_name} : ${r.data_type}`).join("\n"));

// Sample a couple rows to see oem tire size shape
const sample = await c.query(
  `select * from vehicle_fitments where year=2002 and make ilike 'chevrolet' and model ilike 'avalanche%' limit 3`
);
console.log("\nSample Avalanche rows:");
console.log(JSON.stringify(sample.rows, null, 2).slice(0, 2500));

await c.end();
