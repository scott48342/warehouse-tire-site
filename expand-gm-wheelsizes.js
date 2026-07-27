const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  console.log("=== EXPANDING WHEEL SIZES FOR CLASSIC GM VEHICLES ===\n");
  
  // Standard aftermarket wheel sizes for classic GM 5x120.65 vehicles
  const classicGMWheelSizes = [
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
  
  // List of classic GM vehicles that need expanded wheel sizes
  const classicGMModels = [
    { make: 'chevrolet', models: ['chevelle', 'nova', 'camaro', 'corvette', 'el camino', 'monte-carlo', 'caprice', '150', '210', 'bel air', 'nomad', 'deluxe', 's10', 's10 blazer', 'impala'] },
    { make: 'pontiac', models: ['firebird', 'gto', 'trans am', 'lemans', 'grand prix', 'grand-prix', 'bonneville', 'catalina'] },
    { make: 'oldsmobile', models: ['442', 'cutlass', 'cutlass supreme', 'toronado'] },
    { make: 'buick', models: ['gs', 'gsx', 'gran sport', 'grand national', 'skylark', 'regal', 'riviera'] },
    { make: 'gmc', models: ['jimmy', 's15'] }
  ];
  
  let totalUpdated = 0;
  
  for (const group of classicGMModels) {
    for (const model of group.models) {
      const result = await client`
        UPDATE vehicle_fitments 
        SET oem_wheel_sizes = ${JSON.stringify(classicGMWheelSizes)}::jsonb
        WHERE LOWER(make) = ${group.make}
        AND LOWER(model) = ${model}
        AND bolt_pattern = '5x120.65'
        AND year < 1990
        RETURNING year, modification_id
      `;
      if (result.length > 0) {
        console.log(`✅ ${group.make} ${model}: ${result.length} records updated`);
        totalUpdated += result.length;
      }
    }
  }
  
  console.log("\n=== SUMMARY ===");
  console.log("Total records with expanded wheel sizes:", totalUpdated);
  
  await client.end();
}

main().catch(console.error);