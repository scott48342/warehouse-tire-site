const postgres = require("postgres");

async function main() {
  const client = postgres("postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require");
  
  // Update oem_wheel_sizes for all classic Malibus to include aftermarket width options
  // OEM was 14x6, but aftermarket 15-18" wheels commonly run 7-9.5" wide
  const newWheelSizes = JSON.stringify([
    { diameter: 14, width: 6, offset: null, isStock: true, axle: "both" },
    { diameter: 15, width: 7, offset: 0, isStock: false, axle: "both" },
    { diameter: 16, width: 8, offset: 0, isStock: false, axle: "both" },
    { diameter: 17, width: 8, offset: 0, isStock: false, axle: "both" },
    { diameter: 17, width: 9, offset: 0, isStock: false, axle: "both" },
    { diameter: 18, width: 8.5, offset: 0, isStock: false, axle: "both" },
    { diameter: 18, width: 9.5, offset: 0, isStock: false, axle: "both" }
  ]);
  
  const result = await client`
    UPDATE vehicle_fitments 
    SET oem_wheel_sizes = \::jsonb
    WHERE LOWER(make) = 'chevrolet' 
    AND LOWER(model) = 'malibu'
    AND year BETWEEN 1964 AND 1972
    RETURNING year, modification_id
  `;
  
  console.log("Updated", result.length, "records with expanded wheel sizes");
  result.forEach(r => console.log("  " + r.year + ": " + r.modification_id));
  
  await client.end();
}

main().catch(console.error);