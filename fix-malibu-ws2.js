const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  // Update oem_wheel_sizes for all classic Malibus to include aftermarket width options
  const newWheelSizes = [
    { diameter: 14, width: 6, offset: null, isStock: true, axle: "both" },
    { diameter: 15, width: 7, offset: 0, isStock: false, axle: "both" },
    { diameter: 16, width: 8, offset: 0, isStock: false, axle: "both" },
    { diameter: 17, width: 8, offset: 0, isStock: false, axle: "both" },
    { diameter: 17, width: 9, offset: 0, isStock: false, axle: "both" },
    { diameter: 18, width: 8.5, offset: 0, isStock: false, axle: "both" },
    { diameter: 18, width: 9.5, offset: 0, isStock: false, axle: "both" }
  ];
  
  const result = await client`
    UPDATE vehicle_fitments 
    SET oem_wheel_sizes = ${JSON.stringify(newWheelSizes)}::jsonb
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