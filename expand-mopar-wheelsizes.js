const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  console.log("=== EXPANDING WHEEL SIZES FOR CLASSIC MOPAR VEHICLES ===\n");
  
  // Standard aftermarket wheel sizes for classic Mopar 5x114.3 vehicles
  const classicMoparWheelSizes = [
    { diameter: 14, width: 6, offset: null, isStock: true, axle: "both" },
    { diameter: 15, width: 7, offset: 0, isStock: false, axle: "both" },
    { diameter: 15, width: 8, offset: 0, isStock: false, axle: "both" },
    { diameter: 16, width: 8, offset: 0, isStock: false, axle: "both" },
    { diameter: 17, width: 8, offset: 0, isStock: false, axle: "both" },
    { diameter: 17, width: 9, offset: 0, isStock: false, axle: "both" },
    { diameter: 18, width: 8.5, offset: 0, isStock: false, axle: "both" },
    { diameter: 18, width: 9.5, offset: 0, isStock: false, axle: "both" },
    { diameter: 20, width: 8.5, offset: 0, isStock: false, axle: "both" },
    { diameter: 20, width: 10, offset: 0, isStock: false, axle: "both" }
  ];
  
  // Mopar B-body and E-body vehicles with 5x114.3
  const moparModels = [
    { make: 'dodge', models: ['challenger', 'charger', 'coronet', 'super bee', 'demon'] },
    { make: 'plymouth', models: ['barracuda', 'road runner', 'road-runner', 'gtx', 'satellite', 'belvedere', 'fury', 'cuda', 'duster'] },
    { make: 'chrysler', models: ['fifth avenue', 'new yorker'] }
  ];
  
  let totalUpdated = 0;
  
  for (const group of moparModels) {
    for (const model of group.models) {
      const result = await client`
        UPDATE vehicle_fitments 
        SET oem_wheel_sizes = ${JSON.stringify(classicMoparWheelSizes)}::jsonb
        WHERE LOWER(make) = ${group.make}
        AND LOWER(model) = ${model}
        AND bolt_pattern = '5x114.3'
        AND year < 1985
        RETURNING year, modification_id
      `;
      if (result.length > 0) {
        console.log(`✅ ${group.make} ${model}: ${result.length} records updated`);
        totalUpdated += result.length;
      }
    }
  }
  
  console.log("\n=== SUMMARY ===");
  console.log("Total Mopar records with expanded wheel sizes:", totalUpdated);
  
  await client.end();
}

main().catch(console.error);